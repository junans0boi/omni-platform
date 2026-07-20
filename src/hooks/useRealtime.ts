import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAppStore, Message, Profile } from "@/store/useAppStore";

export const useRealtime = () => {
  const {
    activeChannelId,
    activeSpaceId,
    profile,
    addMessage,
    setPresenceUsers,
  } = useAppStore();

  // 1. Subscribe to real-time Messages in the active channel
  useEffect(() => {
    if (!activeChannelId) return;

    const channel = supabase
      .channel(`room:${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;

          // Fetch profile of the sender to display display_name & avatar
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", newMsg.profile_id)
            .single();

          const messageWithProfile: Message = {
            id: newMsg.id,
            channel_id: newMsg.channel_id,
            profile_id: newMsg.profile_id,
            content: newMsg.content,
            created_at: newMsg.created_at,
            profile: (profileData as Profile) || undefined,
          };

          addMessage(messageWithProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId, addMessage]);

  // 2. Track Realtime Presence in the active space
  useEffect(() => {
    if (!activeSpaceId || !profile) return;

    const presenceChannel = supabase.channel(`presence:${activeSpaceId}`, {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const users: Record<string, any> = {};

        Object.keys(state).forEach((key) => {
          const presenceList = state[key];
          if (presenceList && presenceList[0]) {
            users[key] = presenceList[0];
          }
        });

        setPresenceUsers(users);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        // Handle presence join if needed
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        // Handle presence leave if needed
      });

    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          user_id: profile.id,
          username: profile.username,
          display_name: profile.display_name || profile.username,
          avatar_url: profile.avatar_url,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [activeSpaceId, profile, setPresenceUsers]);
};
