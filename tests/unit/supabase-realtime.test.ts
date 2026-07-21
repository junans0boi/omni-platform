import { describe, expect, it } from "vitest";
import {
  channelTopic,
  flattenPresenceState,
  hydrateMessageRow,
  mapMessageChange,
  spaceTopic,
} from "../../src/lib/supabase-realtime";

const channelId = "00000000-0000-4000-8000-000000000001";
const spaceId = "00000000-0000-4000-8000-000000000002";

describe("Supabase Realtime adapter", () => {
  it("uses immutable UUID topics and rejects names", () => {
    expect(channelTopic(channelId)).toBe(`channel:${channelId}`);
    expect(spaceTopic(spaceId)).toBe(`space:${spaceId}`);
    expect(() => channelTopic("general")).toThrow("Invalid channel id");
  });

  it("requires an authorized refetch before hydrating inserts and updates", () => {
    expect(() => mapMessageChange("INSERT", { id: "m", channel_id: channelId })).toThrow(
      "Authorized message refetch required",
    );
    const message = hydrateMessageRow({
      id: "message-id",
      channel_id: channelId,
      profile_id: "profile-id",
      content: "hello",
      created_at: "2026-07-21T00:00:00.000Z",
      edited_at: null,
    });
    expect(mapMessageChange("UPDATE", {}, message)).toMatchObject({ id: "message-id", _type: "UPDATE" });
  });

  it("maps delete tombstones without leaking a raw row", () => {
    expect(mapMessageChange("DELETE", { id: "message-id", channel_id: channelId })).toEqual({
      id: "message-id",
      channelId,
      _type: "DELETE",
    });
  });

  it("merges multi-tab presence by stable user id", () => {
    const snapshot = flattenPresenceState({
      tabA: [{ user_id: "p1", username: "user", display_name: "User", avatar_url: null, online_at: "now" }],
      tabB: [{ user_id: "p1", username: "user", display_name: "User", avatar_url: null, online_at: "later" }],
    });
    expect(Object.keys(snapshot)).toEqual(["p1"]);
    expect(snapshot.p1.online_at).toBe("later");
  });
});
