import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

// POST /api/spaces/[id]/channels — Create a new channel
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

    const { name, type, categoryId } = await req.json();
    if (!name || !type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 });
    }

    const channelType = (type as string).toUpperCase();
    if (!["TEXT", "VOICE", "STAGE"].includes(channelType)) {
      return NextResponse.json({ error: "Invalid channel type" }, { status: 400 });
    }

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, spaceId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ error: "Category does not belong to this space" }, { status: 400 });
      }
    }

    // Get highest position in category
    const lastChannel = await prisma.channel.findFirst({
      where: { spaceId, categoryId: categoryId || null },
      orderBy: { position: "desc" },
    });

    const channel = await prisma.channel.create({
      data: {
        spaceId,
        categoryId: categoryId || null,
        name: name.trim(),
        type: channelType,
        position: (lastChannel?.position ?? -1) + 1,
      },
    });

    return NextResponse.json(channel);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
