"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, MessageCircle, Send, ShieldBan, UserPlus, Users, X } from "lucide-react";

interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface FriendshipView {
  id: string;
  status: string;
  direction: "incoming" | "outgoing";
  blockedByMe: boolean;
  conversationId: string | null;
  profile: PublicProfile;
}

interface ConversationView {
  id: string;
  friendshipId: string;
  friendshipStatus: string;
  blockedByMe: boolean;
  profile: PublicProfile;
}

interface DirectMessageView {
  id: string;
  profileId: string;
  content: string;
  createdAt: string;
  profile: PublicProfile;
}

async function readError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : `request_failed_${response.status}`;
}

export default function HomePage() {
  const router = useRouter();
  const [friendships, setFriendships] = useState<FriendshipView[]>([]);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessageView[]>([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [friendsResponse, conversationsResponse] = await Promise.all([
      fetch("/api/friends", { cache: "no-store" }),
      fetch("/api/dms", { cache: "no-store" }),
    ]);
    if (friendsResponse.status === 401 || conversationsResponse.status === 401) {
      router.replace("/login");
      return;
    }
    if (!friendsResponse.ok || !conversationsResponse.ok) throw new Error("home_load_failed");
    const nextFriends = await friendsResponse.json() as FriendshipView[];
    const nextConversations = await conversationsResponse.json() as ConversationView[];
    setFriendships(nextFriends);
    setConversations(nextConversations);
    setActiveConversationId((current) => current ?? nextConversations[0]?.id ?? null);
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "home_load_failed"));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  useEffect(() => {
    if (!activeConversationId) return;
    fetch(`/api/dms/${activeConversationId}/messages`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        setMessages(await response.json() as DirectMessageView[]);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "messages_load_failed"));
  }, [activeConversationId]);

  const requestFriend = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (!response.ok) { setError(await readError(response)); return; }
    setUsername("");
    await refresh();
  };

  const changeFriendship = async (id: string, action: "accept" | "decline" | "block" | "unblock") => {
    setError(null);
    const response = await fetch(`/api/friends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) { setError(await readError(response)); return; }
    await refresh();
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeConversationId || !message.trim()) return;
    setError(null);
    const response = await fetch(`/api/dms/${activeConversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    if (!response.ok) { setError(await readError(response)); return; }
    const created = await response.json() as DirectMessageView;
    setMessages((current) => [...current, created]);
    setMessage("");
  };

  const activeConversation = conversations.find(({ id }) => id === activeConversationId);
  const incoming = friendships.filter(({ status, direction }) => status === "PENDING" && direction === "incoming");

  return (
    <main className="flex min-h-screen bg-bg text-text">
      <aside className="flex w-80 shrink-0 flex-col border-r border-line bg-surface">
        <header className="flex h-14 items-center gap-3 border-b border-line px-4">
          <Link href="/dashboard" aria-label="Back to Spaces" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"><ArrowLeft className="h-4 w-4" /></Link>
          <h1 className="font-bold">Home</h1>
        </header>
        <form onSubmit={requestFriend} className="flex gap-2 border-b border-line p-3">
          <label className="sr-only" htmlFor="friend-username">Friend username</label>
          <input id="friend-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Add by username" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-hidden focus:border-accent" />
          <button aria-label="Send friend request" className="rounded-lg bg-accent p-2 text-on-accent hover:bg-accent-strong"><UserPlus className="h-4 w-4" /></button>
        </form>
        {incoming.length > 0 && <section aria-label="Incoming friend requests" className="border-b border-line p-3">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Requests</h2>
          {incoming.map((friendship) => <div key={friendship.id} className="flex items-center gap-2 py-1 text-sm">
            <span className="min-w-0 flex-1 truncate">@{friendship.profile.username}</span>
            <button aria-label={`Accept ${friendship.profile.username}`} onClick={() => changeFriendship(friendship.id, "accept")} className="rounded p-1 text-online hover:bg-online/10"><Check className="h-4 w-4" /></button>
            <button aria-label={`Decline ${friendship.profile.username}`} onClick={() => changeFriendship(friendship.id, "decline")} className="rounded p-1 text-danger hover:bg-danger/10"><X className="h-4 w-4" /></button>
          </div>)}
        </section>}
        <nav aria-label="Direct conversations" className="flex-1 overflow-y-auto p-2">
          <h2 className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted">Direct messages</h2>
          {conversations.map((conversation) => <button key={conversation.id} onClick={() => setActiveConversationId(conversation.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${activeConversationId === conversation.id ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2"}`}>
            <MessageCircle className="h-4 w-4" /><span className="truncate">{conversation.profile?.displayName || conversation.profile?.username}</span>
          </button>)}
          {!conversations.length && <p className="px-3 py-8 text-center text-sm text-muted">Accept a friend request to start a DM.</p>}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {activeConversation ? <>
          <header className="flex h-14 items-center justify-between border-b border-line px-5">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted" /><strong>{activeConversation.profile?.displayName || activeConversation.profile?.username}</strong></div>
            <button aria-label={`Block ${activeConversation.profile?.username}`} onClick={() => changeFriendship(activeConversation.friendshipId, activeConversation.blockedByMe ? "unblock" : "block")} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"><ShieldBan className="h-4 w-4" /></button>
          </header>
          <div aria-label="Direct message history" className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((item) => <article key={item.id} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold uppercase">{item.profile.username.slice(0, 2)}</div>
              <div><strong className="text-sm">{item.profile.displayName || item.profile.username}</strong><p className="whitespace-pre-wrap text-sm text-text">{item.content}</p></div>
            </article>)}
          </div>
          {activeConversation.friendshipStatus === "ACCEPTED" ? <form onSubmit={sendMessage} className="flex gap-2 p-4">
            <label className="sr-only" htmlFor="direct-message">Direct message</label>
            <input id="direct-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Message @${activeConversation.profile?.username}`} className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 outline-hidden focus:border-accent" />
            <button aria-label="Send direct message" className="rounded-xl bg-accent px-4 text-on-accent hover:bg-accent-strong"><Send className="h-4 w-4" /></button>
          </form> : <p role="status" className="border-t border-line p-4 text-center text-sm text-muted">History is retained, but new messages are disabled until this friendship is accepted.</p>}
        </> : <div className="flex flex-1 flex-col items-center justify-center text-muted"><MessageCircle className="mb-3 h-12 w-12 stroke-1" /><p>Select a conversation or add a friend.</p></div>}
        {error && <div role="alert" className="fixed bottom-4 right-4 rounded-lg border border-danger/30 bg-danger/20 px-4 py-3 text-sm text-danger">{error}</div>}
      </section>
    </main>
  );
}
