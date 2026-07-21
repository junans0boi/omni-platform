import { create } from "zustand";
import type { PresenceSnapshot } from "@/lib/events";
import { MAX_RETAINED_MESSAGES, mergeMessagePage } from "@/lib/message-pagination";

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Space {
  id: string;
  name: string;
  avatarUrl: string | null;
  inviteCode: string;
  ownerId: string | null;
  createdAt: string;
  archivedAt: string | null;
}

export interface Category {
  id: string;
  spaceId: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  spaceId: string;
  categoryId: string | null;
  name: string;
  type: "TEXT" | "VOICE" | "STAGE";
  position: number;
}

export interface Member {
  id: string;
  spaceId: string;
  profileId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  profile?: Profile;
}

export interface Reaction {
  id: string;
  messageId: string;
  profileId: string;
  emoji: string;
  createdAt: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  channelId: string;
  profileId: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  profile?: Profile;
  reactions?: Reaction[];
}

export type RealtimeMessage =
  | Message
  | (Message & { _type: "UPDATE" })
  | { id: string; channelId: string; _type: "DELETE" };

let latestMessageFetch = 0;

function unreadStorageKey(profileId: string) {
  return `omni-unread:${profileId}`;
}

function loadUnreadBadges(profileId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(unreadStorageKey(profileId)) || "{}"
    );
    if (typeof value !== "object" || value === null) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && entry[1] > 0
      )
    );
  } catch {
    return {};
  }
}

function saveUnreadBadges(profileId: string | undefined, badges: Record<string, number>) {
  if (typeof window === "undefined" || !profileId) return;
  try {
    localStorage.setItem(unreadStorageKey(profileId), JSON.stringify(badges));
  } catch {
    // Storage can be disabled; the in-memory badge still remains usable.
  }
}

async function apiError(response: Response, fallback: string): Promise<Error> {
  let detail = fallback;
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      detail = payload.error;
    }
  } catch {
    // Keep the operation-specific fallback for non-JSON error responses.
  }
  return new Error(`${detail} (${response.status})`);
}

interface AppState {
  profile: Profile | null;
  spaces: Space[];
  categories: Category[];
  channels: Channel[];
  members: Member[];
  messages: Message[];
  messageHistoryCursor: string | null;
  isLoadingOlderMessages: boolean;
  activeSpaceId: string | null;
  activeChannelId: string | null;
  presenceUsers: PresenceSnapshot;
  isLoading: boolean;

  // New states
  theme: "light" | "dark";
  unreadBadges: Record<string, number>;

  // Voice/Video States
  activeVoiceChannelId: string | null;
  livekitToken: string | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;

