import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721085000_presence_mentions.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("availability and structured mentions", () => {
  it("bounds persisted availability and status", () => {
    expect(sql).toContain("availability in ('available', 'idle', 'dnd')");
    expect(sql).toContain("length(custom_status) <= 128");
  });

  it("stores semantic mention kind, target, and snapshotted recipients", () => {
    expect(sql).toContain("kind in ('profile', 'everyone', 'here')");
    expect(sql).toContain("mentions_target_shape_check");
    expect(sql).toContain("primary key (mention_id, profile_id)");
  });

  it("keeps mention visibility Space-private and gates global creation", () => {
    expect(sql).toContain("public.is_active_space_member(c.space_id)");
    expect(sql).toContain("public.has_space_permission(");
    expect(sql).toContain("'mention_everyone'");
    expect(sql).not.toContain(" to anon");
  });
});
