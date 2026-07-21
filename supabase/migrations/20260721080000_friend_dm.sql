begin;

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  profile_a_id uuid not null references public.profiles(id) on delete cascade,
  profile_b_id uuid not null references public.profiles(id) on delete cascade,
  requested_by_id uuid not null references public.profiles(id) on delete cascade,
  blocked_by_id uuid references public.profiles(id) on delete set null,
  status text not null default 'PENDING',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint friendships_canonical_pair check (profile_a_id < profile_b_id),
  constraint friendships_pair_key unique (profile_a_id, profile_b_id),
  constraint friendships_requester_in_pair check (requested_by_id in (profile_a_id, profile_b_id)),
  constraint friendships_blocker_in_pair check (blocked_by_id is null or blocked_by_id in (profile_a_id, profile_b_id)),
  constraint friendships_status_check check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'REMOVED', 'BLOCKED'))
);

create table public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null unique references public.friendships(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.direct_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint direct_participants_pair_key unique (conversation_id, profile_id)
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  content text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  edited_at timestamptz,
  constraint direct_messages_content_not_blank check (length(btrim(content)) between 1 and 4000)
);

create index friendships_profile_a_status_idx on public.friendships(profile_a_id, status);
create index friendships_profile_b_status_idx on public.friendships(profile_b_id, status);
create index direct_participants_profile_idx on public.direct_participants(profile_id, conversation_id);
create index direct_messages_conversation_created_idx on public.direct_messages(conversation_id, created_at, id);
create index direct_messages_profile_idx on public.direct_messages(profile_id);

alter table public.friendships enable row level security;
alter table public.friendships force row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_conversations force row level security;
alter table public.direct_participants enable row level security;
alter table public.direct_participants force row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_messages force row level security;

revoke all on public.friendships, public.direct_conversations, public.direct_participants, public.direct_messages from public, anon, authenticated;
grant select on public.friendships, public.direct_conversations, public.direct_participants, public.direct_messages to authenticated;
grant insert (conversation_id, profile_id, content) on public.direct_messages to authenticated;

create or replace function public.is_direct_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.direct_participants as participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id = public.current_profile_id()
  )
$$;

