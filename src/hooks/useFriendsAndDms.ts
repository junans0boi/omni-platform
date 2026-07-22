"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSoundEffects } from "@/lib/browser-sound-effects";
import { useAppStore } from "@/store/useAppStore";

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  availability?: "AVAILABLE" | "IDLE" | "DND" | string;
  customStatus?: string | null;
}

export interface FriendshipItem {
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

export interface DirectMessageItem {
  id: string;
  conversationId: string;
  profileId: string;
  content: string;
  createdAt: string;
  profile: Profile;
}

export interface DirectConversationItem {
  id: string;
  updatedAt: string;
  otherProfile: Profile | null;
  lastMessage: DirectMessageItem | null;
}

/**
 * Owns all friends/DM state, fetchers, handlers, and derived values.
 * Consumed by both the dashboard sidebar (compact lists) and the
 * FriendsPanel (active DM thread detail view).
 */
export function useFriendsAndDms() {
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const friendsSyncTick = useAppStore((s) => s.friendsSyncTick);
  const clearDmUnread = useAppStore((s) => s.clearDmUnread);
  const setPendingFriendRequestCount = useAppStore((s) => s.setPendingFriendRequestCount);
  const setActiveDmConversationIdStore = useAppStore((s) => s.setActiveDmConversationId);

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
        const data = await res.json() as (DirectConversationItem & { unreadCount?: number })[];
        setConversations(data);
        const badges: Record<string, number> = {};
        data.forEach((c) => {
          if (c.unreadCount && c.unreadCount > 0) {
            badges[c.id] = c.unreadCount;
          }
        });
        useAppStore.setState({ dmUnreadBadges: badges });
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

  const markDmAsRead = useCallback(async (convId: string) => {
    clearDmUnread(convId);
    try {
      await fetch(`/api/dm/${convId}/read`, { method: "POST" });
    } catch {
      // Ignore
    }
  }, [clearDmUnread]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFriendships();
      fetchConversations();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFriendships, fetchConversations]);

  // Sync active DM conversation ID with the global store
  useEffect(() => {
    setActiveDmConversationIdStore(activeConversationId);
    return () => {
      setActiveDmConversationIdStore(null);
    };
  }, [activeConversationId, setActiveDmConversationIdStore]);

  // Realtime signal: any friend-request or DM event bumps friendsSyncTick
  // externally (via the store) -- refetch lists and active DM messages when that happens.
  useEffect(() => {
    if (friendsSyncTick === 0) return;
    const timer = setTimeout(() => {
      fetchFriendships();
      fetchConversations();
      if (activeConversationId) {
        fetchDmMessages(activeConversationId);
        markDmAsRead(activeConversationId);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [friendsSyncTick, fetchFriendships, fetchConversations, fetchDmMessages, activeConversationId, markDmAsRead]);

  useEffect(() => {
    if (!activeConversationId) return;
    const timer = setTimeout(() => {
      fetchDmMessages(activeConversationId);
      markDmAsRead(activeConversationId);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeConversationId, fetchDmMessages, markDmAsRead]);

  // Realtime stream for active DM conversation messages
  useEffect(() => {
    if (!activeConversationId) return;

    const eventSource = new EventSource(`/api/dm/${activeConversationId}/messages/stream`);

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as DirectMessageItem;
        if (message && message.id) {
          setDmMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
          fetchConversations();
          markDmAsRead(activeConversationId);
        }
      } catch (error) {
        console.error("Failed to parse DM message SSE payload:", error);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeConversationId, fetchConversations, markDmAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  const acceptedFriends = friendships.filter((f) => f.status === "ACCEPTED");
  const pendingRequests = friendships.filter((f) => f.status === "PENDING");

  // Feed the live pending-request count into the store so the sidebar tab
  // badge can read it.
  useEffect(() => {
    setPendingFriendRequestCount(pendingRequests.length);
  }, [pendingRequests.length, setPendingFriendRequestCount]);

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
        markDmAsRead(data.id);
      }
    } catch {
      // Ignore
    }
  };

  const handleSelectFile = (file: File) => {
    setPendingFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearPendingFile = () => {
    setPendingFile(null);
    setFilePreview(null);
  };

  const handleSendDm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (sendingDm || (!dmInput.trim() && !pendingFile) || !activeConversationId) return;

    setSendingDm(true);
    let content = dmInput.trim();
    const currentPendingFile = pendingFile;
    setDmInput("");
    clearPendingFile();

    try {
      if (currentPendingFile) {
        const formData = new FormData();
        formData.append("file", currentPendingFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const fileTag = uploadData.isImage
            ? `![${uploadData.originalName || "image"}](${uploadData.url})`
            : `📎 [${uploadData.originalName || "file"}](${uploadData.url})`;
          content = content ? `${content}\n${fileTag}` : fileTag;
        }
      }

      const res = await fetch(`/api/dm/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        setDmMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        fetchConversations();
        markDmAsRead(activeConversationId);
      }
    } catch {
      // Ignore
    } finally {
      setSendingDm(false);
    }
  };

  return {
    subTab,
    setSubTab,
    friendships,
    conversations,
    acceptedFriends,
    pendingRequests,
    searchUsername,
    setSearchUsername,
    addMsg,
    setAddMsg,
    sendingRequest,
    activeConversationId,
    setActiveConversationId,
    activeDmProfile,
    setActiveDmProfile,
    dmMessages,
    dmInput,
    setDmInput,
    sendingDm,
    pendingFile,
    filePreview,
    handleSelectFile,
    clearPendingFile,
    messagesEndRef,
    fetchFriendships,
    fetchConversations,
    fetchDmMessages,
    handleSendFriendRequest,
    handleRespondFriend,
    handleStartDm,
    handleSendDm,
  };
}