  setTheme: (theme: "light" | "dark") => void;
  setProfile: (profile: Profile | null) => void;
  fetchSpaces: () => Promise<void>;
  fetchSpaceData: (spaceId: string) => Promise<void>;
  fetchMessages: (channelId: string) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  addMessage: (message: RealtimeMessage) => void;
  createSpace: (name: string, avatarUrl?: string) => Promise<Space | null>;
  joinSpace: (inviteCode: string) => Promise<boolean>;
  deleteSpace: (spaceId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  editMessage: (channelId: string, msgId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, msgId: string) => Promise<void>;
  toggleReaction: (channelId: string, msgId: string, emoji: string) => Promise<void>;
  setActiveSpaceId: (spaceId: string | null) => void;
  setActiveChannelId: (channelId: string | null) => void;
  setPresenceUsers: (users: PresenceSnapshot) => void;
  clearUnreadBadge: (channelId: string) => void;

  // Voice/Video Actions
  joinVoiceChannel: (channelId: string) => Promise<void>;
  leaveVoiceChannel: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: null,
  spaces: [],
  categories: [],
  channels: [],
  members: [],
  messages: [],
  messageHistoryCursor: null,
  isLoadingOlderMessages: false,
  activeSpaceId: null,
  activeChannelId: null,
  presenceUsers: {},
  isLoading: false,
  theme: "dark",
  unreadBadges: {},

  // Voice/Video initial states
  activeVoiceChannelId: null,
  livekitToken: null,
  isMuted: false,
  isCameraOn: false,
  isScreenSharing: false,

  setTheme: (theme) => set({ theme }),
  setProfile: (profile) => set({
    profile,
    unreadBadges: profile ? loadUnreadBadges(profile.id) : {},
  }),

  fetchSpaces: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/spaces");
      if (res.ok) {
        const data = await res.json();
        set({ spaces: data || [] });
      }
    } catch (e) {
      console.error("Error fetching spaces:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSpaceData: async (spaceId) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/spaces/${spaceId}`);
      if (res.ok) {
        const data = await res.json();
        set({
          categories: data.categories || [],
          channels: data.channels || [],
          members: data.members || [],
        });
      }
    } catch (e) {
      console.error("Error fetching space details:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (channelId) => {
    const requestId = ++latestMessageFetch;
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`);
      if (res.ok) {
        const data: { items: Message[]; nextCursor: string | null } = await res.json();
        if (
          requestId === latestMessageFetch &&
          get().activeChannelId === channelId
        ) {
          set({ messages: data.items || [], messageHistoryCursor: data.nextCursor });
        }
      }
    } catch (e) {
      console.error("Error fetching messages:", e);
    }
  },

  loadOlderMessages: async () => {
    const { activeChannelId, messageHistoryCursor, isLoadingOlderMessages } = get();
    if (!activeChannelId || !messageHistoryCursor || isLoadingOlderMessages) return;
    set({ isLoadingOlderMessages: true });
    try {
      const response = await fetch(`/api/channels/${activeChannelId}/messages?before=${encodeURIComponent(messageHistoryCursor)}`);
      if (!response.ok) throw await apiError(response, "Failed to load message history");
      const data: { items: Message[]; nextCursor: string | null } = await response.json();
      if (get().activeChannelId === activeChannelId) {
        set((state) => ({
          messages: mergeMessagePage(state.messages, data.items),
          messageHistoryCursor: data.nextCursor,
        }));
      }
    } finally {
      set({ isLoadingOlderMessages: false });
    }
  },

  addMessage: (message) => {
    set((state) => {
      const isActiveChannel = message.channelId === state.activeChannelId;

      // Handle delete event
      if ("_type" in message && message._type === "DELETE") {
        if (!isActiveChannel) return state;
        return { messages: state.messages.filter((m) => m.id !== message.id) };
      }
      
      // Handle update event
      if ("_type" in message && message._type === "UPDATE") {
        if (!isActiveChannel) return state;
        return {
          messages: state.messages.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
        };
      }

      if (!isActiveChannel) {
        const unreadBadges = {
          ...state.unreadBadges,
          [message.channelId]: (state.unreadBadges[message.channelId] || 0) + 1,
        };
        saveUnreadBadges(state.profile?.id, unreadBadges);
        return {
          unreadBadges,
        };
      }

      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message].slice(-MAX_RETAINED_MESSAGES) };
    });
  },

  clearUnreadBadge: (channelId) => {
    set((state) => {
      const unreadBadges = { ...state.unreadBadges };
      delete unreadBadges[channelId];
      saveUnreadBadges(state.profile?.id, unreadBadges);
      return { unreadBadges };
    });
  },

  createSpace: async (name, avatarUrl) => {
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar_url: avatarUrl }),
      });
      if (res.ok) {
        const space = await res.json();
        await get().fetchSpaces();
        return space;
      }
    } catch (e) {
      console.error("Error creating space:", e);
    }
    return null;
  },

  joinSpace: async (inviteCode) => {
    try {
      const res = await fetch("/api/spaces", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: inviteCode }),
      });
      if (res.ok) {
        await get().fetchSpaces();
        return true;
      }
    } catch (e) {
      console.error("Error joining space:", e);
    }
    return false;
  },

  deleteSpace: async (spaceId) => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await get().fetchSpaces();
        if (get().activeSpaceId === spaceId) {
          set({ activeSpaceId: null, activeChannelId: null });
        }
      }
    } catch (e) {
      console.error("Error deleting space:", e);
    }
  },

  sendMessage: async (channelId, content) => {
    try {
      const response = await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw await apiError(response, "Failed to send message");
    } catch (e) {
      console.error("Error sending message:", e);
      throw e instanceof Error ? e : new Error("Failed to send message");
    }
  },

  editMessage: async (channelId, msgId, content) => {
    try {
      const response = await fetch(`/api/channels/${channelId}/messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw await apiError(response, "Failed to edit message");
    } catch (e) {
      console.error("Error editing message:", e);
      throw e instanceof Error ? e : new Error("Failed to edit message");
    }
  },

  deleteMessage: async (channelId, msgId) => {
    try {
      const response = await fetch(`/api/channels/${channelId}/messages/${msgId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw await apiError(response, "Failed to delete message");
    } catch (e) {
      console.error("Error deleting message:", e);
      throw e instanceof Error ? e : new Error("Failed to delete message");
    }
  },

  toggleReaction: async (channelId, msgId, emoji) => {
    try {
      const response = await fetch(`/api/channels/${channelId}/messages/${msgId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!response.ok) throw await apiError(response, "Failed to toggle reaction");
    } catch (e) {
      console.error("Error toggling reaction:", e);
      throw e instanceof Error ? e : new Error("Failed to toggle reaction");
    }
  },

  setActiveSpaceId: (spaceId) => set({ activeSpaceId: spaceId }),
  setActiveChannelId: (channelId) => {
    if (get().activeChannelId === channelId) {
      if (channelId) get().clearUnreadBadge(channelId);
      return;
    }
    latestMessageFetch += 1;
    set({ activeChannelId: channelId, messages: [], messageHistoryCursor: null });
    if (channelId) get().clearUnreadBadge(channelId);
  },
  setPresenceUsers: (presenceUsers) => set({ presenceUsers }),

  joinVoiceChannel: async (channelId) => {
    const profile = get().profile;
    if (!profile) return;

    try {
      set({ isLoading: true });
      const res = await fetch(`/api/livekit/token?room=${channelId}`);
      if (!res.ok) throw await apiError(res, "Failed to join voice channel");
      const data: unknown = await res.json();
      if (
        typeof data === "object" &&
        data !== null &&
        "token" in data &&
        typeof data.token === "string"
      ) {
        set({
          activeVoiceChannelId: channelId,
          livekitToken: data.token,
          isMuted: !("canPublish" in data && data.canPublish === true),
          isCameraOn: false,
          isScreenSharing: false,
        });
      } else {
        throw new Error("LiveKit token response was invalid");
      }
    } catch (e) {
      console.error("Error joining voice channel:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  leaveVoiceChannel: () => {
    set({
      activeVoiceChannelId: null,
      livekitToken: null,
      isMuted: false,
      isCameraOn: false,
      isScreenSharing: false,
    });
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOn: !state.isCameraOn })),
  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
}));
