export const SOUND_EVENTS = [
  "INACTIVE_MESSAGE",
  "TARGETED_MENTION",
  "LOCAL_CONNECTED",
  "LOCAL_DISCONNECTED",
  "REMOTE_JOINED",
  "REMOTE_LEFT",
  "LOCAL_MUTED",
  "LOCAL_UNMUTED",
] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number];

export interface SoundPreference {
  enabled: boolean;
  masterVolume: number;
}

export const DEFAULT_SOUND_PREFERENCE: Readonly<SoundPreference> = Object.freeze({
  enabled: true,
  masterVolume: 35,
});

export interface SoundPlayback {
  done: Promise<void>;
  stop: () => void;
}

export interface SoundEffectBackend {
  isReady(): boolean;
  unlock(): Promise<void>;
  play(event: SoundEvent, gain: number): SoundPlayback;
}

export interface MessageSoundContext {
  authoredBySelf: boolean;
  activeChannel: boolean;
  targetedMention: boolean;
}

export function resolveMessageSound({
  authoredBySelf,
  activeChannel,
  targetedMention,
}: MessageSoundContext): SoundEvent | null {
  if (authoredBySelf) return null;
  if (targetedMention) return "TARGETED_MENTION";
  return activeChannel ? null : "INACTIVE_MESSAGE";
}

const DND_SUPPRESSED = new Set<SoundEvent>([
  "INACTIVE_MESSAGE",
  "TARGETED_MENTION",
  "REMOTE_JOINED",
  "REMOTE_LEFT",
]);

const PRIORITY: Record<SoundEvent, number> = {
  LOCAL_CONNECTED: 4,
  LOCAL_DISCONNECTED: 4,
  LOCAL_MUTED: 4,
  LOCAL_UNMUTED: 4,
  TARGETED_MENTION: 3,
  REMOTE_JOINED: 2,
  REMOTE_LEFT: 2,
  INACTIVE_MESSAGE: 1,
};

type ActivePlayback = { event: SoundEvent; playback: SoundPlayback };

/** Profile effects bus. It never receives or mutates a LiveKit media track. */
export class SoundEffects {
  private preference: SoundPreference;
  private dnd = false;
  private readonly active: ActivePlayback[] = [];
  private readonly lastRemoteEvent = new Map<SoundEvent, number>();

  constructor(
    private readonly backend: SoundEffectBackend,
    preference: SoundPreference = DEFAULT_SOUND_PREFERENCE
  ) {
    this.preference = normalizePreference(preference);
  }

  setPreference(preference: SoundPreference) {
    this.preference = normalizePreference(preference);
  }

  setDnd(dnd: boolean) {
    this.dnd = dnd;
  }

  async unlock() {
    await this.backend.unlock();
  }

  emit(event: SoundEvent, now = Date.now()): boolean {
    if (!this.preference.enabled || this.preference.masterVolume === 0) return false;
    if (this.dnd && DND_SUPPRESSED.has(event)) return false;
    if (!this.backend.isReady()) return false;

    if (event === "REMOTE_JOINED" || event === "REMOTE_LEFT") {
      const previous = this.lastRemoteEvent.get(event);
      if (previous !== undefined && now - previous < 1_000) return false;
    }

    if (this.active.length >= 2) {
      const lowest = this.active.reduce((candidate, item) =>
        PRIORITY[item.event] < PRIORITY[candidate.event] ? item : candidate
      );
      if (PRIORITY[event] <= PRIORITY[lowest.event]) return false;
      lowest.playback.stop();
      this.remove(lowest);
    }

    try {
      const playback = this.backend.play(event, this.preference.masterVolume / 100);
      const active = { event, playback };
      this.active.push(active);
      if (event === "REMOTE_JOINED" || event === "REMOTE_LEFT") {
        this.lastRemoteEvent.set(event, now);
      }
      void playback.done.then(
        () => this.remove(active),
        () => this.remove(active)
      );
      return true;
    } catch {
      return false;
    }
  }

  private remove(target: ActivePlayback) {
    const index = this.active.indexOf(target);
    if (index >= 0) this.active.splice(index, 1);
  }
}

function normalizePreference(preference: SoundPreference): SoundPreference {
  return {
    enabled: preference.enabled,
    masterVolume: Math.min(100, Math.max(0, preference.masterVolume)),
  };
}

const TONES: Record<SoundEvent, readonly [number, number]> = {
  INACTIVE_MESSAGE: [520, 0.12],
  TARGETED_MENTION: [760, 0.18],
  LOCAL_CONNECTED: [660, 0.2],
  LOCAL_DISCONNECTED: [330, 0.2],
  REMOTE_JOINED: [590, 0.14],
  REMOTE_LEFT: [400, 0.14],
  LOCAL_MUTED: [360, 0.1],
  LOCAL_UNMUTED: [620, 0.1],
};

/** Self-produced, non-looping Web Audio tones; call unlock from a trusted gesture. */
export class WebAudioSoundBackend implements SoundEffectBackend {
  private context: AudioContext | null = null;

  isReady() {
    return this.context?.state === "running";
  }

  async unlock() {
    this.context ??= new AudioContext();
    if (this.context.state !== "running") await this.context.resume();
  }

  play(event: SoundEvent, volume: number): SoundPlayback {
    const context = this.context;
    if (!context || context.state !== "running") throw new Error("Audio playback is locked");

    const [frequency, duration] = TONES[event];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startedAt = context.currentTime;
    const stoppedAt = startedAt + duration;
    let settled = false;
    let resolveDone: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    const finish = () => {
      if (settled) return;
      settled = true;
      resolveDone();
    };

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startedAt);
    gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.12), startedAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, stoppedAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.addEventListener("ended", finish, { once: true });
    oscillator.start(startedAt);
    oscillator.stop(stoppedAt);

    return {
      done,
      stop: () => {
        try {
          oscillator.stop();
        } catch {
          // Already stopped.
        }
        finish();
      },
    };
  }
}
