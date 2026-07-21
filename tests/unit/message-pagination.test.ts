import { describe, expect, it } from "vitest";
import {
  clampMessagePageLimit,
  decodeMessageCursor,
  encodeMessageCursor,
  mergeMessagePage,
  type PageMessage,
} from "../../src/lib/message-pagination";
import { shouldRenderVideo } from "../../src/lib/media-visibility";

const message = (id: string, createdAt: string): PageMessage => ({ id, createdAt });

describe("message history paging", () => {
  it("validates opaque cursors and clamps hostile limits", () => {
    const cursor = encodeMessageCursor({ id: "m-2", createdAt: "2026-07-21T10:00:00.000Z" });
    expect(decodeMessageCursor(cursor)).toEqual({ id: "m-2", createdAt: "2026-07-21T10:00:00.000Z" });
    expect(() => decodeMessageCursor("not-a-cursor")).toThrow(/cursor/i);
    expect(clampMessagePageLimit("9999")).toBe(100);
    expect(clampMessagePageLimit("0")).toBe(50);
  });

  it("deduplicates ordered pages and bounds the retained message window", () => {
    const current = [message("3", "2026-07-21T03:00:00.000Z"), message("4", "2026-07-21T04:00:00.000Z")];
    const older = [message("1", "2026-07-21T01:00:00.000Z"), message("3", "2026-07-21T03:00:00.000Z")];
    expect(mergeMessagePage(current, older, 3).map(({ id }) => id)).toEqual(["1", "3", "4"]);
  });
});

describe("background media rendering", () => {
  it("renders video only while the grid and document are visible", () => {
    expect(shouldRenderVideo(false, "visible")).toBe(true);
    expect(shouldRenderVideo(false, "hidden")).toBe(false);
    expect(shouldRenderVideo(true, "visible")).toBe(false);
  });
});
