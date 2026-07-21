import { describe, expect, it } from "vitest";
import {
  canonicalProfilePair,
  decideFriendshipTransition,
  mayReadDirectHistory,
  maySendDirectMessage,
} from "../../src/lib/direct-messaging";

describe("friendship and direct-message authorization", () => {
  it("gives either ordering of two Profiles one canonical pair", () => {
    expect(canonicalProfilePair("profile-b", "profile-a")).toEqual({
      profileAId: "profile-a",
      profileBId: "profile-b",
    });
    expect(() => canonicalProfilePair("profile-a", "profile-a")).toThrow("self_request");
  });

  it("allows only the recipient to accept or decline a pending request", () => {
    const friendship = {
      profileAId: "a",
      profileBId: "b",
      requestedById: "a",
      blockedById: null,
      status: "PENDING",
    } as const;
    expect(decideFriendshipTransition(friendship, "b", "accept")).toEqual({ status: "ACCEPTED", blockedById: null });
    expect(() => decideFriendshipTransition(friendship, "a", "accept")).toThrow("friend_request_recipient_required");
  });

  it("retains participant history after unfriend or block but disables new sends", () => {
    expect(mayReadDirectHistory("a", ["a", "b"])).toBe(true);
    expect(mayReadDirectHistory("third", ["a", "b"])).toBe(false);
    expect(maySendDirectMessage("a", ["a", "b"], "ACCEPTED")).toBe(true);
    expect(maySendDirectMessage("a", ["a", "b"], "REMOVED")).toBe(false);
    expect(maySendDirectMessage("b", ["a", "b"], "BLOCKED")).toBe(false);
  });

  it("lets only the blocker unblock and returns the pair to removed", () => {
    const friendship = {
      profileAId: "a",
      profileBId: "b",
      requestedById: "a",
      blockedById: "b",
      status: "BLOCKED",
    } as const;
    expect(decideFriendshipTransition(friendship, "b", "unblock")).toEqual({ status: "REMOVED", blockedById: null });
    expect(() => decideFriendshipTransition(friendship, "a", "unblock")).toThrow("friendship_blocker_required");
  });
});
