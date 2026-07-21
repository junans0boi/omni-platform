import { useEffect } from "react";
import type { PresenceSnapshot } from "@/lib/events";
import { useAppStore, type RealtimeMessage } from "@/store/useAppStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMessageEvent(
  data: string,
  channelId: string
): RealtimeMessage | null {
  const value: unknown = JSON.parse(data);
  if (!isRecord(value) || typeof value.id !== "string") return null;

  if (value._type === "DELETE") {
    return { id: value.id, channelId, _type: "DELETE" };
  }

  if (
    typeof value.channelId !== "string" ||
    typeof value.profileId !== "string" ||
    typeof value.content !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  return { ...value, channelId } as RealtimeMessage;
}

function parsePresenceSnapshot(data: string): PresenceSnapshot | null {
  const value: unknown = JSON.parse(data);
  if (!isRecord(value)) return null;

  for (const presence of Object.values(value)) {
    if (
      !isRecord(presence) ||
      typeof presence.user_id !== "string" ||
      typeof presence.username !== "string" ||
      typeof presence.display_name !== "string" ||
      typeof presence.online_at !== "string" ||
      !(typeof presence.avatar_url === "string" || presence.avatar_url === null)
    ) {
      return null;
    }
  }

  return value as PresenceSnapshot;
}

export const useRealtime = () => {
  const {
    activeSpaceId,
    channels,
    profile,
    addMessage,
    setPresenceUsers,
  } = useAppStore();

  // Subscribe to every text channel so inactive-channel messages become unread.
  useEffect(() => {
    const textChannelIds = channels
      .filter(
        (channel) =>
          channel.spaceId === activeSpaceId && channel.type === "TEXT"
      )
      .map((channel) => channel.id);

    const eventSources = textChannelIds.map((channelId) => {
      const eventSource = new EventSource(
        `/api/channels/${channelId}/messages/stream`
      );

      eventSource.onmessage = (event) => {
        try {
          const message = parseMessageEvent(event.data, channelId);
          if (message) addMessage(message);
        } catch (error) {
          console.error("Failed to parse message SSE payload:", error);
        }
      };

      return eventSource;
    });

    return () => {
      eventSources.forEach((eventSource) => eventSource.close());
    };
  }, [activeSpaceId, addMessage, channels]);

  // The authenticated SSE connection itself represents local presence.
  useEffect(() => {
    if (!activeSpaceId || !profile) return;

    const eventSource = new EventSource(
      `/api/spaces/${activeSpaceId}/presence/stream`
    );

    eventSource.onmessage = (event) => {
      try {
        const presence = parsePresenceSnapshot(event.data);
        if (presence) setPresenceUsers(presence);
      } catch (error) {
        console.error("Failed to parse presence SSE payload:", error);
      }
    };

    return () => {
      eventSource.close();
      setPresenceUsers({});
    };
  }, [activeSpaceId, profile, setPresenceUsers]);
};
