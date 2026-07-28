import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  try {
    const pinnedMessages = await prisma.message.findMany({
      where: { channelId, isPinned: true },
      include: {
        profile: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(pinnedMessages);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  try {
    const body = await req.json();
    const { messageId, isPinned } = body;

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    const updated = await prisma.message.update({
      where: { id: messageId, channelId },
      data: { isPinned: typeof isPinned === "boolean" ? isPinned : true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to pin message" }, { status: 500 });
  }
}
