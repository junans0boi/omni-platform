"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, Space, Channel, Category, Member, Profile } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";
import {
  Hash, Volume2, Plus, Compass, LogOut, Trash2, Copy, X, Send,
  Users, Settings, Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  ChevronDown, ChevronRight, Edit2, Crown, Shield, UserMinus, UserCheck,
  ImageIcon, Paperclip, MoreVertical, Check
} from "lucide-react";
import VoiceGrid from "@/components/VoiceGrid";

// ─── Modal Types ───────────────────────────────────────────────────────────────
type ModalType =
  | "createSpace"
  | "joinSpace"
  | "createChannel"
  | "createCategory"
  | "editProfile"
  | "memberActions"
  | null;

export default function DashboardPage() {
  const router = useRouter();

  const {
    profile, spaces, categories, channels, members, messages,
    activeSpaceId, activeChannelId, presenceUsers, isLoading,
    setProfile, fetchSpaces, fetchSpaceData, fetchMessages,
    createSpace, joinSpace, deleteSpace, sendMessage,
    setActiveSpaceId, setActiveChannelId, joinVoiceChannel, leaveVoiceChannel,
    toggleMute, toggleCamera, activeVoiceChannelId, isMuted, isCameraOn,
    addMessage,
  } = useAppStore();

  useRealtime();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalType>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceAvatar, setNewSpaceAvatar] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"TEXT" | "VOICE" | "STAGE">("TEXT");
  const [newChannelCategoryId, setNewChannelCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    type: "channel" | "category";
    id: string;
    x: number;
    y: number;
    name: string;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) { router.push("/login"); return; }
        const data = await res.json();
        if (data.user) setProfile(data.user);
        await fetchSpaces();
      } catch { router.push("/login"); }
    };
    checkAuth();
  }, [router, setProfile, fetchSpaces]);

  useEffect(() => {
    if (spaces.length > 0 && !activeSpaceId) setActiveSpaceId(spaces[0].id);
  }, [spaces, activeSpaceId, setActiveSpaceId]);

  useEffect(() => {
    if (activeSpaceId) fetchSpaceData(activeSpaceId);
  }, [activeSpaceId, fetchSpaceData]);

  useEffect(() => {
    if (channels.length > 0) {
      const textChans = channels.filter((c) => c.type === "TEXT");
      if (textChans.length > 0) {
        const activeChan = channels.find((c) => c.id === activeChannelId);
        if (!activeChan || activeChan.spaceId !== activeSpaceId) {
          setActiveChannelId(textChans[0].id);
        }
      }
    } else {
      setActiveChannelId(null);
    }
  }, [channels, activeSpaceId, activeChannelId, setActiveChannelId]);

  useEffect(() => {
    if (activeChannelId) fetchMessages(activeChannelId);
  }, [activeChannelId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close context menu on click outside
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const myMember = members.find((m) => m.profileId === profile?.id);
  const isAdminOrOwner = myMember && ["ADMIN", "OWNER"].includes(myMember.role);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openModal = (type: ModalType) => {
    setFormError(null);
    setModal(type);
    if (type === "editProfile" && profile) {
      setEditDisplayName(profile.displayName || "");
      setEditAvatarPreview(profile.avatarUrl || null);
    }
    if (type === "createChannel") {
      setNewChannelCategoryId(categories[0]?.id || "");
    }
  };

  const closeModal = () => {
    setModal(null);
    setFormError(null);
    setFormLoading(false);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    setFormLoading(true);
    const space = await createSpace(newSpaceName.trim(), newSpaceAvatar.trim());
    if (space) {
      setActiveSpaceId(space.id);
      setNewSpaceName(""); setNewSpaceAvatar("");
      closeModal();
    }
    setFormLoading(false);
  };

  const handleJoinSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    const ok = await joinSpace(inviteCodeInput.trim());
    if (ok) { setInviteCodeInput(""); closeModal(); }
    else setFormError("Invalid or expired invite code.");
    setFormLoading(false);
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpaceId || !newChannelName.trim()) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/spaces/${activeSpaceId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChannelName.trim(),
          type: newChannelType,
          categoryId: newChannelCategoryId || null,
        }),
      });
      if (res.ok) {
        setNewChannelName(""); closeModal();
        await fetchSpaceData(activeSpaceId);
      } else {
        const d = await res.json();
        setFormError(d.error);
      }
    } catch (e: any) { setFormError(e.message); }
    setFormLoading(false);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpaceId || !newCategoryName.trim()) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/spaces/${activeSpaceId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (res.ok) {
        setNewCategoryName(""); closeModal();
        await fetchSpaceData(activeSpaceId);
      } else {
        const d = await res.json();
        setFormError(d.error);
      }
    } catch (e: any) { setFormError(e.message); }
    setFormLoading(false);
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm("채널을 삭제하시겠습니까?")) return;
    setContextMenu(null);
    await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
    if (activeSpaceId) await fetchSpaceData(activeSpaceId);
    if (activeChannelId === channelId) setActiveChannelId(null);
  };

  const handleRenameChannel = async (channelId: string) => {
    if (!renameValue.trim()) return;
    await fetch(`/api/channels/${channelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setRenamingId(null); setRenameValue("");
    if (activeSpaceId) await fetchSpaceData(activeSpaceId);
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      let avatarUrl = profile?.avatarUrl || null;

      if (editAvatarFile) {
        const fd = new FormData();
        fd.append("file", editAvatarFile);
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (upRes.ok) avatarUrl = upData.url;
        else { setFormError(upData.error); setFormLoading(false); return; }
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editDisplayName.trim(), avatarUrl }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        closeModal();
      } else {
        const d = await res.json();
        setFormError(d.error);
      }
    } catch (e: any) { setFormError(e.message); }
    setFormLoading(false);
  };

  const handleMemberAction = async (action: "kick" | "promote" | "demote") => {
    if (!selectedMember) return;
    setFormLoading(true);
    try {
      if (action === "kick") {
        await fetch(`/api/members/${selectedMember.id}`, { method: "DELETE" });
      } else {
        const role = action === "promote" ? "ADMIN" : "MEMBER";
        await fetch(`/api/members/${selectedMember.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
      }
      if (activeSpaceId) await fetchSpaceData(activeSpaceId);
      closeModal(); setSelectedMember(null);
    } catch (e: any) { setFormError(e.message); }
    setFormLoading(false);
  };

  const handleLeaveSpace = async () => {
    if (!activeSpaceId || !myMember) return;
    if (myMember.role === "OWNER") {
      alert("오너는 스페이스를 떠날 수 없습니다. 삭제를 이용하세요.");
      return;
    }
    if (!confirm("이 스페이스를 떠나시겠습니까?")) return;
    await fetch(`/api/members/${myMember.id}`, { method: "DELETE" });
    await fetchSpaces();
    setActiveSpaceId(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannelId) return;
    let content = messageInput.trim();

    if (pendingFile) {
      const fd = new FormData();
      fd.append("file", pendingFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        content = content ? `${content}\n![image](${data.url})` : `![image](${data.url})`;
      }
      setPendingFile(null); setImagePreview(null);
    }

    if (!content) return;
    await sendMessage(activeChannelId, content);
    setMessageInput("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setEditAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
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

  const toggleCategory = (catId: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const renderMessage = (content: string) => {
    const imgMatch = content.match(/!\[.*?\]\((.*?)\)/);
    if (imgMatch) {
      const text = content.replace(/!\[.*?\]\(.*?\)/, "").trim();
      return (
        <div className="space-y-2">
          {text && <p className="text-sm text-zinc-300 whitespace-pre-wrap">{text}</p>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgMatch[1]} alt="uploaded" className="max-w-xs max-h-64 rounded-lg object-cover" />
        </div>
      );
    }
    return <p className="text-sm text-zinc-300 whitespace-pre-wrap">{content}</p>;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-[#e4e4e7]">

      {/* 1. Space sidebar */}
      <div className="flex w-[72px] flex-col items-center gap-3 border-r border-white/5 bg-[#0c0c0e] py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-tr from-indigo-500 to-purple-600 text-xl font-bold shadow-lg shadow-indigo-500/20 select-none cursor-default">
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
                className="group relative flex h-12 w-12 items-center justify-center rounded-3xl transition-all duration-200 hover:rounded-2xl bg-zinc-800 hover:bg-indigo-600 active:scale-95"
                style={{ borderRadius: isActive ? "16px" : undefined, backgroundColor: isActive ? "#4f46e5" : undefined }}
                title={space.name}
              >
                <div className="absolute left-0 w-1 rounded-r bg-white transition-all duration-200"
                  style={{ height: isActive ? "40px" : "0" }} />
                {space.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={space.avatarUrl} alt={space.name}
                    className="h-full w-full object-cover"
                    style={{ borderRadius: isActive ? "16px" : "24px" }} />
                ) : (
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    {space.name.substring(0, 2)}
                  </span>
                )}
              </button>
            );
          })}

          <button onClick={() => openModal("createSpace")}
            className="flex h-12 w-12 items-center justify-center rounded-3xl border border-dashed border-zinc-700 text-zinc-400 hover:rounded-2xl hover:border-emerald-500 hover:bg-emerald-600/10 hover:text-emerald-400"
            title="Create Space">
            <Plus className="h-5 w-5" />
          </button>

          <button onClick={() => openModal("joinSpace")}
            className="flex h-12 w-12 items-center justify-center rounded-3xl border border-dashed border-zinc-700 text-zinc-400 hover:rounded-2xl hover:border-indigo-500 hover:bg-indigo-600/10 hover:text-indigo-400"
            title="Join Space">
            <Compass className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2 items-center">
          <button onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            title="Log Out">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 2. Channel sidebar */}
      <div className="flex w-60 flex-col border-r border-white/5 bg-[#111113]">
        {activeSpace ? (
          <>
            <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
              <h2 className="truncate text-sm font-bold text-white" title={activeSpace.name}>
                {activeSpace.name}
              </h2>
              <div className="flex gap-1">
                {isAdminOrOwner && (
                  <button onClick={() => openModal("createChannel")}
                    className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-white" title="Add Channel">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                {myMember?.role === "OWNER" && (
                  <button onClick={() => { if (confirm("이 스페이스를 삭제하시겠습니까?")) deleteSpace(activeSpace.id); }}
                    className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400" title="Delete Space">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Invite code */}
            <div className="mx-3 mt-3 rounded-lg bg-white/5 p-2.5 border border-white/5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Invite Code</span>
              <div className="mt-1.5 flex items-center justify-between rounded bg-zinc-950 px-2 py-1 text-xs">
                <code className="font-mono text-zinc-300 select-all">{activeSpace.inviteCode}</code>
                <button onClick={() => copyInviteCode(activeSpace.inviteCode)} className="text-zinc-500 hover:text-white">
                  {copiedInvite ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Channels list */}
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 no-scrollbar">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    onContextMenu={(e) => { e.preventDefault(); if (isAdminOrOwner) setContextMenu({ type: "category", id: cat.id, x: e.clientX, y: e.clientY, name: cat.name }); }}
                    className="flex w-full items-center gap-1 px-1 py-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
                    {collapsedCats.has(cat.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {renamingId === cat.id ? (
                      <input autoFocus value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameChannel(cat.id); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => setRenamingId(null)}
                        className="flex-1 bg-zinc-800 text-white rounded px-1 py-0.5 text-xs outline-hidden"
                        onClick={(e) => e.stopPropagation()} />
                    ) : (
                      <span className="flex-1 text-left">{cat.name}</span>
                    )}
                  </button>

                  {!collapsedCats.has(cat.id) && (
                    <div className="mt-0.5 space-y-0.5">
                      {channels.filter((c) => c.categoryId === cat.id).map((ch) => {
                        const isActive = ch.id === activeChannelId;
                        return (
                          <div key={ch.id} className="group flex items-center">
                            {renamingId === ch.id ? (
                              <div className="flex flex-1 items-center gap-1.5 px-2">
                                {ch.type === "TEXT" ? <Hash className="h-4 w-4 text-zinc-500 shrink-0" /> : <Volume2 className="h-4 w-4 text-zinc-500 shrink-0" />}
                                <input autoFocus value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleRenameChannel(ch.id); if (e.key === "Escape") setRenamingId(null); }}
                                  onBlur={() => setRenamingId(null)}
                                  className="flex-1 bg-zinc-800 text-white rounded px-1 py-0.5 text-xs outline-hidden" />
                              </div>
                            ) : (
                              <button
                                onClick={() => { setActiveChannelId(ch.id); if (ch.type !== "TEXT") joinVoiceChannel(ch.id); }}
                                onContextMenu={(e) => { e.preventDefault(); if (isAdminOrOwner) setContextMenu({ type: "channel", id: ch.id, x: e.clientX, y: e.clientY, name: ch.name }); }}
                                className="flex flex-1 items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-colors"
                                style={{ backgroundColor: isActive ? "rgba(255,255,255,0.06)" : undefined, color: isActive ? "#fff" : "#a1a1aa" }}>
                                {ch.type === "TEXT" ? <Hash className="h-4 w-4 text-zinc-500 shrink-0" /> : <Volume2 className="h-4 w-4 text-zinc-500 shrink-0" />}
                                <span className="truncate text-left text-sm">{ch.name}</span>
                                {isActive && activeVoiceChannelId === ch.id && (
                                  <span className="ml-auto h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {isAdminOrOwner && (
                <button onClick={() => openModal("createCategory")}
                  className="flex w-full items-center gap-1 px-2 py-1 text-xs text-zinc-600 hover:text-zinc-400 hover:bg-white/5 rounded">
                  <Plus className="h-3.5 w-3.5" /> Add Category
                </button>
              )}

              {myMember && myMember.role !== "OWNER" && (
                <button onClick={handleLeaveSpace}
                  className="flex w-full items-center gap-1 px-2 py-1 text-xs text-red-500/60 hover:text-red-400 hover:bg-red-500/5 rounded mt-2">
                  <LogOut className="h-3.5 w-3.5" /> Leave Space
                </button>
              )}
            </div>

            {/* Profile bar */}
            {profile && (
              <div className="flex h-[52px] items-center gap-2 border-t border-white/5 bg-zinc-950/40 px-3">
                <button onClick={() => openModal("editProfile")} className="group relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 overflow-hidden">
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt={profile.username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs uppercase font-semibold text-zinc-300">
                        {profile.displayName?.substring(0, 2) || profile.username.substring(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                    <Edit2 className="h-3 w-3 text-white" />
                  </div>
                </button>
                <div className="flex flex-1 flex-col overflow-hidden leading-tight">
                  <span className="truncate text-xs font-bold text-white">{profile.displayName || profile.username}</span>
                  <span className="truncate text-[10px] text-zinc-500">@{profile.username}</span>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-zinc-950" />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-zinc-600">
            <Compass className="h-8 w-8 mb-2 stroke-1" />
            <p className="text-xs">Select or create a space</p>
          </div>
        )}
      </div>

      {/* 3. Chat area */}
      <div className="flex flex-1 flex-col bg-[#151518] min-w-0">
        {activeChannel ? (
          <>
            {/* Channel header */}
            <div className="flex h-14 items-center justify-between border-b border-white/5 px-6">
              <div className="flex items-center gap-2">
                {activeChannel.type === "TEXT" ? <Hash className="h-5 w-5 text-zinc-400" /> : <Volume2 className="h-5 w-5 text-zinc-400" />}
                <h1 className="text-sm font-bold text-white">{activeChannel.name}</h1>
                <span className="text-xs text-zinc-600">{activeChannel.type}</span>
              </div>

              {/* Voice controls */}
              {activeVoiceChannelId && (
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${isMuted ? "bg-red-500/20 text-red-400" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"}`}>
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button onClick={toggleCamera}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${isCameraOn ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"}`}>
                    {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  </button>
                  <button onClick={leaveVoiceChannel}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30">
                    <PhoneOff className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <VoiceGrid />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3 group">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 overflow-hidden">
                    {msg.profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.profile.avatarUrl} alt={msg.profile.username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs uppercase font-semibold text-zinc-300">
                        {msg.profile?.displayName?.substring(0, 2) || msg.profile?.username.substring(0, 2) || "U"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-white">
                        {msg.profile?.displayName || msg.profile?.username || "Unknown"}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {renderMessage(msg.content)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Image preview */}
            {imagePreview && (
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="preview" className="h-16 w-16 rounded object-cover" />
                <span className="flex-1 text-xs text-zinc-400 truncate">{pendingFile?.name}</span>
                <button onClick={() => { setImagePreview(null); setPendingFile(null); }} className="text-zinc-500 hover:text-red-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Message input */}
            <form onSubmit={handleSendMessage} className="p-4">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 focus-within:border-indigo-500 transition">
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="text-zinc-500 hover:text-indigo-400 transition" title="Attach image">
                  <ImageIcon className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-hidden"
                  placeholder={`Message #${activeChannel.name}`}
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
          <div className="flex flex-1 flex-col items-center justify-center text-center text-zinc-600 p-8">
            <Compass className="h-10 w-10 stroke-1 mb-2 animate-bounce" />
            <h3 className="text-sm font-bold text-zinc-400">Welcome to Omni-Platform</h3>
            <p className="text-xs mt-1">Select or create a channel to start chatting.</p>
          </div>
        )}
      </div>

      {/* 4. Members sidebar */}
      {activeSpace && (
        <div className="flex w-56 flex-col border-l border-white/5 bg-[#111113]">
          <div className="flex h-14 items-center gap-2 border-b border-white/5 px-4">
            <Users className="h-4 w-4 text-zinc-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Members — {members.length}</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 no-scrollbar">
            {members.map((member) => {
              const isOnline = !!presenceUsers[member.profileId];
              const isMe = member.profileId === profile?.id;
              return (
                <div key={member.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 group hover:bg-white/5 cursor-pointer"
                  onClick={() => {
                    if (!isMe && isAdminOrOwner) {
                      setSelectedMember(member);
                      openModal("memberActions");
                    }
                  }}>
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 overflow-hidden">
                    {member.profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.profile.avatarUrl} alt={member.profile.username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs uppercase font-semibold text-zinc-300">
                        {member.profile?.displayName?.substring(0, 2) || member.profile?.username.substring(0, 2)}
                      </span>
                    )}
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-zinc-950"
                      style={{ backgroundColor: isOnline ? "#10b981" : "#52525b" }} />
                  </div>
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex items-center gap-1">
                      {member.role === "OWNER" && <Crown className="h-2.5 w-2.5 text-yellow-400 shrink-0" />}
                      {member.role === "ADMIN" && <Shield className="h-2.5 w-2.5 text-indigo-400 shrink-0" />}
                      <span className="truncate text-xs font-semibold text-white">
                        {member.profile?.displayName || member.profile?.username}
                        {isMe && <span className="text-zinc-500"> (나)</span>}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">{member.role}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Context Menu ────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[160px] rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}>
          <button
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
            onClick={() => { setRenamingId(contextMenu.id); setRenameValue(contextMenu.name); setContextMenu(null); }}>
            <Edit2 className="h-3.5 w-3.5" /> Rename
          </button>
          {contextMenu.type === "channel" && (
            <button
              className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
              onClick={() => handleDeleteChannel(contextMenu.id)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete Channel
            </button>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4"
          onClick={closeModal}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151518] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>

            {/* Create Space */}
            {modal === "createSpace" && (
              <>
                <ModalHeader title="Create a Space" onClose={closeModal} />
                <form onSubmit={handleCreateSpace} className="mt-4 space-y-4">
                  <ModalInput label="Space Name" value={newSpaceName} onChange={setNewSpaceName} placeholder="My Server" required />
                  <ModalInput label="Avatar URL (Optional)" value={newSpaceAvatar} onChange={setNewSpaceAvatar} placeholder="https://..." />
                  {formError && <ErrorBanner msg={formError} />}
                  <ModalSubmit loading={formLoading} label="Create" />
                </form>
              </>
            )}

            {/* Join Space */}
            {modal === "joinSpace" && (
              <>
                <ModalHeader title="Join a Space" onClose={closeModal} />
                <form onSubmit={handleJoinSpace} className="mt-4 space-y-4">
                  <ModalInput label="Invite Code" value={inviteCodeInput} onChange={setInviteCodeInput} placeholder="ABCDEF" required />
                  {formError && <ErrorBanner msg={formError} />}
                  <ModalSubmit loading={formLoading} label="Join" />
                </form>
              </>
            )}

            {/* Create Channel */}
            {modal === "createChannel" && (
              <>
                <ModalHeader title="Create Channel" onClose={closeModal} />
                <form onSubmit={handleCreateChannel} className="mt-4 space-y-4">
                  <ModalInput label="Channel Name" value={newChannelName} onChange={setNewChannelName} placeholder="일반" required />
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Type</label>
                    <div className="flex gap-2">
                      {(["TEXT", "VOICE", "STAGE"] as const).map((t) => (
                        <button key={t} type="button"
                          className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider border transition ${newChannelType === t ? "border-indigo-500 bg-indigo-600/20 text-indigo-300" : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"}`}
                          onClick={() => setNewChannelType(t)}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Category</label>
                    <select value={newChannelCategoryId} onChange={(e) => setNewChannelCategoryId(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-hidden">
                      <option value="">No category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  {formError && <ErrorBanner msg={formError} />}
                  <ModalSubmit loading={formLoading} label="Create Channel" />
                </form>
              </>
            )}

            {/* Create Category */}
            {modal === "createCategory" && (
              <>
                <ModalHeader title="Create Category" onClose={closeModal} />
                <form onSubmit={handleCreateCategory} className="mt-4 space-y-4">
                  <ModalInput label="Category Name" value={newCategoryName} onChange={setNewCategoryName} placeholder="새 카테고리" required />
                  {formError && <ErrorBanner msg={formError} />}
                  <ModalSubmit loading={formLoading} label="Create Category" />
                </form>
              </>
            )}

            {/* Edit Profile */}
            {modal === "editProfile" && (
              <>
                <ModalHeader title="Edit Profile" onClose={closeModal} />
                <form onSubmit={handleEditProfile} className="mt-4 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <label className="group relative cursor-pointer">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-700 overflow-hidden">
                        {editAvatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={editAvatarPreview} alt="avatar" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl uppercase font-bold text-zinc-400">
                            {profile?.displayName?.substring(0, 2) || profile?.username.substring(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-white" />
                      </div>
                      <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                    </label>
                    <span className="text-xs text-zinc-500">Click to change avatar</span>
                  </div>
                  <ModalInput label="Display Name" value={editDisplayName} onChange={setEditDisplayName} placeholder="John Doe" />
                  {formError && <ErrorBanner msg={formError} />}
                  <ModalSubmit loading={formLoading} label="Save Changes" />
                </form>
              </>
            )}

            {/* Member Actions */}
            {modal === "memberActions" && selectedMember && (
              <>
                <ModalHeader title="Member Actions" onClose={closeModal} />
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                      {selectedMember.profile?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedMember.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm uppercase font-bold text-zinc-300">
                          {selectedMember.profile?.username.substring(0, 2)}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{selectedMember.profile?.displayName || selectedMember.profile?.username}</p>
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{selectedMember.role}</p>
                    </div>
                  </div>

                  {myMember?.role === "OWNER" && selectedMember.role === "MEMBER" && (
                    <button onClick={() => handleMemberAction("promote")}
                      className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-indigo-300 bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20">
                      <UserCheck className="h-4 w-4" /> Promote to Admin
                    </button>
                  )}

                  {myMember?.role === "OWNER" && selectedMember.role === "ADMIN" && (
                    <button onClick={() => handleMemberAction("demote")}
                      className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-zinc-300 bg-white/5 border border-white/10 hover:bg-white/10">
                      <UserMinus className="h-4 w-4" /> Demote to Member
                    </button>
                  )}

                  <button onClick={() => handleMemberAction("kick")}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20">
                    <UserMinus className="h-4 w-4" /> Kick from Space
                  </button>

                  {formError && <ErrorBanner msg={formError} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable modal sub-components ──────────────────────────────────────────────

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-white/5">
      <h3 className="text-base font-bold text-white">{title}</h3>
      <button onClick={onClose} className="text-zinc-500 hover:text-white">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function ModalInput({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">{label}</label>
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-hidden focus:border-indigo-500 focus:bg-white/10"
      />
    </div>
  );
}

function ModalSubmit({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none">
      {loading ? "Processing..." : label}
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{msg}</div>
  );
}
