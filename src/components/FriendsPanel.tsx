"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { getSoundEffects } from "@/lib/browser-sound-effects";
import { UserPlus, MessageSquare, Check, X, Search, Send, UserCheck, Clock } from "lucide-react";

interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  availability?: "AVAILABLE" | "IDLE" | "DND" | string;
  customStatus?: string | null;
}

interface FriendshipItem {
  id: string;
  profileAId: string;
  profileBId: string;
  requestedById: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  direction: "outgoing" | "incoming";
  conversationId: string | null;
  profile: Profile;
  updatedAt: string;
}

interface DirectMessageItem {
  id: string;
  conversationId: string;
  profileId: string;
  content: string;
  createdAt: string;
  profile: Profile;
}

interface DirectConversationItem {
  id: string;
  updatedAt: string;
  otherProfile: Profile | null;
  lastMessage: DirectMessageItem | null;
}

export function FriendsPanel({
  currentProfile,
}: {
  currentProfile: Profile | null;
}) {
  const { t } = useI18n();

  const [subTab, setSubTab] = useState<"all" | "pending" | "add" | "dms">("all");
  const [friendships, setFriendships] = useState<FriendshipItem[]>([]);
  const [conversations, setConversations] = useState<DirectConversationItem[]>([]);

  // Add friend state
  const [searchUsername, setSearchUsername] = useState("");
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  // Active DM state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeDmProfile, setActiveDmProfile] = useState<Profile | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessageItem[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [sendingDm, setSendingDm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchFriendships = useCallback(async () => {
    try {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        setFriendships(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/dm");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchDmMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/dm/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setDmMessages(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFriendships();
      fetchConversations();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFriendships, fetchConversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    const timer = setTimeout(() => {
      fetchDmMessages(activeConversationId);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeConversationId, fetchDmMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    setSendingRequest(true);
    setAddMsg(null);

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: searchUsername.trim() }),
      });

      if (res.status === 201) {
        setAddMsg({ type: "success", text: `${searchUsername}님에게 성공적으로 친구 요청을 보냈습니다.` });
        setSearchUsername("");
        fetchFriendships();
        getSoundEffects()?.emit("INACTIVE_MESSAGE");
      } else {
        const err = await res.json();
        const msg =
          err.error === "profile_not_found"
            ? "해당 유저를 찾을 수 없습니다."
            : err.error === "duplicate_friend_request"
            ? "이미 친구이거나 대기 중인 요청이 존재합니다."
            : "친구 요청 실패";
        setAddMsg({ type: "error", text: msg });
      }
    } catch {
      setAddMsg({ type: "error", text: "오류가 발생했습니다." });
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRespondFriend = async (friendshipId: string, action: "accept" | "decline") => {
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        fetchFriendships();
        fetchConversations();
        getSoundEffects()?.emit("INACTIVE_MESSAGE");
      }
    } catch {
      // Ignore
    }
  };

  const handleStartDm = async (targetProfile: Profile) => {
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfileId: targetProfile.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveConversationId(data.id);
        setActiveDmProfile(targetProfile);
        setSubTab("dms");
      }
    } catch {
      // Ignore
    }
  };

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmInput.trim() || !activeConversationId) return;

    const content = dmInput.trim();
    setDmInput("");
    setSendingDm(true);

    try {
      const res = await fetch(`/api/dm/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        setDmMessages((prev) => [...prev, newMsg]);
        getSoundEffects()?.emit("INACTIVE_MESSAGE");
        fetchConversations();
      }
    } catch {
      // Ignore
    } finally {
      setSendingDm(false);
    }
  };

  const acceptedFriends = friendships.filter((f) => f.status === "ACCEPTED");
  const pendingRequests = friendships.filter((f) => f.status === "PENDING");

  return (
    <div className="flex h-full w-full bg-[#0c0c0e] text-white overflow-hidden">
      {/* Sub Navigation Bar */}
      <div className="w-64 border-r border-white/10 bg-white/5 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold text-base flex items-center gap-2">
              <span>👥</span> {t("friends.title")}
            </h2>
            <button
              onClick={() => setSubTab("add")}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold hover:bg-indigo-500 transition shadow-md shadow-indigo-600/30"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{t("friends.add")}</span>
            </button>
          </div>

          <nav className="p-2 space-y-1">
            <button
              onClick={() => {
                setSubTab("all");
                setActiveConversationId(null);
              }}
              className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                subTab === "all"
                  ? "bg-white/10 text-white font-bold"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="h-4 w-4 text-emerald-400" />
                <span>{t("friends.all")}</span>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400">
                {acceptedFriends.length}
              </span>
            </button>

            <button
              onClick={() => {
                setSubTab("pending");
                setActiveConversationId(null);
              }}
              className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                subTab === "pending"
                  ? "bg-white/10 text-white font-bold"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>{t("friends.pending")}</span>
              </div>
              {pendingRequests.length > 0 && (
                <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-xs font-bold animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <div className="pt-4 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              1:1 다이렉트 메시지 (DM)
            </div>

            <div className="space-y-0.5 max-h-[350px] overflow-y-auto">
              {conversations.map((c) => {
                const isActive = activeConversationId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveConversationId(c.id);
                      setActiveDmProfile(c.otherProfile);
                      setSubTab("dms");
                    }}
                    className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition ${
                      isActive && subTab === "dms"
                        ? "bg-indigo-600/30 text-white border border-indigo-500/30"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="relative h-7 w-7 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold uppercase overflow-hidden shrink-0">
                      {c.otherProfile?.avatarUrl ? (
                        <img src={c.otherProfile.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        c.otherProfile?.username.slice(0, 2) || "??"
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden leading-tight">
                      <p className="font-semibold text-white truncate">
                        {c.otherProfile?.displayName || c.otherProfile?.username || "탈퇴한 유저"}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {c.lastMessage?.content || "대화 내용 없음"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/40">
        {/* SUBTAB: All Friends */}
        {subTab === "all" && (
          <div className="p-6 flex-1 overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-400" />
              <span>{t("friends.all")} ({acceptedFriends.length})</span>
            </h3>

            {acceptedFriends.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <p className="text-sm">{t("friends.noFriends")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {acceptedFriends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl hover:border-indigo-500/50 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white uppercase overflow-hidden">
                        {f.profile.avatarUrl ? (
                          <img src={f.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          f.profile.username.slice(0, 2)
                        )}
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 ${
                            f.profile.availability === "AVAILABLE"
                              ? "bg-emerald-400"
                              : f.profile.availability === "IDLE"
                              ? "bg-amber-400"
                              : "bg-rose-500"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">
                          {f.profile.displayName || f.profile.username}
                        </p>
                        <p className="text-xs text-zinc-400">@{f.profile.username}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartDm(f.profile)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition shadow-sm"
                      title={t("friends.startDm")}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB: Pending Requests */}
        {subTab === "pending" && (
          <div className="p-6 flex-1 overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              <span>{t("friends.pending")} ({pendingRequests.length})</span>
            </h3>

            {pendingRequests.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <p className="text-sm">{t("friends.noRequests")}</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl">
                {pendingRequests.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-300 uppercase overflow-hidden">
                        {f.profile.avatarUrl ? (
                          <img src={f.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          f.profile.username.slice(0, 2)
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">
                          {f.profile.displayName || f.profile.username}
                        </p>
                        <p className="text-xs text-zinc-400">
                          @{f.profile.username} • {f.direction === "incoming" ? "받은 요청" : "보낸 요청"}
                        </p>
                      </div>
                    </div>

                    {f.direction === "incoming" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRespondFriend(f.id, "accept")}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500 transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{t("friends.accept")}</span>
                        </button>
                        <button
                          onClick={() => handleRespondFriend(f.id, "decline")}
                          className="flex items-center gap-1 rounded-xl bg-rose-600/20 text-rose-400 px-3 py-1.5 text-xs font-semibold hover:bg-rose-600 hover:text-white transition"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>{t("friends.reject")}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500 italic">답변 대기 중</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB: Add Friend */}
        {subTab === "add" && (
          <div className="p-6 flex-1 overflow-y-auto max-w-xl">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-400" />
              <span>{t("friends.add")}</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-6">
              상대방의 사용자 이름(Username)을 입력하여 친구 요청을 전송하세요.
            </p>

            {addMsg && (
              <div
                className={`mb-4 rounded-xl border p-3.5 text-xs ${
                  addMsg.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                {addMsg.text}
              </div>
            )}

            <form onSubmit={handleSendFriendRequest} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  placeholder={t("friends.searchPlaceholder")}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={sendingRequest || !searchUsername.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90 disabled:opacity-50"
              >
                {sendingRequest ? t("common.loading") : t("friends.sendRequest")}
              </button>
            </form>
          </div>
        )}

        {/* SUBTAB: Direct Messages Chat Window */}
        {subTab === "dms" && activeConversationId && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* DM Header */}
            <div className="h-14 border-b border-white/10 bg-white/5 px-6 flex items-center gap-3 shrink-0">
              <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                {activeDmProfile?.avatarUrl ? (
                  <img src={activeDmProfile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  activeDmProfile?.username.slice(0, 2) || "??"
                )}
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">
                  {activeDmProfile?.displayName || activeDmProfile?.username}
                </h4>
                <p className="text-[10px] text-zinc-400">@{activeDmProfile?.username}</p>
              </div>
            </div>

            {/* DM Messages History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {dmMessages.length === 0 ? (
                <div className="py-20 text-center text-xs text-zinc-500">
                  대화가 시작되었습니다. 첫 메시지를 보내보세요!
                </div>
              ) : (
                dmMessages.map((msg) => {
                  const isMe = msg.profileId === currentProfile?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-lg ${isMe ? "ml-auto flex-row-reverse" : ""}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0">
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
                              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20"
                              : "bg-white/10 text-white rounded-tl-none"
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1 block text-right">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* DM Input Footer */}
            <form onSubmit={handleSendDm} className="p-4 border-t border-white/10 bg-white/5 flex gap-3 shrink-0">
              <input
                type="text"
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                placeholder="1:1 메시지 전송..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={sendingDm || !dmInput.trim()}
                className="flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
