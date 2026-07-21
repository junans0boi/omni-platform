import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721084000_message_threads.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("Supabase message thread contract", () => {
  it("binds replies and roots to the same channel and rejects cycles by construction", () => {
    expect(sql).toContain("foreign key (reply_to_id, channel_id) references public.messages(id, channel_id) on delete restrict");
    expect(sql).toContain("foreign key (thread_root_id, channel_id) references public.messages(id, channel_id) on delete restrict");
    expect(sql).toContain("messages_not_self_reply check");
    expect(sql).toContain("target_reply_to_id is not null or target_thread_root_id is not null");
    expect(sql).toContain("messages_thread_reply_targets_root");
  });

  it("preserves history through an author-only tombstone operation", () => {
    expect(sql).toContain("revoke delete on public.messages from authenticated");
    expect(sql).toContain("function public.tombstone_message(target_message_id uuid)");
    expect(sql).toContain("msg.profile_id = actor_id");
    expect(sql).toContain("set content = '', deleted_at = coalesce");
    expect(sql).toContain("grant execute on function public.tombstone_message(uuid) to authenticated");
  });

  it("authorizes private thread Realtime topics through active Space membership", () => {
    expect(sql).toContain("thread members receive private realtime");
    expect(sql).toContain("thread members send private realtime");
    expect(sql).toContain("realtime.topic() like 'thread:%'");
    expect(sql).toContain("public.is_active_space_member(c.space_id)");
  });
});
