import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;

  try {
    const updated = await prisma.directParticipant.updateMany({
      where: {
        conversationId,
        profileId: user.id,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, count: updated.count, conversationId });
  } catch (error: unknown) {
    console.error("Failed to mark DM as read:", error);
    return NextResponse.json({ error: "Failed to mark DM as read" }, { status: 500 });
  }
}
