import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, safeProfileSelect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canonicalProfilePair, directMessagingError } from "@/lib/direct-messaging";
import { messageBroker } from "@/lib/events";

const friendshipInclude = {
  profileA: { select: safeProfileSelect },
  profileB: { select: safeProfileSelect },
  conversation: { select: { id: true } },
} as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ profileAId: user.id }, { profileBId: user.id }] },
    include: friendshipInclude,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(friendships.map((friendship) => ({
    id: friendship.id,
    status: friendship.status,
    direction: friendship.requestedById === user.id ? "outgoing" : "incoming",
    blockedByMe: friendship.blockedById === user.id,
    conversationId: friendship.conversation?.id ?? null,
    profile: friendship.profileAId === user.id ? friendship.profileB : friendship.profileA,
    updatedAt: friendship.updatedAt,
  })));
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { username?: unknown };
    if (typeof body.username !== "string" || !body.username.trim()) {
      return NextResponse.json({ error: "username_required" }, { status: 400 });
    }
    const target = await prisma.profile.findUnique({
      where: { username: body.username.trim().toLowerCase() },
      select: safeProfileSelect,
    });
    if (!target) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });

    const pair = canonicalProfilePair(user.id, target.id);
    const existing = await prisma.friendship.findUnique({
      where: { profileAId_profileBId: pair },
    });
    if (existing?.status === "BLOCKED") {
      return NextResponse.json({ error: "friendship_blocked" }, { status: 403 });
    }
    if (existing?.status === "PENDING" || existing?.status === "ACCEPTED") {
      return NextResponse.json({ error: "duplicate_friend_request" }, { status: 409 });
    }

    const friendship = existing
      ? await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: "PENDING", requestedById: user.id, blockedById: null },
          include: friendshipInclude,
        })
      : await prisma.friendship.create({
          data: { ...pair, requestedById: user.id },
          include: friendshipInclude,
        });

    messageBroker.emit(`user:${target.id}`, {
      type: "friend-request:new",
      friendship: {
        id: friendship.id,
        status: friendship.status,
        direction: friendship.requestedById === target.id ? "outgoing" : "incoming",
        blockedByMe: friendship.blockedById === target.id,
        conversationId: friendship.conversation?.id ?? null,
        profile: friendship.profileAId === target.id ? friendship.profileB : friendship.profileA,
        updatedAt: friendship.updatedAt,
      },
    });

    return NextResponse.json(friendship, { status: 201 });
  } catch (error) {
    const response = directMessagingError(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
