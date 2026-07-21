begin;

alter table public.profiles
  add column availability text not null default 'AVAILABLE',
  add column custom_status text,
  add constraint profiles_availability_check check (availability in ('AVAILABLE', 'IDLE', 'DND')),
  add constraint profiles_custom_status_length check (custom_status is null or length(custom_status) <= 128);
grant select (availability, custom_status) on public.profiles to authenticated;
grant update (availability, custom_status) on public.profiles to authenticated;

create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  kind text not null check (kind in ('PROFILE', 'EVERYONE', 'HERE')),
  target_profile_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint mentions_target_shape_check check (
    (kind = 'PROFILE' and target_profile_id is not null) or
    (kind in ('EVERYONE', 'HERE') and target_profile_id is null)
  )
);

create table public.mention_recipients (
  mention_id uuid not null references public.mentions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (mention_id, profile_id)
);

create index mentions_message_id_idx on public.mentions(message_id);
create index mention_recipients_profile_id_idx on public.mention_recipients(profile_id, mention_id);

alter table public.mentions enable row level security;
alter table public.mentions force row level security;
alter table public.mention_recipients enable row level security;
alter table public.mention_recipients force row level security;
revoke all on public.mentions, public.mention_recipients from anon, authenticated;
grant select, insert on public.mentions, public.mention_recipients to authenticated;

create policy mentions_select on public.mentions for select to authenticated using (
  exists (select 1 from public.messages msg join public.channels c on c.id = msg.channel_id
    where msg.id = message_id and public.is_active_space_member(c.space_id))
);
create policy mentions_insert on public.mentions for insert to authenticated with check (
  exists (select 1 from public.messages msg join public.channels c on c.id = msg.channel_id
    where msg.id = message_id and public.is_active_space_member(c.space_id))
  and (kind = 'PROFILE' or public.has_space_permission(
    (select c.space_id from public.messages msg join public.channels c on c.id = msg.channel_id where msg.id = message_id),
    'MENTION_EVERYONE'
  ))
);
create policy mention_recipients_select on public.mention_recipients for select to authenticated using (
  exists (select 1 from public.mentions mn join public.messages msg on msg.id = mn.message_id
    join public.channels c on c.id = msg.channel_id where mn.id = mention_id and public.is_active_space_member(c.space_id))
);
create policy mention_recipients_insert on public.mention_recipients for insert to authenticated with check (
  exists (select 1 from public.mentions mn join public.messages msg on msg.id = mn.message_id
    join public.channels c on c.id = msg.channel_id where mn.id = mention_id and public.is_active_space_member(c.space_id))
);

commit;