create or replace function public.can_send_direct_message(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_direct_participant(target_conversation_id)
    and exists (
      select 1
      from public.direct_conversations as conversation
      join public.friendships as friendship on friendship.id = conversation.friendship_id
      where conversation.id = target_conversation_id
        and friendship.status = 'ACCEPTED'
    )
$$;

create or replace function public.request_friendship(target_username text)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.current_profile_id();
  target_id uuid;
  pair_a uuid;
  pair_b uuid;
  existing public.friendships;
  result public.friendships;
begin
  select p.id into target_id from public.profiles as p
  where p.username = lower(btrim(target_username)) and p.account_status = 'ACTIVE';
  if target_id is null then raise exception using errcode = 'P0002', message = 'profile_not_found'; end if;
  if target_id = actor_id then raise exception using errcode = '23514', message = 'self_request'; end if;
  pair_a := least(actor_id, target_id);
  pair_b := greatest(actor_id, target_id);

  select * into existing from public.friendships as f
  where f.profile_a_id = pair_a and f.profile_b_id = pair_b for update;
  if found and existing.status = 'BLOCKED' then
    raise exception using errcode = '42501', message = 'friendship_blocked';
  end if;
  if found and existing.status in ('PENDING', 'ACCEPTED') then
    raise exception using errcode = '23505', message = 'duplicate_friend_request';
  end if;

  insert into public.friendships (profile_a_id, profile_b_id, requested_by_id)
  values (pair_a, pair_b, actor_id)
  on conflict (profile_a_id, profile_b_id) do update
    set status = 'PENDING', requested_by_id = excluded.requested_by_id,
        blocked_by_id = null, updated_at = timezone('utc'::text, now())
  returning * into result;
  return result;
end
$$;

create or replace function public.accept_friendship(target_friendship_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.current_profile_id();
  friendship public.friendships;
  conversation_id uuid;
begin
  select * into friendship from public.friendships as f where f.id = target_friendship_id for update;
  if not found or actor_id not in (friendship.profile_a_id, friendship.profile_b_id) then
    raise exception using errcode = '42501', message = 'friendship_participant_required';
  end if;
  if friendship.status <> 'PENDING' or friendship.requested_by_id = actor_id then
    raise exception using errcode = '23514', message = 'friend_request_recipient_required';
  end if;
  update public.friendships set status = 'ACCEPTED', blocked_by_id = null,
    updated_at = timezone('utc'::text, now()) where id = target_friendship_id;
  insert into public.direct_conversations (friendship_id) values (target_friendship_id)
    on conflict (friendship_id) do update set friendship_id = excluded.friendship_id
    returning id into conversation_id;
  insert into public.direct_participants (conversation_id, profile_id)
    values (conversation_id, friendship.profile_a_id), (conversation_id, friendship.profile_b_id)
    on conflict (conversation_id, profile_id) do nothing;
  return conversation_id;
end
$$;

create or replace function public.change_friendship_state(target_friendship_id uuid, action text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.current_profile_id();
  friendship public.friendships;
  next_status text;
  next_blocker uuid;
begin
  select * into friendship from public.friendships as f where f.id = target_friendship_id for update;
  if not found or actor_id not in (friendship.profile_a_id, friendship.profile_b_id) then
    raise exception using errcode = '42501', message = 'friendship_participant_required';
  end if;
  if action = 'block' then next_status := 'BLOCKED'; next_blocker := actor_id;
  elsif action = 'unblock' and friendship.status = 'BLOCKED' and friendship.blocked_by_id = actor_id then next_status := 'REMOVED'; next_blocker := null;
  elsif action = 'decline' and friendship.status = 'PENDING' and friendship.requested_by_id <> actor_id then next_status := 'DECLINED'; next_blocker := null;
  elsif action = 'unfriend' and friendship.status = 'ACCEPTED' then next_status := 'REMOVED'; next_blocker := null;
  else raise exception using errcode = '23514', message = 'invalid_friendship_transition';
  end if;
  update public.friendships set status = next_status, blocked_by_id = next_blocker,
    updated_at = timezone('utc'::text, now()) where id = target_friendship_id;
  return next_status;
end
$$;

-- A Profile becomes visible to a friend/request participant or retained DM participant,
-- in addition to the Space visibility paths established by #58.
create or replace function public.can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile_id = public.current_profile_id()
    or exists (
      select 1 from public.friendships as f
      where public.current_profile_id() in (f.profile_a_id, f.profile_b_id)
        and target_profile_id in (f.profile_a_id, f.profile_b_id)
    )
    or exists (
      select 1
      from public.direct_participants as viewer
      join public.direct_participants as subject on subject.conversation_id = viewer.conversation_id
      where viewer.profile_id = public.current_profile_id() and subject.profile_id = target_profile_id
    )
    or exists (
      select 1 from public.members as viewer_membership
      join public.spaces as s on s.id = viewer_membership.space_id
      join public.members as subject_membership on subject_membership.space_id = viewer_membership.space_id
      where viewer_membership.profile_id = public.current_profile_id()
        and subject_membership.profile_id = target_profile_id and s.archived_at is null
    )
$$;

create policy friendships_select on public.friendships for select to authenticated
  using (public.current_profile_id() in (profile_a_id, profile_b_id));
create policy direct_conversations_select on public.direct_conversations for select to authenticated
  using (public.is_direct_participant(id));
create policy direct_participants_select on public.direct_participants for select to authenticated
  using (public.is_direct_participant(conversation_id));
create policy direct_messages_select on public.direct_messages for select to authenticated
  using (public.is_direct_participant(conversation_id));
create policy direct_messages_insert on public.direct_messages for insert to authenticated
  with check (profile_id = public.current_profile_id() and public.can_send_direct_message(conversation_id));

revoke execute on function public.is_direct_participant(uuid) from public, anon;
revoke execute on function public.can_send_direct_message(uuid) from public, anon;
revoke execute on function public.request_friendship(text) from public, anon;
revoke execute on function public.accept_friendship(uuid) from public, anon;
revoke execute on function public.change_friendship_state(uuid, text) from public, anon;
grant execute on function public.is_direct_participant(uuid) to authenticated;
grant execute on function public.can_send_direct_message(uuid) to authenticated;
grant execute on function public.request_friendship(text) to authenticated;
grant execute on function public.accept_friendship(uuid) to authenticated;
grant execute on function public.change_friendship_state(uuid, text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;

create policy "direct participants receive private realtime"
on realtime.messages for select to authenticated
using (
  realtime.topic() like 'dm:%'
  and public.is_direct_participant(split_part(realtime.topic(), ':', 2)::uuid)
);
create policy "direct participants send private realtime"
on realtime.messages for insert to authenticated
with check (
  extension in ('broadcast', 'presence')
  and realtime.topic() like 'dm:%'
  and public.is_direct_participant(split_part(realtime.topic(), ':', 2)::uuid)
);

commit;
