import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  canFromSnapshot,
  validatePermissionGrant,
  type AuthoritySnapshot,
} from "../../src/lib/rbac";

const member = (permissions: string[] = []): AuthoritySnapshot => ({
  membershipId: "member-1",
  membershipRole: "MEMBER",
  permissions,
  roleIds: [],
});

describe("RBAC authority matrix", () => {
  it("gives the immutable owner every permission and denies non-members", () => {
    expect(canFromSnapshot({ ...member(), membershipRole: "OWNER" }, "MANAGE_ROLES")).toBe(true);
    expect(canFromSnapshot(null, "MANAGE_CHANNELS")).toBe(false);
  });

  it("uses the union of custom role allows without implicit member authority", () => {
    const actor = member(["MANAGE_CHANNELS", "MANAGE_INVITES"]);
    expect(canFromSnapshot(actor, "MANAGE_CHANNELS")).toBe(true);
    expect(canFromSnapshot(actor, "MANAGE_INVITES")).toBe(true);
    expect(canFromSnapshot(actor, "KICK_MEMBERS")).toBe(false);
  });

  it("rejects unknown permissions and grants above the actor", () => {
    expect(validatePermissionGrant(member(["MANAGE_ROLES", "MANAGE_CHANNELS"]), ["MANAGE_CHANNELS"]))
      .toEqual({ ok: true, permissions: ["MANAGE_CHANNELS"] });
    expect(validatePermissionGrant(member(["MANAGE_ROLES"]), ["KICK_MEMBERS"]))
      .toEqual({ ok: false, reason: "cannot_grant_above_actor" });
    expect(validatePermissionGrant(member(["MANAGE_ROLES"]), ["NOT_REAL"])).toEqual({
      ok: false,
      reason: "invalid_permission",
    });
  });

  it("keeps the permission vocabulary stable and duplicate-free", () => {
    expect(new Set(PERMISSIONS).size).toBe(10);
    expect(PERMISSIONS).toContain("DELETE_OTHERS_MESSAGES");
    expect(PERMISSIONS).toContain("VIEW_PRIVATE_CHANNELS");
  });
});
