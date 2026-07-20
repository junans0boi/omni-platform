import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { email, password, username, display_name } = await req.json();

    if (!password || !username) {
      return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    const existing = await prisma.profile.findUnique({
      where: { username: cleanUsername },
    });

    if (existing) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 400 });
    }

    const profile = await prisma.profile.create({
      data: {
        username: cleanUsername,
        displayName: display_name || cleanUsername,
        password: password, // Plain text for local dev simplicity
      },
    });

    const cookieStore = await cookies();
    cookieStore.set("session_user_id", profile.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return NextResponse.json({ user: profile });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
