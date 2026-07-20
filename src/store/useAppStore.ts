import { create } from "zustand";

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
  _type?: "UPDATE" | "DELETE";
}

interface AppState {
  profile: Profile | null;
  spaces: Space[];
  categories: Category[];
  channels: Channel[];
  members: Member[];
  messages: Message[];
  activeSpaceId: string | null;
  activeChannelId: string | null;
  presenceUsers: Record<string, any>;
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
  addMessage: (message: Message) => void;
  createSpace: (name: string, avatarUrl?: string) => Promise<Space | null>;
  joinSpace: (inviteCode: string) => Promise<boolean>;
  deleteSpace: (spaceId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  editMessage: (channelId: string, msgId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, msgId: string) => Promise<void>;
  toggleReaction: (channelId: string, msgId: string, emoji: string) => Promise<void>;
  setActiveSpaceId: (spaceId: string | null) => void;
  setActiveChannelId: (channelId: string | null) => void;
  setPresenceUsers: (users: Record<string, any>) => void;
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
  setProfile: (profile) => set({ profile }),

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
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`);
      if (res.ok) {
        const data = await res.json();
        set({ messages: data || [] });
      }
    } catch (e) {
      console.error("Error fetching messages:", e);
    }
  },

  addMessage: (message) => {
    set((state) => {
      // Handle delete event
      if (message._type === "DELETE") {
        return { messages: state.messages.filter((m) => m.id !== message.id) };
      }
      
      // Handle update event
      if (message._type === "UPDATE") {
        return {
          messages: state.messages.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
        };
      }

      // Handle new message
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }

      const newState: Partial<AppState> = { messages: [...state.messages, message] };

      // Increment unread badge if message is not in active channel
      if (message.channelId !== state.activeChannelId) {
        newState.unreadBadges = {
          ...state.unreadBadges,
          [message.channelId]: (state.unreadBadges[message.channelId] || 0) + 1,
        };
      }

      return newState;
    });
  },

  clearUnreadBadge: (channelId) => {
    set((state) => {
      const unreadBadges = { ...state.unreadBadges };
      delete unreadBadges[channelId];
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
      await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch (e) {
      console.error("Error sending message:", e);
    }
  },

  editMessage: async (channelId, msgId, content) => {
    try {
      await fetch(`/api/channels/${channelId}/messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch (e) {
      console.error("Error editing message:", e);
    }
  },

  deleteMessage: async (channelId, msgId) => {
    try {
      await fetch(`/api/channels/${channelId}/messages/${msgId}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error("Error deleting message:", e);
    }
  },

  toggleReaction: async (channelId, msgId, emoji) => {
    try {
      await fetch(`/api/channels/${channelId}/messages/${msgId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    } catch (e) {
      console.error("Error toggling reaction:", e);
    }
  },

  setActiveSpaceId: (spaceId) => set({ activeSpaceId: spaceId }),
  setActiveChannelId: (channelId) => {
    set({ activeChannelId: channelId });
    if (channelId) get().clearUnreadBadge(channelId);
  },
  setPresenceUsers: (presenceUsers) => set({ presenceUsers }),

  joinVoiceChannel: async (channelId) => {
    const profile = get().profile;
    if (!profile) return;

    try {
      set({ isLoading: true });
      const res = await fetch(
        `/api/livekit/token?room=${channelId}&username=${encodeURIComponent(
          profile.displayName || profile.username
        )}`
      );
      const data = await res.json();
      if (data.token) {
        set({
          activeVoiceChannelId: channelId,
          livekitToken: data.token,
          isMuted: false,
          isCameraOn: false,
          isScreenSharing: false,
        });
      } else {
        console.error("Failed to retrieve token:", data.error);
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

