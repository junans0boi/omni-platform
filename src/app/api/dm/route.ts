import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, safeProfileSelect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await prisma.directConversation.findMany({
    where: {
      participants: {
        some: { profileId: user.id },
      },
    },
    include: {
      participants: {
        include: {
          profile: { select: safeProfileSelect },
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          profile: { select: safeProfileSelect },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = await Promise.all(
    conversations.map(async (conv) => {
      const myParticipant = conv.participants.find((p) => p.profileId === user.id);
      const otherParticipant = conv.participants.find((p) => p.profileId !== user.id);
      const lastReadAt = myParticipant?.lastReadAt || new Date(0);

      const unreadCount = await prisma.directMessage.count({
        where: {
          conversationId: conv.id,
          profileId: { not: user.id },
          createdAt: { gt: lastReadAt },
        },
      });

      return {
        id: conv.id,
        updatedAt: conv.createdAt,
        otherProfile: otherParticipant?.profile || null,
        lastMessage: conv.messages[0] || null,
        unreadCount,
      };
    })
  );

  return NextResponse.json(formatted);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { targetProfileId } = body as { targetProfileId?: string };

  if (!targetProfileId) {
    return NextResponse.json({ error: "targetProfileId is required" }, { status: 400 });
  }

  // 1. Find or create friendship between user and targetProfileId
  const profileAId = user.id < targetProfileId ? user.id : targetProfileId;
  const profileBId = user.id < targetProfileId ? targetProfileId : user.id;

  let friendship = await prisma.friendship.findUnique({
    where: { profileAId_profileBId: { profileAId, profileBId } },
  });

  if (!friendship) {
    friendship = await prisma.friendship.create({
      data: {
        profileAId,
        profileBId,
        requestedById: user.id,
        status: "ACCEPTED",
      },
    });
  }

  // 2. Find or create DirectConversation for this friendship
  let conversation = await prisma.directConversation.findUnique({
    where: { friendshipId: friendship.id },
    include: {
      participants: {
        include: {
          profile: { select: safeProfileSelect },
        },
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.directConversation.create({
      data: {
        friendshipId: friendship.id,
        participants: {
          create: [{ profileId: profileAId }, { profileId: profileBId }],
        },
      },
      include: {
        participants: {
          include: {
            profile: { select: safeProfileSelect },
          },
        },
      },
    });
  }

  const otherParticipant = conversation.participants.find((p) => p.profileId !== user.id);

  return NextResponse.json({
    id: conversation.id,
    updatedAt: conversation.createdAt,
    otherProfile: otherParticipant?.profile || null,
  });
}
