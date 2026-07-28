import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Memory storage for docs channel content
const docsStore: Record<string, string> = {};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;
  const content = docsStore[channelId] || "";

  return NextResponse.json({ content });
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
    const { content } = body;
    docsStore[channelId] = content || "";

    return NextResponse.json({ success: true, content: docsStore[channelId] });
  } catch {
    return NextResponse.json({ error: "Failed to save doc" }, { status: 500 });
  }
}
