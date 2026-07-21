import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageBroker } from "@/lib/events";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId, msgId } = await params;

  try {
    const { emoji } = await req.json();
    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
    }

    const message = await prisma.message.findUnique({
      where: { id: msgId },
      include: {
        channel: true,
      },
    });

    if (!message || message.channelId !== channelId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check membership
    const member = await prisma.member.findUnique({
      where: {
        spaceId_profileId: {
          spaceId: message.channel.spaceId,
          profileId: user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Toggle logic
    const existing = await prisma.reaction.findUnique({
      where: {
        messageId_profileId_emoji: {
          messageId: msgId,
          profileId: user.id,
          emoji,
        },
      },
    });

    if (existing) {
      await prisma.reaction.delete({
        where: { id: existing.id },
      });
    } else {
      await prisma.reaction.create({
        data: {
          messageId: msgId,
          profileId: user.id,
          emoji,
        },
      });
    }

    // Fetch the updated message with reactions to broadcast
    const updatedMessage = await prisma.message.findUnique({
      where: { id: msgId },
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

    // Broadcast update
    messageBroker.emit(`message:${channelId}`, { ...updatedMessage, _type: "UPDATE" });

    return NextResponse.json(updatedMessage);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
