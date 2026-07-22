import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayRoles } from "@/lib/role-appearance-server";

// GET: fetch space details (categories, channels, members)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: spaceId } = await params;

  try {
    // Verify membership with membershipRoles for channel override checking
    const isMember = await prisma.member.findUnique({
      where: {
        spaceId_profileId: {
          spaceId,
          profileId: user.id,
        },
      },
      include: {
        membershipRoles: { select: { roleId: true } },
      },
    });

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const categories = await prisma.category.findMany({
      where: { spaceId },
      orderBy: { position: "asc" },
    });

    const rawChannels = await prisma.channel.findMany({
      where: { spaceId },
      include: { overrides: true },
      orderBy: { position: "asc" },
    });

    const memberRoleIds = isMember.membershipRoles.map((mr) => mr.roleId);

    // Filter private channels: OWNER can see all, ADMIN/MEMBER only if in overrides
    const channels = rawChannels.filter((ch) => {
      if (!ch.isPrivate) return true;
      if (isMember.role === "OWNER") return true;
      if (!ch.overrides || ch.overrides.length === 0) return false;
      return ch.overrides.some(
        (o) => (o.profileId && o.profileId === user.id) || (o.roleId && memberRoleIds.includes(o.roleId))
      );
    });

    const members = await prisma.member.findMany({
      where: { spaceId },
      include: {
        membershipRoles: { include: { role: true } },
        profile: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            availability: true,
            customStatus: true,
            createdAt: true,
          },
        },
      },
    });
    const displayRoles = await getDisplayRoles(spaceId, members.map((member) => member.profileId));

    return NextResponse.json({
      categories,
      channels,
      members: members.map((member) => ({
        ...member,
        profile: { ...member.profile, displayRole: displayRoles.get(member.profileId) },
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// DELETE: Soft delete a space
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: spaceId } = await params;

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.space.update({
      where: { id: spaceId },
      data: {
        archivedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// PATCH: Update space profile (name, avatarUrl)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: spaceId } = await params;

  try {
    const member = await prisma.member.findUnique({
      where: {
        spaceId_profileId: {
          spaceId,
          profileId: user.id,
        },
      },
    });

    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden: Owner or Admin permissions required" }, { status: 403 });
    }

    const { name, avatarUrl } = await req.json();

    const updatedSpace = await prisma.space.update({
      where: { id: spaceId },
      data: {
        ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
      },
    });

    // Notify all space members in real-time
    const { messageBroker } = await import("@/lib/events");
    const spaceMembers = await prisma.member.findMany({
      where: { spaceId },
      select: { profileId: true },
    });

    for (const m of spaceMembers) {
      messageBroker.emit(`user:${m.profileId}`, {
        type: "space:updated",
        spaceId,
        space: updatedSpace,
      });
    }

    return NextResponse.json(updatedSpace);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
