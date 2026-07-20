import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Space {
  id: string;
  name: string;
  avatar_url: string | null;
  invite_code: string;
  owner_id: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface Category {
  id: string;
  space_id: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  space_id: string;
  category_id: string | null;
  name: string;
  type: "TEXT" | "VOICE" | "STAGE";
  position: number;
}

export interface Member {
  id: string;
  space_id: string;
  profile_id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  profile?: Profile;
}

export interface Message {
  id: string;
  channel_id: string;
  profile_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
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

  // Voice/Video States
  activeVoiceChannelId: string | null;
  livekitToken: string | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;

  setProfile: (profile: Profile | null) => void;
  fetchSpaces: () => Promise<void>;
  fetchSpaceData: (spaceId: string) => Promise<void>;
  fetchMessages: (channelId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  createSpace: (name: string, avatarUrl?: string) => Promise<Space | null>;
  joinSpace: (inviteCode: string) => Promise<boolean>;
  deleteSpace: (spaceId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  setActiveSpaceId: (spaceId: string | null) => void;
  setActiveChannelId: (channelId: string | null) => void;
  setPresenceUsers: (users: Record<string, any>) => void;

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

  // Voice/Video initial states
  activeVoiceChannelId: null,
  livekitToken: null,
  isMuted: false,
  isCameraOn: false,
  isScreenSharing: false,

  setProfile: (profile) => set({ profile }),

  fetchSpaces: async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    set({ isLoading: true });
    // Fetch spaces where user is a member
    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("space_id")
      .eq("profile_id", user.id);

    if (memberError || !memberData) {
      set({ isLoading: false });
      return;
    }

    const spaceIds = memberData.map((m) => m.space_id);
    if (spaceIds.length === 0) {
      set({ spaces: [], isLoading: false });
      return;
    }

    const { data: spaceData, error: spaceError } = await supabase
      .from("spaces")
      .select("*")
      .in("id", spaceIds)
      .is("archived_at", null);

    if (spaceError) {
      set({ isLoading: false });
      return;
    }

    set({ spaces: spaceData || [], isLoading: false });
  },

  fetchSpaceData: async (spaceId) => {
    set({ isLoading: true });

    // Fetch categories
    const { data: catData } = await supabase
      .from("categories")
      .select("*")
      .eq("space_id", spaceId)
      .order("position", { ascending: true });

    // Fetch channels
    const { data: chanData } = await supabase
      .from("channels")
      .select("*")
      .eq("space_id", spaceId)
      .order("position", { ascending: true });

    // Fetch members with profiles
    const { data: memData } = await supabase
      .from("members")
      .select("*, profile:profiles(*)")
      .eq("space_id", spaceId);

    set({
      categories: catData || [],
      channels: chanData || [],
      members: memData || [],
      isLoading: false,
    });
  },

  fetchMessages: async (channelId) => {
    const { data: msgData } = await supabase
      .from("messages")
      .select("*, profile:profiles(*)")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    set({ messages: msgData || [] });
  },

  addMessage: (message) => {
    set((state) => {
      // Avoid duplicate renders if message is already added
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    });
  },

  createSpace: async (name, avatarUrl) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return null;

    // Generate random 6-character invite code
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: spaceData, error } = await supabase
      .from("spaces")
      .insert({
        name,
        avatar_url: avatarUrl || null,
        invite_code: inviteCode,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating space:", error);
      return null;
    }

    // Refresh spaces list
    await get().fetchSpaces();
    return spaceData;
  },

  joinSpace: async (inviteCode) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    // Find space by invite code
    const { data: spaceData, error: spaceError } = await supabase
      .from("spaces")
      .select("id")
      .eq("invite_code", inviteCode.trim().toUpperCase())
      .is("archived_at", null)
      .single();

    if (spaceError || !spaceData) {
      return false;
    }

    // Add to members table
    const { error: joinError } = await supabase.from("members").insert({
      space_id: spaceData.id,
      profile_id: user.id,
      role: "MEMBER",
    });

    if (joinError && joinError.code !== "23505") { // Ignore duplicate key (already joined)
      console.error("Error joining space:", joinError);
      return false;
    }

    await get().fetchSpaces();
    return true;
  },

  deleteSpace: async (spaceId) => {
    const { error } = await supabase
      .from("spaces")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", spaceId);

    if (error) {
      console.error("Error deleting space:", error);
      return;
    }

    // Refresh and reset active space/channel if deleted space was active
    await get().fetchSpaces();
    if (get().activeSpaceId === spaceId) {
      set({ activeSpaceId: null, activeChannelId: null });
    }
  },

  sendMessage: async (channelId, content) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      profile_id: user.id,
      content,
    });

    if (error) {
      console.error("Error sending message:", error);
    }
  },

  setActiveSpaceId: (spaceId) => set({ activeSpaceId: spaceId }),
  setActiveChannelId: (channelId) => set({ activeChannelId: channelId }),
  setPresenceUsers: (presenceUsers) => set({ presenceUsers }),

  joinVoiceChannel: async (channelId) => {
    const profile = get().profile;
    if (!profile) return;

    try {
      set({ isLoading: true });
      const res = await fetch(
        `/api/livekit/token?room=${channelId}&username=${encodeURIComponent(
          profile.display_name || profile.username
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
