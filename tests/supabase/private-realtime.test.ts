import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721073000_private_realtime.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("private Supabase Realtime contract", () => {
  it("publishes only message and reaction durable tables", () => {
    const published = [...sql.matchAll(/publication supabase_realtime add table public\.([a-z_]+)/g)]
      .map((match) => match[1]);
    expect(published).toEqual(["messages", "reactions"]);
  });

  it("authorizes immutable space and channel UUID topics by membership", () => {
    expect(sql).toContain("realtime.topic() like 'space:%'");
    expect(sql).toContain("realtime.topic() like 'channel:%'");
    expect(sql).toContain("split_part(realtime.topic(), ':', 2)::uuid");
    expect(sql).toContain("p.auth_user_id = (select auth.uid())");
    expect(sql).toContain("m.space_id = c.space_id");
  });

  it("allows only private Broadcast and Presence writes", () => {
    expect(sql).toContain("on realtime.messages for select to authenticated");
    expect(sql).toContain("on realtime.messages for insert to authenticated");
    expect(sql).toContain("extension in ('broadcast', 'presence')");
    expect(sql).not.toContain(" to anon");
  });
});
