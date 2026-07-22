"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Edit2, Send, Trash2, X } from "lucide-react";
import type { Message } from "@/store/useAppStore";
import { DELETED_MESSAGE_PREVIEW } from "@/lib/message-threads";
import { useI18n } from "@/i18n/I18nProvider";

type ThreadPayload = { root: Message; replies: Message[] };

function body(message: Message) {
  return message.deletedAt ? DELETED_MESSAGE_PREVIEW : message.content;
}

export function ThreadPanel({
  channelId,
  rootId,
  currentProfileId,
  onClose,
}: {
  channelId: string;
  rootId: string;
  currentProfileId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/channels/${channelId}/messages/${rootId}/thread`, { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json()).error || "Failed to load thread");
    setThread(await response.json());
  }, [channelId, rootId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Failed to load thread"));
    });
    const events = new EventSource(`/api/channels/${channelId}/messages/stream`);
    events.onmessage = () => void load();
    events.onopen = () => void load();
    return () => {
      window.cancelAnimationFrame(frame);
      events.close();
    };
  }, [channelId, load]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    const response = await fetch(`/api/channels/${channelId}/messages/${rootId}/thread`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    setSending(false);
    if (!response.ok) {
      setError((await response.json()).error || "Failed to reply");
      return;
    }
    setContent("");
    setError(null);
    await load();
  };

  const save = async (messageId: string) => {
    const response = await fetch(`/api/channels/${channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editingContent.trim() }),
    });
    if (!response.ok) {
      setError((await response.json()).error || "Failed to edit reply");
      return;
    }
    setEditingId(null);
    await load();
  };

  const remove = async (messageId: string) => {
    const response = await fetch(`/api/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });
    if (!response.ok) {
      setError((await response.json()).error || "Failed to delete reply");
      return;
    }
    await load();
  };

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-black/50" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="thread-panel-title"
        className="flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex h-14 items-center border-b border-line px-4">
          <h2 id="thread-panel-title" className="flex-1 font-bold">{t("thread.title")}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
          {!thread ? <p className="text-sm text-muted">{t("common.loading")}</p> : (
            <>
              <article className="mb-4 border-b border-line pb-4" data-testid="thread-root">
                <p className="text-sm font-bold">{thread.root.profile?.displayName || thread.root.profile?.username}</p>
                <p className={`mt-1 whitespace-pre-wrap text-sm ${thread.root.deletedAt ? "italic text-muted" : "text-text"}`}>{body(thread.root)}</p>
              </article>
              <p className="mb-2 text-xs font-semibold text-muted">{thread.replies.length} replies</p>
              <div className="space-y-3">
                {thread.replies.map((reply) => (
                  <article key={reply.id} data-testid="thread-reply" className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{reply.profile?.displayName || reply.profile?.username}</span>
                      <time className="text-[10px] text-muted">{new Date(reply.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                      {!reply.deletedAt && reply.profileId === currentProfileId && (
                        <span className="ml-auto flex gap-1">
                          <button type="button" aria-label={t("thread.editReply")} onClick={() => { setEditingId(reply.id); setEditingContent(reply.content); }} className="rounded p-1 text-muted hover:bg-surface-2"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label={t("thread.deleteReply")} onClick={() => void remove(reply.id)} className="rounded p-1 text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" /></button>
                        </span>
                      )}
                    </div>
                    {editingId === reply.id ? (
                      <input autoFocus aria-label="Edit thread reply content" value={editingContent} onChange={(event) => setEditingContent(event.target.value)} onKeyDown={(event) => {
                        if (event.key === "Enter" && editingContent.trim()) void save(reply.id);
                        if (event.key === "Escape") setEditingId(null);
                      }} className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-hidden" />
                    ) : <p className={`mt-1 whitespace-pre-wrap text-sm ${reply.deletedAt ? "italic text-muted" : "text-text"}`}>{body(reply)}</p>}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
        <form onSubmit={send} className="border-t border-line p-4">
          {error && <p role="alert" className="mb-2 text-xs text-danger">{error}</p>}
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
            <input aria-label={t("thread.replyPlaceholder")} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t("thread.replyPlaceholder")} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-hidden" />
            <button type="submit" aria-label={t("thread.sendReply")} disabled={!content.trim() || sending} className="rounded-lg bg-accent text-on-accent p-2 disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </div>
        </form>
      </aside>
    </div>
  );
}
