import { describe, expect, it } from "vitest";
import {
  assertMessageReference,
  messagePreview,
  isMainFeedMessage,
} from "../../src/lib/message-threads";

const root = {
  id: "root",
  channelId: "channel-a",
  replyToId: null,
  threadRootId: null,
  deletedAt: null,
  content: "A durable root message",
};

describe("message thread contract", () => {
  it("accepts only an existing, top-level target in the same channel", () => {
    expect(() => assertMessageReference("channel-a", "new-message", root)).not.toThrow();
    expect(() => assertMessageReference("channel-b", "new-message", root)).toThrow("cross_channel_reference");
    expect(() => assertMessageReference("channel-a", "root", root)).toThrow("message_reference_cycle");
    expect(() => assertMessageReference("channel-a", "new-message", {
      ...root,
      id: "nested",
      threadRootId: "root",
    })).toThrow("nested_thread_reference");
    expect(() => assertMessageReference("channel-a", "new-message", {
      ...root,
      id: "reply",
      replyToId: "root",
    })).toThrow("nested_thread_reference");
  });

  it("keeps deleted history addressable without leaking deleted prose", () => {
    expect(messagePreview(root)).toBe("A durable root message");
    expect(messagePreview({ ...root, deletedAt: new Date(0) })).toBe("[deleted message]");
  });

  it("keeps panel replies out of the channel feed", () => {
    expect(isMainFeedMessage(root)).toBe(true);
    expect(isMainFeedMessage({ ...root, threadRootId: "root" })).toBe(false);
  });
});
