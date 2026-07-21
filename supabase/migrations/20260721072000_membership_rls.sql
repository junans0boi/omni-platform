begin;

-- The Data API starts from no privileges. Only the column-level capabilities below are
-- exposed; anon receives none and trusted migration/admin clients are not part of RLS proof.
revoke all privileges on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;

alter table public.profiles force row level security;
alter table public.spaces force row level security;
alter table public.categories force row level security;
alter table public.channels force row level security;
alter table public.members force row level security;
alter table public.messages force row level security;
alter table public.reactions force row level security;

-- A Channel's optional Category must belong to the same Space. The historical single-column
-- FK is retained; this additional key makes a cross-Space category assignment impossible.
alter table public.categories
  add constraint categories_id_space_key unique (id, space_id);
alter table public.channels
  add constraint channels_category_space_fkey
  foreign key (category_id, space_id)
  references public.categories(id, space_id)
  on delete cascade;

-- An active Space can have at most one OWNER Membership. transfer_space_ownership performs
-- the matching Space.owner_id and Membership changes in one locked transaction.
create unique index members_one_owner_per_space_idx
  on public.members(space_id)
  where role = 'OWNER';

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles as p
  where p.auth_user_id = auth.uid()
    and p.account_status = 'ACTIVE'
  limit 1
$$;

create or replace function public.is_active_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.spaces as s
    join public.members as m on m.space_id = s.id
    join public.profiles as p on p.id = m.profile_id
    where s.id = target_space_id
      and s.archived_at is null
      and p.id = public.current_profile_id()
      and p.account_status = 'ACTIVE'
  )
$$;

create or replace function public.has_active_space_role(
  target_space_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.spaces as s
    join public.members as m on m.space_id = s.id
    join public.profiles as p on p.id = m.profile_id
    where s.id = target_space_id
      and s.archived_at is null
      and p.id = public.current_profile_id()
      and p.account_status = 'ACTIVE'
      and m.role = any (allowed_roles)
  )
$$;

create or replace function public.can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile_id = public.current_profile_id()
    or exists (
      select 1
      from public.members as viewer_membership
      join public.spaces as s on s.id = viewer_membership.space_id
      join public.members as subject_membership
        on subject_membership.space_id = viewer_membership.space_id
      where viewer_membership.profile_id = public.current_profile_id()
        and subject_membership.profile_id = target_profile_id
        and s.archived_at is null
    )
    or exists (
      select 1
      from public.members as viewer_membership
      join public.spaces as s on s.id = viewer_membership.space_id
      join public.channels as c on c.space_id = s.id
      join public.messages as msg on msg.channel_id = c.id
      where viewer_membership.profile_id = public.current_profile_id()
        and msg.profile_id = target_profile_id
        and s.archived_at is null
    )
$$;

