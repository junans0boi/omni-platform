import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/spaces/[id]/audit-logs — Fetch audit logs for a space
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
    const member = await prisma.member.findUnique({
      where: { spaceId_profileId: { spaceId, profileId: user.id } },
    });

    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden: Admin or Owner required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const actionFilter = searchParams.get("action");

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        spaceId,
        ...(actionFilter ? { action: actionFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(auditLogs);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
