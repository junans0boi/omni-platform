import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { decideFriendshipTransition, directMessagingError, type FriendshipAction } from "@/lib/direct-messaging";
import { prisma } from "@/lib/prisma";
import { messageBroker } from "@/lib/events";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = (await req.json()) as { action?: unknown };
    if (!(["accept", "decline", "block", "unblock"] as unknown[]).includes(body.action)) {
      return NextResponse.json({ error: "invalid_friendship_action" }, { status: 400 });
    }
    const friendship = await prisma.friendship.findUnique({ where: { id } });
    if (!friendship) return NextResponse.json({ error: "friendship_not_found" }, { status: 404 });
    const next = decideFriendshipTransition(friendship, user.id, body.action as FriendshipAction);

    const result = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.friendship.update({ where: { id }, data: next });
      if (next.status !== "ACCEPTED") return { friendship: updated, conversationId: null };

      const conversation = await transaction.directConversation.upsert({
        where: { friendshipId: id },
        update: {},
        create: { friendshipId: id },
      });
      await Promise.all([
        transaction.directParticipant.upsert({
          where: { conversationId_profileId: { conversationId: conversation.id, profileId: friendship.profileAId } },
          update: {},
          create: { conversationId: conversation.id, profileId: friendship.profileAId },
        }),
        transaction.directParticipant.upsert({
          where: { conversationId_profileId: { conversationId: conversation.id, profileId: friendship.profileBId } },
          update: {},
          create: { conversationId: conversation.id, profileId: friendship.profileBId },
        }),
      ]);
      return { friendship: updated, conversationId: conversation.id };
    });

    const otherPartyId =
      friendship.profileAId === user.id ? friendship.profileBId : friendship.profileAId;
    messageBroker.emit(`user:${otherPartyId}`, {
      type: "friend-request:updated",
      friendshipId: id,
      status: result.friendship.status,
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = directMessagingError(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) return NextResponse.json({ error: "friendship_not_found" }, { status: 404 });
  if (user.id !== friendship.profileAId && user.id !== friendship.profileBId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (friendship.status === "BLOCKED" && friendship.blockedById !== user.id) {
    return NextResponse.json({ error: "friendship_blocked" }, { status: 403 });
  }
  await prisma.friendship.update({
    where: { id },
    data: { status: "REMOVED", blockedById: null },
  });
  return NextResponse.json({ success: true });
}
