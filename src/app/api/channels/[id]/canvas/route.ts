import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Memory storage for canvas stroke data
const canvasStore: Record<string, unknown> = {};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;
  const data = canvasStore[channelId] || null;

  return NextResponse.json({ data });
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
    canvasStore[channelId] = body.data;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save canvas" }, { status: 500 });
  }
}
