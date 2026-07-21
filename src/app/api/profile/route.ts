import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, safeProfileSelect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthBackend } from "@/lib/auth-backend";
import { updateSupabaseSessionProfile } from "@/lib/supabase-auth";

// GET /api/profile — Get current user's profile
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(user);
}

// PATCH /api/profile — Update profile (displayName, avatarUrl)
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { displayName, avatarUrl } = await req.json();

    if (getAuthBackend() === "supabase") {
      const updated = await updateSupabaseSessionProfile({
        ...(displayName !== undefined && {
          displayName: typeof displayName === "string" ? displayName.trim() || null : null,
        }),
        ...(avatarUrl !== undefined && {
          avatarUrl: typeof avatarUrl === "string" ? avatarUrl || null : null,
        }),
      });
      if (!updated) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json(updated);
    }

    const updated = await prisma.profile.update({
      where: { id: user.id },
      data: {
        ...(displayName !== undefined && { displayName: displayName.trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
      },
      select: safeProfileSelect,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
