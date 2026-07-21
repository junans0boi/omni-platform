import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721070000_lossless_domain_baseline.sql"),
  "utf8",
);
const sql = migration.replace(/\s+/g, " ").trim().toLowerCase();

describe("Supabase lossless domain DDL", () => {
  it("accepts every preserved SQLite domain field without persisting credentials", () => {
    const requiredColumns = [
      "profiles.auth_user_id",
      "profiles.username",
      "profiles.display_name",
      "profiles.avatar_url",
      "profiles.created_at",
      "profiles.updated_at",
      "spaces.invite_code",
      "spaces.owner_id",
      "spaces.archived_at",
      "categories.position",
      "channels.category_id",
      "channels.type",
      "messages.edited_at",
      "reactions.message_id",
      "reactions.profile_id",
      "reactions.emoji",
    ];

    for (const qualifiedColumn of requiredColumns) {
      const [table, column] = qualifiedColumn.split(".");
      expect(sql, qualifiedColumn).toMatch(
        new RegExp(`(?:create table(?: if not exists)? public\\.${table}[^;]*|alter table public\\.${table}[^;]*)\\b${column}\\b`),
      );
    }

    expect(sql).not.toMatch(/create table(?: if not exists)? public\.sessions/);
    expect(sql).not.toMatch(/\b(?:password|password_hash|token_hash)\b/);
  });

  it("preserves identity and relationship integrity with explicit collision and enum checks", () => {
    expect(sql).toContain("profiles_username_key unique (username)");
    expect(sql).toContain("profiles_auth_user_id_key unique (auth_user_id)");
    expect(sql).toContain("spaces_invite_code_key unique (invite_code)");
    expect(sql).toContain("members_space_profile_key unique (space_id, profile_id)");
    expect(sql).toContain("reactions_message_profile_emoji_key unique (message_id, profile_id, emoji)");
    expect(sql).toContain("channels_type_check check (type in ('text', 'voice', 'stage'))");
    expect(sql).toContain("members_role_check check (role in ('owner', 'admin', 'member'))");
    expect(sql).toContain("profiles_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete set null");
    expect(sql).toContain("messages_profile_id_fkey foreign key (profile_id) references public.profiles(id) on delete restrict");
    expect(sql).toContain("reactions_message_id_fkey foreign key (message_id) references public.messages(id) on delete cascade");
  });

  it("installs traversal indexes and deny-by-default grants without accepting legacy policies", () => {
    const indexes = [
      "spaces_owner_id_idx",
      "categories_space_position_idx",
      "channels_space_position_idx",
      "channels_category_position_idx",
      "members_profile_id_idx",
      "messages_channel_created_at_idx",
      "messages_profile_id_idx",
      "reactions_message_id_idx",
      "reactions_profile_id_idx",
    ];
    for (const index of indexes) expect(sql).toContain(`index if not exists ${index}`);

    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all privileges on all tables in schema public from anon, authenticated");
    expect(sql).toContain("grant usage on schema public to authenticated");
    expect(sql).toContain('drop policy if exists "allow public read access to profiles"');
    expect(sql).toContain('drop policy if exists "allow space members to join via invite code (insert)"');
    expect(sql).not.toMatch(/create policy/);
  });
});
