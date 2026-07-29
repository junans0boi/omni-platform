import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GroqNotConfiguredError, summarizeTranscript } from "@/lib/groq-summary";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  const summaries = await prisma.meetingSummary.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ summaries });
}

/**
 * Summarizes and clears the channel's currently accumulated transcript
 * (see /api/channels/[id]/transcript) via Groq. Called automatically when a
 * user leaves a voice channel, and manually via the "AI 회의록 생성" button —
 * both read the same real transcript, no client-supplied text is trusted.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, name: true },
  });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const entries = await prisma.transcriptEntry.findMany({
    where: { channelId },
    orderBy: { createdAt: "asc" },
  });

  if (entries.length === 0) {
    return NextResponse.json({ success: false, reason: "no_transcript" }, { status: 200 });
  }

  let summaryText: string;
  try {
    summaryText = await summarizeTranscript(entries);
  } catch (error) {
    if (error instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Groq summary generation failed:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 502 });
  }

  const summary = await prisma.$transaction(async (tx) => {
    const created = await tx.meetingSummary.create({
      data: {
        channelId,
        title: `${channel.name} 회의록 — ${new Date().toLocaleString("ko-KR")}`,
        summaryText,
      },
    });
    await tx.transcriptEntry.deleteMany({ where: { channelId } });
    return created;
  });

  return NextResponse.json({ success: true, summary }, { status: 201 });
}
