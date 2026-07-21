import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageBroker } from "@/lib/events";
import {
  clampMessagePageLimit,
  decodeMessageCursor,
  encodeMessageCursor,
} from "@/lib/message-pagination";

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
        ...(cursor ? {
          OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ],
        } : {}),
      },
      include: {
        profile: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        reactions: {
          include: {
            profile: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = messages.slice(0, limit).reverse();
    const oldest = items[0];
    return NextResponse.json({
      items,
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
    const { content } = await req.json();
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

    const message = await prisma.message.create({
      data: {
        channelId,
        profileId: user.id,
        content,
      },
      include: {
        profile: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        reactions: true,
      },
    });

    // Notify listeners via Event Broker
    messageBroker.emit(`message:${channelId}`, message);

    return NextResponse.json(message);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
