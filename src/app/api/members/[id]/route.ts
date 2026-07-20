import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/members/[id] — Change member role (Owner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memberId } = await params;

  try {
    const target = await prisma.member.findUnique({ where: { id: memberId } });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const requester = await prisma.member.findUnique({
      where: { spaceId_profileId: { spaceId: target.spaceId, profileId: user.id } },
    });

    if (!requester || requester.role !== "OWNER") {
      return NextResponse.json({ error: "Only the OWNER can change roles" }, { status: 403 });
    }

    const { role } = await req.json();
    if (!["ADMIN", "MEMBER"].includes(role)) {
      return NextResponse.json({ error: "Role must be ADMIN or MEMBER" }, { status: 400 });
    }

    // Cannot demote the owner themselves
    if (target.profileId === user.id) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: { role },
      include: {
        profile: { select: { id: true, username: true, displayName: true, avatarUrl: true, createdAt: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/members/[id] — Kick a member (Admin/Owner) or leave space (self)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memberId } = await params;

  try {
    const target = await prisma.member.findUnique({ where: { id: memberId } });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const requester = await prisma.member.findUnique({
      where: { spaceId_profileId: { spaceId: target.spaceId, profileId: user.id } },
    });

    const isSelf = target.profileId === user.id;
    const isAdminOrOwner = requester && ["ADMIN", "OWNER"].includes(requester.role);

    if (!isSelf && !isAdminOrOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot kick the owner
    if (!isSelf && target.role === "OWNER") {
      return NextResponse.json({ error: "Cannot kick the space owner" }, { status: 400 });
    }

    await prisma.member.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
