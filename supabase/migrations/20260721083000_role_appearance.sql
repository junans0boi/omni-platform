begin;

alter table public.roles
  add column position integer not null default 0,
  add column color_hex text,
  add column badge_key text,
  add constraint roles_color_hex_check check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint roles_badge_key_check check (badge_key is null or badge_key in ('crown', 'shield', 'star', 'moderator'));

create index roles_space_position_id_idx on public.roles(space_id, position desc, id);

do $$
begin
  alter publication supabase_realtime add table public.roles;
exception when duplicate_object then null;
end $$;

commit;
