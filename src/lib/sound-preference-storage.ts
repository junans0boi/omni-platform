import { DEFAULT_SOUND_PREFERENCE, type SoundPreference } from "./sound-effects";

export function soundPreferenceStorageKey(profileId: string): string {
  return `omni-sound-preference:${profileId}`;
}

export function readSoundPreference(
  profileId: string,
  storage: Pick<Storage, "getItem">,
): SoundPreference {
  try {
    const value: unknown = JSON.parse(storage.getItem(soundPreferenceStorageKey(profileId)) || "null");
    if (
      typeof value === "object" && value !== null &&
      "enabled" in value && typeof value.enabled === "boolean" &&
      "masterVolume" in value && typeof value.masterVolume === "number"
    ) {
      return {
        enabled: value.enabled,
        masterVolume: Math.min(100, Math.max(0, Math.round(value.masterVolume))),
      };
    }
  } catch {
    // Invalid or unavailable storage falls back to the product default.
  }
  return { ...DEFAULT_SOUND_PREFERENCE };
}

export function writeSoundPreference(
  profileId: string,
  preference: SoundPreference,
  storage: Pick<Storage, "setItem">,
): void {
  storage.setItem(soundPreferenceStorageKey(profileId), JSON.stringify(preference));
}
