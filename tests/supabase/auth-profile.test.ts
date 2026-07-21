import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721071000_auth_profile_claim.sql"),
  "utf8",
);
const sql = migration.replace(/\s+/g, " ").trim().toLowerCase();

describe("Supabase Auth and Profile claim contract", () => {
  it("runs the signup trigger with a fixed empty search path", () => {
    expect(sql).toMatch(
      /create or replace function public\.handle_new_user\(\) returns trigger language plpgsql security definer set search_path = ''/,
    );
    expect(sql).toContain("new.raw_user_meta_data ->> 'username'");
    expect(sql).toContain("after insert on auth.users");
    expect(sql).toContain("for each row execute function public.handle_new_user()");
  });

  it("links only the exact trusted legacy Profile and rejects collisions", () => {
    expect(sql).toContain("new.raw_app_meta_data ->> 'legacy_profile_id'");
    expect(sql).toContain("where p.id = coalesce(requested_profile_id, new.id)");
    expect(sql).toContain("where p.id = existing_profile.id");
    expect(sql).toContain("profile_uuid_already_claimed");
    expect(sql).toContain("profile_username_collision");
    expect(sql).toContain("legacy_claim_username_mismatch");
    expect(sql).toContain("legacy_claim_email_required");
    expect(sql).toContain("legacy_claim_profile_not_active");
    expect(sql).toContain("get diagnostics affected_rows = row_count");
    expect(sql).toContain("if affected_rows <> 1 then");
  });

  it("keeps unverified claims disabled and activates only after email verification", () => {
    expect(sql).toContain("when new.email_confirmed_at is null then 'claim_pending'");
    expect(sql).toMatch(/after update of email_confirmed_at on auth\.users/);
    expect(sql).toContain("old.email_confirmed_at is null");
    expect(sql).toContain("new.email_confirmed_at is not null");
    expect(sql).toContain("and p.account_status = 'claim_pending'");
  });

  it("never persists or logs legacy credential material", () => {
    expect(sql).not.toMatch(/\b(?:password|password_hash|token_hash|scrypt)\b/);
    expect(sql).not.toMatch(/raise (?:notice|log|warning)/);
  });
});
