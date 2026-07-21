begin;

alter table public.messages
  add column if not exists reply_to_id uuid,
  add column if not exists thread_root_id uuid,
  add column if not exists deleted_at timestamptz;

alter table public.messages
  add constraint messages_id_channel_key unique (id, channel_id),
  add constraint messages_not_self_reply check (reply_to_id is null or reply_to_id <> id),
  add constraint messages_not_self_thread check (thread_root_id is null or thread_root_id <> id),
  add constraint messages_thread_reply_targets_root check (
    thread_root_id is null or reply_to_id = thread_root_id
  ),
  add constraint messages_reply_same_channel_fkey
    foreign key (reply_to_id, channel_id)
    references public.messages(id, channel_id)
    on delete restrict,
  add constraint messages_thread_same_channel_fkey
    foreign key (thread_root_id, channel_id)
    references public.messages(id, channel_id)
    on delete restrict;

create index if not exists messages_thread_root_created_at_idx
  on public.messages(thread_root_id, created_at, id)
  where thread_root_id is not null;
create index if not exists messages_reply_to_id_idx
  on public.messages(reply_to_id)
  where reply_to_id is not null;

-- References deliberately have depth one. This makes cycles impossible and keeps
-- thread roots in the channel feed while panel replies remain panel-only.
create or replace function public.validate_message_reference_depth()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_reply_to_id uuid;
  target_thread_root_id uuid;
begin
  if new.reply_to_id is not null then
    select msg.reply_to_id, msg.thread_root_id
      into target_reply_to_id, target_thread_root_id
    from public.messages as msg
    where msg.id = new.reply_to_id
      and msg.channel_id = new.channel_id;

    if not found then
      raise exception using errcode = '23503', message = 'message_reference_not_found';
    end if;
    if target_reply_to_id is not null or target_thread_root_id is not null then
      raise exception using errcode = '23514', message = 'nested_message_reference';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_message_reference_depth on public.messages;
create trigger validate_message_reference_depth
  before insert or update of reply_to_id, thread_root_id, channel_id
  on public.messages
  for each row execute function public.validate_message_reference_depth();

revoke execute on function public.validate_message_reference_depth() from public, anon, authenticated;

-- Hard deletion would erase reply/thread history. Authenticated clients can only
-- tombstone their own message through this locked operation.
revoke delete on public.messages from authenticated;

create or replace function public.tombstone_message(target_message_id uuid)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.current_profile_id();
  target public.messages;
begin
  select msg.* into target
  from public.messages as msg
  join public.channels as c on c.id = msg.channel_id
  where msg.id = target_message_id
    and msg.profile_id = actor_id
    and public.is_active_space_member(c.space_id)
  for update of msg;

  if not found then
    raise exception using errcode = '42501', message = 'message_author_required';
  end if;

  update public.messages as msg
  set content = '', deleted_at = coalesce(msg.deleted_at, timezone('utc'::text, now()))
  where msg.id = target_message_id
  returning msg.* into target;
  return target;
end;
$$;

revoke execute on function public.tombstone_message(uuid) from public, anon;
grant execute on function public.tombstone_message(uuid) to authenticated;

-- A thread topic is private to active members of the root message's Space.
drop policy if exists "thread members receive private realtime" on realtime.messages;
create policy "thread members receive private realtime"
on realtime.messages for select to authenticated
using (
  realtime.topic() like 'thread:%'
  and exists (
    select 1
    from public.messages root
    join public.channels c on c.id = root.channel_id
    where root.id = split_part(realtime.topic(), ':', 2)::uuid
      and root.thread_root_id is null
      and public.is_active_space_member(c.space_id)
  )
);

drop policy if exists "thread members send private realtime" on realtime.messages;
create policy "thread members send private realtime"
on realtime.messages for insert to authenticated
with check (
  extension in ('broadcast', 'presence')
  and realtime.topic() like 'thread:%'
  and exists (
    select 1
    from public.messages root
    join public.channels c on c.id = root.channel_id
    where root.id = split_part(realtime.topic(), ':', 2)::uuid
      and root.thread_root_id is null
      and public.is_active_space_member(c.space_id)
  )
);

commit;
