"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, Space, Channel, Category } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";
import {
  Hash,
  Volume2,
  Plus,
  Compass,
  LogOut,
  Trash2,
  Copy,
  X,
  Send,
  Users,
  Settings,
} from "lucide-react";
import VoiceGrid from "@/components/VoiceGrid";

export default function DashboardPage() {
  const router = useRouter();

  // Zustand Store values
  const {
    profile,
    spaces,
    categories,
    channels,
    members,
    messages,
    activeSpaceId,
    activeChannelId,
    presenceUsers,
    isLoading,
    setProfile,
    fetchSpaces,
    fetchSpaceData,
    fetchMessages,
    createSpace,
    joinSpace,
    deleteSpace,
    sendMessage,
    setActiveSpaceId,
    setActiveChannelId,
    joinVoiceChannel,
  } = useAppStore();

  // Establish subscriptions
  useRealtime();

  // Local state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceAvatar, setNewSpaceAvatar] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Authenticate user & load initial spaces
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        if (data.user) {
          setProfile(data.user);
        }

        await fetchSpaces();
      } catch (err) {
        router.push("/login");
      }
    };

    checkAuth();
  }, [router, setProfile, fetchSpaces]);

  // Set default active space and channel if none active
  useEffect(() => {
    if (spaces.length > 0 && !activeSpaceId) {
      setActiveSpaceId(spaces[0].id);
    }
  }, [spaces, activeSpaceId, setActiveSpaceId]);

  // Fetch space details (channels, categories, members) when active space changes
  useEffect(() => {
    if (activeSpaceId) {
      fetchSpaceData(activeSpaceId);
    }
  }, [activeSpaceId, fetchSpaceData]);

  // Auto select first text channel when channels load or space changes
  useEffect(() => {
    if (channels.length > 0) {
      const textChans = channels.filter((c) => c.type === "TEXT");
      if (textChans.length > 0) {
        const activeChanObj = channels.find((c) => c.id === activeChannelId);
        if (!activeChanObj || activeChanObj.spaceId !== activeSpaceId) {
          setActiveChannelId(textChans[0].id);
        }
      }
    } else {
      setActiveChannelId(null);
    }
  }, [channels, activeSpaceId, activeChannelId, setActiveChannelId]);

  // Fetch messages when active channel changes
  useEffect(() => {
    if (activeChannelId) {
      fetchMessages(activeChannelId);
    }
  }, [activeChannelId, fetchMessages]);

  // Auto scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    const space = await createSpace(newSpaceName.trim(), newSpaceAvatar.trim());
    if (space) {
      setActiveSpaceId(space.id);
      setNewSpaceName("");
      setNewSpaceAvatar("");
      setShowCreateModal(false);
    }
  };

  const handleJoinSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;

    const success = await joinSpace(inviteCodeInput.trim());
    if (success) {
      setInviteCodeInput("");
      setShowJoinModal(false);
    } else {
      alert("Invalid or expired invite code.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeChannelId) return;

    await sendMessage(activeChannelId, messageInput.trim());
    setMessageInput("");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-[#e4e4e7]">
      {/* 1. Space Selection Sidebar */}
      <div className="flex w-[72px] flex-col items-center gap-3 border-r border-white/5 bg-[#0c0c0e] py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-tr from-indigo-500 to-purple-600 text-xl font-bold shadow-lg shadow-indigo-500/20 cursor-default select-none">
          Ω
        </div>

        <div className="h-[2px] w-8 rounded bg-white/10" />

        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto w-full items-center no-scrollbar">
          {spaces.map((space) => {
            const isActive = space.id === activeSpaceId;
            return (
              <button
                key={space.id}
                onClick={() => setActiveSpaceId(space.id)}
                className="group relative flex h-12 w-12 items-center justify-center rounded-3xl transition-all duration-300 hover:rounded-2xl bg-zinc-800 hover:bg-indigo-600 active:scale-[0.95]"
                style={{
                  borderRadius: isActive ? "16px" : undefined,
                  backgroundColor: isActive ? "#4f46e5" : undefined,
                }}
                title={space.name}
              >
                <div
                  className="absolute left-0 w-1 rounded-r bg-white transition-all duration-300"
                  style={{
                    height: isActive ? "40px" : "0px",
                    transform: isActive ? "scaleY(1)" : "scaleY(0)",
                  }}
                />
                {space.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={space.avatarUrl}
                    alt={space.name}
                    className="h-full w-full object-cover rounded-3xl group-hover:rounded-2xl transition-all duration-300"
                    style={{ borderRadius: isActive ? "16px" : undefined }}
                  />
                ) : (
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    {space.name.substring(0, 2)}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex h-12 w-12 items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-transparent text-zinc-400 transition-all duration-300 hover:rounded-2xl hover:border-emerald-500 hover:bg-emerald-600/10 hover:text-emerald-400"
            title="Create Space"
          >
            <Plus className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowJoinModal(true)}
            className="flex h-12 w-12 items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-transparent text-zinc-400 transition-all duration-300 hover:rounded-2xl hover:border-indigo-500 hover:bg-indigo-600/10 hover:text-indigo-400"
            title="Join Space with Code"
          >
            <Compass className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
            title="Log Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 2. Space Channels Sidebar */}
      <div className="flex w-60 flex-col border-r border-white/5 bg-[#111113]">
        {activeSpace ? (
          <>
            <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
              <h2 className="truncate text-base font-bold text-white" title={activeSpace.name}>
                {activeSpace.name}
              </h2>
              {profile?.id === activeSpace.ownerId && (
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this space?")) {
                      deleteSpace(activeSpace.id);
                    }
                  }}
                  className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                  title="Delete Space"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mx-3 mt-3 rounded-lg bg-white/5 p-3 border border-white/5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Invite Code
              </span>
              <div className="mt-1.5 flex items-center justify-between rounded bg-zinc-950 px-2 py-1 text-xs">
                <code className="font-mono text-zinc-300 select-all">
                  {activeSpace.inviteCode}
                </code>
                <button
                  onClick={() => copyInviteCode(activeSpace.inviteCode)}
                  className="text-zinc-500 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              {copiedInvite && (
                <span className="mt-1 block text-right text-[10px] text-emerald-400">
                  Copied!
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 no-scrollbar">
              {categories.map((category) => (
                <div key={category.id} className="space-y-0.5">
                  <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {category.name}
                  </span>
                  {channels
                    .filter((c) => c.categoryId === category.id)
                    .map((channel) => {
                      const isActive = channel.id === activeChannelId;
                      return (
                        <button
                          key={channel.id}
                          onClick={() => {
                            setActiveChannelId(channel.id);
                            if (channel.type === "VOICE" || channel.type === "STAGE") {
                              joinVoiceChannel(channel.id);
                            }
                          }}
                          className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-all"
                          style={{
                            backgroundColor: isActive ? "rgba(255,255,255,0.06)" : undefined,
                            color: isActive ? "#ffffff" : "#a1a1aa",
                          }}
                        >
                          {channel.type === "TEXT" ? (
                            <Hash className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <Volume2 className="h-4 w-4 text-zinc-500" />
                          )}
                          <span className="truncate text-left">{channel.name}</span>
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>

            {profile && (
              <div className="flex h-[52px] items-center gap-2 border-t border-white/5 bg-zinc-950/40 px-3">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt={profile.username}
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-xs uppercase font-semibold text-zinc-300">
                      {profile.displayName?.substring(0, 2) || profile.username.substring(0, 2)}
                    </span>
                  )}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-zinc-950" />
                </div>
                <div className="flex flex-1 flex-col overflow-hidden leading-tight">
                  <span className="truncate text-xs font-bold text-white">
                    {profile.displayName || profile.username}
                  </span>
                  <span className="truncate text-[10px] text-zinc-500">@{profile.username}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-zinc-500">
            <Settings className="h-8 w-8 stroke-1 animate-spin duration-3000 mb-2" />
            <p className="text-xs">Select or create a space to begin</p>
          </div>
        )}
      </div>

      {/* 3. Messaging Area */}
      <div className="flex flex-1 flex-col bg-[#151518]">
        {activeChannel ? (
          <>
            <div className="flex h-14 items-center justify-between border-b border-white/5 px-6">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-zinc-400" />
                <h1 className="text-sm font-bold text-white">{activeChannel.name}</h1>
              </div>
            </div>

            <VoiceGrid />

            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
              {messages.map((message) => (
                <div key={message.id} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700">
                    {message.profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.profile.avatarUrl}
                        alt={message.profile.username}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs uppercase font-semibold text-zinc-300">
                        {message.profile?.displayName?.substring(0, 2) ||
                          message.profile?.username.substring(0, 2) ||
                          "U"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden leading-tight">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-white">
                        {message.profile?.displayName || message.profile?.username || "Unknown"}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-zinc-950/20">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 focus-within:border-indigo-500 transition">
                <input
                  type="text"
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-hidden"
                  placeholder={`Send message to #${activeChannel.name}`}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                />
                <button type="submit" className="text-zinc-400 hover:text-white transition">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-zinc-500 p-8">
            <Compass className="h-10 w-10 stroke-1 mb-2 animate-bounce" />
            <h3 className="text-sm font-bold text-zinc-400">Welcome to Omni-Platform</h3>
            <p className="text-xs max-w-sm mt-1">
              Connect to a text channel or create a new space to join the conversation.
            </p>
          </div>
        )}
      </div>

      {/* 4. Presence list */}
      {activeSpace && (
        <div className="flex w-60 flex-col border-l border-white/5 bg-[#111113]">
          <div className="flex h-14 items-center gap-2 border-b border-white/5 px-4">
            <Users className="h-4 w-4 text-zinc-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Members — {members.length}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2 no-scrollbar">
            {members.map((member) => {
              const isOnline = !!presenceUsers[member.profileId];
              return (
                <div key={member.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700">
                    {member.profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.profile.avatarUrl}
                        alt={member.profile.username}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs uppercase font-semibold text-zinc-300">
                        {member.profile?.displayName?.substring(0, 2) ||
                          member.profile?.username.substring(0, 2)}
                      </span>
                    )}
                    <span
                      className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-zinc-950"
                      style={{
                        backgroundColor: isOnline ? "#10b981" : "#71717a",
                      }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col overflow-hidden leading-tight">
                    <span className="truncate text-xs font-bold text-white">
                      {member.profile?.displayName || member.profile?.username}
                    </span>
                    <span className="truncate text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      {member.role}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Modals */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151518] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <h3 className="text-base font-bold text-white">Create a Space</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSpace} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Space Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-hidden focus:border-indigo-500 focus:bg-white/10"
                  placeholder="My Gaming Server"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Avatar Image URL (Optional)
                </label>
                <input
                  type="url"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-hidden focus:border-indigo-500 focus:bg-white/10"
                  placeholder="https://example.com/avatar.jpg"
                  value={newSpaceAvatar}
                  onChange={(e) => setNewSpaceAvatar(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
              >
                Create
              </button>
            </form>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151518] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <h3 className="text-base font-bold text-white">Join a Space</h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleJoinSpace} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Invite Code
                </label>
                <input
                  type="text"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-hidden focus:border-indigo-500 focus:bg-white/10"
                  placeholder="ABCDEF"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
              >
                Join Space
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
