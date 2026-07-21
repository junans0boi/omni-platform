import { describe, expect, it } from "vitest";
import {
  clampParticipantVolume,
  participantVolumeStorageKey,
  readParticipantVolumes,
  writeParticipantVolumes,
} from "../../src/lib/participant-volume";

describe("participant-local volume", () => {
  it("clamps finite values and rejects invalid input", () => {
    expect(clampParticipantVolume(-1)).toBe(0);
    expect(clampParticipantVolume(101)).toBe(100);
    expect(clampParticipantVolume(42.6)).toBe(43);
    expect(clampParticipantVolume(Number.NaN)).toBe(100);
  });

  it("persists preferences per listener without upstream state", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    writeParticipantVolumes("listener", { remote: 25 }, storage);
    expect(values.has(participantVolumeStorageKey("listener"))).toBe(true);
    expect(readParticipantVolumes("listener", storage)).toEqual({ remote: 25 });
    expect(readParticipantVolumes("other", storage)).toEqual({});
  });
});
