import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, safeProfileSelect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthBackend } from "@/lib/auth-backend";
import { updateSupabaseSessionProfile } from "@/lib/supabase-auth";
import { AVAILABILITY_VALUES, validateCustomStatus } from "@/lib/mentions";

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
    const { displayName, avatarUrl, availability, customStatus } = await req.json();
    const normalizedAvailability = availability === undefined
      ? undefined
      : AVAILABILITY_VALUES.includes(availability) ? availability : null;
    if (normalizedAvailability === null) {
      return NextResponse.json({ error: "Invalid availability" }, { status: 400 });
    }
    let normalizedStatus: string | null | undefined;
    try {
      normalizedStatus = customStatus === undefined ? undefined : validateCustomStatus(
        typeof customStatus === "string" ? customStatus : null,
      );
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid status" }, { status: 400 });
    }

    if (getAuthBackend() === "supabase") {
      const updated = await updateSupabaseSessionProfile({
        ...(displayName !== undefined && {
          displayName: typeof displayName === "string" ? displayName.trim() || null : null,
        }),
        ...(avatarUrl !== undefined && {
          avatarUrl: typeof avatarUrl === "string" ? avatarUrl || null : null,
        }),
        ...(normalizedAvailability !== undefined && { availability: normalizedAvailability }),
        ...(normalizedStatus !== undefined && { customStatus: normalizedStatus }),
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
        ...(normalizedAvailability !== undefined && { availability: normalizedAvailability }),
        ...(normalizedStatus !== undefined && { customStatus: normalizedStatus }),
      },
      select: safeProfileSelect,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
