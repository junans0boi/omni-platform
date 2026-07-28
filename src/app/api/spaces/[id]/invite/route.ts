import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: spaceId } = await params;

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true, name: true, inviteCode: true },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    return NextResponse.json({
      inviteCode: space.inviteCode,
      inviteUrl: `${req.nextUrl.origin}/join/${space.inviteCode}`,
      expiresAt: null, // 영구 초대 코드
    });
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

  const { id: spaceId } = await params;

  try {
    // 새 초대 코드 재생성
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const updated = await prisma.space.update({
      where: { id: spaceId },
      data: { inviteCode: newCode },
      select: { inviteCode: true },
    });

    return NextResponse.json({
      inviteCode: updated.inviteCode,
      inviteUrl: `${req.nextUrl.origin}/join/${updated.inviteCode}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to regenerate invite code" }, { status: 500 });
  }
}
