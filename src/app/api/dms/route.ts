import { NextResponse } from "next/server";
import { getSessionUser, safeProfileSelect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participations = await prisma.directParticipant.findMany({
    where: { profileId: user.id },
    include: {
      conversation: {
        include: {
          friendship: { select: { id: true, status: true, blockedById: true } },
          participants: {
            where: { profileId: { not: user.id } },
            include: { profile: { select: safeProfileSelect } },
          },
          messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(participations.map(({ conversation }) => ({
    id: conversation.id,
    friendshipId: conversation.friendship.id,
    friendshipStatus: conversation.friendship.status,
    blockedByMe: conversation.friendship.blockedById === user.id,
    profile: conversation.participants[0]?.profile ?? null,
    lastMessage: conversation.messages[0] ?? null,
  })));
}
