import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, safeProfileSelect } from "@/lib/auth";
import { mayReadDirectHistory, maySendDirectMessage } from "@/lib/direct-messaging";
import { messageBroker } from "@/lib/events";
import { prisma } from "@/lib/prisma";

async function getConversation(id: string) {
  return prisma.directConversation.findUnique({
    where: { id },
    include: {
      friendship: { select: { status: true } },
      participants: { select: { profileId: true } },
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  const participantIds = conversation.participants.map(({ profileId }) => profileId);
  if (!mayReadDirectHistory(user.id, participantIds)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 50, 1), 100);
  const messages = await prisma.directMessage.findMany({
    where: { conversationId: id },
    include: { profile: { select: safeProfileSelect } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return NextResponse.json(messages.reverse());
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  const participantIds = conversation.participants.map(({ profileId }) => profileId);
  if (!mayReadDirectHistory(user.id, participantIds)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!maySendDirectMessage(user.id, participantIds, conversation.friendship.status)) {
    return NextResponse.json({ error: "friendship_not_accepted" }, { status: 409 });
  }
  const body = (await req.json()) as { content?: unknown };
  if (typeof body.content !== "string" || !body.content.trim() || body.content.length > 4_000) {
    return NextResponse.json({ error: "content_required" }, { status: 400 });
  }
  const message = await prisma.directMessage.create({
    data: { conversationId: id, profileId: user.id, content: body.content.trim() },
    include: { profile: { select: safeProfileSelect } },
  });
  messageBroker.emit(`direct-message:${id}`, message);
  return NextResponse.json(message, { status: 201 });
}
