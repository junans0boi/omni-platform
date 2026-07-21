import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/20260721081000_custom_rbac.sql"),
  "utf8",
).toLowerCase();

describe("Supabase custom RBAC contract", () => {
  it("defines Space-scoped roles, permission sets, assignments, and the shared authority function", () => {
    expect(sql).toContain("create table public.roles");
    expect(sql).toContain("constraint roles_space_name_key unique (space_id, name)");
    expect(sql).toContain("create table public.role_permissions");
    expect(sql).toContain("create table public.membership_roles");
    expect(sql).toContain("create or replace function public.has_space_permission");
    expect(sql).toContain("membership_and_role_must_share_space");
  });

  it("makes owner immutable and blocks self-escalation or grants above the actor", () => {
    expect(sql).toContain("target.profile_id <> public.current_profile_id()");
    expect(sql).toContain("target.role <> 'owner'");
    expect(sql).toContain("not public.has_space_permission(target.space_id, rp.permission)");
    expect(sql).toContain("public.has_active_space_role(r.space_id, array['owner'])");
  });

  it("uses custom permissions for channel management, kicks, and deleting others' messages", () => {
    expect(sql).toContain("public.has_space_permission(space_id, 'manage_channels')");
    expect(sql).toContain("public.has_space_permission(space_id, 'kick_members')");
    expect(sql).toContain("public.has_space_permission(c.space_id, 'delete_others_messages')");
  });
});
