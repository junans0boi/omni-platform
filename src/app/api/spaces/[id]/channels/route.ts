import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const member = await prisma.member.findUnique({
      where: { spaceId_profileId: { spaceId, profileId: user.id } },
    });

    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
