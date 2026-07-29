import { describe, expect, it } from "vitest";
import { didPresetChangeWhileSharing, getScreenCaptureOptions } from "../../src/lib/screen-share-preset";

describe("getScreenCaptureOptions", () => {
  it("maps 1080p60 to 1920x1080 @ 60fps", () => {
    expect(getScreenCaptureOptions("1080p60")).toEqual({
      resolution: { width: 1920, height: 1080, frameRate: 60 },
      audio: true,
    });
  });

  it("maps 720p to 1280x720 @ 30fps", () => {
    expect(getScreenCaptureOptions("720p")).toEqual({
      resolution: { width: 1280, height: 720, frameRate: 30 },
      audio: true,
    });
  });
});

describe("didPresetChangeWhileSharing", () => {
  it("is true when the preset changes mid-share", () => {
    expect(
      didPresetChangeWhileSharing({
        isScreenSharing: true,
        hasSharedBefore: true,
        previousPreset: "1080p60",
        nextPreset: "720p",
      }),
    ).toBe(true);
  });

  it("is false when not currently sharing", () => {
    expect(
      didPresetChangeWhileSharing({
        isScreenSharing: false,
        hasSharedBefore: true,
        previousPreset: "1080p60",
        nextPreset: "720p",
      }),
    ).toBe(false);
  });

  it("is false the first time a share starts (no prior share to re-apply)", () => {
    expect(
      didPresetChangeWhileSharing({
        isScreenSharing: true,
        hasSharedBefore: false,
        previousPreset: "1080p60",
        nextPreset: "1080p60",
      }),
    ).toBe(false);
  });

  it("is false when the preset is unchanged", () => {
    expect(
      didPresetChangeWhileSharing({
        isScreenSharing: true,
        hasSharedBefore: true,
        previousPreset: "720p",
        nextPreset: "720p",
      }),
    ).toBe(false);
  });
});
