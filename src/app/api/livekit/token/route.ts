import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");

  if (!room) {
    return NextResponse.json(
      { error: "Missing room parameter" },
      { status: 400 }
    );
  }

  // 1. Validate current session user from local auth cookie
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  // Support both LIVEKIT_URL and NEXT_PUBLIC_LIVEKIT_URL naming conventions
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit server credentials are not configured" },
      { status: 500 }
    );
  }

  try {
    // 2. Fetch channel information to get space_id and type
    const channel = await prisma.channel.findUnique({
      where: { id: room },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel.type === "TEXT") {
      return NextResponse.json(
        { error: "Text channels do not support LiveKit sessions" },
        { status: 400 }
      );
    }

    // 3. Verify user membership in the space
    const member = await prisma.member.findUnique({
      where: {
        spaceId_profileId: {
          spaceId: channel.spaceId,
          profileId: user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this space" },
        { status: 403 }
      );
    }

    // 4. Determine publishing permissions based on roles & stage channel type
    const isStage = channel.type === "STAGE";
    const canPublish = !isStage || await can(user.id, channel.spaceId, "CONTROL_VOICE");

    // 5. Generate LiveKit token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: user.displayName || user.username,
      ttl: "15m",
    });

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    const tokenJwt = await at.toJwt();
    return NextResponse.json({ token: tokenJwt, canPublish });
  } catch (error) {
    console.error("Error generating LiveKit token:", error);
    return NextResponse.json(
      { error: "Failed to generate access token" },
      { status: 500 }
    );
  }
}
