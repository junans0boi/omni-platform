const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("GROQ_API_KEY is not configured in environment variables");
    this.name = "GroqNotConfiguredError";
  }
}

/**
 * Summarizes a voice-channel transcript into Korean meeting notes via Groq's
 * OpenAI-compatible chat completions API. Throws GroqNotConfiguredError if
 * no key is set, or a plain Error with Groq's message on API failure.
 */
export async function summarizeTranscript(
  entries: { speakerName: string; text: string }[],
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const transcriptText = entries.map((e) => `${e.speakerName}: ${e.text}`).join("\n");

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "당신은 회의/음성 채널 대화록을 요약하는 비서입니다. 주어진 대화 자막을 한국어로 " +
            "간결하게 정리하세요. 반드시 다음 세 섹션으로 나눠 마크다운으로 작성하세요: " +
            "## 요약, ## 주요 안건, ## 액션 아이템. 대화가 너무 짧거나 실질적 내용이 없으면 " +
            "그 사실을 있는 그대로 요약에 적으세요.",
        },
        { role: "user", content: transcriptText },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const summaryText = data?.choices?.[0]?.message?.content;
  if (typeof summaryText !== "string" || !summaryText.trim()) {
    throw new Error("Groq API returned an empty summary");
  }
  return summaryText.trim();
}
