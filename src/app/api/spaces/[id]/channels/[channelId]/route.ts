import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

// PATCH /api/spaces/[id]/channels/[channelId] — Update channel
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: spaceId, channelId } = await params;

  try {
    if (!(await can(user.id, spaceId, "MANAGE_CHANNELS"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, mode } = await req.json();

    const channel = await prisma.channel.findFirst({
      where: { id: channelId, spaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(name && typeof name === "string" ? { name: name.trim() } : {}),
        ...(mode && typeof mode === "string" ? { mode: mode.toUpperCase() } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/spaces/[id]/channels/[channelId] — Delete channel
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: spaceId, channelId } = await params;

  try {
    if (!(await can(user.id, spaceId, "MANAGE_CHANNELS"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const channel = await prisma.channel.findFirst({
      where: { id: channelId, spaceId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await prisma.channel.delete({
      where: { id: channelId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
