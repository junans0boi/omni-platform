begin;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint roles_name_not_blank check (length(btrim(name)) between 1 and 50),
  constraint roles_space_name_key unique (space_id, name)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission text not null,
  primary key (role_id, permission),
  constraint role_permissions_vocabulary_check check (permission in (
    'MANAGE_CHANNELS', 'KICK_MEMBERS', 'MANAGE_ROLES',
    'DELETE_OTHERS_MESSAGES', 'VIEW_PRIVATE_CHANNELS', 'CONTROL_VOICE',
    'MENTION_EVERYONE', 'MANAGE_PINS', 'MANAGE_INVITES', 'MANAGE_EXPRESSIONS'
  ))
);

create table public.membership_roles (
  member_id uuid not null references public.members(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (member_id, role_id)
);

create index roles_space_id_idx on public.roles(space_id);
create index membership_roles_role_id_idx on public.membership_roles(role_id);

create or replace function public.enforce_membership_role_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.members m
    join public.roles r on r.space_id = m.space_id
    where m.id = new.member_id and r.id = new.role_id
  ) then
    raise exception using errcode = '23514', message = 'membership_and_role_must_share_space';
  end if;
  return new;
end;
$$;

create trigger membership_roles_same_space
  before insert or update on public.membership_roles
  for each row execute function public.enforce_membership_role_space();

create or replace function public.has_space_permission(target_space_id uuid, requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_space_role(target_space_id, array['OWNER'])
    or exists (
      select 1
      from public.members m
      join public.membership_roles mr on mr.member_id = m.id
      join public.roles r on r.id = mr.role_id and r.space_id = m.space_id
      join public.role_permissions rp on rp.role_id = r.id
      where m.space_id = target_space_id
        and m.profile_id = public.current_profile_id()
        and rp.permission = requested_permission
    )
$$;

create or replace function public.can_manage_custom_role(target_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.roles r
    where r.id = target_role_id
      and public.has_space_permission(r.space_id, 'MANAGE_ROLES')
      and (
        public.has_active_space_role(r.space_id, array['OWNER'])
        or not exists (
          select 1 from public.members m
          join public.membership_roles mr on mr.member_id = m.id
          where m.space_id = r.space_id
            and m.profile_id = public.current_profile_id()
            and mr.role_id = r.id
        )
      )
  )
$$;

create or replace function public.can_assign_custom_role(target_member_id uuid, target_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members target
    join public.roles r on r.space_id = target.space_id and r.id = target_role_id
    where target.id = target_member_id
      and target.profile_id <> public.current_profile_id()
      and target.role <> 'OWNER'
      and public.has_space_permission(target.space_id, 'MANAGE_ROLES')
      and (
        public.has_active_space_role(target.space_id, array['OWNER'])
        or not exists (
          select 1
          from public.role_permissions rp
          where rp.role_id = r.id
            and not public.has_space_permission(target.space_id, rp.permission)
        )
      )
  )
$$;

revoke execute on function public.enforce_membership_role_space() from public, anon, authenticated;
revoke execute on function public.has_space_permission(uuid, text) from public, anon;
revoke execute on function public.can_manage_custom_role(uuid) from public, anon;
revoke execute on function public.can_assign_custom_role(uuid, uuid) from public, anon;
grant execute on function public.has_space_permission(uuid, text) to authenticated;
grant execute on function public.can_manage_custom_role(uuid) to authenticated;
grant execute on function public.can_assign_custom_role(uuid, uuid) to authenticated;

alter table public.roles enable row level security;
alter table public.roles force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
alter table public.membership_roles enable row level security;
alter table public.membership_roles force row level security;

revoke all on public.roles, public.role_permissions, public.membership_roles from anon, authenticated;
grant select, insert, update, delete on public.roles, public.role_permissions, public.membership_roles to authenticated;

create policy roles_select on public.roles for select to authenticated
  using (public.is_active_space_member(space_id));
create policy roles_insert on public.roles for insert to authenticated
  with check (public.has_space_permission(space_id, 'MANAGE_ROLES'));
create policy roles_update on public.roles for update to authenticated
  using (public.can_manage_custom_role(id))
  with check (public.can_manage_custom_role(id));
create policy roles_delete on public.roles for delete to authenticated
  using (public.can_manage_custom_role(id));

create policy role_permissions_select on public.role_permissions for select to authenticated
  using (exists (select 1 from public.roles r where r.id = role_id and public.is_active_space_member(r.space_id)));
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check (
    public.can_manage_custom_role(role_id)
    and exists (
      select 1 from public.roles r where r.id = role_id
        and (public.has_active_space_role(r.space_id, array['OWNER']) or public.has_space_permission(r.space_id, permission))
    )
  );
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (
    public.can_manage_custom_role(role_id)
    and exists (
      select 1 from public.roles r where r.id = role_id
        and (public.has_active_space_role(r.space_id, array['OWNER']) or public.has_space_permission(r.space_id, permission))
    )
  );

create policy membership_roles_select on public.membership_roles for select to authenticated
  using (exists (
    select 1 from public.members m where m.id = member_id and public.is_active_space_member(m.space_id)
  ));
create policy membership_roles_insert on public.membership_roles for insert to authenticated
  with check (public.can_assign_custom_role(member_id, role_id));
create policy membership_roles_delete on public.membership_roles for delete to authenticated
  using (public.can_assign_custom_role(member_id, role_id));

-- Replace fixed ADMIN checks at the existing RLS boundary with the shared permission vocabulary.
drop policy if exists categories_insert on public.categories;
drop policy if exists categories_update on public.categories;
drop policy if exists categories_delete on public.categories;
create policy categories_insert on public.categories for insert to authenticated
  with check (public.has_space_permission(space_id, 'MANAGE_CHANNELS'));
create policy categories_update on public.categories for update to authenticated
  using (public.has_space_permission(space_id, 'MANAGE_CHANNELS'))
  with check (public.has_space_permission(space_id, 'MANAGE_CHANNELS'));
create policy categories_delete on public.categories for delete to authenticated
  using (public.has_space_permission(space_id, 'MANAGE_CHANNELS'));

drop policy if exists channels_insert on public.channels;
drop policy if exists channels_update on public.channels;
drop policy if exists channels_delete on public.channels;
create policy channels_insert on public.channels for insert to authenticated
  with check (public.has_space_permission(space_id, 'MANAGE_CHANNELS'));
create policy channels_update on public.channels for update to authenticated
  using (public.has_space_permission(space_id, 'MANAGE_CHANNELS'))
  with check (public.has_space_permission(space_id, 'MANAGE_CHANNELS'));
create policy channels_delete on public.channels for delete to authenticated
  using (public.has_space_permission(space_id, 'MANAGE_CHANNELS'));

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using (
    profile_id = public.current_profile_id()
    or exists (
      select 1 from public.channels c where c.id = channel_id
        and public.has_space_permission(c.space_id, 'DELETE_OTHERS_MESSAGES')
    )
  );

drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete to authenticated
  using (
    public.can_remove_membership(space_id, profile_id, role)
    or (
      profile_id <> public.current_profile_id()
      and role <> 'OWNER'
      and public.has_space_permission(space_id, 'KICK_MEMBERS')
    )
  );

commit;
