begin;

-- #55 corrective baseline. The preceding historical migration is retained as evidence;
-- this migration removes its unreviewed behavior and completes the lossless domain shape.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_space_created on public.spaces;
drop function if exists public.handle_new_user();
drop function if exists public.handle_new_space();

drop policy if exists "Allow public read access to profiles" on public.profiles;
drop policy if exists "Allow users to update their own profile" on public.profiles;
drop policy if exists "Allow insert profile on user creation" on public.profiles;
drop policy if exists "Allow space members to view their spaces" on public.spaces;
drop policy if exists "Allow authenticated users to create spaces" on public.spaces;
drop policy if exists "Allow space owner to update space" on public.spaces;
drop policy if exists "Allow space owner to delete space" on public.spaces;
drop policy if exists "Allow space members to view member list" on public.members;
drop policy if exists "Allow space members to join via invite code (insert)" on public.members;
drop policy if exists "Allow admins or self to remove members" on public.members;
drop policy if exists "Allow members to view categories" on public.categories;
drop policy if exists "Allow space admins to manage categories" on public.categories;
drop policy if exists "Allow members to view channels" on public.channels;
drop policy if exists "Allow space admins to manage channels" on public.channels;
drop policy if exists "Allow space members to view messages in channels" on public.messages;
drop policy if exists "Allow space members to post messages" on public.messages;

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists account_status text not null default 'ACTIVE',
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists anonymized_at timestamptz,
  alter column username set not null,
  alter column display_name drop not null,
  alter column avatar_url drop not null,
  alter column created_at set not null,
  alter column updated_at set not null,
  add constraint profiles_username_key unique (username),
  add constraint profiles_auth_user_id_key unique (auth_user_id),
  add constraint profiles_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete set null,
  add constraint profiles_account_status_check check (account_status in ('ACTIVE', 'CLAIM_PENDING', 'EXIT_PENDING', 'DISABLED', 'ANONYMIZED'));

-- Existing Auth-backed rows keep their UUID association. Missing Auth identities remain
-- unclaimed and are handled by #56; email collision checks also belong to auth.users there.
update public.profiles as p
set auth_user_id = p.id
where p.auth_user_id is null
  and exists (select 1 from auth.users as u where u.id = p.id);

alter table public.spaces drop constraint if exists spaces_invite_code_key;
alter table public.spaces
  alter column name set not null,
  alter column invite_code set not null,
  alter column owner_id drop not null,
  alter column archived_at drop not null,
  alter column created_at set not null,
  add constraint spaces_invite_code_key unique (invite_code);

alter table public.categories
  alter column space_id set not null,
  alter column name set not null,
  alter column position set not null,
  alter column created_at set not null;

alter table public.channels drop constraint if exists channels_type_check;
alter table public.channels
  alter column space_id set not null,
  alter column category_id drop not null,
  alter column name set not null,
  alter column type set not null,
  alter column position set not null,
  alter column created_at set not null,
  add constraint channels_type_check check (type in ('TEXT', 'VOICE', 'STAGE'));

alter table public.members drop constraint if exists members_role_check;
alter table public.members
  alter column space_id set not null,
  alter column profile_id set not null,
  alter column role set not null,
  alter column created_at set not null,
  add constraint members_space_profile_key unique (space_id, profile_id),
  add constraint members_role_check check (role in ('OWNER', 'ADMIN', 'MEMBER'));

alter table public.messages drop constraint if exists messages_profile_id_fkey;
alter table public.messages
  add column if not exists edited_at timestamptz,
  alter column channel_id set not null,
  alter column profile_id set not null,
  alter column content set not null,
  alter column created_at set not null,
  add constraint messages_profile_id_fkey foreign key (profile_id) references public.profiles(id) on delete restrict;

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  profile_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint reactions_message_id_fkey foreign key (message_id) references public.messages(id) on delete cascade,
  constraint reactions_profile_id_fkey foreign key (profile_id) references public.profiles(id) on delete restrict,
  constraint reactions_message_profile_emoji_key unique (message_id, profile_id, emoji),
  constraint reactions_emoji_not_blank check (length(btrim(emoji)) > 0)
);

create index if not exists spaces_owner_id_idx on public.spaces(owner_id);
create index if not exists categories_space_position_idx on public.categories(space_id, position, id);
create index if not exists channels_space_position_idx on public.channels(space_id, position, id);
create index if not exists channels_category_position_idx on public.channels(category_id, position, id);
create index if not exists members_profile_id_idx on public.members(profile_id, space_id);
create index if not exists messages_channel_created_at_idx on public.messages(channel_id, created_at, id);
create index if not exists messages_profile_id_idx on public.messages(profile_id);
create index if not exists reactions_message_id_idx on public.reactions(message_id, created_at, id);
create index if not exists reactions_profile_id_idx on public.reactions(profile_id);

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.categories enable row level security;
alter table public.channels enable row level security;
alter table public.members enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;

revoke all privileges on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.spaces to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.reactions to authenticated;

commit;
