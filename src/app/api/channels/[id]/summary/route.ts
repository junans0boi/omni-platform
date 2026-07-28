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
    // 음성/수업 채널 회의록 및 요약 히스토리 조회
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true, type: true },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Mock summary data if no summary DB exists yet
    const summaries = [
      {
        id: "sum_1",
        channelId,
        title: `${channel.name} 실시간 회의록 & AI 요약`,
        createdAt: new Date().toISOString(),
        summaryText: "1. 음성채널 실시간 STT 세션 완료\n2. 주요 안건: 모바일 UX 개편 및 음성 발언권 제어 연동\n3. Gemini 2.5 Flash를 통한 회의록 자동 요약 완료",
        transcripts: [
          { speaker: "User A", text: "음성 채널 모드별 UI 구분을 완료했습니다." },
          { speaker: "User B", text: "DataChannel 연동으로 발언권도 제어할 수 있습니다." }
        ]
      }
    ];

    return NextResponse.json({ summaries });
  } catch (error) {
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
    const { transcript } = body;

    // AI 요약 생성 시뮬레이션
    const summaryText = `[AI 요약 완료]\n- 파싱 텍스트 길이: ${transcript?.length || 0}자\n- 주요 내용: 음성 세션 요약 및 작업 목록 갱신 완료.`;

    return NextResponse.json({
      success: true,
      summary: {
        id: `sum_${Date.now()}`,
        channelId,
        summaryText,
        createdAt: new Date().toISOString(),
      }
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
