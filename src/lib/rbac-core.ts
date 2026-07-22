export const PERMISSIONS = [
  "MANAGE_CHANNELS",
  "KICK_MEMBERS",
  "MANAGE_ROLES",
  "DELETE_OTHERS_MESSAGES",
  "VIEW_PRIVATE_CHANNELS",
  "CONTROL_VOICE",
  "MENTION_EVERYONE",
  "MANAGE_PINS",
  "MANAGE_INVITES",
  "MANAGE_EXPRESSIONS",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface AuthoritySnapshot {
  membershipId: string;
  membershipRole: string;
  permissions: string[];
  roleIds: string[];
}

const permissionSet = new Set<string>(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return permissionSet.has(value);
}

export function canFromSnapshot(authority: AuthoritySnapshot | null, permission: Permission): boolean {
  if (!authority) return false;
  if (authority.membershipRole === "OWNER" || authority.membershipRole === "ADMIN") return true;
  return authority.permissions.includes(permission);
}

export function validatePermissionGrant(
  actor: AuthoritySnapshot,
  requested: string[],
): { ok: true; permissions: Permission[] } | { ok: false; reason: string } {
  const unique = [...new Set(requested)];
  if (!unique.every(isPermission)) return { ok: false, reason: "invalid_permission" };
  if (actor.membershipRole !== "OWNER" && unique.some((permission) => !actor.permissions.includes(permission))) {
    return { ok: false, reason: "cannot_grant_above_actor" };
  }
  return { ok: true, permissions: unique as Permission[] };
}
