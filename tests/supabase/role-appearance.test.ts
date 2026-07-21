import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721083000_role_appearance.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("Role appearance database contract", () => {
  it("constrains color and controlled accessible badge vocabulary", () => {
    expect(sql).toContain("color_hex ~ '^#[0-9a-fa-f]{6}$'");
    expect(sql).toContain("badge_key in ('crown', 'shield', 'star', 'moderator')");
  });

  it("orders deterministically and publishes appearance updates", () => {
    expect(sql).toContain("roles(space_id, position desc, id)");
    expect(sql).toContain("publication supabase_realtime add table public.roles");
  });
});
