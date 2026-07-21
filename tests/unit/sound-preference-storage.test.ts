import { describe, expect, it } from "vitest";
import {
  readSoundPreference,
  soundPreferenceStorageKey,
  writeSoundPreference,
} from "../../src/lib/sound-preference-storage";

describe("profile-scoped sound preference", () => {
  it("defaults to enabled at 35 percent", () => {
    expect(readSoundPreference("p1", { getItem: () => null })).toEqual({ enabled: true, masterVolume: 35 });
  });

  it("persists separately per Profile and clamps corrupt volume", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    writeSoundPreference("p1", { enabled: false, masterVolume: 80 }, storage);
    expect(readSoundPreference("p1", storage)).toEqual({ enabled: false, masterVolume: 80 });
    expect(readSoundPreference("p2", storage)).toEqual({ enabled: true, masterVolume: 35 });
    values.set(soundPreferenceStorageKey("p1"), JSON.stringify({ enabled: true, masterVolume: 300 }));
    expect(readSoundPreference("p1", storage).masterVolume).toBe(100);
  });
});
