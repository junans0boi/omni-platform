begin;

-- Durable changes only. Broadcast/Presence payloads use realtime.messages and are not
-- persisted in public domain tables.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reactions;
exception when duplicate_object then null;
end $$;

alter table realtime.messages enable row level security;

drop policy if exists "space members receive private realtime" on realtime.messages;
create policy "space members receive private realtime"
on realtime.messages for select to authenticated
using (
  (
    realtime.topic() like 'space:%'
    and exists (
      select 1
      from public.members m
      join public.profiles p on p.id = m.profile_id
      where p.auth_user_id = (select auth.uid())
        and m.space_id = split_part(realtime.topic(), ':', 2)::uuid
    )
  )
  or
  (
    realtime.topic() like 'channel:%'
    and exists (
      select 1
      from public.channels c
      join public.members m on m.space_id = c.space_id
      join public.profiles p on p.id = m.profile_id
      where p.auth_user_id = (select auth.uid())
        and c.id = split_part(realtime.topic(), ':', 2)::uuid
    )
  )
);

drop policy if exists "space members send and track private realtime" on realtime.messages;
create policy "space members send and track private realtime"
on realtime.messages for insert to authenticated
with check (
  extension in ('broadcast', 'presence')
  and (
    (
      realtime.topic() like 'space:%'
      and exists (
        select 1
        from public.members m
        join public.profiles p on p.id = m.profile_id
        where p.auth_user_id = (select auth.uid())
          and m.space_id = split_part(realtime.topic(), ':', 2)::uuid
      )
    )
    or
    (
      realtime.topic() like 'channel:%'
      and exists (
        select 1
        from public.channels c
        join public.members m on m.space_id = c.space_id
        join public.profiles p on p.id = m.profile_id
        where p.auth_user_id = (select auth.uid())
          and c.id = split_part(realtime.topic(), ':', 2)::uuid
      )
    )
  )
);

commit;
