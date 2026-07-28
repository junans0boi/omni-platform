import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Memory & session transcripts store
const transcriptStore: Record<string, { speaker: string; text: string; timestamp: string }[]> = {};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;
  const list = transcriptStore[channelId] || [];

  return NextResponse.json({ transcripts: list });
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
    const { speaker, text } = body;

    if (!transcriptStore[channelId]) {
      transcriptStore[channelId] = [];
    }

    if (text && text.trim()) {
      transcriptStore[channelId].push({
        speaker: speaker || "Unknown",
        text: text.trim(),
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, count: transcriptStore[channelId].length });
  } catch {
    return NextResponse.json({ error: "Failed to store transcript" }, { status: 500 });
  }
}
