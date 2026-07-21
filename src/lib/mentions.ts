export const AVAILABILITY_VALUES = ["AVAILABLE", "IDLE", "DND"] as const;
export type Availability = (typeof AVAILABILITY_VALUES)[number];
export type MentionKind = "PROFILE" | "EVERYONE" | "HERE";

export interface MentionDraft {
  kind: MentionKind;
  profileId?: string;
}

export interface MentionMember {
  profileId: string;
  online: boolean;
}

export function validateCustomStatus(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 128) throw new Error("Custom status is too long");
  return normalized;
}

export function resolveMentionRecipients(
  mention: MentionDraft,
  members: readonly MentionMember[],
  canMentionEveryoneHere: boolean,
): string[] {
  if (mention.kind === "PROFILE") {
    if (!mention.profileId || !members.some((member) => member.profileId === mention.profileId)) {
      throw new Error("Mention target is not a member");
    }
    return [mention.profileId];
  }
  if (!canMentionEveryoneHere) throw new Error("Global mention permission required");
  const eligible = mention.kind === "HERE" ? members.filter((member) => member.online) : members;
  return [...new Set(eligible.map((member) => member.profileId))].sort();
}
