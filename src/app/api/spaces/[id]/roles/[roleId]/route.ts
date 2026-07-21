import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canFromSnapshot, getAuthority, validatePermissionGrant } from "@/lib/rbac";
import { validateRoleAppearance } from "@/lib/role-appearance";

async function context(profileId: string, spaceId: string, roleId: string) {
  const [authority, role] = await Promise.all([
    getAuthority(profileId, spaceId),
    prisma.role.findFirst({ where: { id: roleId, spaceId }, include: { permissions: true } }),
  ]);
  return { authority, role };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: spaceId, roleId } = await params;
  const { authority, role } = await context(user.id, spaceId, roleId);
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (!authority || !canFromSnapshot(authority, "MANAGE_ROLES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (authority.membershipRole !== "OWNER" && authority.roleIds.includes(roleId)) {
    return NextResponse.json({ error: "Cannot mutate a role assigned to yourself" }, { status: 403 });
  }

  const payload: unknown = await request.json();
  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const body = payload as {
    name?: unknown;
    permissions?: unknown;
    position?: unknown;
    colorHex?: unknown;
    badgeKey?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : role.name;
  const requested = body.permissions ?? role.permissions.map(({ permission }) => permission);
  const position = body.position === undefined ? role.position : body.position;
  const colorHex = body.colorHex === undefined
    ? role.colorHex
    : typeof body.colorHex === "string" && body.colorHex ? body.colorHex.toUpperCase() : null;
  const badgeKey = body.badgeKey === undefined
    ? role.badgeKey
    : typeof body.badgeKey === "string" && body.badgeKey ? body.badgeKey : null;
  if (
    !name || name.length > 50 || !Array.isArray(requested) || !Number.isInteger(position) ||
    !validateRoleAppearance(colorHex, badgeKey)
  ) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const grant = validatePermissionGrant(authority, requested.filter((item): item is string => typeof item === "string"));
  if (!grant.ok || grant.permissions.length !== requested.length) {
    return NextResponse.json({ error: grant.ok ? "Invalid permission" : grant.reason }, { status: 403 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      return tx.role.update({
        where: { id: roleId },
        data: {
          name,
          position: position as number,
          colorHex,
          badgeKey,
          permissions: { create: grant.permissions.map((permission) => ({ permission })) },
        },
        include: { permissions: true, memberships: true },
      });
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to update role" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: spaceId, roleId } = await params;
  const { authority, role } = await context(user.id, spaceId, roleId);
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (!authority || !canFromSnapshot(authority, "MANAGE_ROLES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (authority.membershipRole !== "OWNER" && authority.roleIds.includes(roleId)) {
    return NextResponse.json({ error: "Cannot remove a role assigned to yourself" }, { status: 403 });
  }
  await prisma.role.delete({ where: { id: roleId } });
  return NextResponse.json({ success: true });
}
