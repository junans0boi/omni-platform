import { describe, expect, it } from "vitest";
import { resolveFocusedTile } from "../../src/lib/spotlight";

describe("resolveFocusedTile", () => {
  it("returns null when nothing is focused", () => {
    expect(
      resolveFocusedTile({ focusedTileId: null, localHasVideo: true, remoteParticipantSids: ["p1"] }),
    ).toBeNull();
  });

  it("keeps local focus while local video is on", () => {
    expect(
      resolveFocusedTile({ focusedTileId: "local", localHasVideo: true, remoteParticipantSids: [] }),
    ).toBe("local");
  });

  it("drops local focus once the camera/screen share turns off", () => {
    expect(
      resolveFocusedTile({ focusedTileId: "local", localHasVideo: false, remoteParticipantSids: [] }),
    ).toBeNull();
  });

  it("keeps a remote focus while that participant is still present", () => {
    expect(
      resolveFocusedTile({ focusedTileId: "p1", localHasVideo: false, remoteParticipantSids: ["p1", "p2"] }),
    ).toBe("p1");
  });

  it("drops a remote focus once that participant leaves", () => {
    expect(
      resolveFocusedTile({ focusedTileId: "p1", localHasVideo: false, remoteParticipantSids: ["p2"] }),
    ).toBeNull();
  });
});
