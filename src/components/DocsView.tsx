"use client";

import React, { useState, useEffect } from "react";
import { FileText, Save, Check } from "lucide-react";

export function DocsView({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [content, setContent] = useState<string>(
    `# 📝 ${channelName} 실시간 공유 문서\n\n이 문서 공간은 실시간으로 협업 편집이 가능합니다.\n\n- [x] 프로젝트 명세 작성\n- [ ] 실시간 캔버스 화이트보드 공유\n- [ ] 마크다운 문서 내보내기`
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Fetch initial doc content
    fetch(`/api/channels/${channelId}/doc`)
      .then((res) => res.json())
      .then((data) => {
        if (data.content) setContent(data.content);
      })
      .catch(() => {});
  }, [channelId]);

  const handleSave = async () => {
    try {
      await fetch(`/api/channels/${channelId}/doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-surface p-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          <h2 className="text-sm font-bold text-text">{channelName} - Docs 에디터</h2>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-on-accent text-xs font-bold shadow-md hover:bg-accent-strong transition"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          <span>{saved ? "저장됨" : "저장하기"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Editor Area */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full p-4 rounded-2xl border border-line bg-surface-2 text-text text-xs leading-relaxed outline-none resize-none font-mono focus:border-accent transition"
          placeholder="마크다운 문서를 입력하세요..."
        />

        {/* Live Preview Area */}
        <div className="w-full h-full p-4 rounded-2xl border border-line bg-surface overflow-y-auto text-xs text-text leading-relaxed whitespace-pre-wrap font-sans">
          {content}
        </div>
      </div>
    </div>
  );
}
