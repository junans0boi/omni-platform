import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canFromSnapshot, getAuthority, validatePermissionGrant } from "@/lib/rbac";

async function assignmentContext(profileId: string, spaceId: string, memberId: string, roleId: string) {
  const [authority, target, role] = await Promise.all([
    getAuthority(profileId, spaceId),
    prisma.member.findFirst({ where: { id: memberId, spaceId } }),
    prisma.role.findFirst({ where: { id: roleId, spaceId }, include: { permissions: true } }),
  ]);
  return { authority, target, role };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: spaceId, memberId } = await params;
  const { roleId } = (await request.json()) as { roleId?: string };
  if (!roleId) return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  const { authority, target, role } = await assignmentContext(user.id, spaceId, memberId, roleId);
  if (!target || !role) return NextResponse.json({ error: "Member or role not found" }, { status: 404 });
  if (!authority || !canFromSnapshot(authority, "MANAGE_ROLES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (authority.membershipId === memberId || target.role === "OWNER") {
    return NextResponse.json({ error: "Self-escalation and OWNER mutation are forbidden" }, { status: 403 });
  }
  const grant = validatePermissionGrant(authority, role.permissions.map(({ permission }) => permission));
  if (!grant.ok) return NextResponse.json({ error: grant.reason }, { status: 403 });

  await prisma.membershipRole.upsert({
    where: { memberId_roleId: { memberId, roleId } },
    create: { memberId, roleId },
    update: {},
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: spaceId, memberId } = await params;
  const roleId = new URL(request.url).searchParams.get("roleId");
  if (!roleId) return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  const { authority, target, role } = await assignmentContext(user.id, spaceId, memberId, roleId);
  if (!target || !role) return NextResponse.json({ error: "Member or role not found" }, { status: 404 });
  if (!authority || !canFromSnapshot(authority, "MANAGE_ROLES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (authority.membershipId === memberId || target.role === "OWNER") {
    return NextResponse.json({ error: "Self-escalation and OWNER mutation are forbidden" }, { status: 403 });
  }
  const grant = validatePermissionGrant(authority, role.permissions.map(({ permission }) => permission));
  if (!grant.ok) return NextResponse.json({ error: grant.reason }, { status: 403 });
  await prisma.membershipRole.deleteMany({ where: { memberId, roleId } });
  return NextResponse.json({ success: true });
}
