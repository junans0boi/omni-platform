import { afterEach, describe, expect, it, vi } from "vitest";
import { GroqNotConfiguredError, summarizeTranscript } from "../../src/lib/groq-summary";

describe("summarizeTranscript", () => {
  const originalKey = process.env.GROQ_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  });

  it("throws GroqNotConfiguredError when no API key is set", async () => {
    delete process.env.GROQ_API_KEY;
    await expect(summarizeTranscript([{ speakerName: "A", text: "hi" }])).rejects.toBeInstanceOf(
      GroqNotConfiguredError,
    );
  });

  it("sends the transcript as speaker-prefixed lines and returns Groq's summary", async () => {
    process.env.GROQ_API_KEY = "test-key";
    let sentBody: any;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sentBody = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "## 요약\n테스트 요약" } }] }),
          { status: 200 },
        );
      }),
    );

    const result = await summarizeTranscript([
      { speakerName: "Alice", text: "안건 하나 논의합시다" },
      { speakerName: "Bob", text: "동의합니다" },
    ]);

    expect(result).toBe("## 요약\n테스트 요약");
    expect(sentBody.messages[1].content).toBe("Alice: 안건 하나 논의합시다\nBob: 동의합니다");
  });

  it("throws with the response body when Groq returns a non-2xx status", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 })),
    );

    await expect(summarizeTranscript([{ speakerName: "A", text: "hi" }])).rejects.toThrow(
      /429/,
    );
  });
});
