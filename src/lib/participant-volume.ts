export const DEFAULT_PARTICIPANT_VOLUME = 100;

export function clampParticipantVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PARTICIPANT_VOLUME;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function participantVolumeStorageKey(listenerProfileId: string): string {
  return `omni-participant-volume:${listenerProfileId}`;
}

export function readParticipantVolumes(
  listenerProfileId: string,
  storage: Pick<Storage, "getItem">,
): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(participantVolumeStorageKey(listenerProfileId)) || "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([profileId, value]) =>
        typeof value === "number" && profileId ? [[profileId, clampParticipantVolume(value)]] : [],
      ),
    );
  } catch {
    return {};
  }
}

export function writeParticipantVolumes(
  listenerProfileId: string,
  values: Record<string, number>,
  storage: Pick<Storage, "setItem">,
): void {
  storage.setItem(participantVolumeStorageKey(listenerProfileId), JSON.stringify(values));
}
