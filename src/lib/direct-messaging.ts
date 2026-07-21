export const FRIENDSHIP_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "REMOVED",
  "BLOCKED",
] as const;

export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];
export type FriendshipAction = "accept" | "decline" | "block" | "unblock";

export interface FriendshipState {
  profileAId: string;
  profileBId: string;
  requestedById: string;
  blockedById: string | null;
  status: string;
}

export function canonicalProfilePair(firstProfileId: string, secondProfileId: string) {
  if (firstProfileId === secondProfileId) throw new Error("self_request");
  return firstProfileId < secondProfileId
    ? { profileAId: firstProfileId, profileBId: secondProfileId }
    : { profileAId: secondProfileId, profileBId: firstProfileId };
}

function isParticipant(friendship: FriendshipState, actorId: string) {
  return actorId === friendship.profileAId || actorId === friendship.profileBId;
}

export function decideFriendshipTransition(
  friendship: FriendshipState,
  actorId: string,
  action: FriendshipAction,
): { status: FriendshipStatus; blockedById: string | null } {
  if (!isParticipant(friendship, actorId)) throw new Error("friendship_participant_required");

  if (action === "block") return { status: "BLOCKED", blockedById: actorId };
  if (action === "unblock") {
    if (friendship.status !== "BLOCKED" || friendship.blockedById !== actorId) {
      throw new Error("friendship_blocker_required");
    }
    return { status: "REMOVED", blockedById: null };
  }

  if (friendship.status !== "PENDING") throw new Error("pending_friend_request_required");
  if (friendship.requestedById === actorId) throw new Error("friend_request_recipient_required");
  return { status: action === "accept" ? "ACCEPTED" : "DECLINED", blockedById: null };
}

export function mayReadDirectHistory(actorId: string, participantIds: readonly string[]) {
  return participantIds.includes(actorId);
}

export function maySendDirectMessage(
  actorId: string,
  participantIds: readonly string[],
  friendshipStatus: string,
) {
  return friendshipStatus === "ACCEPTED" && mayReadDirectHistory(actorId, participantIds);
}

export function directMessagingError(error: unknown): { error: string; status: number } {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    return { error: "duplicate_friend_request", status: 409 };
  }
  const code = error instanceof Error ? error.message : "unknown_error";
  const conflicts = new Set([
    "self_request",
    "duplicate_friend_request",
    "pending_friend_request_required",
    "friend_request_recipient_required",
    "friendship_blocker_required",
    "friendship_not_accepted",
  ]);
  if (conflicts.has(code)) return { error: code, status: 409 };
  if (code.endsWith("_required")) return { error: code, status: 403 };
  return { error: "Unable to complete direct messaging request", status: 500 };
}
