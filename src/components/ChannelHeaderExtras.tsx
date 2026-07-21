"use client";

import React, { useState } from "react";
import { Pin, Image as ImageIcon, Bell, BellOff, X } from "lucide-react";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  profile?: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export function ChannelHeaderExtras({
  messages,
}: {
  messages: Message[];
}) {
  const [drawer, setDrawer] = useState<"pinned" | "media" | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Extract pinned messages (messages containing #pin or marked)
  const pinnedMessages = messages.filter((m) => m.content.includes("#pin") || m.content.includes("📌"));

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
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            : "text-zinc-400 hover:bg-white/10 hover:text-white"
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
            : "text-zinc-400 hover:bg-white/10 hover:text-white"
        }`}
      >
        <ImageIcon className="h-4 w-4" />
      </button>

      {/* Channel Notification Mute Toggle */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        title={isMuted ? "채널 알림 켜기" : "채널 무음 (Mute)"}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          isMuted
            ? "bg-red-500/20 text-red-400 border border-red-500/30"
            : "text-zinc-400 hover:bg-white/10 hover:text-white"
        }`}
      >
        {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </button>

      {/* Drawer Overlay */}
      {drawer && (
        <div className="absolute top-10 right-0 w-80 rounded-2xl border border-white/15 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-2xl z-50 text-left animate-fadeIn">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              {drawer === "pinned" ? <Pin className="h-3.5 w-3.5 text-amber-400" /> : <ImageIcon className="h-3.5 w-3.5 text-purple-400" />}
              {drawer === "pinned" ? "고정된 메시지 (#pin)" : "미디어 & 파일 갤러리"}
            </span>
            <button onClick={() => setDrawer(null)} className="text-zinc-500 hover:text-white text-xs">
              <X className="h-4 w-4" />
            </button>
          </div>

          {drawer === "pinned" && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {pinnedMessages.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  <p>고정된 메시지가 없습니다.</p>
                  <p className="text-[10px] text-zinc-600 mt-1">메시지에 #pin 태그 또는 📌 이모지를 포함해 보세요.</p>
                </div>
              ) : (
                pinnedMessages.map((pm) => (
                  <div key={pm.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                    <div className="flex items-center justify-between text-zinc-400 text-[10px] mb-1">
                      <span className="font-semibold text-amber-300">@{pm.profile?.username}</span>
                      <span>{new Date(pm.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-white text-xs whitespace-pre-wrap">{pm.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {drawer === "media" && (
            <div className="max-h-64 overflow-y-auto pr-1">
              {mediaItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  공유된 미디어가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {mediaItems.map((item, idx) => (
                    <div key={idx} className="group relative rounded-xl overflow-hidden border border-white/10 bg-white/5 aspect-square">
                      <img src={item.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2 transition text-[10px] text-white">
                        <span className="font-semibold truncate">{item.sender}</span>
                        <span className="text-[9px] text-zinc-400">{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
