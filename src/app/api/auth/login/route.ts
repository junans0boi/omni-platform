import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeProfileSelect } from "@/lib/auth";
import { hashPassword, verifyLegacyPassword, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { getAuthBackend } from "@/lib/auth-backend";
import { createSupabaseAuthClient, getSupabaseSessionProfile } from "@/lib/supabase-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as {
      email?: unknown;
      password?: unknown;
    };

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email ||
      !password ||
      password.length > 1_024
    ) {
      return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
    }

    const inputName = email.trim().toLowerCase();

    if (getAuthBackend() === "supabase") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputName)) {
        return NextResponse.json(
          { error: "Use the verified email address for this account" },
          { status: 400 },
        );
      }

      const supabase = await createSupabaseAuthClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: inputName,
        password,
      });
      if (error) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
      }

      const profile = await getSupabaseSessionProfile();
      if (!profile) {
        await supabase.auth.signOut();
        return NextResponse.json({ error: "Profile is not active" }, { status: 403 });
      }
      return NextResponse.json({ user: profile });
    }

    const profile = await prisma.profile.findFirst({
      where: { OR: [{ username: inputName }, { email: inputName }] },
      select: {
        ...safeProfileSelect,
        password: true,
        passwordHash: true,
      },
    });

    const passwordMatches = profile?.passwordHash
      ? await verifyPassword(password, profile.passwordHash)
      : profile?.password
        ? verifyLegacyPassword(password, profile.password)
        : false;

    if (!profile || !passwordMatches) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
    }

    if (!profile.passwordHash) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { passwordHash: await hashPassword(password), password: null },
      });
    }

    await createSession(profile.id);

    return NextResponse.json({
      user: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to log in" }, { status: 500 });
  }
}
