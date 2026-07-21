import { EventEmitter } from "events";

export interface PresenceUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  online_at: string;
}

export type PresenceSnapshot = Record<string, PresenceUser>;

interface PresenceEntry {
  connections: number;
  user: PresenceUser;
}

type PresenceSpaces = Map<string, Map<string, PresenceEntry>>;

type RealtimeGlobals = typeof globalThis & {
  messageBroker?: EventEmitter;
  presenceSpaces?: PresenceSpaces;
};

// Persist local-only realtime state across Next.js HMR reloads.
const realtimeGlobals = globalThis as RealtimeGlobals;

if (!realtimeGlobals.messageBroker) {
  realtimeGlobals.messageBroker = new EventEmitter();
  realtimeGlobals.messageBroker.setMaxListeners(100);
}

if (!realtimeGlobals.presenceSpaces) {
  realtimeGlobals.presenceSpaces = new Map();
}

export const messageBroker = realtimeGlobals.messageBroker;
const presenceSpaces = realtimeGlobals.presenceSpaces;

export const presenceEventName = (spaceId: string) => `presence:${spaceId}`;

export function getPresenceSnapshot(spaceId: string): PresenceSnapshot {
  const spacePresence = presenceSpaces.get(spaceId);
  if (!spacePresence) return {};

  return Object.fromEntries(
    Array.from(spacePresence.entries(), ([profileId, entry]) => [
      profileId,
      entry.user,
    ])
  );
}

export function connectPresence(
  spaceId: string,
  user: PresenceUser
): () => void {
  const spacePresence = presenceSpaces.get(spaceId) ?? new Map();
  const current = spacePresence.get(user.user_id);

  spacePresence.set(user.user_id, {
    connections: (current?.connections ?? 0) + 1,
    user: current?.user ?? user,
  });
  presenceSpaces.set(spaceId, spacePresence);
  messageBroker.emit(presenceEventName(spaceId), getPresenceSnapshot(spaceId));

  let disconnected = false;
  return () => {
    if (disconnected) return;
    disconnected = true;

    const entry = spacePresence.get(user.user_id);
    if (entry && entry.connections > 1) {
      spacePresence.set(user.user_id, {
        ...entry,
        connections: entry.connections - 1,
      });
    } else {
      spacePresence.delete(user.user_id);
    }

    if (spacePresence.size === 0) presenceSpaces.delete(spaceId);
    messageBroker.emit(presenceEventName(spaceId), getPresenceSnapshot(spaceId));
  };
}
