import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: list spaces user is a member of
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const memberSpaces = await prisma.member.findMany({
      where: {
        profileId: user.id,
      },
      select: {
        spaceId: true,
      },
    });

    const spaceIds = memberSpaces.map((ms) => ms.spaceId);

    const spaces = await prisma.space.findMany({
      where: {
        id: { in: spaceIds },
        archivedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(spaces);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: create a new space and default templates
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, avatar_url } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create space
    const space = await prisma.space.create({
      data: {
        name,
        avatarUrl: avatar_url || null,
        inviteCode,
        ownerId: user.id,
      },
    });

    // Create default category
    const category = await prisma.category.create({
      data: {
        spaceId: space.id,
        name: "기본",
        position: 0,
      },
    });

    // Create default text channel
    await prisma.channel.create({
      data: {
        spaceId: space.id,
        categoryId: category.id,
        name: "일반",
        type: "TEXT",
        position: 0,
      },
    });

    // Create default voice channel
    await prisma.channel.create({
      data: {
        spaceId: space.id,
        categoryId: category.id,
        name: "로비",
        type: "VOICE",
        position: 1,
      },
    });

    // Add owner as a member
    await prisma.member.create({
      data: {
        spaceId: space.id,
        profileId: user.id,
        role: "OWNER",
      },
    });

    return NextResponse.json(space);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: Join a space via invite code
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { invite_code } = await req.json();
    if (!invite_code) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const space = await prisma.space.findFirst({
      where: {
        inviteCode: invite_code.trim().toUpperCase(),
        archivedAt: null,
      },
    });

    if (!space) {
      return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 404 });
    }

    // Add as member (upsert/ignore duplicates)
    const existingMember = await prisma.member.findUnique({
      where: {
        spaceId_profileId: {
          spaceId: space.id,
          profileId: user.id,
        },
      },
    });

    if (!existingMember) {
      await prisma.member.create({
        data: {
          spaceId: space.id,
          profileId: user.id,
          role: "MEMBER",
        },
      });
    }

    return NextResponse.json({ success: true, spaceId: space.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
