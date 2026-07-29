export type ScreenSharePreset = "720p" | "1080p60";

export interface ScreenCaptureOptions {
  resolution: { width: number; height: number; frameRate: number };
  audio: boolean;
}

export function getScreenCaptureOptions(preset: ScreenSharePreset): ScreenCaptureOptions {
  return preset === "1080p60"
    ? { resolution: { width: 1920, height: 1080, frameRate: 60 }, audio: true }
    : { resolution: { width: 1280, height: 720, frameRate: 30 }, audio: true };
}

/**
 * LiveKit's setScreenShareEnabled(true, options) only calls unmute() on an
 * already-published screen-share source and silently drops new resolution/
 * frameRate options. Detecting a mid-share preset change here is what lets
 * the caller force a real re-capture (disable, then re-enable with the new
 * options) instead of a silent no-op.
 */
export function didPresetChangeWhileSharing(params: {
  isScreenSharing: boolean;
  hasSharedBefore: boolean;
  previousPreset: ScreenSharePreset;
  nextPreset: ScreenSharePreset;
}): boolean {
  const { isScreenSharing, hasSharedBefore, previousPreset, nextPreset } = params;
  return isScreenSharing && hasSharedBefore && previousPreset !== nextPreset;
}
