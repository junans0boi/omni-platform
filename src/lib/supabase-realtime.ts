import type { PresenceSnapshot } from "@/lib/events";
import type { Message, Profile, Reaction, RealtimeMessage } from "@/store/useAppStore";

type Row = Record<string, unknown>;

function requiredString(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid realtime ${key}`);
  return value;
}

function nullableString(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Invalid realtime ${key}`);
  return value;
}

export function channelTopic(channelId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(channelId)) throw new Error("Invalid channel id");
  return `channel:${channelId}`;
}

export function spaceTopic(spaceId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) throw new Error("Invalid space id");
  return `space:${spaceId}`;
}

export function mapProfileRow(row: Row): Profile {
  return {
    id: requiredString(row, "id"),
    username: requiredString(row, "username"),
    displayName: nullableString(row, "display_name"),
    avatarUrl: nullableString(row, "avatar_url"),
    createdAt: requiredString(row, "created_at"),
  };
}

export function mapReactionRow(row: Row, profile?: Profile): Reaction {
  return {
    id: requiredString(row, "id"),
    messageId: requiredString(row, "message_id"),
    profileId: requiredString(row, "profile_id"),
    emoji: requiredString(row, "emoji"),
    createdAt: requiredString(row, "created_at"),
    profile,
  };
}

export function hydrateMessageRow(
  row: Row,
  profile?: Profile,
  reactions: Reaction[] = [],
): Message {
  return {
    id: requiredString(row, "id"),
    channelId: requiredString(row, "channel_id"),
    profileId: requiredString(row, "profile_id"),
    content: requiredString(row, "content"),
    createdAt: requiredString(row, "created_at"),
    editedAt: nullableString(row, "edited_at"),
    profile,
    reactions,
  };
}

export function mapMessageChange(
  event: "INSERT" | "UPDATE" | "DELETE",
  row: Row,
  hydrated?: Message,
): RealtimeMessage {
  if (event === "DELETE") {
    return {
      id: requiredString(row, "id"),
      channelId: requiredString(row, "channel_id"),
      _type: "DELETE",
    };
  }
  if (!hydrated) throw new Error("Authorized message refetch required");
  return event === "UPDATE" ? { ...hydrated, _type: "UPDATE" } : hydrated;
}

export function flattenPresenceState(value: Record<string, Array<Record<string, unknown>>>): PresenceSnapshot {
  const snapshot: PresenceSnapshot = {};
  for (const entries of Object.values(value)) {
    for (const entry of entries) {
      const userId = requiredString(entry, "user_id");
      snapshot[userId] = {
        user_id: userId,
        username: requiredString(entry, "username"),
        display_name: requiredString(entry, "display_name"),
        avatar_url: nullableString(entry, "avatar_url"),
        online_at: requiredString(entry, "online_at"),
      };
    }
  }
  return snapshot;
}
