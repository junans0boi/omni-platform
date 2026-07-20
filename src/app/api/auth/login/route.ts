import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
    }

    const inputName = email.trim().toLowerCase();

    // Look up by username
    const profile = await prisma.profile.findUnique({
      where: { username: inputName },
    });

    if (!profile || profile.password !== password) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
    }

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
