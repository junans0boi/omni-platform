import { useEffect } from "react";
import { getSoundEffects } from "@/lib/browser-sound-effects";

/** Unlocks Web Audio from the first trusted pointer or keyboard gesture. */
export function useSoundEffectsUnlock() {
  useEffect(() => {
    const unlock = () => {
      void getSoundEffects()?.unlock().then(removeListeners).catch(() => {
        // Effects are supplementary. A denied audio context must not break UI actions.
      });
    };
    const removeListeners = () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return removeListeners;
  }, []);
}