create or replace function public.can_insert_membership(
  target_space_id uuid,
  target_profile_id uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile_id <> public.current_profile_id()
    and target_role <> 'OWNER'
    and exists (
      select 1
      from public.profiles as target
      where target.id = target_profile_id
        and target.account_status = 'ACTIVE'
    )
    and (
      (public.has_active_space_role(target_space_id, array['OWNER'])
        and target_role = any (array['ADMIN', 'MEMBER']))
      or
      (public.has_active_space_role(target_space_id, array['ADMIN'])
        and target_role = 'MEMBER')
    )
$$;

create or replace function public.can_update_membership(
  target_space_id uuid,
  target_profile_id uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile_id <> public.current_profile_id()
    and target_role <> 'OWNER'
    and target_role = any (array['ADMIN', 'MEMBER'])
    and public.has_active_space_role(target_space_id, array['OWNER'])
$$;

create or replace function public.can_remove_membership(
  target_space_id uuid,
  target_profile_id uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      target_profile_id = public.current_profile_id()
      and target_role <> 'OWNER'
      and public.is_active_space_member(target_space_id)
    )
    or (
      target_profile_id <> public.current_profile_id()
      and target_role <> 'OWNER'
      and public.has_active_space_role(target_space_id, array['OWNER'])
    )
    or (
      target_profile_id <> public.current_profile_id()
      and target_role = 'MEMBER'
      and public.has_active_space_role(target_space_id, array['ADMIN'])
    )
$$;

-- Raw OWNER-role and Space.owner_id writes are intentionally not granted. This is the only
-- user-JWT path for ownership transfer, and the row lock serializes competing transfers.
create or replace function public.transfer_space_ownership(
  target_space_id uuid,
  next_owner_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner_profile_id uuid;
begin
  select s.owner_id
  into current_owner_profile_id
  from public.spaces as s
  where s.id = target_space_id
    and s.archived_at is null
  for update;

  if not found or current_owner_profile_id <> public.current_profile_id() then
    raise exception using errcode = '42501', message = 'space_owner_required';
  end if;

  if next_owner_profile_id = current_owner_profile_id
     or not exists (
       select 1
       from public.members as m
       join public.profiles as p on p.id = m.profile_id
       where m.space_id = target_space_id
         and m.profile_id = next_owner_profile_id
         and p.account_status = 'ACTIVE'
     ) then
    raise exception using errcode = '23514', message = 'active_successor_membership_required';
  end if;

  update public.members as m
  set role = 'MEMBER'
  where m.space_id = target_space_id
    and m.profile_id = current_owner_profile_id
    and m.role = 'OWNER';

  update public.members as m
  set role = 'OWNER'
  where m.space_id = target_space_id
    and m.profile_id = next_owner_profile_id;

  update public.spaces as s
  set owner_id = next_owner_profile_id
  where s.id = target_space_id;
end;
$$;

-- Space creation remains a single user action: the trigger installs the invariant OWNER
-- Membership and starter hierarchy after the INSERT policy has bound owner_id to the JWT.
create or replace function public.handle_new_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_category_id uuid;
begin
  insert into public.members (space_id, profile_id, role)
  values (new.id, new.owner_id, 'OWNER');

  insert into public.categories (space_id, name, position)
  values (new.id, '기본', 0)
  returning id into new_category_id;

  insert into public.channels (space_id, category_id, name, type, position)
  values
    (new.id, new_category_id, '일반', 'TEXT', 0),
    (new.id, new_category_id, '로비', 'VOICE', 1);
  return new;
end;
$$;

drop trigger if exists on_space_created on public.spaces;
create trigger on_space_created
  after insert on public.spaces
  for each row execute function public.handle_new_space();

revoke execute on function public.current_profile_id() from public, anon;
revoke execute on function public.is_active_space_member(uuid) from public, anon;
revoke execute on function public.has_active_space_role(uuid, text[]) from public, anon;
revoke execute on function public.can_view_profile(uuid) from public, anon;
revoke execute on function public.can_insert_membership(uuid, uuid, text) from public, anon;
revoke execute on function public.can_update_membership(uuid, uuid, text) from public, anon;
revoke execute on function public.can_remove_membership(uuid, uuid, text) from public, anon;
revoke execute on function public.transfer_space_ownership(uuid, uuid) from public, anon;
revoke execute on function public.handle_new_space() from public, anon, authenticated;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_active_space_member(uuid) to authenticated;
grant execute on function public.has_active_space_role(uuid, text[]) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_insert_membership(uuid, uuid, text) to authenticated;
grant execute on function public.can_update_membership(uuid, uuid, text) to authenticated;
grant execute on function public.can_remove_membership(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_space_ownership(uuid, uuid) to authenticated;

grant select (id, username, display_name, avatar_url, account_status, created_at, updated_at)
  on public.profiles to authenticated;
grant update (username, display_name, avatar_url, updated_at)
  on public.profiles to authenticated;
grant select on public.spaces to authenticated;
grant insert (id, name, avatar_url, invite_code, owner_id, archived_at)
  on public.spaces to authenticated;
grant update (name, avatar_url, archived_at) on public.spaces to authenticated;
grant select, insert, delete on public.categories to authenticated;
grant update (name, position) on public.categories to authenticated;
grant select, insert, delete on public.channels to authenticated;
grant update (category_id, name, type, position) on public.channels to authenticated;
grant select, insert, delete on public.members to authenticated;
grant update (role) on public.members to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant update (content, edited_at) on public.messages to authenticated;
grant select, insert, delete on public.reactions to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_view_profile(id));
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = public.current_profile_id() and account_status = 'ACTIVE')
  with check (id = public.current_profile_id() and account_status = 'ACTIVE');

create policy spaces_select on public.spaces
  for select to authenticated
  using (public.is_active_space_member(id));
create policy spaces_insert on public.spaces
  for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and archived_at is null
  );
create policy spaces_update on public.spaces
  for update to authenticated
  using (public.has_active_space_role(id, array['OWNER']))
  with check (owner_id = public.current_profile_id());

create policy categories_select on public.categories
  for select to authenticated
  using (public.is_active_space_member(space_id));
create policy categories_insert on public.categories
  for insert to authenticated
  with check (public.has_active_space_role(space_id, array['OWNER', 'ADMIN']));
create policy categories_update on public.categories
  for update to authenticated
  using (public.has_active_space_role(space_id, array['OWNER', 'ADMIN']))
  with check (public.has_active_space_role(space_id, array['OWNER', 'ADMIN']));
create policy categories_delete on public.categories
  for delete to authenticated
  using (public.has_active_space_role(space_id, array['OWNER', 'ADMIN']));

create policy channels_select on public.channels
  for select to authenticated
  using (public.is_active_space_member(space_id));
create policy channels_insert on public.channels
  for insert to authenticated
  with check (public.has_active_space_role(space_id, array['OWNER', 'ADMIN']));
create policy channels_update on public.channels
  for update to authenticated
  using (public.has_active_space_role(space_id, array['OWNER', 'ADMIN']))
  with check (public.has_active_space_role(space_id, array['OWNER', 'ADMIN']));
create policy channels_delete on public.channels
  for delete to authenticated
  using (public.has_active_space_role(space_id, array['OWNER', 'ADMIN']));

create policy members_select on public.members
  for select to authenticated
  using (public.is_active_space_member(space_id));
create policy members_insert on public.members
  for insert to authenticated
  with check (public.can_insert_membership(space_id, profile_id, role));
create policy members_update on public.members
  for update to authenticated
  using (public.can_update_membership(space_id, profile_id, role))
  with check (public.can_update_membership(space_id, profile_id, role));
create policy members_delete on public.members
  for delete to authenticated
  using (public.can_remove_membership(space_id, profile_id, role));

create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.channels as c
      where c.id = channel_id
        and public.is_active_space_member(c.space_id)
    )
  );
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and exists (
      select 1 from public.channels as c
      where c.id = channel_id
        and public.is_active_space_member(c.space_id)
    )
  );
