import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721080000_friend_dm.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("Supabase friend and direct-message contract", () => {
  it("enforces one canonical Profile pair and one conversation", () => {
    expect(sql).toContain("constraint friendships_canonical_pair check (profile_a_id < profile_b_id)");
    expect(sql).toContain("constraint friendships_pair_key unique (profile_a_id, profile_b_id)");
    expect(sql).toContain("friendship_id uuid not null unique");
    expect(sql).toContain("on conflict (conversation_id, profile_id) do nothing");
  });

  it("moves request acceptance and participant creation through locked JWT RPCs", () => {
    expect(sql).toContain("function public.request_friendship(target_username text)");
    expect(sql).toContain("function public.accept_friendship(target_friendship_id uuid)");
    expect(sql).toContain("where f.id = target_friendship_id for update");
    expect(sql).toContain("friendship.requested_by_id = actor_id");
    expect(sql).toContain("status = 'accepted'");
    expect(sql).not.toMatch(/grant insert[^;]+public\.friendships/);
  });

  it("lets participants retain reads while accepted friendship gates sends", () => {
    expect(sql).toContain("create policy direct_messages_select");
    expect(sql).toContain("public.is_direct_participant(conversation_id)");
    expect(sql).toContain("friendship.status = 'accepted'");
    expect(sql).toContain("profile_id = public.current_profile_id()");
  });

  it("keeps third-user and anonymous access out of data and private Realtime", () => {
    expect(sql).toContain("force row level security");
    expect(sql).toContain("revoke all on public.friendships, public.direct_conversations, public.direct_participants, public.direct_messages from public, anon, authenticated");
    expect(sql).toContain("realtime.topic() like 'dm:%'");
    expect(sql).toContain("direct participants receive private realtime");
    expect(sql).toContain("direct participants send private realtime");
  });
});
