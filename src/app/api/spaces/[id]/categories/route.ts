import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

// POST /api/spaces/[id]/categories — Create a new category
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
    if (!(await can(user.id, spaceId, "MANAGE_CHANNELS"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const lastCat = await prisma.category.findFirst({
      where: { spaceId },
      orderBy: { position: "desc" },
    });

    const category = await prisma.category.create({
      data: {
        spaceId,
        name: name.trim(),
        position: (lastCat?.position ?? -1) + 1,
      },
    });

    return NextResponse.json(category);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
