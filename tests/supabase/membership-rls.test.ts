import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721072000_membership_rls.sql"),
  "utf8",
);
const sql = migration.replace(/\s+/g, " ").trim().toLowerCase();

const publicTables = [
  "profiles",
  "spaces",
  "categories",
  "channels",
  "members",
  "messages",
  "reactions",
] as const;

describe("Supabase membership RLS contract", () => {
  it("keeps anonymous users ungranted and scopes every policy to authenticated JWTs", () => {
    expect(sql).toContain("revoke all privileges on all tables in schema public from anon, authenticated");
    expect(sql).not.toMatch(/grant [^;]+ to anon/);

    for (const table of publicTables) {
      expect(sql).toContain(`alter table public.${table} force row level security`);
      const policies = [...sql.matchAll(new RegExp(`create policy [^;]+ on public\\.${table} ([^;]+);`, "g"))];
      expect(policies.length, `${table} has an explicit policy`).toBeGreaterThan(0);
      for (const policy of policies) expect(policy[1], `${table} policy role`).toContain("to authenticated");
    }
  });

  it("resolves authorization through the active Auth-linked Profile and active Space", () => {
    expect(sql).toContain("p.auth_user_id = auth.uid()");
    expect(sql).toContain("p.account_status = 'active'");
    expect(sql).toContain("s.archived_at is null");
    expect(sql).not.toMatch(/members\.profile_id\s*=\s*auth\.uid\(\)/);
  });

  it("defines explicit CRUD policies with USING and WITH CHECK where rows can mutate", () => {
    const requiredPolicyFragments = [
      "profiles_select",
      "profiles_update",
      "spaces_select",
      "spaces_insert",
      "spaces_update",
      "categories_select",
      "categories_insert",
      "categories_update",
      "categories_delete",
      "channels_select",
      "channels_insert",
      "channels_update",
      "channels_delete",
      "members_select",
      "members_insert",
      "members_update",
      "members_delete",
      "messages_select",
      "messages_insert",
      "messages_update",
      "messages_delete",
      "reactions_select",
      "reactions_insert",
      "reactions_delete",
    ];
    for (const name of requiredPolicyFragments) expect(sql).toContain(`create policy ${name}`);

    for (const name of [
      "profiles_update",
      "spaces_insert",
      "spaces_update",
      "categories_insert",
      "categories_update",
      "channels_insert",
      "channels_update",
      "members_insert",
      "members_update",
      "messages_insert",
      "messages_update",
      "reactions_insert",
    ]) {
      const policy = sql.match(new RegExp(`create policy ${name}[^;]+;`))?.[0];
      expect(policy, `${name} exists`).toBeDefined();
      expect(policy, `${name} has WITH CHECK`).toContain("with check");
    }
  });

  it("prevents self-grant, role escalation, owner removal, and cross-Space channel links", () => {
    expect(sql).toContain("role <> 'owner'");
    expect(sql).toContain("public.can_insert_membership(space_id, profile_id, role)");
    expect(sql).toContain("public.can_update_membership(space_id, profile_id, role)");
    expect(sql).toContain("public.can_remove_membership(space_id, profile_id, role)");
    expect(sql).toContain("target_role = 'member'");
    expect(sql).toContain("target_profile_id <> public.current_profile_id()");
    expect(sql).toContain("channels_category_space_fkey foreign key (category_id, space_id)");
    expect(sql).toContain("references public.categories(id, space_id)");
    expect(sql).toContain("members_one_owner_per_space_idx");
  });

  it("uses a JWT-backed atomic owner transfer instead of direct owner-id or OWNER-role writes", () => {
    expect(sql).toMatch(/function public\.transfer_space_ownership\(\s*target_space_id uuid, next_owner_profile_id uuid\s*\)/);
    expect(sql).toContain("security definer set search_path = ''");
    expect(sql).toContain("for update");
    expect(sql).toContain("current_owner_profile_id <> public.current_profile_id()");
    expect(sql).toContain("and m.profile_id = next_owner_profile_id");
    expect(sql).toContain("and p.account_status = 'active'");
    expect(sql).toContain("grant execute on function public.transfer_space_ownership(uuid, uuid) to authenticated");
    expect(sql).not.toMatch(/grant update \([^)]*owner_id[^)]*\) on public\.spaces/);
    expect(sql).not.toMatch(/grant update on public\.members/);
  });

  it("ships an executable owner/admin/member/non-member/anonymous/archived CRUD matrix", () => {
    const matrix = readFileSync(
      join(process.cwd(), "supabase/tests/membership_rls.sql"),
      "utf8",
    ).replace(/\s+/g, " ").toLowerCase();

    for (const actor of ["owner", "admin", "member", "non_member", "anonymous", "archived_member"])
      expect(matrix).toContain(`actor:${actor}`);
    for (const operation of ["select", "insert", "update", "delete"])
      expect(matrix).toContain(`operation:${operation}`);
    expect(matrix).toContain("set local role authenticated");
    expect(matrix).toContain("set local role anon");
    expect(matrix).toContain("request.jwt.claim.sub");
    expect(matrix).toContain("finish()");
  });
});
