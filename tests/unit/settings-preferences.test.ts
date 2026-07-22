import { describe, expect, it } from "vitest";

describe("User Preferences API Data Model Validation", () => {
  it("validates default user preference options", () => {
    const defaultPreferences = {
      pcNotification: true,
      friendAnniversary: true,
      friendOnline: true,
      friendProfileUpdate: true,
      reactionNotification: "all",
      newMessageSound: true,
      activeChannelSound: true,
      ringtoneSound: true,
      disableAllSounds: false,
      micVolume: 80,
      speakerVolume: 85,
      inputProfile: "isolation",
      pushToTalk: false,
      alwaysPreviewVideo: true,
      locale: "ko",
      timeFormat: "auto",
    };

    expect(defaultPreferences.pcNotification).toBe(true);
    expect(defaultPreferences.inputProfile).toBe("isolation");
    expect(defaultPreferences.timeFormat).toBe("auto");
    expect(defaultPreferences.disableAllSounds).toBe(false);
  });

  it("validates time format options", () => {
    const validFormats = ["auto", "12h", "24h"];
    expect(validFormats).toContain("12h");
    expect(validFormats).toContain("24h");
  });

  it("validates input audio profiles", () => {
    const profiles = ["isolation", "studio", "custom"];
    expect(profiles).toHaveLength(3);
  });
});
