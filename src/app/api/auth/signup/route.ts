import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeProfileSelect } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { getAuthBackend } from "@/lib/auth-backend";
import { createSupabaseAuthClient, getSupabaseSessionProfile } from "@/lib/supabase-auth";

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

    if (getAuthBackend() === "supabase") {
      const supabase = await createSupabaseAuthClient();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name:
              typeof display_name === "string" && display_name.trim()
                ? display_name.trim()
                : cleanUsername,
          },
        },
      });

      if (error || !data.user) {
        return NextResponse.json({ error: "Unable to create account" }, { status: 400 });
      }

      if (!data.session) {
        return NextResponse.json({ verificationRequired: true }, { status: 202 });
      }

      const profile = await getSupabaseSessionProfile();
      if (!profile) {
        await supabase.auth.signOut();
        return NextResponse.json({ error: "Profile is not active" }, { status: 403 });
      }
      return NextResponse.json({ user: profile });
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
