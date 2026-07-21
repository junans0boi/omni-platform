"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, Member, Reaction } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { useRealtime } from "@/hooks/useRealtime";
import { getErrorMessage } from "@/lib/errors";
import {
  Hash, Volume2, Plus, Compass, LogOut, Trash2, Copy, X, Send,
  Users, ChevronDown, ChevronRight, Edit2, Crown, Shield, UserMinus,
  ImageIcon, Smile, PanelLeftClose, PanelLeft, Check, MessageSquare, Reply
} from "lucide-react";
import VoiceGrid from "@/components/VoiceGrid";
import { LocaleSettings } from "@/components/LocaleSettings";
import { SoundSettings } from "@/components/SoundSettings";
import { getSoundEffects } from "@/lib/browser-sound-effects";
import { DEFAULT_SOUND_PREFERENCE, type SoundPreference } from "@/lib/sound-effects";
import { readSoundPreference, writeSoundPreference } from "@/lib/sound-preference-storage";
import { useI18n } from "@/i18n/I18nProvider";
import { useBoundedVirtualList } from "@/hooks/useBoundedVirtualList";
import { ThreadPanel } from "@/components/ThreadPanel";
import { DELETED_MESSAGE_PREVIEW, messagePreview } from "@/lib/message-threads";

type ModalType =
  | "createSpace"
  | "joinSpace"
  | "createChannel"
  | "createCategory"
  | "editProfile"
  | "memberActions"
  | null;

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useI18n();

  const {
    profile, spaces, categories, channels, members, messages,
    messageHistoryCursor, isLoadingOlderMessages, loadOlderMessages,
    activeSpaceId, activeChannelId, presenceUsers,
    theme, unreadBadges,
    setTheme, setProfile, fetchSpaces, fetchSpaceData, fetchMessages,
    createSpace, joinSpace, deleteSpace, sendMessage, editMessage, deleteMessage, toggleReaction,
    setActiveSpaceId, setActiveChannelId, joinVoiceChannel, activeVoiceChannelId,
  } = useAppStore(useShallow((state) => ({
    profile: state.profile,
    spaces: state.spaces,
    categories: state.categories,
    channels: state.channels,
    members: state.members,
    messages: state.messages,
    messageHistoryCursor: state.messageHistoryCursor,
    isLoadingOlderMessages: state.isLoadingOlderMessages,
    loadOlderMessages: state.loadOlderMessages,
    activeSpaceId: state.activeSpaceId,
    activeChannelId: state.activeChannelId,
    presenceUsers: state.presenceUsers,
    theme: state.theme,
    unreadBadges: state.unreadBadges,
    setTheme: state.setTheme,
    setProfile: state.setProfile,
    fetchSpaces: state.fetchSpaces,
    fetchSpaceData: state.fetchSpaceData,
    fetchMessages: state.fetchMessages,
    createSpace: state.createSpace,
    joinSpace: state.joinSpace,
    deleteSpace: state.deleteSpace,
    sendMessage: state.sendMessage,
    editMessage: state.editMessage,
    deleteMessage: state.deleteMessage,
    toggleReaction: state.toggleReaction,
    setActiveSpaceId: state.setActiveSpaceId,
    setActiveChannelId: state.setActiveChannelId,
    joinVoiceChannel: state.joinVoiceChannel,
    activeVoiceChannelId: state.activeVoiceChannelId,
  })));

  useRealtime();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalType>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  
  const [isChannelSidebarOpen, setIsChannelSidebarOpen] = useState(true);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const previousFirstMessageRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const memberDialogRef = useRef<HTMLDivElement>(null);
  const memberDialogButtonRef = useRef<HTMLButtonElement>(null);
  const { scrollRef: messageScrollRef, virtualizer: messageVirtualizer } =
    useBoundedVirtualList(messages);

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [soundPreferenceOverride, setSoundPreferenceOverride] = useState<{
    profileId: string;
    value: SoundPreference;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ type: "channel" | "category"; id: string; x: number; y: number; name: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // The product has one durable visual theme: premium dark mode.
  const storedSoundPreference = useMemo(
    () => profile && typeof window !== "undefined"
      ? readSoundPreference(profile.id, window.localStorage)
      : { ...DEFAULT_SOUND_PREFERENCE },
    [profile],
  );
  const soundPreference = profile && soundPreferenceOverride?.profileId === profile.id
    ? soundPreferenceOverride.value
    : storedSoundPreference;

  useEffect(() => {
    getSoundEffects()?.setPreference(soundPreference);
  }, [soundPreference]);

  const updateSoundPreference = (preference: SoundPreference) => {
    if (profile) setSoundPreferenceOverride({ profileId: profile.id, value: preference });
    getSoundEffects()?.setPreference(preference);
    if (!profile || typeof window === "undefined") return;
    try {
      writeSoundPreference(profile.id, preference, window.localStorage);
    } catch {
      // Effects remain usable in memory when browser storage is unavailable.
    }
  };

  useEffect(() => {
    setTheme("dark");
    document.documentElement.classList.add("dark");
    window.localStorage.setItem("omni-theme", "dark");
  }, [setTheme]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const frame = window.requestAnimationFrame(() => {
      if (mobile.matches) {
        setIsChannelSidebarOpen(false);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isMemberDialogOpen) return;
    const dialog = memberDialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const returnFocus = memberDialogButtonRef.current ?? previousFocus;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []);
    window.requestAnimationFrame(() => focusable()[0]?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMemberDialogOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus();
    };
  }, [isMemberDialogOpen]);

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
    const frame = window.requestAnimationFrame(() => {
      setReplyToId(null);
      setThreadRootId(null);
    });
    if (activeChannelId) fetchMessages(activeChannelId);
    return () => window.cancelAnimationFrame(frame);
  }, [activeChannelId, fetchMessages]);

  useEffect(() => {
    if (!messages.length) {
      previousFirstMessageRef.current = null;
      return;
    }
    const previousFirst = previousFirstMessageRef.current;
    const previousIndex = previousFirst
      ? messages.findIndex((message) => message.id === previousFirst)
      : -1;

    if (previousIndex > 0) {
      // Loading an older cursor page must keep the former first row anchored.
      messageVirtualizer.scrollToIndex(previousIndex, { align: "start" });
    } else {
      const viewport = messageScrollRef.current;
      const nearBottom = !viewport ||
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 160;
      if (!previousFirst || nearBottom) {
        messageVirtualizer.scrollToIndex(messages.length - 1, { align: "end" });
      }
    }
    previousFirstMessageRef.current = messages[0].id;
  }, [messageScrollRef, messageVirtualizer, messages]);

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
  
  // Filter members for mention dropdown
  const mentionableMembers = mentionQuery === null
    ? []
    : members.filter((member) => {
        const query = mentionQuery.toLowerCase();
        return Boolean(
          member.profile?.username.toLowerCase().includes(query) ||
          member.profile?.displayName?.toLowerCase().includes(query)
        );
      });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openModal = (type: ModalType) => {
    setFormError(null);
    setModal(type);
    if (type === "editProfile" && profile) {
      setEditDisplayName(profile.displayName || "");
      setEditAvatarPreview(profile.avatarUrl || null);
    }
    if (type === "createChannel") setNewChannelCategoryId(categories[0]?.id || "");
  };

  const closeModal = () => {
    setModal(null);
    setFormError(null);
    setFormLoading(false);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
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
        body: JSON.stringify({ name: newChannelName.trim(), type: newChannelType, categoryId: newChannelCategoryId || null }),
      });
      if (res.ok) { setNewChannelName(""); closeModal(); await fetchSpaceData(activeSpaceId); }
      else setFormError((await res.json()).error);
    } catch (error: unknown) { setFormError(getErrorMessage(error)); }
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
      if (res.ok) { setNewCategoryName(""); closeModal(); await fetchSpaceData(activeSpaceId); }
      else setFormError((await res.json()).error);
    } catch (error: unknown) { setFormError(getErrorMessage(error)); }
    setFormLoading(false);
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm("Delete channel?")) return;
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

  const handleRenameCategory = async (categoryId: string) => {
    if (!renameValue.trim()) return;
    const response = await fetch(`/api/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    if (!response.ok) {
      setFormError((await response.json()).error || "Failed to rename category");
      return;
    }
    setRenamingId(null);
    setRenameValue("");
    if (activeSpaceId) await fetchSpaceData(activeSpaceId);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Delete this category and all of its channels?")) return;
    setContextMenu(null);
    const response = await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });
    if (!response.ok) {
      setFormError((await response.json()).error || "Failed to delete category");
      return;
    }
    if (activeSpaceId) await fetchSpaceData(activeSpaceId);
  };

  const handleDeleteSpace = async () => {
    if (!activeSpaceId || !confirm("Delete this space? This cannot be undone.")) return;
    await deleteSpace(activeSpaceId);
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      let avatarUrl = profile?.avatarUrl || null;
      if (editAvatarFile) {
        const fd = new FormData(); fd.append("file", editAvatarFile);
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
      if (res.ok) { setProfile(await res.json()); closeModal(); }
      else setFormError((await res.json()).error);
    } catch (error: unknown) { setFormError(getErrorMessage(error)); }
    setFormLoading(false);
  };

  const handleMemberAction = async (action: "kick" | "promote" | "demote") => {
    if (!selectedMember) return;
    setFormLoading(true);
    try {
      if (action === "kick") await fetch(`/api/members/${selectedMember.id}`, { method: "DELETE" });
      else await fetch(`/api/members/${selectedMember.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: action === "promote" ? "ADMIN" : "MEMBER" }),
      });
      if (activeSpaceId) await fetchSpaceData(activeSpaceId);
      closeModal(); setSelectedMember(null);
    } catch (error: unknown) { setFormError(getErrorMessage(error)); }
    setFormLoading(false);
  };

  const handleLeaveSpace = async () => {
    if (!activeSpaceId || !myMember) return;
    if (myMember.role === "OWNER") return alert("Owners cannot leave. Delete space instead.");
    if (!confirm("Leave this space?")) return;
    await fetch(`/api/members/${myMember.id}`, { method: "DELETE" });
    await fetchSpaces(); setActiveSpaceId(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeChannelId) return;
    
    let content = messageInput.trim();
    if (pendingFile) {
      const fd = new FormData(); fd.append("file", pendingFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) content = content ? `${content}\n![image](${(await res.json()).url})` : `![image](${(await res.json()).url})`;
      setPendingFile(null); setImagePreview(null);
    }
    if (!content) return;
    
    try {
      await sendMessage(activeChannelId, content, replyToId);
      setMessageInput("");
      setReplyToId(null);
      setActionError(null);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "Failed to send message"));
    }
  };

  const handleEditSubmit = async (msgId: string) => {
    if (!activeChannelId || !editingContent.trim()) return;
    try {
      await editMessage(activeChannelId, msgId, editingContent.trim());
      setEditingMsgId(null);
      setEditingContent("");
      setActionError(null);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "Failed to edit message"));
    }
  };

  const handleDeleteMessage = async (channelId: string, messageId: string) => {
    try {
      await deleteMessage(channelId, messageId);
      setActionError(null);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "Failed to delete message"));
    }
  };

  const handleToggleReaction = async (channelId: string, messageId: string, emoji: string) => {
    try {
      await toggleReaction(channelId, messageId, emoji);
      setActionError(null);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "Failed to update reaction"));
    }
  };

  const selectMention = (member: Member) => {
    const username = member.profile?.username;
    if (!username) return;
    setMessageInput((current) => current.replace(/@[a-z0-9_]*$/i, `@${username} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleMessageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null) {
      if (mentionableMembers.length === 0 && e.key !== "Escape") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionableMembers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionableMembers.length) % mentionableMembers.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const member = mentionableMembers[mentionIndex];
        if (member) {
          selectMention(member);
        }
      } else if (e.key === "Escape") {
        setMentionQuery(null);
      }
    } else {
      if (e.key === "Enter") handleSendMessage();
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageInput(val);
    const words = val.split(" ");
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith("@")) {
      setMentionQuery(lastWord.substring(1));
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const jumpToMessage = (messageId: string) => {
    const index = messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    messageVirtualizer.scrollToIndex(index, { align: "center" });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)?.focus();
    });
  };

  const renderMessageContent = (content: string) => {
    const imgMatch = content.match(/!\[.*?\]\((.*?)\)/);
    const textContent = content.replace(/!\[.*?\]\((.*?)\)/g, "").trim();
    
    return (
      <div className="space-y-2">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {textContent.split(/(@[a-z0-9_]+)/gi).map((part, i) => {
            if (/^@[a-z0-9_]+$/i.test(part)) {
              const username = part.substring(1);
              const isMe = profile?.username === username;
              return (
                <span key={i} className={`px-1 rounded font-semibold ${isMe ? "bg-blue-500/30 text-blue-400" : "bg-zinc-500/20 text-blue-400"}`}>
                  {part}
                </span>
              );
            }
            return part;
          })}
        </p>
        {imgMatch && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgMatch[1]} alt="uploaded" className="max-w-xs max-h-64 rounded-xl object-cover shadow-sm border border-zinc-200 dark:border-white/10" />
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-[#e4e4e7]">
      {/* 1. Unified Space and Channel sidebar */}
      <div className="fixed md:relative left-0 inset-y-0 md:inset-y-auto z-40 md:z-20 flex flex-col overflow-hidden border-r border-white/5 bg-[#111113] transition-all duration-300 shrink-0"
        style={{ width: isChannelSidebarOpen ? "240px" : "0px", opacity: isChannelSidebarOpen ? 1 : 0 }}>
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/5 px-3">
          <a href="/home" aria-label="Home" title="Home" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-tr from-blue-500 to-violet-600 text-sm font-bold text-white">Ω</a>
          <select
            aria-label={t("dashboard.selectSpace")}
            value={activeSpaceId ?? ""}
            onChange={(event) => setActiveSpaceId(event.target.value || null)}
            className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm font-semibold text-white outline-hidden focus:border-blue-500"
          >
            <option value="" disabled>{spaces.length ? t("dashboard.selectASpace") : t("dashboard.noSpaces")}</option>
            {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
          </select>
          <button onClick={() => openModal("createSpace")} title={t("dialog.createSpace")} aria-label={t("dialog.createSpace")}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {activeSpace ? (
          <>
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-4">
              <h2 className="truncate text-xs font-semibold text-zinc-400">{t("dashboard.spaceActions")}</h2>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(activeSpace.inviteCode);
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2000);
                  }}
                  title="Copy Invite Code"
                  className={`rounded p-1.5 transition-colors ${copiedInvite ? 'text-emerald-500' : (theme === 'dark' ? 'text-zinc-400 hover:bg-white/10 hover:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900')}`}
                >
                  {copiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                {isAdminOrOwner && (
                  <button onClick={() => openModal("createChannel")} title="Create Channel" className={`rounded p-1.5 transition-colors ${theme === 'dark' ? 'text-zinc-400 hover:bg-white/10 hover:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}><Plus className="h-4 w-4" /></button>
                )}
                {myMember?.role === "OWNER" ? (
                  <button onClick={handleDeleteSpace} title="Delete Space" className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                ) : myMember ? (
                  <button onClick={handleLeaveSpace} title="Leave Space" className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500"><LogOut className="h-4 w-4" /></button>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4 no-scrollbar">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <button onClick={() => {
                    const next = new Set(collapsedCats);
                    if (next.has(cat.id)) next.delete(cat.id);
                    else next.add(cat.id);
                    setCollapsedCats(next);
                  }}
                    onContextMenu={(e) => { e.preventDefault(); if (isAdminOrOwner) setContextMenu({ type: "category", id: cat.id, x: e.clientX, y: e.clientY, name: cat.name }); }}
                    className={`flex w-full items-center gap-1 px-1 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-800'}`}>
                    {collapsedCats.has(cat.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {renamingId === cat.id ? (
                      <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(cat.id); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => setRenamingId(null)}
                        className="flex-1 rounded px-1.5 py-0.5 text-xs outline-hidden bg-white text-black dark:bg-zinc-800 dark:text-white border border-blue-500" onClick={(e) => e.stopPropagation()} />
                    ) : <span className="flex-1 text-left">{cat.name}</span>}
                  </button>

                  {!collapsedCats.has(cat.id) && (
                    <div className="mt-1 space-y-0.5">
                      {channels.filter((c) => c.categoryId === cat.id).map((ch) => {
                        const isActive = ch.id === activeChannelId;
                        const unreads = unreadBadges[ch.id] || 0;
                        return (
                          <div key={ch.id} className="group flex items-center">
                            {renamingId === ch.id ? (
                              <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleRenameChannel(ch.id); if (e.key === "Escape") setRenamingId(null); }}
                                onBlur={() => setRenamingId(null)}
                                className="w-full rounded px-2 py-1 text-sm outline-hidden bg-white text-black dark:bg-zinc-800 dark:text-white border border-blue-500 ml-5" />
                            ) : (
                              <button onClick={() => { setActiveChannelId(ch.id); if (ch.type !== "TEXT") joinVoiceChannel(ch.id); }}
                                onContextMenu={(e) => { e.preventDefault(); if (isAdminOrOwner) setContextMenu({ type: "channel", id: ch.id, x: e.clientX, y: e.clientY, name: ch.name }); }}
                                className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${isActive ? (theme === 'dark' ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-700 font-medium') : (theme === 'dark' ? 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200' : 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900')}`}>
                                {ch.type === "TEXT" ? <Hash className="h-4 w-4 shrink-0 opacity-70" /> : <Volume2 className="h-4 w-4 shrink-0 opacity-70" />}
                                <span className="truncate text-left flex-1">{ch.name}</span>
                                {unreads > 0 && !isActive && (
                                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">{unreads}</span>
                                )}
                                {isActive && activeVoiceChannelId === ch.id && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
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
                <button onClick={() => openModal("createCategory")} className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-colors mt-2 ${theme === 'dark' ? 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-700'}`}>
                  <Plus className="h-3.5 w-3.5" /> {t("dashboard.addCategory")}
                </button>
              )}
            </div>

            {/* Profile Bar */}
            {profile && (
              <div className={`flex h-[60px] shrink-0 items-center gap-2 border-t px-3 ${theme === 'dark' ? 'border-white/5 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
                <button onClick={() => openModal("editProfile")} aria-label={t("dashboard.profile")} className="group relative shrink-0">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                    {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs uppercase font-bold">{profile.username.substring(0,2)}</span>}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Edit2 className="h-3.5 w-3.5 text-white" /></div>
                </button>
                <div className="flex flex-1 flex-col overflow-hidden leading-tight">
                  <span className="truncate text-sm font-semibold">{profile.displayName || profile.username}</span>
                  <span className={`truncate text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>@{profile.username}</span>
                </div>
                <button onClick={handleLogout} className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400" title="Log Out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-zinc-500">
            <Compass className="mb-3 h-9 w-9 stroke-1" />
            <p className="text-sm">{t("dashboard.empty.space")}</p>
          </div>
        )}
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#151518]">
        {activeChannel ? (
          <>
            {/* Top Bar */}
            <div className={`flex h-14 shrink-0 items-center justify-between border-b px-4 ${theme === 'dark' ? 'border-white/5' : 'border-zinc-200'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsChannelSidebarOpen(!isChannelSidebarOpen)} aria-label="Toggle channel sidebar" className={`rounded p-1.5 ${theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}>
                  {isChannelSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
                </button>
                <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
                <div className="flex items-center gap-2">
                  {activeChannel.type === "TEXT" ? <Hash className="h-5 w-5 text-zinc-400" /> : <Volume2 className="h-5 w-5 text-zinc-400" />}
                  <h1 className="text-base font-bold">{activeChannel.name}</h1>
                </div>
              </div>
              
              <button
                ref={memberDialogButtonRef}
                onClick={() => setIsMemberDialogOpen(true)}
                aria-label="View members"
                aria-haspopup="dialog"
                aria-expanded={isMemberDialogOpen}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Users className="h-5 w-5" />
                <span className="text-xs font-semibold">{members.length}</span>
              </button>
            </div>

            <VoiceGrid />

            {/* Messages */}
            <div
              ref={messageScrollRef}
              data-testid="message-viewport"
              className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar"
            >
              {messageHistoryCursor && (
                <div className="flex justify-center pb-3">
                  <button
                    type="button"
                    disabled={isLoadingOlderMessages}
                    onClick={() => void loadOlderMessages()}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                  >
                    {isLoadingOlderMessages ? "Loading…" : "Load older messages"}
                  </button>
                </div>
              )}
              <div
                data-testid="message-virtual-space"
                style={{ height: `${messageVirtualizer.getTotalSize()}px`, position: "relative" }}
              >
              {messageVirtualizer.getVirtualItems().map((virtualRow) => {
                const idx = virtualRow.index;
                const msg = messages[idx];
                const prevMsg = messages[idx - 1];
                const isConsecutive = prevMsg && prevMsg.profileId === msg.profileId && (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000);
                const isMe = msg.profileId === profile?.id;
                const isMentioned = profile
                  ? new RegExp(`(^|\\s)@${profile.username}(?=\\s|$|[.,!?;:])`, "i").test(msg.content)
                  : false;

                return (
                  <div key={msg.id}
                    ref={messageVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    data-testid="message-row"
                    data-message-id={msg.id}
                    tabIndex={-1}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`group relative flex gap-3 px-2 py-1 -mx-2 rounded-lg transition-colors ${isMentioned ? (theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')} ${!isConsecutive ? 'mt-4' : ''}`}>
                    
                    {/* Avatar or Timestamp */}
                    <div className="w-10 shrink-0 flex justify-center mt-0.5">
                      {!isConsecutive ? (
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                          {msg.profile?.avatarUrl ? <img src={msg.profile?.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs uppercase font-bold">{msg.profile?.username.substring(0,2)}</span>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {!isConsecutive && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span
                            className="text-[15px] font-bold"
                            style={{ color: msg.profile?.displayRole?.colorHex }}
                          >
                            {msg.profile?.displayName || msg.profile?.username}
                            {msg.profile?.displayRole?.badgeKey && (
                              <span className="ml-1 text-[10px] text-zinc-400" aria-label={`${msg.profile.displayRole.name} role, ${msg.profile.displayRole.badgeKey} badge`}>
                                [{msg.profile.displayRole.badgeKey}]
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-medium">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}

                      {msg.replyTo && (
                        <button
                          type="button"
                          onClick={() => jumpToMessage(msg.replyTo!.id)}
                          className="mb-1 flex max-w-full items-center gap-2 rounded border-l-2 border-blue-500/60 bg-white/[0.03] px-2 py-1 text-left text-xs text-zinc-400 hover:bg-white/[0.07]"
                        >
                          <Reply className="h-3 w-3 shrink-0" />
                          <span className="font-semibold text-zinc-300">{msg.replyTo.profile?.displayName || msg.replyTo.profile?.username}</span>
                          <span className="truncate">{messagePreview({ content: msg.replyTo.content, deletedAt: msg.replyTo.deletedAt ?? null })}</span>
                        </button>
                      )}

                      {editingMsgId === msg.id ? (
                        <div className="mt-1">
                          <input autoFocus aria-label="Edit message content" value={editingContent} onChange={(e) => setEditingContent(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleEditSubmit(msg.id); if (e.key === "Escape") setEditingMsgId(null); }}
                            className={`w-full rounded-lg px-3 py-2 text-sm outline-hidden border ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                          <p className="text-[10px] text-zinc-500 mt-1">escape to cancel • enter to save</p>
                        </div>
                      ) : msg.deletedAt ? (
                        <p className="text-sm italic text-zinc-500">{DELETED_MESSAGE_PREVIEW}</p>
                      ) : renderMessageContent(msg.content)}

                      {/* Edited Tag */}
                      {msg.editedAt && !editingMsgId && (
                        <span className="text-[10px] text-zinc-400 italic ml-2">(edited)</span>
                      )}

                      {/* Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {Object.entries(msg.reactions.reduce((acc, r) => {
                            acc[r.emoji] = acc[r.emoji] || [];
                            acc[r.emoji].push(r);
                            return acc;
                          }, {} as Record<string, Reaction[]>)).map(([emoji, reacts]) => {
                            const myReact = reacts.find(r => r.profileId === profile?.id);
                            return (
                              <button key={emoji} onClick={() => handleToggleReaction(activeChannel.id, msg.id, emoji)}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] transition-colors ${myReact ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold' : (theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600')}`}>
                                <span>{emoji}</span><span>{reacts.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {(msg._count?.threadReplies ?? 0) > 0 && (
                        <button type="button" onClick={() => setThreadRootId(msg.id)} className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-500/10">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {msg._count?.threadReplies} replies
                          {msg.threadReplies?.[0] && <span className="font-normal text-zinc-500">· {new Date(msg.threadReplies[0].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                        </button>
                      )}
                    </div>

                    {/* Hover Action Bar */}
                    <div className={`absolute -top-3 right-4 flex items-center rounded-lg border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}`}>
                      {!msg.deletedAt && <button aria-label="Reply to message" onClick={() => { setReplyToId(msg.id); inputRef.current?.focus(); }} className={`p-1.5 transition-colors ${theme === 'dark' ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-slate-100 text-zinc-600'}`}><Reply className="h-4 w-4" /></button>}
                      <button aria-label="Open thread" onClick={() => setThreadRootId(msg.id)} className={`p-1.5 transition-colors ${theme === 'dark' ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-slate-100 text-zinc-600'}`}><MessageSquare className="h-4 w-4" /></button>
                      <div className="relative group/emoji">
                        <button aria-label="Add reaction" className={`p-1.5 transition-colors ${theme === 'dark' ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-slate-100 text-zinc-600'}`}><Smile className="h-4 w-4" /></button>
                        <div className={`absolute bottom-full right-0 mb-1 hidden group-hover/emoji:flex gap-1 rounded-full px-2 py-1 border shadow-lg ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}`}>
                          {EMOJIS.map(e => (
                            <button key={e} aria-label={`React with ${e}`} onClick={() => handleToggleReaction(activeChannel.id, msg.id, e)} className="hover:scale-125 transition-transform p-1">{e}</button>
                          ))}
                        </div>
                      </div>
                      {!msg.deletedAt && (isMe || isAdminOrOwner) && (
                        <>
                          <div className={`w-px h-4 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                          {isMe && <button aria-label="Edit message" onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content); }} className={`p-1.5 transition-colors ${theme === 'dark' ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-slate-100 text-zinc-600'}`}><Edit2 className="h-4 w-4" /></button>}
                          <button aria-label="Delete message" onClick={() => handleDeleteMessage(activeChannel.id, msg.id)} className={`p-1.5 transition-colors ${theme === 'dark' ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'}`}><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>

                  </div>
                );
              })}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 pt-0">
              {actionError && (
                <div role="alert" className="mb-2 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  <span>{actionError}</span>
                  <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss error"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
              {replyToId && (() => {
                const target = messages.find((message) => message.id === replyToId);
                return target ? (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-zinc-300">
                    <Reply className="h-3.5 w-3.5 text-blue-400" />
                    <span>Replying to <strong>{target.profile?.displayName || target.profile?.username}</strong></span>
                    <span className="min-w-0 flex-1 truncate text-zinc-500">{messagePreview({ content: target.content, deletedAt: target.deletedAt ?? null })}</span>
                    <button type="button" onClick={() => setReplyToId(null)} aria-label="Cancel reply" className="rounded p-1 hover:bg-white/10"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : null;
              })()}
              {/* Image Preview */}
              {imagePreview && (
                <div className={`mb-2 inline-flex items-center gap-3 rounded-xl border p-2 shadow-sm ${theme === 'dark' ? 'bg-zinc-800 border-white/10' : 'bg-white border-slate-200'}`}>
                  <img src={imagePreview} alt="preview" className="h-16 w-16 rounded-lg object-cover" />
                  <span className="text-xs max-w-[200px] truncate">{pendingFile?.name}</span>
                  <button onClick={() => { setImagePreview(null); setPendingFile(null); }} className="p-1 rounded-full hover:bg-red-500/10 text-red-500 mr-1"><X className="h-4 w-4" /></button>
                </div>
              )}

              {/* Mention Dropdown */}
              {mentionQuery !== null && mentionableMembers.length > 0 && (
                <div className={`absolute bottom-20 left-6 z-10 w-64 rounded-xl border shadow-xl overflow-hidden ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}`}>
                  <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border-b ${theme === 'dark' ? 'border-zinc-700 text-zinc-400' : 'border-zinc-100 text-zinc-500'}`}>Members</div>
                  <div className="max-h-48 overflow-y-auto">
                    {mentionableMembers.map((m, idx) => (
                      <button type="button" key={m.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(m)} className={`flex w-full items-center gap-2 px-3 py-2 cursor-pointer text-left ${idx === mentionIndex ? (theme === 'dark' ? 'bg-blue-600/20' : 'bg-blue-50') : (theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-slate-50')}`}>
                        <div className={`h-6 w-6 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`}>
                          {m.profile?.avatarUrl ? <img src={m.profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold uppercase">{m.profile?.username.substring(0,2)}</span>}
                        </div>
                        <span className="text-sm font-medium">{m.profile?.displayName || m.profile?.username}</span>
                        <span className={`text-xs ml-auto ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>@{m.profile?.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={`relative flex items-end gap-2 rounded-2xl border px-3 py-1.5 transition-shadow focus-within:ring-2 focus-within:ring-blue-500/20 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-slate-100 border-slate-200'}`}>
                <input type="file" ref={fileInputRef} accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0]; if(!f) return; setPendingFile(f);
                  const r = new FileReader(); r.onload=()=>setImagePreview(r.result as string); r.readAsDataURL(f); e.target.value = "";
                }} className="hidden" />
                
                <button type="button" onClick={() => fileInputRef.current?.click()} className={`mb-1.5 rounded-full p-2 transition-colors ${theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-zinc-500 hover:bg-slate-200 hover:text-slate-700'}`}>
                  <ImageIcon className="h-5 w-5" />
                </button>
                
                <input ref={inputRef} type="text"
                  className="flex-1 bg-transparent py-3 text-[15px] outline-hidden placeholder:text-zinc-400"
                  placeholder={`Message #${activeChannel.name}`}
                  value={messageInput}
                  onChange={handleMessageInputChange}
                  onKeyDown={handleMessageInputKeyDown}
                />
                
                <button onClick={() => handleSendMessage()} disabled={!messageInput.trim() && !pendingFile}
                  className={`mb-1.5 rounded-full p-2 transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                  <Send className="h-4 w-4 ml-0.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center opacity-60">
            <Compass className="h-12 w-12 stroke-1 mb-4" />
            <h3 className="text-lg font-bold mb-1">{t("dashboard.welcome")}</h3>
            <p className="text-sm">{t("dashboard.selectChannel")}</p>
          </div>
        )}
      </div>

      {threadRootId && activeChannelId && profile && (
        <ThreadPanel
          channelId={activeChannelId}
          rootId={threadRootId}
          currentProfileId={profile.id}
          onClose={() => setThreadRootId(null)}
        />
      )}

      {/* Member directory overlay: never consumes a permanent layout column. */}
      {isMemberDialogOpen && activeSpace && (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsMemberDialogOpen(false);
          }}
        >
          <div
            ref={memberDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="members-dialog-title"
            className="flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#111113] shadow-2xl"
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/5 px-4">
              <Users className="h-4 w-4 text-zinc-500" />
              <h2 id="members-dialog-title" className="flex-1 text-sm font-bold">{t("dashboard.members")}</h2>
              <span className="text-xs text-zinc-500">{members.length}</span>
              <button autoFocus onClick={() => setIsMemberDialogOpen(false)} aria-label={t("dialog.closeMembers")} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {members.map((member) => {
                const isOnline = !!presenceUsers[member.profileId];
                const isMe = member.profileId === profile?.id;
                return (
                  <button key={member.id} disabled={isMe || !isAdminOrOwner}
                    onClick={() => { setIsMemberDialogOpen(false); setSelectedMember(member); openModal("memberActions"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors enabled:hover:bg-white/5 disabled:cursor-default">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
                      {member.profile?.avatarUrl ? <img src={member.profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold uppercase">{member.profile?.username.substring(0,2)}</span>}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#111113]" style={{ backgroundColor: isOnline ? "#10b981" : "#64748b" }} />
                    </div>
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-semibold"
                      style={{ color: member.profile?.displayRole?.colorHex }}
                    >
                      {member.profile?.displayName || member.profile?.username}
                      {member.profile?.displayRole?.badgeKey && (
                        <span className="ml-1 text-[10px] text-zinc-400" aria-label={`${member.profile.displayRole.name} role, ${member.profile.displayRole.badgeKey} badge`}>
                          [{member.profile.displayRole.badgeKey}]
                        </span>
                      )}
                    </span>
                    {member.role === "OWNER" && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                    {member.role === "ADMIN" && <Shield className="h-3.5 w-3.5 text-blue-500" />}
                    {isMe && <span className="text-[10px] text-zinc-500">You</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Context Menu ────────────────────────────────────────────── */}
      {contextMenu && (
        <div className={`fixed z-[100] min-w-[160px] rounded-xl border shadow-2xl p-1.5 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}`}
          style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
            onClick={() => { setRenamingId(contextMenu.id); setRenameValue(contextMenu.name); setContextMenu(null); }}>
            <Edit2 className="h-4 w-4" /> Rename
          </button>
          {contextMenu.type === "channel" && (
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              onClick={() => handleDeleteChannel(contextMenu.id)}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          {contextMenu.type === "category" && (
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              onClick={() => handleDeleteCategory(contextMenu.id)}>
              <Trash2 className="h-4 w-4" /> Delete with channels
            </button>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${theme === 'dark' ? 'bg-zinc-900 border border-zinc-800' : 'bg-white'}`}>
            {modal === "createSpace" && (
              <form onSubmit={handleCreateSpace} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dialog.createSpace")}</h2>
                <input autoFocus value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} placeholder="Space Name" className={`w-full rounded-xl px-4 py-3 outline-hidden border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'}`} />
                <input value={newSpaceAvatar} onChange={(e) => setNewSpaceAvatar(e.target.value)} placeholder="Avatar URL (Optional)" className={`w-full rounded-xl px-4 py-3 outline-hidden border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'}`} />
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className={`flex-1 rounded-xl py-3 font-bold transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>{t("common.cancel")}</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">{t("dialog.create")}</button>
                </div>
                <div className="my-2 flex items-center gap-2"><div className={`flex-1 h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} /><span className="text-xs text-zinc-500">{t("dialog.or")}</span><div className={`flex-1 h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} /></div>
                <button type="button" onClick={() => setModal("joinSpace")} className={`w-full rounded-xl py-3 font-bold transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>{t("dialog.joinWithCode")}</button>
              </form>
            )}

            {modal === "joinSpace" && (
              <form onSubmit={handleJoinSpace} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dialog.joinSpace")}</h2>
                <input autoFocus value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} placeholder="Invite Code" className={`w-full rounded-xl px-4 py-3 outline-hidden border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'}`} />
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModal("createSpace")} className={`flex-1 rounded-xl py-3 font-bold transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>{t("dialog.back")}</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">{t("dialog.join")}</button>
                </div>
              </form>
            )}

            {modal === "createChannel" && (
              <form onSubmit={handleCreateChannel} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dialog.createChannel")}</h2>
                <div>
                  <label className="mb-2 block text-xs font-bold text-zinc-500">CATEGORY (OPTIONAL)</label>
                  <select value={newChannelCategoryId} onChange={(e) => setNewChannelCategoryId(e.target.value)} className={`w-full rounded-xl px-4 py-3 outline-hidden border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200'}`}>
                    <option value="">No Category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-zinc-500">CHANNEL TYPE</label>
                  <div className="flex gap-2">
                    {(["TEXT", "VOICE", "STAGE"] as const).map(t => (
                      <button key={t} type="button" onClick={() => setNewChannelType(t)} className={`flex-1 rounded-xl border py-3 text-sm font-bold transition-colors ${newChannelType === t ? 'border-blue-500 bg-blue-500/10 text-blue-500' : (theme === 'dark' ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800' : 'border-slate-200 bg-slate-50 text-zinc-500 hover:bg-slate-100')}`}>
                        {t === "TEXT" ? <Hash className="mx-auto mb-1 h-5 w-5" /> : <Volume2 className="mx-auto mb-1 h-5 w-5" />} {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-zinc-500">CHANNEL NAME</label>
                  <input autoFocus value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="new-channel" className={`w-full rounded-xl px-4 py-3 outline-hidden border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'}`} />
                </div>
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className={`flex-1 rounded-xl py-3 font-bold transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>Cancel</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">Create</button>
                </div>
              </form>
            )}

            {modal === "createCategory" && (
              <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dialog.createCategory")}</h2>
                <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="CATEGORY NAME" className={`w-full rounded-xl px-4 py-3 outline-hidden border uppercase ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'}`} />
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className={`flex-1 rounded-xl py-3 font-bold transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>Cancel</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">Create</button>
                </div>
              </form>
            )}

            {modal === "editProfile" && (
              <form onSubmit={handleEditProfile} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dashboard.profile")}</h2>
                <LocaleSettings />
                <SoundSettings value={soundPreference} onChange={updateSoundPreference} />
                <div className="flex justify-center">
                  <div className="relative group overflow-hidden rounded-full h-24 w-24 border-4 border-zinc-800 bg-zinc-900 cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
                    {editAvatarPreview ? <img src={editAvatarPreview} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-2xl font-bold uppercase">{profile?.username.substring(0,2)}</div>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-xs font-bold text-white">
                      <Edit2 className="h-4 w-4 mb-1" /> Change
                    </div>
                    <input type="file" id="avatar-upload" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]; if (!f) return; setEditAvatarFile(f);
                      const r = new FileReader(); r.onload=()=>setEditAvatarPreview(r.result as string); r.readAsDataURL(f);
                    }} />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-zinc-500">DISPLAY NAME</label>
                  <input autoFocus value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder={profile?.username} className={`w-full rounded-xl px-4 py-3 outline-hidden border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'}`} />
                </div>
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className={`flex-1 rounded-xl py-3 font-bold transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>Cancel</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">Save</button>
                </div>
              </form>
            )}

            {modal === "memberActions" && selectedMember && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    {selectedMember.profile?.avatarUrl ? <img src={selectedMember.profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="h-full w-full flex items-center justify-center font-bold uppercase">{selectedMember.profile?.username.substring(0,2)}</span>}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedMember.profile?.displayName || selectedMember.profile?.username}</h2>
                    <p className="text-xs text-zinc-500">@{selectedMember.profile?.username} • {selectedMember.role}</p>
                  </div>
                </div>
                <div className={`h-px w-full ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                <div className="flex flex-col gap-2">
                  {selectedMember.role !== "ADMIN" && (
                    <button onClick={() => handleMemberAction("promote")} disabled={formLoading} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
                      <Shield className="h-5 w-5 text-blue-500" /> <span className="font-bold">Promote to Admin</span>
                    </button>
                  )}
                  {selectedMember.role === "ADMIN" && myMember?.role === "OWNER" && (
                    <button onClick={() => handleMemberAction("demote")} disabled={formLoading} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
                      <UserMinus className="h-5 w-5 text-yellow-500" /> <span className="font-bold">Demote to Member</span>
                    </button>
                  )}
                  <button onClick={() => handleMemberAction("kick")} disabled={formLoading} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors">
                    <UserMinus className="h-5 w-5" /> <span className="font-bold">Kick from Space</span>
                  </button>
                </div>
                {formError && <p className="text-sm text-red-500">{formError}</p>}
                <button onClick={closeModal} className={`mt-2 w-full rounded-xl py-3 font-bold transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-slate-100 hover:bg-slate-200'}`}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
