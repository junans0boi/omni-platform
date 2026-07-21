import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresenceSnapshot, messageBroker } from "@/lib/events";
import {
  clampMessagePageLimit,
  decodeMessageCursor,
  encodeMessageCursor,
} from "@/lib/message-pagination";
import { assertMessageReference } from "@/lib/message-threads";
import { getDisplayRoles } from "@/lib/role-appearance-server";
import { resolveMentionRecipients, type MentionDraft } from "@/lib/mentions";
import { can } from "@/lib/rbac";

const messageInclude = {
  profile: {
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      deletedAt: true,
      profile: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  },
  reactions: {
    include: {
      profile: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { threadReplies: true } },
  mentions: { include: { recipients: { select: { profileId: true } } } },
  threadReplies: {
    select: { createdAt: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

// GET: fetch messages for the channel
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId } = await params;

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Verify space membership
    const isMember = await prisma.member.findUnique({
      where: {
        spaceId_profileId: {
          spaceId: channel.spaceId,
          profileId: user.id,
        },
      },
    });

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = clampMessagePageLimit(req.nextUrl.searchParams.get("limit"));
    const cursorValue = req.nextUrl.searchParams.get("before");
    let cursor: ReturnType<typeof decodeMessageCursor> | null = null;
    if (cursorValue) {
      try {
        cursor = decodeMessageCursor(cursorValue);
      } catch {
        return NextResponse.json({ error: "Invalid message cursor" }, { status: 400 });
      }
    }

    const messages = await prisma.message.findMany({
      where: {
        channelId,
        threadRootId: null,
        ...(cursor ? {
          OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ],
        } : {}),
      },
      include: messageInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = messages.slice(0, limit).reverse();
    const displayRoles = await getDisplayRoles(channel.spaceId, items.map((message) => message.profileId));
    const decoratedItems = items.map((message) => ({
      ...message,
      profile: { ...message.profile, displayRole: displayRoles.get(message.profileId) },
    }));
    const oldest = items[0];
    return NextResponse.json({
      items: decoratedItems,
      nextCursor: hasMore && oldest
        ? encodeMessageCursor({ id: oldest.id, createdAt: oldest.createdAt.toISOString() })
        : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: send a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId } = await params;

  try {
    const payload: unknown = await req.json();
    const content = typeof payload === "object" && payload !== null && "content" in payload && typeof payload.content === "string"
      ? payload.content.trim()
      : "";
    const replyToId = typeof payload === "object" && payload !== null && "replyToId" in payload && typeof payload.replyToId === "string"
      ? payload.replyToId
      : null;
    const rawMentions = typeof payload === "object" && payload !== null && "mentions" in payload && Array.isArray(payload.mentions)
      ? payload.mentions
      : [];
    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const isMember = await prisma.member.findUnique({
      where: {
        spaceId_profileId: {
          spaceId: channel.spaceId,
          profileId: user.id,
        },
      },
    });

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const mentionDrafts: MentionDraft[] = [];
    for (const value of rawMentions) {
      if (!value || typeof value !== "object" || !("kind" in value) ||
        !["PROFILE", "EVERYONE", "HERE"].includes(String(value.kind))) {
        return NextResponse.json({ error: "Invalid mention" }, { status: 400 });
      }
      mentionDrafts.push({
        kind: value.kind as MentionDraft["kind"],
        ...(value.kind === "PROFILE" && "profileId" in value && typeof value.profileId === "string"
          ? { profileId: value.profileId }
          : {}),
      });
    }
    const spaceMembers = await prisma.member.findMany({
      where: { spaceId: channel.spaceId },
      select: { profileId: true },
    });
    const presence = getPresenceSnapshot(channel.spaceId);
    const globalAllowed = mentionDrafts.some((draft) => draft.kind !== "PROFILE")
      ? await can(user.id, channel.spaceId, "MENTION_EVERYONE")
      : false;
    let resolvedMentions: Array<MentionDraft & { recipientIds: string[] }>;
    try {
      resolvedMentions = mentionDrafts.map((draft) => ({
        ...draft,
        recipientIds: resolveMentionRecipients(
          draft,
          spaceMembers.map((member) => ({ profileId: member.profileId, online: Boolean(presence[member.profileId]) })),
          globalAllowed,
        ),
      }));
    } catch (error) {
      const forbidden = error instanceof Error && error.message === "Global mention permission required";
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid mention" }, { status: forbidden ? 403 : 400 });
    }

    if (replyToId) {
      const target = await prisma.message.findUnique({
        where: { id: replyToId },
        select: { id: true, channelId: true, replyToId: true, threadRootId: true, deletedAt: true, content: true },
      });
      try {
        assertMessageReference(channelId, "", target);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "invalid_message_reference" },
          { status: 400 }
        );
      }
    }

    const message = await prisma.message.create({
      data: {
        channelId,
        profileId: user.id,
        content,
        replyToId,
        mentions: {
          create: resolvedMentions.map((mention) => ({
            kind: mention.kind,
            targetProfileId: mention.kind === "PROFILE" ? mention.profileId : null,
            recipients: { create: mention.recipientIds.map((profileId) => ({ profileId })) },
          })),
        },
      },
      include: messageInclude,
    });

    // Notify listeners via Event Broker
    messageBroker.emit(`message:${channelId}`, message);

    return NextResponse.json(message);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
