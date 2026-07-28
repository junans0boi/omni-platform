"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Pin, Image as ImageIcon, Bell, BellOff, X, FileText, Download } from "lucide-react";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  profile?: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export function ChannelHeaderExtras({
  messages,
  channelId,
}: {
  messages: Message[];
  channelId?: string;
}) {
  const [drawer, setDrawer] = useState<"pinned" | "media" | "summary" | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [serverPinnedMessages, setServerPinnedMessages] = useState<Message[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [summaries, setSummaries] = useState<any[]>([]);

  // Fetch summary history from API
  const fetchSummaries = useCallback(async () => {
    if (!channelId) return;
    try {
      const res = await fetch(`/api/channels/${channelId}/summary`);
      if (res.ok) {
        const data = await res.json();
        if (data.summaries) setSummaries(data.summaries);
      }
    } catch {}
  }, [channelId]);

  useEffect(() => {
    if (drawer === "summary") {
      fetchSummaries();
    }
  }, [drawer, fetchSummaries]);

  // Markdown file download helper (TICK-206)
  const handleDownloadMarkdown = (summaryItem: { title: string; summaryText: string }) => {
    const content = `# ${summaryItem.title}\n\n${summaryItem.summaryText}\n\n---\nExported from Omni Platform`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting_summary_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Fetch pinned messages from API if channelId exists
  const fetchPinnedMessages = useCallback(async () => {
    if (!channelId) return;
    try {
      const res = await fetch(`/api/channels/${channelId}/pins`);
      if (res.ok) {
        const data = await res.json();
        setServerPinnedMessages(data);
      }
    } catch {
      // fallback
    }
  }, [channelId]);

  useEffect(() => {
    if (drawer === "pinned") {
      fetchPinnedMessages();
    }
  }, [drawer, fetchPinnedMessages]);

  // Combine local tagged messages (#pin/📌 or isPinned) and server pinned messages
  const localPinned = messages.filter(
    (m) => m.isPinned || m.content.includes("#pin") || m.content.includes("📌")
  );
  
  const pinnedMessagesMap = new Map<string, Message>();
  serverPinnedMessages.forEach((m) => pinnedMessagesMap.set(m.id, m));
  localPinned.forEach((m) => pinnedMessagesMap.set(m.id, m));
  const pinnedMessages = Array.from(pinnedMessagesMap.values());

  // Extract images from messages (![alt](url))
  const mediaItems: { url: string; sender: string; date: string }[] = [];
  messages.forEach((m) => {
    const match = m.content.match(/!\[.*?\]\((.*?)\)/);
    if (match && match[1]) {
      mediaItems.push({
        url: match[1],
        sender: m.profile?.displayName || m.profile?.username || "Unknown",
        date: new Date(m.createdAt).toLocaleDateString(),
      });
    }
  });

  return (
    <div className="relative flex items-center gap-1">
      {/* Pin Drawer Button */}
      <button
        onClick={() => setDrawer(drawer === "pinned" ? null : "pinned")}
        title="핀 고정 메시지 모아보기"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          drawer === "pinned"
            ? "bg-idle/20 text-idle border border-idle/30"
            : "text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        <Pin className="h-4 w-4" />
      </button>

      {/* Media Gallery Button */}
      <button
        onClick={() => setDrawer(drawer === "media" ? null : "media")}
        title="미디어 & 파일 갤러리"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          drawer === "media"
            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
            : "text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        <ImageIcon className="h-4 w-4" />
      </button>

      {/* TICK-205: Summary Drawer Button */}
      <button
        onClick={() => setDrawer(drawer === "summary" ? null : "summary")}
        title="AI 회의록 요약 & 히스토리"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          drawer === "summary"
            ? "bg-accent/20 text-accent border border-accent/30"
            : "text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        <FileText className="h-4 w-4" />
      </button>

      {/* Channel Notification Mute Toggle */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        title={isMuted ? "채널 알림 켜기" : "채널 무음 (Mute)"}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          isMuted
            ? "bg-danger/20 text-danger border border-danger/30"
            : "text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </button>

      {/* Drawer Overlay */}
      {drawer && (
        <div className="absolute top-10 right-0 w-80 rounded-2xl border border-line bg-surface p-4 shadow-2xl backdrop-blur-2xl z-50 text-left animate-fadeIn">
          <div className="flex items-center justify-between border-b border-line pb-2.5 mb-3">
            <span className="text-xs font-bold text-text flex items-center gap-1.5">
              {drawer === "pinned" && <Pin className="h-3.5 w-3.5 text-idle" />}
              {drawer === "media" && <ImageIcon className="h-3.5 w-3.5 text-purple-400" />}
              {drawer === "summary" && <FileText className="h-3.5 w-3.5 text-accent" />}
              {drawer === "pinned" ? "고정된 메시지 (Pin)" : drawer === "media" ? "미디어 & 파일 갤러리" : "AI 회의록 요약"}
            </span>
            <button onClick={() => setDrawer(null)} className="text-muted hover:text-text text-xs">
              <X className="h-4 w-4" />
            </button>
          </div>

          {drawer === "pinned" && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {pinnedMessages.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  <p>고정된 메시지가 없습니다.</p>
                  <p className="text-[10px] text-muted mt-1">메시지에 #pin 태그 또는 📌 이모지를 포함해 보세요.</p>
                </div>
              ) : (
                pinnedMessages.map((pm) => (
                  <div key={pm.id} className="rounded-xl border border-line bg-surface p-3 text-xs shadow-sm hover:border-idle/40 transition">
                    <div className="flex items-center justify-between text-muted text-[10px] mb-1">
                      <span className="font-semibold text-idle">@{pm.profile?.displayName || pm.profile?.username || "유저"}</span>
                      <span>{new Date(pm.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-text text-xs whitespace-pre-wrap leading-relaxed">{pm.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {drawer === "media" && (
            <div className="max-h-64 overflow-y-auto pr-1">
              {mediaItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  공유된 미디어가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {mediaItems.map((item, idx) => (
                    <div key={idx} className="group relative rounded-xl overflow-hidden border border-line bg-surface aspect-square">
                      <img src={item.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2 transition text-[10px] text-white">
                        <span className="font-semibold truncate">{item.sender}</span>
                        <span className="text-[9px] text-muted">{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {drawer === "summary" && (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {summaries.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  생성된 요약 회의록이 없습니다.
                </div>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                summaries.map((sum: any) => (
                  <div key={sum.id} className="rounded-xl border border-line bg-surface p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text truncate max-w-[170px]">{sum.title}</span>
                      <button
                        onClick={() => handleDownloadMarkdown(sum)}
                        title="Markdown (.md) 내보내기"
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30 text-[10px] font-bold transition"
                      >
                        <Download className="h-3 w-3" />
                        <span>.md</span>
                      </button>
                    </div>
                    <p className="text-muted text-[11px] whitespace-pre-wrap leading-relaxed border-t border-line/50 pt-2">
                      {sum.summaryText}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
