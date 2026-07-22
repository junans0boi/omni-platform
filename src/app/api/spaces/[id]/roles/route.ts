import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

// GET /api/spaces/[id]/roles — Fetch all roles with permissions in a space
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
    const isMember = await prisma.member.findUnique({
      where: { spaceId_profileId: { spaceId, profileId: user.id } },
    });

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roles = await prisma.role.findMany({
      where: { spaceId },
      include: {
        permissions: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { position: "asc" },
    });

    return NextResponse.json(roles);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// POST /api/spaces/[id]/roles — Create custom role
export async function POST(
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
      where: { spaceId_profileId: { spaceId, profileId: user.id } },
    });

    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden: Admin or Owner required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, colorHex, permissions } = body as {
      name?: string;
      colorHex?: string;
      permissions?: string[];
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    const role = await prisma.role.create({
      data: {
        spaceId,
        name: name.trim(),
        colorHex: colorHex || "#808080",
        permissions: {
          create: (permissions || []).map((permission) => ({ permission })),
        },
      },
      include: {
        permissions: true,
      },
    });

    await createAuditLog({
      spaceId,
      actorId: user.id,
      actorName: user.displayName || user.username,
      action: "ROLE_CREATE",
      targetName: role.name,
      details: `Created role '${role.name}' with ${role.permissions.length} permissions`,
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
