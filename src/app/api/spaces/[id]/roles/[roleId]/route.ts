import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

// PATCH /api/spaces/[id]/roles/[roleId] — Update role (name, colorHex, permissions)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: spaceId, roleId } = await params;

  try {
    const member = await prisma.member.findUnique({
      where: { spaceId_profileId: { spaceId, profileId: user.id } },
    });

    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, colorHex, permissions } = body as {
      name?: string;
      colorHex?: string;
      permissions?: string[];
    };

    // If permissions array is provided, delete existing and recreate
    if (permissions && Array.isArray(permissions)) {
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId,
          permission,
        })),
      });
    }

    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(name !== undefined && name.trim() ? { name: name.trim() } : {}),
        ...(colorHex !== undefined ? { colorHex } : {}),
      },
      include: {
        permissions: true,
      },
    });

    await createAuditLog({
      spaceId,
      actorId: user.id,
      actorName: user.displayName || user.username,
      action: "ROLE_UPDATE",
      targetName: updatedRole.name,
      details: `Updated role '${updatedRole.name}'`,
    });

    return NextResponse.json(updatedRole);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// DELETE /api/spaces/[id]/roles/[roleId] — Delete custom role
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: spaceId, roleId } = await params;

  try {
    const member = await prisma.member.findUnique({
      where: { spaceId_profileId: { spaceId, profileId: user.id } },
    });

    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    await prisma.role.delete({ where: { id: roleId } });

    await createAuditLog({
      spaceId,
      actorId: user.id,
      actorName: user.displayName || user.username,
      action: "ROLE_DELETE",
      targetName: role.name,
      details: `Deleted role '${role.name}'`,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
