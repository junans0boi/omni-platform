"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, Member, Reaction } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { useRealtime } from "@/hooks/useRealtime";
import { getErrorMessage } from "@/lib/errors";
import {
  Hash, Volume2, Plus, Compass, LogOut, Trash2, Copy, X, Send,
  Users, ChevronDown, ChevronRight, ChevronLeft, Edit2, Crown, Shield, UserMinus,
  ImageIcon, Smile, PanelLeftClose, PanelLeft, Check, MessageSquare, Reply, Settings, UserPlus, Lock, Paperclip
} from "lucide-react";
import VoiceGrid from "@/components/VoiceGrid";

import { SettingsModal } from "@/components/SettingsModal";
import { SpaceSettingsModal } from "@/components/SpaceSettingsModal";
import { FriendsPanel } from "@/components/FriendsPanel";
import { ChannelHeaderExtras } from "@/components/ChannelHeaderExtras";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { getSoundEffects } from "@/lib/browser-sound-effects";
import { DEFAULT_SOUND_PREFERENCE } from "@/lib/sound-effects";
import { readSoundPreference } from "@/lib/sound-preference-storage";
import type { MentionDraft } from "@/lib/mentions";
import { useI18n } from "@/i18n/I18nProvider";
import { useBoundedVirtualList } from "@/hooks/useBoundedVirtualList";
import { useFriendsAndDms } from "@/hooks/useFriendsAndDms";
import { ThreadPanel } from "@/components/ThreadPanel";
import { DELETED_MESSAGE_PREVIEW, messagePreview } from "@/lib/message-threads";