create policy messages_update on public.messages
  for update to authenticated
  using (
    profile_id = public.current_profile_id()
    and exists (
      select 1 from public.channels as c
      where c.id = channel_id
        and public.is_active_space_member(c.space_id)
    )
  )
  with check (
    profile_id = public.current_profile_id()
    and exists (
      select 1 from public.channels as c
      where c.id = channel_id
        and public.is_active_space_member(c.space_id)
    )
  );
create policy messages_delete on public.messages
  for delete to authenticated
  using (
    profile_id = public.current_profile_id()
    and exists (
      select 1 from public.channels as c
      where c.id = channel_id
        and public.is_active_space_member(c.space_id)
    )
  );

create policy reactions_select on public.reactions
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages as msg
      join public.channels as c on c.id = msg.channel_id
      where msg.id = message_id
        and public.is_active_space_member(c.space_id)
    )
  );
create policy reactions_insert on public.reactions
  for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and exists (
      select 1
      from public.messages as msg
      join public.channels as c on c.id = msg.channel_id
      where msg.id = message_id
        and public.is_active_space_member(c.space_id)
    )
  );
create policy reactions_delete on public.reactions
  for delete to authenticated
  using (
    profile_id = public.current_profile_id()
    and exists (
      select 1
      from public.messages as msg
      join public.channels as c on c.id = msg.channel_id
      where msg.id = message_id
        and public.is_active_space_member(c.space_id)
    )
  );

commit;
