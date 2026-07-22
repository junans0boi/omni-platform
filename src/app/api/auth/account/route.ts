import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, safeProfileSelect } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

// PATCH /api/auth/account — Update username, email, phone, or password
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { username, email, phone, currentPassword, newPassword } = await req.json();

    const dataToUpdate: Record<string, unknown> = {};

    if (username && typeof username === "string") {
      const formatted = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (formatted.length < 2) {
        return NextResponse.json({ error: "Invalid username format" }, { status: 400 });
      }
      dataToUpdate.username = formatted;
    }

    if (email && typeof email === "string") {
      dataToUpdate.email = email.trim().toLowerCase();
    }

    if (phone && typeof phone === "string") {
      dataToUpdate.phone = phone.trim();
    }

    if (newPassword && typeof newPassword === "string") {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required to set new password" }, { status: 400 });
      }

      const dbUser = await prisma.profile.findUnique({
        where: { id: user.id },
      });

      if (!dbUser || !dbUser.passwordHash) {
        return NextResponse.json({ error: "Invalid credential state" }, { status: 400 });
      }

      const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "Current password does not match" }, { status: 400 });
      }

      dataToUpdate.passwordHash = await hashPassword(newPassword);
    }

    const updatedProfile = await prisma.profile.update({
      where: { id: user.id },
      data: dataToUpdate,
      select: safeProfileSelect,
    });

    return NextResponse.json({ success: true, user: updatedProfile });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