type ModalType =
  | "createSpace"
  | "joinSpace"
  | "createChannel"
  | "createCategory"
  | "editProfile"
  | "editSpace"
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
    theme, themeName, unreadBadges, dmUnreadBadges, pendingFriendRequestCount,
    setTheme, setThemeName, setProfile, fetchSpaces, fetchSpaceData, fetchMessages,
    createSpace, joinSpace, deleteSpace, sendMessage, editMessage, deleteMessage, toggleReaction,
    setActiveSpaceId, setActiveChannelId, joinVoiceChannel, leaveVoiceChannel, activeVoiceChannelId,
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
    themeName: state.themeName,
    unreadBadges: state.unreadBadges,
    dmUnreadBadges: state.dmUnreadBadges,
    pendingFriendRequestCount: state.pendingFriendRequestCount,
    setTheme: state.setTheme,
    setThemeName: state.setThemeName,
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
    leaveVoiceChannel: state.leaveVoiceChannel,
    activeVoiceChannelId: state.activeVoiceChannelId,
  })));

  useRealtime();
  const friendsAndDms = useFriendsAndDms();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpaceSettingsOpen, setIsSpaceSettingsOpen] = useState(false);
  const [mainView, setMainView] = useState<"space" | "friends">("space");
  const [showAddFriend, setShowAddFriend] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

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
  const [newChannelMode, setNewChannelMode] = useState<"GENERAL" | "MEETING" | "LECTURE">("GENERAL");
  const [newChannelCategoryId, setNewChannelCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editSpaceName, setEditSpaceName] = useState("");
  const [editSpaceAvatarFile, setEditSpaceAvatarFile] = useState<File | null>(null);
  const [editSpaceAvatarPreview, setEditSpaceAvatarPreview] = useState<string | null>(null);
  const [editAvailability, setEditAvailability] = useState<"AVAILABLE" | "IDLE" | "DND">("AVAILABLE");
  const [editCustomStatus, setEditCustomStatus] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ type: "channel" | "category"; id: string; x: number; y: number; name: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const storedSoundPreference = useMemo(
    () => profile && typeof window !== "undefined"
      ? readSoundPreference(profile.id, window.localStorage)
      : { ...DEFAULT_SOUND_PREFERENCE },
    [profile],
  );

  useEffect(() => {
    getSoundEffects()?.setPreference(storedSoundPreference);
  }, [storedSoundPreference]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolvedMode: "light" | "dark" = "dark";
      let resolvedName: "default" | "transmission" | "night-signal" = "default";
      try {
        const storedMode = window.localStorage.getItem("omni-theme");
        const storedName = window.localStorage.getItem("omni-theme-name");
        if (storedMode === "light" || storedMode === "dark") resolvedMode = storedMode;
        if (storedName === "default" || storedName === "transmission" || storedName === "night-signal") resolvedName = storedName;
      } catch {}
      try {
        const res = await fetch("/api/user-preferences");
        if (res.ok) {
          const pref = await res.json();
          if (pref.themeMode === "light" || pref.themeMode === "dark") resolvedMode = pref.themeMode;
          if (pref.themeName === "default" || pref.themeName === "transmission" || pref.themeName === "night-signal") resolvedName = pref.themeName;
        }
      } catch {}
      if (cancelled) return;
      setTheme(resolvedMode);
      setThemeName(resolvedName);
      document.documentElement.classList.toggle("dark", resolvedMode === "dark");
      document.documentElement.setAttribute("data-theme-name", resolvedName);
      try {
        window.localStorage.setItem("omni-theme", resolvedMode);
        window.localStorage.setItem("omni-theme-name", resolvedName);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [setTheme, setThemeName]);

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
        if (!res.ok) { window.location.href = "/login"; return; }
        const data = await res.json();
        if (data.user) setProfile(data.user);
        await fetchSpaces();
      } catch { window.location.href = "/login"; }
    };
    checkAuth();
  }, [setProfile, fetchSpaces]);

  const hasAutoSelectedSpaceRef = useRef(false);
  useEffect(() => {
    if (spaces.length > 0 && !activeSpaceId && !hasAutoSelectedSpaceRef.current) {
      hasAutoSelectedSpaceRef.current = true;
      setActiveSpaceId(spaces[0].id);
    }
  }, [spaces, activeSpaceId, setActiveSpaceId]);

  useEffect(() => {
    if (activeSpaceId) fetchSpaceData(activeSpaceId);
  }, [activeSpaceId, fetchSpaceData]);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);

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
      setEditAvailability(profile.availability ?? "AVAILABLE");
      setEditCustomStatus(profile.customStatus ?? "");
    }
    if (type === "editSpace" && activeSpace) {
      setEditSpaceName(activeSpace.name || "");
      setEditSpaceAvatarPreview(activeSpace.avatarUrl || null);
      setEditSpaceAvatarFile(null);
    }
    if (type === "createChannel") setNewChannelCategoryId(categories[0]?.id || "");
  };

  const closeModal = () => {
    setModal(null);
    setFormError(null);
    setFormLoading(false);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setEditSpaceAvatarFile(null);
    setEditSpaceAvatarPreview(null);
  };

  const handleEditSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpaceId || !editSpaceName.trim()) return;
    setFormLoading(true);
    try {
      let avatarUrl = activeSpace?.avatarUrl || null;
      if (editSpaceAvatarFile) {
        const fd = new FormData(); fd.append("file", editSpaceAvatarFile);
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (upRes.ok) avatarUrl = upData.url;
        else { setFormError(upData.error); setFormLoading(false); return; }
      }
      const res = await fetch(`/api/spaces/${activeSpaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editSpaceName.trim(),
          avatarUrl,
        }),
      });
      if (res.ok) {
        await fetchSpaces();
        await fetchSpaceData(activeSpaceId);
        closeModal();
      } else setFormError((await res.json()).error);
    } catch (error: unknown) { setFormError(getErrorMessage(error)); }
    setFormLoading(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleThemeChange = (name: "default" | "transmission" | "night-signal", mode: "light" | "dark") => {
    setTheme(mode);
    setThemeName(name);
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.setAttribute("data-theme-name", name);
    try {
      window.localStorage.setItem("omni-theme", mode);
      window.localStorage.setItem("omni-theme-name", name);
    } catch {}
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
          mode: newChannelMode,
          categoryId: newChannelCategoryId || null,
        }),
      });
      if (res.ok) {
        const createdChannel = await res.json();
        setNewChannelName("");
        closeModal();
        await fetchSpaceData(activeSpaceId);
        if (createdChannel?.id) {
          setActiveChannelId(createdChannel.id);
        }
      } else {
        setFormError((await res.json()).error);
      }
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
    if (!activeSpaceId || !confirm("이 채널을 정말 삭제하시겠습니까?")) return;
    setContextMenu(null);
    try {
      const res = await fetch(`/api/spaces/${activeSpaceId}/channels/${channelId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchSpaceData(activeSpaceId);
        if (activeChannelId === channelId) {
          const remaining = channels.filter((c) => c.id !== channelId);
          setActiveChannelId(remaining[0]?.id || null);
        }
        if (activeVoiceChannelId === channelId) {
          leaveVoiceChannel();
        }
      }
    } catch {
      // Ignore
    }
  };

  const handleRenameChannel = async (channelId: string) => {
    if (!activeSpaceId || !renameValue.trim()) return;
    try {
      await fetch(`/api/spaces/${activeSpaceId}/channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setRenamingId(null);
      setRenameValue("");
      await fetchSpaceData(activeSpaceId);
    } catch {
      // Ignore
    }
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
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          avatarUrl,
          availability: editAvailability,
          customStatus: editCustomStatus,
        }),
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

  const sendingChannelMessageRef = useRef(false);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (sendingChannelMessageRef.current || !activeChannelId) return;
    
    let content = messageInput.trim();
    if (!content && !pendingFile) return;

    sendingChannelMessageRef.current = true;
    setMessageInput("");

    try {
      if (pendingFile) {
        const fd = new FormData(); fd.append("file", pendingFile);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const uploadData = await res.json();
          const fileTag = uploadData.isImage
            ? `![${uploadData.originalName || "image"}](${uploadData.url})`
            : `📎 [${uploadData.originalName || "file"}](${uploadData.url})`;
          content = content ? `${content}\n${fileTag}` : fileTag;
        }
        setPendingFile(null); setImagePreview(null);
      }
      if (!content) return;

      const mentions: MentionDraft[] = [];
      if (/(^|\s)@everyone\b/i.test(content)) mentions.push({ kind: "EVERYONE" });
      if (/(^|\s)@here\b/i.test(content)) mentions.push({ kind: "HERE" });
      for (const member of members) {
        const username = member.profile?.username;
        if (username && new RegExp(`(^|\\s)@${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(content)) {
          mentions.push({ kind: "PROFILE", profileId: member.profileId });
        }
      }
      
      await sendMessage(activeChannelId, content, replyToId, mentions);
      setReplyToId(null);
      setActionError(null);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "Failed to send message"));
    } finally {
      sendingChannelMessageRef.current = false;
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
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
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
    const imgMatch = content.match(/!\[(.*?)\]\((.*?)\)/);
    const fileMatch = content.match(/📎 \[(.*?)\]\((.*?)\)/);
    const textContent = content
      .replace(/!\[(.*?)\]\((.*?)\)/g, "")
      .replace(/📎 \[(.*?)\]\((.*?)\)/g, "")
      .trim();

    return (
      <div className="space-y-2">
        {textContent && (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {textContent.split(/(@[a-z0-9_]+)/gi).map((part, i) => {
              if (/^@[a-z0-9_]+$/i.test(part)) {
                const username = part.substring(1);
                const isMe = profile?.username === username;
                return (
                  <span key={i} className={`px-1 rounded font-semibold ${isMe ? "bg-accent-soft text-accent" : "bg-surface-2 text-accent"}`}>
                    {part}
                  </span>
                );
              }
              return part;
            })}
          </p>
        )}
        {imgMatch && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgMatch[2]} alt={imgMatch[1] || "uploaded image"} className="max-w-xs max-h-64 rounded-xl object-cover shadow-sm border border-line cursor-pointer hover:opacity-95 transition" onClick={() => window.open(imgMatch[2], "_blank")} />
        )}
        {fileMatch && (
          <a
            href={fileMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2.5 text-xs font-semibold text-text hover:bg-surface-3 transition max-w-xs"
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

  // ── Render ────────────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg text-text">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-xs font-semibold text-muted">Loading Omni Platform...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      {/* 1. Unified Space and Channel sidebar */}
      <div className="fixed md:relative left-0 inset-y-0 md:inset-y-auto z-40 md:z-20 flex flex-col overflow-hidden border-r border-line bg-surface transition-all duration-300 shrink-0"
        style={{ width: isChannelSidebarOpen ? "240px" : "0px", opacity: isChannelSidebarOpen ? 1 : 0 }}>
        {/* Top Header: Brand Name & Settings Icon */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-3">
          <div className="flex items-center gap-2">
            <a href="/home" aria-label="Home" title="Home" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]">Ω</a>
            <span className="font-extrabold text-xs tracking-tight text-text">Omni Platform</span>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} title={t("settings.title")} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text transition">
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Global Switcher Tabs ([💬 스페이스] | [👥 친구/DM]) */}
        <div className="p-2 border-b border-line">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1">
            <button
              onClick={() => setMainView("space")}
              className={`relative flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                mainView === "space"
                  ? "bg-accent text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                  : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>스페이스</span>
              {(() => {
                const totalChannelUnreads = Object.values(unreadBadges).reduce((a, b) => a + b, 0);
                return totalChannelUnreads > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-on-accent">
                    {totalChannelUnreads}
                  </span>
                ) : null;
              })()}
            </button>
            <button
              onClick={() => setMainView("friends")}
              className={`relative flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                mainView === "friends"
                  ? "bg-accent text-on-accent shadow-md shadow-[0_4px_12px_-2px_var(--accent)]"
                  : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>친구/DM</span>
              {(() => {
                const totalDmUnreads = Object.values(dmUnreadBadges).reduce((a, b) => a + b, 0);
                const totalFriendsBadge = pendingFriendRequestCount + totalDmUnreads;
                return totalFriendsBadge > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-on-accent">
                    {totalFriendsBadge}
                  </span>
                ) : null;
              })()}
            </button>
          </div>
        </div>

        {mainView === "space" && (
          <>
            {/* Header Bar: space list header, or back-chevron + name when a space is active */}
            {activeSpaceId ? (
              <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
                <button
                  onClick={() => setActiveSpaceId(null)}
                  aria-label={t("dashboard.selectSpace")}
                  className="rounded-xl border border-line bg-surface p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text">
                  {activeSpace?.name}
                </span>
                <button
                  onClick={() => setIsSpaceSettingsOpen(true)}
                  title="스페이스 설정"
                  aria-label="스페이스 설정"
                  className="rounded-xl border border-line bg-surface p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">스페이스</span>
                <button onClick={() => openModal("createSpace")} title={t("dialog.createSpace")} aria-label={t("dialog.createSpace")}
                  className="rounded-xl border border-line bg-surface p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            {activeSpace ? (
              <>
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-4">
              <h2 className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">{t("dashboard.spaceActions")}</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeSpace.inviteCode);
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2000);
                  }}
                  title={t("dashboard.copyInvite")}
                  className={`rounded-lg p-1 transition-colors ${copiedInvite ? 'text-online' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
                >
                  {copiedInvite ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => openModal("createChannel")} title={t("dialog.createChannel")} className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-2 hover:text-text"><Plus className="h-3.5 w-3.5" /></button>
                {isAdminOrOwner && (
                  <button onClick={() => openModal("editSpace")} title="스페이스 프로필/설정 변경" className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-2 hover:text-text"><Edit2 className="h-3.5 w-3.5" /></button>
                )}
                {myMember?.role === "OWNER" ? (
                  <button onClick={handleDeleteSpace} title={t("dashboard.deleteSpace")} className="rounded-lg p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                ) : myMember ? (
                  <button onClick={handleLeaveSpace} title={t("dashboard.leaveSpace")} className="rounded-lg p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"><LogOut className="h-3.5 w-3.5" /></button>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 no-scrollbar">
              {/* Quick Channel Create Button */}
              <button
                onClick={() => openModal("createChannel")}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-accent bg-accent-soft px-3 py-2 text-xs font-extrabold text-accent transition hover:bg-accent-soft shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>채널 생성 (자유 / 회의 / 강의 모드)</span>
              </button>

              {/* Channel List & Empty Fallbacks */}
              {(() => {
                const validCatIds = new Set(categories.map((cat) => cat.id));
                const uncategorizedChannels = channels.filter((c) => !c.categoryId || !validCatIds.has(c.categoryId));

                if (channels.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-4 text-center mt-4 space-y-2">
                      <span className="text-xs text-muted">채널이 아직 없습니다.</span>
                      <button onClick={() => openModal("createChannel")} className="flex items-center gap-1 text-xs font-bold text-accent bg-accent-soft hover:bg-accent-soft px-3 py-1.5 rounded-lg border border-accent transition">
                        <Plus className="h-3.5 w-3.5" />
                        <span>채널 만들기</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Uncategorized / General Channels */}
                    {(uncategorizedChannels.length > 0 || categories.length === 0) && (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between px-2 py-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">일반 채널 (General)</span>
                          <button onClick={() => { setNewChannelCategoryId(""); openModal("createChannel"); }} title="채널 추가" className="text-muted hover:text-text transition">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {uncategorizedChannels.map((ch) => {
                          const isActive = ch.id === activeChannelId;
                          const unreads = unreadBadges[ch.id] || 0;
                          return (
                            <div key={ch.id} className="group relative flex items-center">
                              {renamingId === ch.id ? (
                                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleRenameChannel(ch.id); if (e.key === "Escape") setRenamingId(null); }}
                                  onBlur={() => setRenamingId(null)}
                                  className="w-full rounded px-2 py-1 text-sm outline-hidden bg-surface-2 text-text border border-accent ml-2" />
                              ) : (
                                <>
                                  <button onClick={() => { setActiveChannelId(ch.id); if (ch.type !== "TEXT") joinVoiceChannel(ch.id); }}
                                    onContextMenu={(e) => { e.preventDefault(); if (isAdminOrOwner) setContextMenu({ type: "channel", id: ch.id, x: e.clientX, y: e.clientY, name: ch.name }); }}
                                    className={`flex flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition ${isActive ? 'bg-accent-soft text-text border border-accent font-semibold' : 'text-muted hover:bg-surface-2 hover:text-text'}`}>
                                    {ch.type === "TEXT" ? <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <Volume2 className="h-3.5 w-3.5 shrink-0 opacity-70 text-accent" />}
                                    <span className="truncate text-left flex-1 flex items-center gap-1">
                                      <span>{ch.name}</span>
                                      {ch.isPrivate && <span title="비공개 채널"><Lock className="h-3 w-3 shrink-0 text-danger inline" /></span>}
                                    </span>
                                    {ch.mode === "LECTURE" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-soft text-accent">강의</span>}
                                    {ch.mode === "MEETING" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-soft text-accent">회의</span>}
                                    {unreads > 0 && !isActive && (
                                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">{unreads}</span>
                                    )}
                                    {isActive && activeVoiceChannelId === ch.id && <span className="ml-auto h-2 w-2 rounded-full bg-online animate-pulse" />}
                                  </button>

                                  {/* Hover Actions */}
                                  {isAdminOrOwner && (
                                    <div className="absolute right-1.5 hidden group-hover:flex items-center gap-1 bg-surface-2 rounded-lg p-0.5 border border-line shadow-md">
                                      <button onClick={() => { setRenamingId(ch.id); setRenameValue(ch.name); }} title="채널 이름 변경" className="p-1 text-muted hover:text-text transition">
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button onClick={() => handleDeleteChannel(ch.id)} title="채널 삭제" className="p-1 text-muted hover:text-danger transition">
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Categorized Channels */}
              {categories.map((cat) => (
                <div key={cat.id} className="group/cat">
                  <div className="flex items-center justify-between px-1 py-1">
                    <button onClick={() => {
                      const next = new Set(collapsedCats);
                      if (next.has(cat.id)) next.delete(cat.id);
                      else next.add(cat.id);
                      setCollapsedCats(next);
                    }}
                      onContextMenu={(e) => { e.preventDefault(); if (isAdminOrOwner) setContextMenu({ type: "category", id: cat.id, x: e.clientX, y: e.clientY, name: cat.name }); }}
                      className="flex flex-1 items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-muted hover:text-text transition">
                      {collapsedCats.has(cat.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {renamingId === cat.id ? (
                        <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(cat.id); if (e.key === "Escape") setRenamingId(null); }}
                          onBlur={() => setRenamingId(null)}
                          className="flex-1 rounded px-1.5 py-0.5 text-xs outline-hidden bg-surface-2 text-text border border-accent" onClick={(e) => e.stopPropagation()} />
                      ) : <span className="flex-1 text-left">{cat.name}</span>}
                    </button>

                    {isAdminOrOwner && (
                      <div className="flex items-center gap-1 opacity-0 group-hover/cat:opacity-100 transition">
                        <button onClick={() => { setNewChannelCategoryId(cat.id); openModal("createChannel"); }} title="카테고리에 채널 추가" className="p-0.5 text-muted hover:text-text transition">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDeleteCategory(cat.id)} title="카테고리 삭제" className="p-0.5 text-muted hover:text-danger transition">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {!collapsedCats.has(cat.id) && (
                    <div className="mt-1 space-y-0.5">
                      {channels.filter((c) => c.categoryId === cat.id).map((ch) => {
                        const isActive = ch.id === activeChannelId;
                        const unreads = unreadBadges[ch.id] || 0;
                        return (
                          <div key={ch.id} className="group relative flex items-center">
                            {renamingId === ch.id ? (
                              <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleRenameChannel(ch.id); if (e.key === "Escape") setRenamingId(null); }}
                                onBlur={() => setRenamingId(null)}
                                className="w-full rounded px-2 py-1 text-sm outline-hidden bg-surface-2 text-text border border-accent ml-5" />
                            ) : (
                              <>
                                <button onClick={() => { setActiveChannelId(ch.id); if (ch.type !== "TEXT") joinVoiceChannel(ch.id); }}
                                  onContextMenu={(e) => { e.preventDefault(); if (isAdminOrOwner) setContextMenu({ type: "channel", id: ch.id, x: e.clientX, y: e.clientY, name: ch.name }); }}
                                  className={`flex flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition ${isActive ? 'bg-accent-soft text-text border border-accent font-semibold' : 'text-muted hover:bg-surface-2 hover:text-text'}`}>
                                  {ch.type === "TEXT" ? <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <Volume2 className="h-3.5 w-3.5 shrink-0 opacity-70 text-accent" />}
                                  <span className="truncate text-left flex-1 flex items-center gap-1">
                                    <span>{ch.name}</span>
                                    {ch.isPrivate && <span title="비공개 채널"><Lock className="h-3 w-3 shrink-0 text-danger inline" /></span>}
                                  </span>
                                  {ch.mode === "LECTURE" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-soft text-accent">강의</span>}
                                  {ch.mode === "MEETING" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-soft text-accent">회의</span>}
                                  {unreads > 0 && !isActive && (
                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">{unreads}</span>
                                  )}
                                  {isActive && activeVoiceChannelId === ch.id && <span className="ml-auto h-2 w-2 rounded-full bg-online animate-pulse" />}
                                </button>

                                {/* Hover Actions */}
                                {isAdminOrOwner && (
                                  <div className="absolute right-1.5 hidden group-hover:flex items-center gap-1 bg-surface-2 rounded-lg p-0.5 border border-line shadow-md">
                                    <button onClick={() => { setRenamingId(ch.id); setRenameValue(ch.name); }} title="채널 이름 변경" className="p-1 text-muted hover:text-text transition">
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button onClick={() => handleDeleteChannel(ch.id)} title="채널 삭제" className="p-1 text-muted hover:text-danger transition">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {isAdminOrOwner && (
                <button onClick={() => openModal("createCategory")} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs rounded-xl transition text-muted hover:bg-surface-2 hover:text-text mt-2">
                  <Plus className="h-3.5 w-3.5" /> {t("dashboard.addCategory")}
                </button>
              )}
            </div>

            {/* Profile Bar */}
            {profile && (
              <div className="flex h-[60px] shrink-0 items-center gap-2 border-t border-line bg-surface px-3">
                <button onClick={() => openModal("editProfile")} aria-label={t("dashboard.profile")} className="group relative shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden bg-surface-2">
                    {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs uppercase font-bold">{profile.username.substring(0,2)}</span>}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Edit2 className="h-3.5 w-3.5 text-white" /></div>
                </button>
                <div className="flex flex-1 flex-col overflow-hidden leading-tight">
                  <span className="truncate text-sm font-semibold">{profile.displayName || profile.username}</span>
                  <span className="truncate text-xs text-muted">@{profile.username}</span>
                </div>
                <button onClick={() => setIsSettingsOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text transition" title={t("settings.title")}>
                  <Settings className="h-4 w-4" />
                </button>
                <button onClick={handleLogout} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger transition" title={t("profile.logout")}>
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 no-scrollbar">
                {spaces.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center text-muted">
                    <Compass className="mb-3 h-9 w-9 stroke-1" />
                    <p className="text-sm">{t("dashboard.empty.space")}</p>
                  </div>
                ) : (
                  spaces.map((space) => (
                    <button
                      key={space.id}
                      onClick={() => setActiveSpaceId(space.id)}
                      className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs text-muted transition hover:bg-surface-2 hover:text-text"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-xs font-bold uppercase text-accent">
                        {space.avatarUrl ? (
                          <img src={space.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          space.name.slice(0, 2)
                        )}
                      </div>
                      <span className="flex-1 truncate font-semibold text-text">{space.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {mainView === "friends" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">친구/DM</span>
              <button
                onClick={() => setShowAddFriend((v) => !v)}
                title={t("friends.add")}
                aria-label={t("friends.add")}
                className="rounded-xl border border-line bg-surface p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>

            {showAddFriend && (
              <div className="border-b border-line p-3 space-y-2">
                {friendsAndDms.addMsg && (
                  <div
                    className={`rounded-lg border p-2 text-[11px] ${
                      friendsAndDms.addMsg.type === "success"
                        ? "border-online/30 bg-online/10 text-online"
                        : "border-danger/30 bg-danger/10 text-danger"
                    }`}
                  >
                    {friendsAndDms.addMsg.text}
                  </div>
                )}
                <form onSubmit={friendsAndDms.handleSendFriendRequest} className="flex gap-1.5">
                  <input
                    type="text"
                    value={friendsAndDms.searchUsername}
                    onChange={(e) => friendsAndDms.setSearchUsername(e.target.value)}
                    placeholder={t("friends.searchPlaceholder")}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-text placeholder-muted outline-none transition focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={friendsAndDms.sendingRequest || !friendsAndDms.searchUsername.trim()}
                    className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-on-accent transition hover:bg-accent-strong disabled:opacity-50"
                  >
                    {t("friends.add")}
                  </button>
                </form>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 no-scrollbar">
              {friendsAndDms.pendingRequests.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                    대기 중인 요청
                  </div>
                  {friendsAndDms.pendingRequests.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-idle/20 font-bold uppercase text-idle">
                        {f.profile.avatarUrl ? (
                          <img src={f.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          f.profile.username.slice(0, 2)
                        )}
                      </div>
                      <span className="flex-1 truncate text-text">{f.profile.displayName || f.profile.username}</span>
                      {f.direction === "incoming" ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => friendsAndDms.handleRespondFriend(f.id, "accept")}
                            title={t("friends.accept")}
                            className="rounded-lg p-1 text-online transition hover:bg-online/20"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => friendsAndDms.handleRespondFriend(f.id, "decline")}
                            title={t("friends.reject")}
                            className="rounded-lg p-1 text-danger transition hover:bg-danger/20"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="shrink-0 text-[10px] italic text-muted">대기 중</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                  {t("friends.all")}
                </div>
                {friendsAndDms.acceptedFriends.length === 0 ? (
                  <div className="px-2 py-4 text-center text-xs text-muted">{t("friends.noFriends")}</div>
                ) : (
                  friendsAndDms.acceptedFriends.map((f) => {
                    const conv = friendsAndDms.conversations.find((c) => c.otherProfile?.id === f.profile.id);
                    const unreads = conv ? dmUnreadBadges[conv.id] || 0 : 0;
                    const isActive = friendsAndDms.activeConversationId === conv?.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => friendsAndDms.handleStartDm(f.profile)}
                        className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition ${
                          isActive
                            ? "bg-accent-soft text-text border border-accent/30"
                            : "text-muted hover:bg-surface-2 hover:text-text"
                        }`}
                      >
                        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-accent-soft flex items-center justify-center font-bold uppercase text-accent">
                          {f.profile.avatarUrl ? (
                            <img src={f.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            f.profile.username.slice(0, 2)
                          )}
                          <span
                            className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-surface ${
                              f.profile.availability === "AVAILABLE"
                                ? "bg-online"
                                : f.profile.availability === "IDLE"
                                ? "bg-idle"
                                : "bg-danger"
                            }`}
                          />
                        </div>
                        <span className="flex-1 truncate font-semibold text-text">
                          {f.profile.displayName || f.profile.username}
                        </span>
                        {unreads > 0 && !isActive && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-on-accent shadow-sm">
                            {unreads}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Chat Area or Friends Panel */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        {mainView === "friends" ? (
          <FriendsPanel
            currentProfile={profile}
            activeConversationId={friendsAndDms.activeConversationId}
            activeDmProfile={friendsAndDms.activeDmProfile}
            dmMessages={friendsAndDms.dmMessages}
            dmInput={friendsAndDms.dmInput}
            setDmInput={friendsAndDms.setDmInput}
            sendingDm={friendsAndDms.sendingDm}
            handleSendDm={friendsAndDms.handleSendDm}
            messagesEndRef={friendsAndDms.messagesEndRef}
            searchUsername={friendsAndDms.searchUsername}
            setSearchUsername={friendsAndDms.setSearchUsername}
            addMsg={friendsAndDms.addMsg}
            sendingRequest={friendsAndDms.sendingRequest}
            handleSendFriendRequest={friendsAndDms.handleSendFriendRequest}
            pendingFile={friendsAndDms.pendingFile}
            filePreview={friendsAndDms.filePreview}
            handleSelectFile={friendsAndDms.handleSelectFile}
            clearPendingFile={friendsAndDms.clearPendingFile}
          />
        ) : activeChannel ? (
          <>
            {/* Top Bar */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsChannelSidebarOpen(!isChannelSidebarOpen)} aria-label="Toggle channel sidebar" className="rounded p-1.5 hover:bg-surface-2 text-muted">
                  {isChannelSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
                </button>
                <div className="h-4 w-px bg-line" />
                <div className="flex items-center gap-2">
                  {activeChannel.type === "TEXT" ? <Hash className="h-5 w-5 text-muted" /> : <Volume2 className="h-5 w-5 text-muted" />}
                  <h1 className="text-base font-bold">{activeChannel.name}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <NotificationDrawer
                  onSelectChannel={(sId, cId) => {
                    if (sId) setActiveSpaceId(sId);
                    if (cId) setActiveChannelId(cId);
                    setMainView("space");
                  }}
                  onOpenFriends={() => setMainView("friends")}
                />
                <ChannelHeaderExtras messages={messages} />
                <button
                  ref={memberDialogButtonRef}
                  onClick={() => setIsMemberDialogOpen(true)}
                  aria-label="View members"
                  aria-haspopup="dialog"
                  aria-expanded={isMemberDialogOpen}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <Users className="h-5 w-5" />
                  <span className="text-xs font-semibold">{members.length}</span>
                </button>
              </div>
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
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 disabled:opacity-50"
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
                    className={`group relative flex gap-3 px-2 py-1 -mx-2 rounded-lg transition-colors ${isMentioned ? 'bg-accent-soft' : 'hover:bg-surface-2'} ${!isConsecutive ? 'mt-4' : ''}`}>
                    
                    {/* Avatar or Timestamp */}
                    <div className="w-10 shrink-0 flex justify-center mt-0.5">
                      {!isConsecutive ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden bg-surface-2">
                          {msg.profile?.avatarUrl ? <img src={msg.profile?.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs uppercase font-bold">{msg.profile?.username.substring(0,2)}</span>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mt-1">
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
                              <span className="ml-1 text-[10px] text-muted" aria-label={`${msg.profile.displayRole.name} role, ${msg.profile.displayRole.badgeKey} badge`}>
                                [{msg.profile.displayRole.badgeKey}]
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-muted font-medium">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}

                      {msg.replyTo && (
                        <button
                          type="button"
                          onClick={() => jumpToMessage(msg.replyTo!.id)}
                          className="mb-1 flex max-w-full items-center gap-2 rounded border-l-2 border-accent bg-surface-2 px-2 py-1 text-left text-xs text-muted hover:bg-surface-2"
                        >
                          <Reply className="h-3 w-3 shrink-0" />
                          <span className="font-semibold text-muted">{msg.replyTo.profile?.displayName || msg.replyTo.profile?.username}</span>
                          <span className="truncate">{messagePreview({ content: msg.replyTo.content, deletedAt: msg.replyTo.deletedAt ?? null })}</span>
                        </button>
                      )}

                      {editingMsgId === msg.id ? (
                        <div className="mt-1">
                          <input autoFocus aria-label="Edit message content" value={editingContent} onChange={(e) => setEditingContent(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleEditSubmit(msg.id); if (e.key === "Escape") setEditingMsgId(null); }}
                            className="w-full rounded-lg px-3 py-2 text-sm outline-hidden border bg-surface-2 border-line" />
                          <p className="text-[10px] text-muted mt-1">escape to cancel • enter to save</p>
                        </div>
                      ) : msg.deletedAt ? (
                        <p className="text-sm italic text-muted">{DELETED_MESSAGE_PREVIEW}</p>
                      ) : renderMessageContent(msg.content)}

                      {/* Edited Tag */}
                      {msg.editedAt && !editingMsgId && (
                        <span className="text-[10px] text-muted italic ml-2">(edited)</span>
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
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] transition-colors ${myReact ? 'border-accent bg-accent-soft text-accent font-bold' : 'border-line bg-surface-2 hover:bg-line text-muted'}`}>
                                <span>{emoji}</span><span>{reacts.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {(msg._count?.threadReplies ?? 0) > 0 && (
                        <button type="button" onClick={() => setThreadRootId(msg.id)} className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {msg._count?.threadReplies} replies
                          {msg.threadReplies?.[0] && <span className="font-normal text-muted">· {new Date(msg.threadReplies[0].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                        </button>
                      )}
                    </div>

                    {/* Hover Action Bar */}
                    <div className="absolute -top-3 right-4 flex items-center rounded-lg border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity bg-surface-2 border-line">
                      {!msg.deletedAt && <button aria-label="Reply to message" onClick={() => { setReplyToId(msg.id); inputRef.current?.focus(); }} className="p-1.5 transition-colors hover:bg-line text-muted"><Reply className="h-4 w-4" /></button>}
                      <button aria-label="Open thread" onClick={() => setThreadRootId(msg.id)} className="p-1.5 transition-colors hover:bg-line text-muted"><MessageSquare className="h-4 w-4" /></button>
                      <div className="relative group/emoji">
                        <button aria-label="Add reaction" className="p-1.5 transition-colors hover:bg-line text-muted"><Smile className="h-4 w-4" /></button>
                        <div className="absolute bottom-full right-0 mb-1 hidden group-hover/emoji:flex gap-1 rounded-full px-2 py-1 border shadow-lg bg-surface-2 border-line">
                          {EMOJIS.map(e => (
                            <button key={e} aria-label={`React with ${e}`} onClick={() => handleToggleReaction(activeChannel.id, msg.id, e)} className="hover:scale-125 transition-transform p-1">{e}</button>
                          ))}
                        </div>
                      </div>
                      {!msg.deletedAt && (isMe || isAdminOrOwner) && (
                        <>
                          <div className="w-px h-4 bg-line" />
                          {isMe && <button aria-label="Edit message" onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content); }} className="p-1.5 transition-colors hover:bg-line text-muted"><Edit2 className="h-4 w-4" /></button>}
                          <button aria-label="Delete message" onClick={() => handleDeleteMessage(activeChannel.id, msg.id)} className="p-1.5 transition-colors hover:bg-danger/20 text-danger"><Trash2 className="h-4 w-4" /></button>
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
                <div role="alert" className="mb-2 flex items-center justify-between rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
                  <span>{actionError}</span>
                  <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss error"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
              {replyToId && (() => {
                const target = messages.find((message) => message.id === replyToId);
                return target ? (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 text-xs text-muted">
                    <Reply className="h-3.5 w-3.5 text-accent" />
                    <span>Replying to <strong>{target.profile?.displayName || target.profile?.username}</strong></span>
                    <span className="min-w-0 flex-1 truncate text-muted">{messagePreview({ content: target.content, deletedAt: target.deletedAt ?? null })}</span>
                    <button type="button" onClick={() => setReplyToId(null)} aria-label="Cancel reply" className="rounded p-1 hover:bg-surface-2"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : null;
              })()}
              {/* Image Preview */}
              {imagePreview && (
                <div className="mb-2 inline-flex items-center gap-3 rounded-xl border p-2 shadow-sm bg-surface-2 border-line">
                  <img src={imagePreview} alt="preview" className="h-16 w-16 rounded-lg object-cover" />
                  <span className="text-xs max-w-[200px] truncate">{pendingFile?.name}</span>
                  <button onClick={() => { setImagePreview(null); setPendingFile(null); }} className="p-1 rounded-full hover:bg-danger/10 text-danger mr-1"><X className="h-4 w-4" /></button>
                </div>
              )}

              {/* Mention Dropdown */}
              {mentionQuery !== null && mentionableMembers.length > 0 && (
                <div className="absolute bottom-20 left-6 z-10 w-64 rounded-xl border shadow-xl overflow-hidden bg-surface-2 border-line">
                  <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider border-b border-line text-muted">Members</div>
                  <div className="max-h-48 overflow-y-auto">
                    {mentionableMembers.map((m, idx) => (
                      <button type="button" key={m.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(m)} className={`flex w-full items-center gap-2 px-3 py-2 cursor-pointer text-left ${idx === mentionIndex ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}>
                        <div className="h-6 w-6 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-surface-2">
                          {m.profile?.avatarUrl ? <img src={m.profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold uppercase">{m.profile?.username.substring(0,2)}</span>}
                        </div>
                        <span className="text-sm font-medium">{m.profile?.displayName || m.profile?.username}</span>
                        <span className="text-xs ml-auto text-muted">@{m.profile?.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative flex items-end gap-2 rounded-2xl border px-3 py-1.5 transition-shadow focus-within:ring-2 focus-within:ring-accent/20 bg-surface-2 border-line">
                <input type="file" ref={fileInputRef} onChange={(e) => {
                  const f = e.target.files?.[0]; if(!f) return; setPendingFile(f);
                  if (f.type.startsWith("image/")) {
                    const r = new FileReader(); r.onload=()=>setImagePreview(r.result as string); r.readAsDataURL(f);
                  } else {
                    setImagePreview(null);
                  }
                  e.target.value = "";
                }} className="hidden" />

                <button type="button" onClick={() => fileInputRef.current?.click()} title="파일/이미지 첨부" className="mb-1.5 rounded-full p-2 transition-colors text-muted hover:bg-line hover:text-text">
                  <Paperclip className="h-5 w-5" />
                </button>

                <input ref={inputRef} type="text"
                  className="flex-1 bg-transparent py-3 text-[15px] outline-hidden placeholder:text-muted"
                  placeholder={`Message #${activeChannel.name}`}
                  value={messageInput}
                  onChange={handleMessageInputChange}
                  onKeyDown={handleMessageInputKeyDown}
                />

                <button onClick={() => handleSendMessage()} disabled={!messageInput.trim() && !pendingFile}
                  className="mb-1.5 rounded-full p-2 transition-colors disabled:opacity-50 bg-accent text-on-accent hover:bg-accent-strong">
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
            className="flex h-full w-full max-w-sm flex-col border-l border-line bg-surface shadow-2xl"
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
              <Users className="h-4 w-4 text-muted" />
              <h2 id="members-dialog-title" className="flex-1 text-sm font-bold">{t("dashboard.members")}</h2>
              <span className="text-xs text-muted">{members.length}</span>
              <button autoFocus onClick={() => setIsMemberDialogOpen(false)} aria-label={t("dialog.closeMembers")} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text">
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
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors enabled:hover:bg-surface-2 disabled:cursor-default">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2">
                      {member.profile?.avatarUrl ? <img src={member.profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold uppercase">{member.profile?.username.substring(0,2)}</span>}
                      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface ${isOnline ? 'bg-online' : 'bg-muted'}`} />
                    </div>
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-semibold"
                      style={{ color: member.profile?.displayRole?.colorHex }}
                    >
                      {member.profile?.displayName || member.profile?.username}
                      {member.profile?.displayRole?.badgeKey && (
                        <span className="ml-1 text-[10px] text-muted" aria-label={`${member.profile.displayRole.name} role, ${member.profile.displayRole.badgeKey} badge`}>
                          [{member.profile.displayRole.badgeKey}]
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted">
                      {isOnline ? (member.profile?.availability ?? "AVAILABLE") : "OFFLINE"}
                      {member.profile?.customStatus ? ` · ${member.profile.customStatus}` : ""}
                    </span>
                    {member.role === "OWNER" && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                    {member.role === "ADMIN" && <Shield className="h-3.5 w-3.5 text-accent" />}
                    {isMe && <span className="text-[10px] text-muted">You</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Context Menu ────────────────────────────────────────────── */}
      {contextMenu && (
        <div className="fixed z-[100] min-w-[160px] rounded-xl border shadow-2xl p-1.5 bg-surface-2 border-line"
          style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-line"
            onClick={() => { setRenamingId(contextMenu.id); setRenameValue(contextMenu.name); setContextMenu(null); }}>
            <Edit2 className="h-4 w-4" /> Rename
          </button>
          {contextMenu.type === "channel" && (
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
              onClick={() => handleDeleteChannel(contextMenu.id)}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          {contextMenu.type === "category" && (
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
              onClick={() => handleDeleteCategory(contextMenu.id)}>
              <Trash2 className="h-4 w-4" /> Delete with channels
            </button>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl bg-surface border border-line">
            {modal === "createSpace" && (
              <form onSubmit={handleCreateSpace} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dialog.createSpace")}</h2>
                <input autoFocus value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} placeholder="Space Name" className="w-full rounded-xl px-4 py-3 outline-hidden border bg-surface-2 border-line" />
                <input value={newSpaceAvatar} onChange={(e) => setNewSpaceAvatar(e.target.value)} placeholder="Avatar URL (Optional)" className="w-full rounded-xl px-4 py-3 outline-hidden border bg-surface-2 border-line" />
                {formError && <p className="text-sm text-danger">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 rounded-xl py-3 font-bold transition-colors bg-surface-2 hover:bg-line">{t("common.cancel")}</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-accent py-3 font-bold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50">{t("dialog.create")}</button>
                </div>
                <div className="my-2 flex items-center gap-2"><div className="flex-1 h-px bg-line" /><span className="text-xs text-muted">{t("dialog.or")}</span><div className="flex-1 h-px bg-line" /></div>
                <button type="button" onClick={() => setModal("joinSpace")} className="w-full rounded-xl py-3 font-bold transition-colors bg-surface-2 hover:bg-line">{t("dialog.joinWithCode")}</button>
              </form>
            )}

            {modal === "joinSpace" && (
              <form onSubmit={handleJoinSpace} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dialog.joinSpace")}</h2>
                <input autoFocus value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} placeholder="Invite Code" className="w-full rounded-xl px-4 py-3 outline-hidden border bg-surface-2 border-line" />
                {formError && <p className="text-sm text-danger">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModal("createSpace")} className="flex-1 rounded-xl py-3 font-bold transition-colors bg-surface-2 hover:bg-line">{t("dialog.back")}</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-accent py-3 font-bold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50">{t("dialog.join")}</button>
                </div>
              </form>
            )}

            {modal === "createChannel" && (
              <form onSubmit={handleCreateChannel} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dialog.createChannel")}</h2>
                <div>
                  <label className="mb-2 block text-xs font-bold text-muted">CATEGORY (OPTIONAL)</label>
                  <select value={newChannelCategoryId} onChange={(e) => setNewChannelCategoryId(e.target.value)} className="w-full rounded-xl px-4 py-3 outline-hidden border bg-surface-2 border-line text-text">
                    <option value="">No Category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-muted">CHANNEL TYPE</label>
                  <div className="flex gap-2">
                    {(["TEXT", "VOICE", "STAGE"] as const).map(t => (
                      <button key={t} type="button" onClick={() => setNewChannelType(t)} className={`flex-1 rounded-xl border py-3 text-sm font-bold transition-colors ${newChannelType === t ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface-2 text-muted hover:bg-line'}`}>
                        {t === "TEXT" ? <Hash className="mx-auto mb-1 h-5 w-5" /> : <Volume2 className="mx-auto mb-1 h-5 w-5" />} {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-muted">CHANNEL MODE (운영 모드)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { mode: "GENERAL", label: "💬 자유 소통", desc: "기본 대화" },
                      { mode: "MEETING", label: "🎙️ 회의 모드", desc: "순서 대기열" },
                      { mode: "LECTURE", label: "🎓 강의 모드", desc: "선생님/학생 손들기" },
                    ].map(item => (
                      <button key={item.mode} type="button" onClick={() => setNewChannelMode(item.mode as "GENERAL" | "MEETING" | "LECTURE")} className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition ${newChannelMode === item.mode ? 'border-accent bg-accent-soft text-accent font-bold' : 'border-line bg-surface-2 text-muted hover:bg-line'}`}>
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className="text-[10px] text-muted mt-0.5">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-muted">CHANNEL NAME</label>
                  <input autoFocus value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="new-channel" className="w-full rounded-xl px-4 py-3 outline-hidden border bg-surface-2 border-line" />
                </div>
                {formError && <p className="text-sm text-danger">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 rounded-xl py-3 font-bold transition-colors bg-surface-2 hover:bg-line">Cancel</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-accent py-3 font-bold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50">Create</button>
                </div>
              </form>
            )}

            {modal === "createCategory" && (
              <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dialog.createCategory")}</h2>
                <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="CATEGORY NAME" className="w-full rounded-xl px-4 py-3 outline-hidden border uppercase bg-surface-2 border-line" />
                {formError && <p className="text-sm text-danger">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 rounded-xl py-3 font-bold transition-colors bg-surface-2 hover:bg-line">Cancel</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-accent py-3 font-bold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50">Create</button>
                </div>
              </form>
            )}

            {modal === "editProfile" && (
              <form onSubmit={handleEditProfile} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("dashboard.profile")}</h2>
                <div className="flex justify-center">
                  <div className="relative group overflow-hidden rounded-full h-24 w-24 border-4 border-line bg-surface cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
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
                  <label className="mb-2 block text-xs font-bold text-muted">{t("profile.displayName")}</label>
                  <input autoFocus value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder={profile?.username} className="w-full rounded-xl px-4 py-3 outline-hidden border bg-surface-2 border-line" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-muted">{t("profile.availability")}
                    <select aria-label="AVAILABILITY" value={editAvailability} onChange={(event) => setEditAvailability(event.target.value as typeof editAvailability)}
                      className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-text">
                      <option value="AVAILABLE">{t("profile.availability.available")}</option>
                      <option value="IDLE">{t("profile.availability.idle")}</option>
                      <option value="DND">{t("profile.availability.dnd")}</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-muted">{t("profile.customStatus")}
                    <input aria-label="CUSTOM STATUS" value={editCustomStatus} maxLength={128} onChange={(event) => setEditCustomStatus(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-text" />
                  </label>
                </div>
                {formError && <p className="text-sm text-danger">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 rounded-xl py-3 font-bold transition-colors bg-surface-2 hover:bg-line">{t("common.cancel")}</button>
                  <button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-accent py-3 font-bold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50">{t("common.save")}</button>
                </div>
              </form>
            )}

            {modal === "editSpace" && (
              <form onSubmit={handleEditSpace} className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">스페이스 프로필 / 설정 수정</h2>
                <div className="flex justify-center">
                  <div
                    className="relative group overflow-hidden rounded-full h-24 w-24 border-4 border-line bg-surface cursor-pointer flex items-center justify-center"
                    onClick={() => document.getElementById('space-avatar-upload')?.click()}
                  >
                    {editSpaceAvatarPreview ? (
                      <img src={editSpaceAvatarPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-2xl font-bold uppercase text-accent bg-accent-soft">
                        {editSpaceName.substring(0, 2) || "??"}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-xs font-bold text-white">
                      <Edit2 className="h-4 w-4 mb-1" /> Change
                    </div>
                    <input
                      type="file"
                      id="space-avatar-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setEditSpaceAvatarFile(f);
                        const r = new FileReader();
                        r.onload = () => setEditSpaceAvatarPreview(r.result as string);
                        r.readAsDataURL(f);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-muted">스페이스 이름 (SPACE NAME)</label>
                  <input
                    autoFocus
                    value={editSpaceName}
                    onChange={(e) => setEditSpaceName(e.target.value)}
                    placeholder="Space Name"
                    className="w-full rounded-xl px-4 py-3 outline-hidden border bg-surface-2 border-line text-text"
                  />
                </div>
                {formError && <p className="text-sm text-danger">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-xl py-3 font-bold transition-colors bg-surface-2 hover:bg-line"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading || !editSpaceName.trim()}
                    className="flex-1 rounded-xl bg-accent py-3 font-bold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50"
                  >
                    {t("common.save")}
                  </button>
                </div>
              </form>
            )}

            {modal === "memberActions" && selectedMember && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-surface-2">
                    {selectedMember.profile?.avatarUrl ? <img src={selectedMember.profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="h-full w-full flex items-center justify-center font-bold uppercase">{selectedMember.profile?.username.substring(0,2)}</span>}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedMember.profile?.displayName || selectedMember.profile?.username}</h2>
                    <p className="text-xs text-muted">@{selectedMember.profile?.username} • {selectedMember.role}</p>
                  </div>
                </div>
                <div className="h-px w-full bg-line" />
                <div className="flex flex-col gap-2">
                  {selectedMember.role !== "ADMIN" && (
                    <button onClick={() => handleMemberAction("promote")} disabled={formLoading} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors bg-surface-2 hover:bg-line">
                      <Shield className="h-5 w-5 text-accent" /> <span className="font-bold">Promote to Admin</span>
                    </button>
                  )}
                  {selectedMember.role === "ADMIN" && myMember?.role === "OWNER" && (
                    <button onClick={() => handleMemberAction("demote")} disabled={formLoading} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors bg-surface-2 hover:bg-line">
                      <UserMinus className="h-5 w-5 text-yellow-500" /> <span className="font-bold">Demote to Member</span>
                    </button>
                  )}
                  <button onClick={() => handleMemberAction("kick")} disabled={formLoading} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-danger/10 hover:bg-danger/20 text-danger transition-colors">
                    <UserMinus className="h-5 w-5" /> <span className="font-bold">Kick from Space</span>
                  </button>
                </div>
                {formError && <p className="text-sm text-danger">{formError}</p>}
                <button onClick={closeModal} className="mt-2 w-full rounded-xl py-3 font-bold transition-colors bg-surface-2 hover:bg-line">Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Independent Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={profile}
        onProfileUpdate={(updated) => setProfile(updated)}
        onLogout={handleLogout}
        currentThemeName={themeName}
        currentThemeMode={theme}
        onThemeChange={handleThemeChange}
      />

      {/* Independent Space Settings Modal */}
      <SpaceSettingsModal
        isOpen={isSpaceSettingsOpen}
        onClose={() => setIsSpaceSettingsOpen(false)}
        space={activeSpace || null}
        currentProfile={profile}
        members={members}
        categories={categories}
        channels={channels}
        myRole={myMember?.role || "MEMBER"}
        onSpaceUpdate={async () => {
          if (activeSpaceId) {
            await fetchSpaces();
            await fetchSpaceData(activeSpaceId);
          }
        }}
        onDeleteSpace={handleDeleteSpace}
        onLeaveSpace={handleLeaveSpace}
        onMemberAction={async (member, action) => {
          setSelectedMember(member);
          await handleMemberAction(action);
        }}
        onDeleteChannel={handleDeleteChannel}
        onDeleteCategory={handleDeleteCategory}
      />
    </div>
  );
}
