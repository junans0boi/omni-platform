import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canFromSnapshot,
  getAuthority,
  validatePermissionGrant,
} from "@/lib/rbac";
import { validateRoleAppearance } from "@/lib/role-appearance";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: spaceId } = await params;
  const authority = await getAuthority(user.id, spaceId);
  if (!authority) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [roles, members] = await Promise.all([
    prisma.role.findMany({
      where: { spaceId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        permissions: { select: { permission: true } },
        memberships: { select: { memberId: true } },
      },
    }),
    prisma.member.findMany({
      where: { spaceId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        profileId: true,
        role: true,
        profile: { select: { username: true, displayName: true } },
        membershipRoles: { select: { roleId: true } },
      },
    }),
  ]);

  return NextResponse.json({
    canManageRoles: canFromSnapshot(authority, "MANAGE_ROLES"),
    currentMembershipId: authority.membershipId,
    permissions: authority.membershipRole === "OWNER" ? "ALL" : authority.permissions,
    roles,
    members,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: spaceId } = await params;
  const authority = await getAuthority(user.id, spaceId);
  if (!authority || !canFromSnapshot(authority, "MANAGE_ROLES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload: unknown = await request.json();
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { name, permissions, position, colorHex, badgeKey } = payload as {
    name?: unknown;
    permissions?: unknown;
    position?: unknown;
    colorHex?: unknown;
    badgeKey?: unknown;
  };
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedPosition = position === undefined ? 0 : position;
  const normalizedColor = typeof colorHex === "string" && colorHex ? colorHex.toUpperCase() : null;
  const normalizedBadge = typeof badgeKey === "string" && badgeKey ? badgeKey : null;
  if (
    !normalizedName || normalizedName.length > 50 || !Array.isArray(permissions) ||
    !Number.isInteger(normalizedPosition) || !validateRoleAppearance(normalizedColor, normalizedBadge)
  ) {
    return NextResponse.json({ error: "Name and permissions are required" }, { status: 400 });
  }
  const grant = validatePermissionGrant(authority, permissions.filter((item): item is string => typeof item === "string"));
  if (!grant.ok || grant.permissions.length !== permissions.length) {
    return NextResponse.json({ error: grant.ok ? "Invalid permission" : grant.reason }, { status: 403 });
  }

  try {
    const role = await prisma.role.create({
      data: {
        spaceId,
        name: normalizedName,
        position: normalizedPosition as number,
        colorHex: normalizedColor,
        badgeKey: normalizedBadge,
        permissions: { create: grant.permissions.map((permission) => ({ permission })) },
      },
      include: { permissions: true, memberships: true },
    });
    return NextResponse.json(role, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create role" }, { status: 500 });
  }
}
