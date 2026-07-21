import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageBroker } from "@/lib/events";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId, msgId } = await params;

  try {
    const { content } = await req.json();
    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
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

    if (message.profileId !== user.id) {
      return NextResponse.json({ error: "Forbidden (You can only edit your own messages)" }, { status: 403 });
    }

    const updated = await prisma.message.update({
      where: { id: msgId },
      data: {
        content,
        editedAt: new Date(),
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
    messageBroker.emit(`message:${channelId}`, { ...updated, _type: "UPDATE" });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId, msgId } = await params;

  try {
    const message = await prisma.message.findUnique({
      where: { id: msgId },
      include: {
        channel: true,
      },
    });

    if (!message || message.channelId !== channelId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

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

    const isOwnerOrAdmin = ["OWNER", "ADMIN"].includes(member.role);
    const isMessageAuthor = message.profileId === user.id;

    if (!isOwnerOrAdmin && !isMessageAuthor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.message.delete({
      where: { id: msgId },
    });

    // Notify listeners via Event Broker
    messageBroker.emit(`message:${channelId}`, { id: msgId, _type: "DELETE" });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
