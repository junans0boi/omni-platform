export const SOUND_EVENTS = [
  "INACTIVE_MESSAGE",
  "TARGETED_MENTION",
  "LOCAL_CONNECTED",
  "LOCAL_DISCONNECTED",
  "REMOTE_JOINED",
  "REMOTE_LEFT",
  "LOCAL_MUTED",
  "LOCAL_UNMUTED",
  "SCREEN_SHARE_STARTED",
  "SCREEN_SHARE_STOPPED",
  "LOCAL_DEAFENED",
  "LOCAL_UNDEAFENED",
  "RINGTONE_CALL",
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
  SCREEN_SHARE_STARTED: 4,
  SCREEN_SHARE_STOPPED: 4,
  LOCAL_DEAFENED: 4,
  LOCAL_UNDEAFENED: 4,
  RINGTONE_CALL: 4,
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

/** Rich Web Audio sound synthesizer for distinct, high-fidelity audio feedback */
export class WebAudioSoundBackend implements SoundEffectBackend {
  private context: AudioContext | null = null;

  isReady() {
    return this.context?.state === "running";
  }

  async unlock() {
    this.context ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (this.context.state !== "running") await this.context.resume();
  }

  play(event: SoundEvent, volume: number): SoundPlayback {
    const context = this.context;
    if (!context || context.state !== "running") throw new Error("Audio playback is locked");

    const startedAt = context.currentTime;
    const masterGain = context.createGain();
    const effectiveVolume = Math.max(0.01, volume);
    masterGain.gain.setValueAtTime(effectiveVolume, startedAt);
    masterGain.connect(context.destination);

    let duration = 0.3;
    let resolveDone: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const activeNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

    const finish = () => {
      resolveDone();
    };

    // Helper to play a melody or multi-tone note sequence
    const playSequence = (notes: { freq: number; startOffset: number; duration: number; type?: OscillatorType; gainMult?: number }[]) => {
      notes.forEach(({ freq, startOffset, duration: noteDur, type = "triangle", gainMult = 1 }) => {
        const osc = context.createOscillator();
        const noteGain = context.createGain();
        const noteStart = startedAt + startOffset;
        const noteEnd = noteStart + noteDur;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, noteStart);

        noteGain.gain.setValueAtTime(0.001, noteStart);
        noteGain.gain.linearRampToValueAtTime(0.4 * gainMult, noteStart + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(noteStart);
        osc.stop(noteEnd);
        activeNodes.push(osc);
      });
      duration = Math.max(...notes.map((n) => n.startOffset + n.duration));
    };

    // Helper to play frequency sweeps (Sci-Fi sweeps for Screen Sharing)
    const playSweep = (startFreq: number, endFreq: number, sweepDuration: number, type: OscillatorType = "sine") => {
      const osc = context.createOscillator();
      const sweepGain = context.createGain();
      const noteEnd = startedAt + sweepDuration;

      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, startedAt);
      osc.frequency.exponentialRampToValueAtTime(endFreq, noteEnd);

      sweepGain.gain.setValueAtTime(0.001, startedAt);
      sweepGain.gain.linearRampToValueAtTime(0.35, startedAt + 0.03);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

      osc.connect(sweepGain);
      sweepGain.connect(masterGain);

      osc.start(startedAt);
      osc.stop(noteEnd);
      activeNodes.push(osc);
      duration = sweepDuration;
    };

    switch (event) {
      case "LOCAL_CONNECTED":
        // Warm 3-tone ascending chord (C5 -> E5 -> G5)
        playSequence([
          { freq: 523.25, startOffset: 0.0, duration: 0.18, type: "triangle" },
          { freq: 659.25, startOffset: 0.09, duration: 0.18, type: "triangle" },
          { freq: 783.99, startOffset: 0.18, duration: 0.25, type: "triangle" },
        ]);
        break;

      case "LOCAL_DISCONNECTED":
        // Soft 3-tone descending chime (G5 -> E5 -> C5)
        playSequence([
          { freq: 783.99, startOffset: 0.0, duration: 0.15, type: "sine" },
          { freq: 659.25, startOffset: 0.08, duration: 0.15, type: "sine" },
          { freq: 523.25, startOffset: 0.16, duration: 0.22, type: "sine" },
        ]);
        break;

      case "LOCAL_MUTED":
        // Crisp 2-tap downward click
        playSequence([
          { freq: 380, startOffset: 0.0, duration: 0.07, type: "sine" },
          { freq: 260, startOffset: 0.06, duration: 0.1, type: "sine" },
        ]);
        break;

      case "LOCAL_UNMUTED":
        // Bright 2-tap upward click
        playSequence([
          { freq: 420, startOffset: 0.0, duration: 0.07, type: "triangle" },
          { freq: 680, startOffset: 0.06, duration: 0.1, type: "triangle" },
        ]);
        break;

      case "SCREEN_SHARE_STARTED":
        // Sci-Fi upward frequency sweep chime
        playSweep(440, 1050, 0.42, "sine");
        break;

      case "SCREEN_SHARE_STOPPED":
        // Sci-Fi downward frequency sweep chime
        playSweep(950, 360, 0.38, "sine");
        break;

      case "LOCAL_DEAFENED":
        // Low muffled 2-note drop
        playSequence([
          { freq: 340, startOffset: 0.0, duration: 0.1, type: "sine" },
          { freq: 200, startOffset: 0.08, duration: 0.15, type: "sine" },
        ]);
        break;

      case "LOCAL_UNDEAFENED":
        // Clear 2-note rise
        playSequence([
          { freq: 280, startOffset: 0.0, duration: 0.1, type: "sine" },
          { freq: 520, startOffset: 0.08, duration: 0.15, type: "sine" },
        ]);
        break;

      case "REMOTE_JOINED":
        // Gentle bubble pop (E5 -> G5)
        playSequence([
          { freq: 659.25, startOffset: 0.0, duration: 0.12, type: "sine" },
          { freq: 880.00, startOffset: 0.06, duration: 0.16, type: "sine" },
        ]);
        break;

      case "REMOTE_LEFT":
        // Gentle bubble drop (F5 -> C5)
        playSequence([
          { freq: 698.46, startOffset: 0.0, duration: 0.12, type: "sine" },
          { freq: 523.25, startOffset: 0.06, duration: 0.16, type: "sine" },
        ]);
        break;

      case "INACTIVE_MESSAGE":
        // Crisp message pop with octave harmonic
        playSequence([
          { freq: 587.33, startOffset: 0.0, duration: 0.18, type: "triangle" },
          { freq: 1174.66, startOffset: 0.0, duration: 0.12, type: "sine", gainMult: 0.5 },
        ]);
        break;

      case "TARGETED_MENTION":
        // Vibrant 3-tone notification chime (E5 -> A5 -> C6)
        playSequence([
          { freq: 659.25, startOffset: 0.0, duration: 0.12, type: "triangle" },
          { freq: 880.00, startOffset: 0.09, duration: 0.12, type: "triangle" },
          { freq: 1046.50, startOffset: 0.18, duration: 0.22, type: "triangle" },
        ]);
        break;

      case "RINGTONE_CALL":
        // Dual-tone pulsing ringtone (440Hz + 480Hz)
        playSequence([
          { freq: 440, startOffset: 0.0, duration: 0.35, type: "sine" },
          { freq: 480, startOffset: 0.0, duration: 0.35, type: "sine", gainMult: 0.7 },
          { freq: 440, startOffset: 0.4, duration: 0.35, type: "sine" },
          { freq: 480, startOffset: 0.4, duration: 0.35, type: "sine", gainMult: 0.7 },
        ]);
        break;

      default:
        playSequence([{ freq: 520, startOffset: 0.0, duration: 0.15, type: "sine" }]);
        break;
    }

    setTimeout(finish, (duration + 0.05) * 1000);

    return {
      done,
      stop: () => {
        activeNodes.forEach((node) => {
          try {
            node.stop();
          } catch {
            // Already stopped
          }
        });
        finish();
      },
    };
  }
}
