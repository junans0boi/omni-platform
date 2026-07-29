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

  const transcripts = await prisma.transcriptEntry.findMany({
    where: { channelId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ transcripts });
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
    const speaker = typeof body.speaker === "string" ? body.speaker.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const entry = await prisma.transcriptEntry.create({
      data: { channelId, speakerName: speaker || "Unknown", text },
    });

    return NextResponse.json({ success: true, entry });
  } catch {
    return NextResponse.json({ error: "Failed to store transcript" }, { status: 500 });
  }
}
