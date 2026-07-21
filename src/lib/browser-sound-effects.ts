import { SoundEffects, WebAudioSoundBackend } from "@/lib/sound-effects";

let effects: SoundEffects | undefined;

export function getSoundEffects(): SoundEffects | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  effects ??= new SoundEffects(new WebAudioSoundBackend());
  return effects;
}
