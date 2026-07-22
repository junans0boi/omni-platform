"use client";

import React from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { Search, Send, UserPlus, Paperclip, Download, X } from "lucide-react";
import type { DirectMessageItem, Profile } from "@/hooks/useFriendsAndDms";

interface FriendsPanelProps {
  currentProfile: Profile | null;
  activeConversationId: string | null;
  activeDmProfile: Profile | null;
  dmMessages: DirectMessageItem[];
  dmInput: string;
  setDmInput: (value: string) => void;
  sendingDm: boolean;
  handleSendDm: (e: React.FormEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  searchUsername: string;
  setSearchUsername: (value: string) => void;
  addMsg: { type: "success" | "error"; text: string } | null;
  sendingRequest: boolean;
  handleSendFriendRequest: (e: React.FormEvent) => void;
  pendingFile?: File | null;
  filePreview?: string | null;
  handleSelectFile?: (file: File) => void;
  clearPendingFile?: () => void;
}

export function FriendsPanel({
  currentProfile,
  activeConversationId,
  activeDmProfile,
  dmMessages,
  dmInput,
  setDmInput,
  sendingDm,
  handleSendDm,
  messagesEndRef,
  searchUsername,
  setSearchUsername,
  addMsg,
  sendingRequest,
  handleSendFriendRequest,
  pendingFile,
  filePreview,
  handleSelectFile,
  clearPendingFile,
}: FriendsPanelProps) {
  const { t } = useI18n();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const renderContent = (content: string) => {
    const imgMatch = content.match(/!\[(.*?)\]\((.*?)\)/);
    const fileMatch = content.match(/📎 \[(.*?)\]\((.*?)\)/);
    const cleanText = content
      .replace(/!\[(.*?)\]\((.*?)\)/g, "")
      .replace(/📎 \[(.*?)\]\((.*?)\)/g, "")
      .trim();

    return (
      <div className="space-y-2">
        {cleanText && <p className="whitespace-pre-wrap leading-relaxed">{cleanText}</p>}
        {imgMatch && (
          <div className="mt-1">
            <img
              src={imgMatch[2]}
              alt={imgMatch[1] || "image"}
              className="max-w-xs max-h-64 rounded-xl object-cover border border-line shadow-sm cursor-pointer hover:opacity-95 transition"
              onClick={() => window.open(imgMatch[2], "_blank")}
            />
          </div>
        )}
        {fileMatch && (
          <a
            href={fileMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-2.5 rounded-xl border border-line bg-surface/50 p-2.5 text-xs font-semibold text-text hover:bg-surface-2 transition max-w-xs"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent shrink-0">
              <Paperclip className="h-4 w-4" />
            </div>
            <div className="flex-1 truncate">
              <span className="truncate block font-medium">{fileMatch[1]}</span>
              <span className="text-[10px] text-muted block">클릭하여 다운로드</span>
            </div>
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface text-text">
      {activeConversationId ? (
        <>
          {/* DM Header */}
          <div className="h-14 border-b border-line bg-surface px-6 flex items-center gap-3 shrink-0">
            <div className="h-8 w-8 rounded-full bg-accent-soft flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
              {activeDmProfile?.avatarUrl ? (
                <img src={activeDmProfile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                activeDmProfile?.username.slice(0, 2) || "??"
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-text">
                {activeDmProfile?.displayName || activeDmProfile?.username}
              </h4>
              <p className="text-[10px] text-muted">@{activeDmProfile?.username}</p>
            </div>
          </div>

          {/* DM Messages History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {dmMessages.length === 0 ? (
              <div className="py-20 text-center text-xs text-muted">
                대화가 시작되었습니다. 첫 메시지를 보내보세요!
              </div>
            ) : (
              Array.from(new Map(dmMessages.map((m) => [m.id, m])).values()).map((msg) => {
                const isMe = msg.profileId === currentProfile?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-lg ${isMe ? "ml-auto flex-row-reverse" : ""}`}
                  >
                    <div className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0">
                      {msg.profile?.avatarUrl ? (
                        <img src={msg.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        msg.profile?.username.slice(0, 2) || "??"
                      )}
                    </div>
                    <div>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm ${
                          isMe
                            ? "bg-accent text-on-accent rounded-tr-none shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                            : "bg-surface-2 text-text rounded-tl-none"
                        }`}
                      >
                        {renderContent(msg.content)}
                      </div>
                      <span className="text-[10px] text-muted mt-1 block text-right">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending File Banner */}
          {pendingFile && (
            <div className="px-4 py-2 bg-surface-2 border-t border-line flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 truncate">
                {filePreview ? (
                  <img src={filePreview} alt="" className="h-8 w-8 rounded object-cover border border-line" />
                ) : (
                  <Paperclip className="h-4 w-4 text-accent shrink-0" />
                )}
                <span className="truncate font-semibold">{pendingFile.name}</span>
                <span className="text-[10px] text-muted">({(pendingFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={clearPendingFile}
                className="p-1 rounded hover:bg-surface text-muted hover:text-text transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* DM Input Footer */}
          <form onSubmit={handleSendDm} className="p-4 border-t border-line bg-surface flex gap-2 shrink-0 items-center">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && handleSelectFile) handleSelectFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="파일/이미지 첨부"
              className="p-2.5 rounded-xl border border-line bg-surface text-muted hover:bg-surface-2 hover:text-text transition"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <input
              type="text"
              value={dmInput}
              onChange={(e) => setDmInput(e.target.value)}
              placeholder="1:1 메시지 전송..."
              className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text placeholder-muted outline-none transition focus:border-accent"
            />
            <button
              type="submit"
              disabled={sendingDm || (!dmInput.trim() && !pendingFile)}
              className="flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-on-accent shadow-lg shadow-[0_4px_12px_-2px_var(--accent)] transition hover:bg-accent-strong disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <div className="text-center text-muted">
            <p className="text-sm">대화할 친구를 선택하세요.</p>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <h3 className="text-sm font-bold flex items-center justify-center gap-2 text-muted">
              <UserPlus className="h-4 w-4 text-accent" />
              <span>{t("friends.add")}</span>
            </h3>

            {addMsg && (
              <div
                className={`rounded-xl border p-3 text-xs ${
                  addMsg.type === "success"
                    ? "border-online/30 bg-online/10 text-online"
                    : "border-danger/30 bg-danger/10 text-danger"
                }`}
              >
                {addMsg.text}
              </div>
            )}

            <form onSubmit={handleSendFriendRequest} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted" />
                <input
                  type="text"
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  placeholder={t("friends.searchPlaceholder")}
                  className="w-full rounded-2xl border border-line bg-surface pl-11 pr-4 py-3 text-sm text-text placeholder-muted outline-none transition focus:border-accent"
                />
              </div>

              <button
                type="submit"
                disabled={sendingRequest || !searchUsername.trim()}
                className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-on-accent shadow-lg shadow-[0_4px_12px_-2px_var(--accent)] transition hover:opacity-90 disabled:opacity-50"
              >
                {sendingRequest ? t("common.loading") : t("friends.sendRequest")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
