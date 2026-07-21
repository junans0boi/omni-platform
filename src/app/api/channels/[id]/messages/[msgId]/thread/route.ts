import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { messageBroker } from "@/lib/events";
import { assertMessageReference } from "@/lib/message-threads";
import { prisma } from "@/lib/prisma";

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
};

async function authorize(channelId: string, profileId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, spaceId: true, type: true },
  });
  if (!channel) return { error: "Channel not found", status: 404 } as const;
  if (channel.type !== "TEXT") return { error: "Threads require a text channel", status: 400 } as const;
  const member = await prisma.member.findUnique({
    where: { spaceId_profileId: { spaceId: channel.spaceId, profileId } },
  });
  if (!member) return { error: "Forbidden", status: 403 } as const;
  return { channel } as const;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: channelId, msgId } = await params;
  const auth = await authorize(channelId, user.id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const root = await prisma.message.findUnique({
    where: { id: msgId },
    include: {
      profile: { select: profileSelect },
      replyTo: { select: { id: true, content: true, deletedAt: true, profile: { select: profileSelect } } },
    },
  });
  try {
    assertMessageReference(channelId, "", root);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid_thread_root" },
      { status: 404 }
    );
  }

  const replies = await prisma.message.findMany({
    where: { channelId, threadRootId: msgId },
    include: { profile: { select: profileSelect } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({ root, replies });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: channelId, msgId } = await params;
  const auth = await authorize(channelId, user.id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const payload: unknown = await req.json();
  const content = typeof payload === "object" && payload !== null && "content" in payload && typeof payload.content === "string"
    ? payload.content.trim()
    : "";
  if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const root = await prisma.message.findUnique({
    where: { id: msgId },
    select: { id: true, channelId: true, replyToId: true, threadRootId: true, deletedAt: true, content: true },
  });
  try {
    assertMessageReference(channelId, "", root);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid_thread_root" },
      { status: 400 }
    );
  }

  const reply = await prisma.message.create({
    data: {
      channelId,
      profileId: user.id,
      content,
      threadRootId: msgId,
      replyToId: msgId,
    },
    include: { profile: { select: profileSelect } },
  });
  messageBroker.emit(`message:${channelId}`, reply);
  const rootSummary = await prisma.message.findUniqueOrThrow({
    where: { id: msgId },
    include: {
      profile: { select: profileSelect },
      replyTo: { select: { id: true, content: true, deletedAt: true, profile: { select: profileSelect } } },
      reactions: true,
      _count: { select: { threadReplies: true } },
      threadReplies: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  messageBroker.emit(`message:${channelId}`, { ...rootSummary, _type: "UPDATE" });
  return NextResponse.json(reply, { status: 201 });
}
