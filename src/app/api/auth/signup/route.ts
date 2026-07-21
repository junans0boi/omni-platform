import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeProfileSelect } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password, username, display_name } = (await req.json()) as {
      email?: unknown;
      password?: unknown;
      username?: unknown;
      display_name?: unknown;
    };

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof username !== "string" ||
      !email ||
      !password ||
      !username
    ) {
      return NextResponse.json({ error: "Missing email, username, or password" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const cleanEmail = email.trim().toLowerCase();

    if (
      !cleanUsername ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      password.length < 8 ||
      password.length > 1_024
    ) {
      return NextResponse.json(
        { error: "Use a valid email, username, and a password between 8 and 1024 characters" },
        { status: 400 },
      );
    }

    const existing = await prisma.profile.findFirst({
      where: { OR: [{ username: cleanUsername }, { email: cleanEmail }] },
    });

    if (existing) {
      return NextResponse.json({ error: "Username or email is already registered" }, { status: 400 });
    }

    const profile = await prisma.profile.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        displayName:
          typeof display_name === "string" && display_name.trim()
            ? display_name.trim()
            : cleanUsername,
        passwordHash: await hashPassword(password),
        password: null,
      },
      select: safeProfileSelect,
    });

    await createSession(profile.id);

    return NextResponse.json({ user: profile });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }
}
