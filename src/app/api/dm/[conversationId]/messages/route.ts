import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, safeProfileSelect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageBroker } from "@/lib/events";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  // Check participation
  const participant = await prisma.directParticipant.findUnique({
    where: {
      conversationId_profileId: {
        conversationId,
        profileId: user.id,
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.directMessage.findMany({
    where: { conversationId },
    include: {
      profile: { select: safeProfileSelect },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  // Check participation
  const participant = await prisma.directParticipant.findUnique({
    where: {
      conversationId_profileId: {
        conversationId,
        profileId: user.id,
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { content } = body as { content?: string };

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const message = await prisma.directMessage.create({
    data: {
      conversationId,
      profileId: user.id,
      content: content.trim(),
    },
    include: {
      profile: { select: safeProfileSelect },
    },
  });

  messageBroker.emit(`direct-message:${conversationId}`, message);

  const recipients = await prisma.directParticipant.findMany({
    where: { conversationId, profileId: { not: user.id } },
  });
  for (const recipient of recipients) {
    messageBroker.emit(`user:${recipient.profileId}`, {
      type: "dm:new",
      conversationId,
      message,
    });
  }

  return NextResponse.json(message, { status: 201 });
}
