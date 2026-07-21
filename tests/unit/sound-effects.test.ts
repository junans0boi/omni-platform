import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SOUND_PREFERENCE,
  SoundEffects,
  resolveMessageSound,
  type SoundEffectBackend,
  type SoundEvent,
} from "../../src/lib/sound-effects";

function backend(ready = true) {
  const completed: Array<() => void> = [];
  const value: SoundEffectBackend = {
    isReady: () => ready,
    unlock: vi.fn(async () => undefined),
    play: vi.fn(() => {
      let finish: () => void = () => {};
      const done = new Promise<void>((resolve) => {
        finish = resolve;
      });
      completed.push(finish);
      return { done, stop: finish };
    }),
  };
  return { value, completed };
}

describe("message sound policy", () => {
  it("plays one mention sound instead of a general message sound", () => {
    expect(resolveMessageSound({ authoredBySelf: false, activeChannel: false, targetedMention: true })).toBe("TARGETED_MENTION");
    expect(resolveMessageSound({ authoredBySelf: false, activeChannel: true, targetedMention: true })).toBe("TARGETED_MENTION");
  });

  it("only plays ordinary messages from other people in inactive channels", () => {
    expect(resolveMessageSound({ authoredBySelf: false, activeChannel: false, targetedMention: false })).toBe("INACTIVE_MESSAGE");
    expect(resolveMessageSound({ authoredBySelf: false, activeChannel: true, targetedMention: false })).toBeNull();
    expect(resolveMessageSound({ authoredBySelf: true, activeChannel: false, targetedMention: true })).toBeNull();
  });
});

describe("effects bus", () => {
  it("defaults to enabled at 35 percent and clamps volume", () => {
    expect(DEFAULT_SOUND_PREFERENCE).toEqual({ enabled: true, masterVolume: 35 });
    const audio = backend();
    const effects = new SoundEffects(audio.value, { enabled: true, masterVolume: 140 });
    effects.emit("LOCAL_MUTED");
    expect(audio.value.play).toHaveBeenCalledWith("LOCAL_MUTED", 1);
  });

  it("suppresses incoming events in DND but keeps successful local feedback", () => {
    const audio = backend();
    const effects = new SoundEffects(audio.value);
    effects.setDnd(true);

    for (const event of ["INACTIVE_MESSAGE", "TARGETED_MENTION", "REMOTE_JOINED", "REMOTE_LEFT"] as SoundEvent[]) {
      expect(effects.emit(event)).toBe(false);
    }
    expect(effects.emit("LOCAL_CONNECTED")).toBe(true);
    expect(effects.emit("LOCAL_MUTED")).toBe(true);
  });

  it("master OFF suppresses every event", () => {
    const audio = backend();
    const effects = new SoundEffects(audio.value, { enabled: false, masterVolume: 35 });
    expect(effects.emit("LOCAL_MUTED")).toBe(false);
    expect(audio.value.play).not.toHaveBeenCalled();
  });

  it("drops autoplay-blocked events instead of replaying them after unlock", async () => {
    let ready = false;
    const audio = backend();
    audio.value.isReady = () => ready;
    const effects = new SoundEffects(audio.value);

    expect(effects.emit("TARGETED_MENTION")).toBe(false);
    ready = true;
    await effects.unlock();
    expect(audio.value.play).not.toHaveBeenCalled();
  });

  it("aggregates repeated remote churn for one second", () => {
    const audio = backend();
    const effects = new SoundEffects(audio.value);
    expect(effects.emit("REMOTE_JOINED", 1_000)).toBe(true);
    expect(effects.emit("REMOTE_JOINED", 1_999)).toBe(false);
    expect(effects.emit("REMOTE_JOINED", 2_000)).toBe(true);
  });

  it("caps concurrency and lets local feedback replace a lower-priority sound", () => {
    const audio = backend();
    const effects = new SoundEffects(audio.value);
    expect(effects.emit("REMOTE_JOINED")).toBe(true);
    expect(effects.emit("REMOTE_LEFT")).toBe(true);
    expect(effects.emit("INACTIVE_MESSAGE")).toBe(false);
    expect(effects.emit("LOCAL_MUTED")).toBe(true);
    expect(audio.value.play).toHaveBeenCalledTimes(3);
  });
});
