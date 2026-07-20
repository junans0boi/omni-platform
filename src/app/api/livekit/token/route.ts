import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const username = req.nextUrl.searchParams.get("username");

  if (!room || !username) {
    return NextResponse.json(
      { error: "Missing room or username parameters" },
      { status: 400 }
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit server credentials are not configured" },
      { status: 500 }
    );
  }

  // 1. Initialize Supabase Server client using Next.js 15 async cookies
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can be ignored if middleware handles session refreshes
          }
        },
      },
    }
  );

  // 2. Validate current auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Fetch channel information to get space_id and type
  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("space_id, type")
    .eq("id", room)
    .single();

  if (channelError || !channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // 4. Verify user membership in the space
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("role")
    .eq("space_id", channel.space_id)
    .eq("profile_id", user.id)
    .single();

  if (memberError || !member) {
    return NextResponse.json(
      { error: "Forbidden: You are not a member of this space" },
      { status: 403 }
    );
  }

  try {
    // 5. Determine publishing permissions based on roles & stage channel type
    const isStage = channel.type === "STAGE";
    const canPublish = !isStage || member.role === "ADMIN" || member.role === "OWNER";

    // 6. Generate LiveKit token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
    });

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    const tokenJwt = await at.toJwt();
    return NextResponse.json({ token: tokenJwt });
  } catch (error) {
    console.error("Error generating LiveKit token:", error);
    return NextResponse.json(
      { error: "Failed to generate access token" },
      { status: 500 }
    );
  }
}
