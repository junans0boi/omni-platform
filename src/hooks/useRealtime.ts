import { useEffect } from "react";
import { useAppStore, Message } from "@/store/useAppStore";

export const useRealtime = () => {
  const {
    activeChannelId,
    activeSpaceId,
    profile,
    addMessage,
    setPresenceUsers,
  } = useAppStore();

  // 1. Subscribe to real-time Messages via Server-Sent Events (SSE)
  useEffect(() => {
    if (!activeChannelId) return;

    const eventSource = new EventSource(
      `/api/channels/${activeChannelId}/messages/stream`
    );

    eventSource.onmessage = (event) => {
      try {
        const newMsg: Message = JSON.parse(event.data);
        addMessage(newMsg);
      } catch (err) {
        console.error("Failed to parse SSE payload:", err);
      }
    };

    eventSource.onerror = () => {
      // Auto reconnect handled by EventSource natively
    };

    return () => {
      eventSource.close();
    };
  }, [activeChannelId, addMessage]);

  // 2. Local Presence status syncing (mocked on local server)
  useEffect(() => {
    if (!activeSpaceId || !profile) return;

    // Simulating online presence for the current user
    const localUserPresence = {
      [profile.id]: {
        user_id: profile.id,
        username: profile.username,
        display_name: profile.displayName || profile.username,
        avatar_url: profile.avatarUrl,
        online_at: new Date().toISOString(),
      },
    };

    setPresenceUsers(localUserPresence);
  }, [activeSpaceId, profile, setPresenceUsers]);
};
