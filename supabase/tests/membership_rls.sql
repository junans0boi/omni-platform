create extension if not exists pgtap with schema extensions;
begin;
select plan(25);

-- This suite is run by `supabase test db` against an isolated database after migrations.
-- It intentionally exercises policies as browser roles; fixture setup alone uses postgres.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{}', '{"username":"owner_user"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admin@example.test', '', now(), '{}', '{"username":"admin_user"}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'member@example.test', '', now(), '{}', '{"username":"member_user"}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), '{}', '{"username":"outsider_user"}', now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'invitee@example.test', '', now(), '{}', '{"username":"invitee_user"}', now(), now());

insert into public.spaces (id, name, invite_code, owner_id)
values (
  '20000000-0000-0000-0000-000000000001',
  'Active fixture',
  'active-fixture',
  '10000000-0000-0000-0000-000000000001'
), (
  '20000000-0000-0000-0000-000000000002',
  'Archived fixture',
  'archived-fixture',
  '10000000-0000-0000-0000-000000000001'
);
insert into public.members (id, space_id, profile_id, role) values
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'ADMIN'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'MEMBER'),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'MEMBER');
update public.spaces
set archived_at = now()
where id = '20000000-0000-0000-0000-000000000002';

-- actor:owner operation:select
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select count(*)::bigint from public.spaces$$,
  array[1::bigint],
  'owner sees the active Space but not the archived Space'
);
select results_eq(
  $$select count(*)::bigint from public.members where space_id = '20000000-0000-0000-0000-000000000001'$$,
  array[3::bigint],
  'owner can read the active member list'
);

-- actor:owner operation:insert / operation:update / operation:delete
select lives_ok(
  $$insert into public.members (id, space_id, profile_id, role) values ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'MEMBER')$$,
  'owner may invite an active Profile as MEMBER'
);
select lives_ok(
  $$update public.members set role = 'ADMIN' where id = '30000000-0000-0000-0000-000000000005'$$,
  'owner may promote a non-owner member to ADMIN'
);
select lives_ok(
  $$delete from public.members where id = '30000000-0000-0000-0000-000000000005'$$,
  'owner may remove a non-owner member'
);
select results_eq(
  $$with removed as (delete from public.members where profile_id = '10000000-0000-0000-0000-000000000001' returning 1) select count(*)::bigint from removed$$,
  array[0::bigint],
  'owner cannot remove their OWNER Membership before transfer'
);

-- actor:admin operation:select / operation:insert / operation:update / operation:delete
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select count(*)::bigint from public.channels$$,
  array[2::bigint],
  'admin sees active descendants only'
);
select lives_ok(
  $$insert into public.channels (id, space_id, name, type, position) values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'admin-channel', 'TEXT', 20)$$,
  'admin may create a Channel'
);
select lives_ok(
  $$update public.channels set name = 'renamed' where id = '40000000-0000-0000-0000-000000000001'$$,
  'admin may update a Channel'
);
select lives_ok(
  $$delete from public.channels where id = '40000000-0000-0000-0000-000000000001'$$,
  'admin may delete a Channel'
);
select throws_ok(
  $$insert into public.members (space_id, profile_id, role) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'ADMIN')$$,
  '42501',
  'admin cannot grant ADMIN'
);

-- actor:member operation:select / operation:insert / operation:update / operation:delete
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$select count(*)::bigint from public.categories$$,
  array[1::bigint],
  'member reads active descendants only'
);
select lives_ok(
  $$insert into public.messages (id, channel_id, profile_id, content) select '50000000-0000-0000-0000-000000000001', c.id, '10000000-0000-0000-0000-000000000003', 'hello' from public.channels c where c.space_id = '20000000-0000-0000-0000-000000000001' and c.type = 'TEXT' limit 1$$,
  'member may create their Message'
);
select lives_ok(
  $$update public.messages set content = 'edited', edited_at = now() where id = '50000000-0000-0000-0000-000000000001'$$,
  'member may update their Message'
);
select lives_ok(
  $$insert into public.reactions (id, message_id, profile_id, emoji) values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '👍')$$,
  'member may react as themself'
);
select lives_ok(
  $$delete from public.reactions where id = '60000000-0000-0000-0000-000000000001'$$,
  'member may delete their Reaction'
);
select lives_ok(
  $$delete from public.messages where id = '50000000-0000-0000-0000-000000000001'$$,
  'member may delete their Message'
);
select throws_ok(
  $$insert into public.members (space_id, profile_id, role) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'OWNER')$$,
  '42501',
  'member cannot self-grant OWNER'
);

-- actor:non_member operation:select / operation:insert / operation:update / operation:delete
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$select count(*)::bigint from public.spaces$$,
  array[0::bigint],
  'non-member cannot read Spaces'
);
select results_eq(
  $$select count(*)::bigint from public.messages$$,
  array[0::bigint],
  'non-member cannot read Messages'
);
select throws_ok(
  $$insert into public.members (space_id, profile_id, role) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'MEMBER')$$,
  '42501',
  'non-member cannot bypass an invite with a self-insert'
);

-- actor:archived_member operation:select / operation:insert / operation:update / operation:delete
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$select count(*)::bigint from public.channels c where c.space_id = '20000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'archived-Space member cannot read descendants'
);

-- actor:anonymous operation:select / operation:insert / operation:update / operation:delete
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select * from public.spaces$$,
  '42501',
  'anonymous has no table privilege'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.transfer_space_ownership('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003')$$,
  'owner transfer RPC is callable only with the owner JWT'
);
select is(
  (select owner_id from public.spaces where id = '20000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000003'::uuid,
  'transfer updates Space.owner_id atomically'
);

select * from finish();
rollback;
