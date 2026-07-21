export const ROLE_BADGES = ["crown", "shield", "star", "moderator"] as const;
export type RoleBadge = (typeof ROLE_BADGES)[number];

export interface RoleAppearance {
  id: string;
  name: string;
  position: number;
  colorHex: string | null;
  badgeKey: string | null;
}

export interface DisplayRole {
  id: string | null;
  name: string;
  colorHex: string;
  badgeKey: RoleBadge | null;
}

export const NEUTRAL_DISPLAY_ROLE: Readonly<DisplayRole> = Object.freeze({
  id: null,
  name: "Member",
  colorHex: "#A1A1AA",
  badgeKey: null,
});

export function isRoleColor(value: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(value);
}

export function isRoleBadge(value: string): value is RoleBadge {
  return (ROLE_BADGES as readonly string[]).includes(value);
}

export function validateRoleAppearance(colorHex: string | null, badgeKey: string | null): boolean {
  return (colorHex === null || isRoleColor(colorHex)) && (badgeKey === null || isRoleBadge(badgeKey));
}

export function resolveDisplayRole(roles: readonly RoleAppearance[]): DisplayRole {
  const role = [...roles]
    .filter(({ colorHex, badgeKey }) => validateRoleAppearance(colorHex, badgeKey))
    .sort((left, right) => right.position - left.position || left.id.localeCompare(right.id))[0];
  if (!role) return { ...NEUTRAL_DISPLAY_ROLE };
  return {
    id: role.id,
    name: role.name,
    colorHex: role.colorHex ?? NEUTRAL_DISPLAY_ROLE.colorHex,
    badgeKey: role.badgeKey && isRoleBadge(role.badgeKey) ? role.badgeKey : null,
  };
}
