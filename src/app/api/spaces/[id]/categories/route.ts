import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const member = await prisma.member.findUnique({
      where: { spaceId_profileId: { spaceId, profileId: user.id } },
    });

    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
