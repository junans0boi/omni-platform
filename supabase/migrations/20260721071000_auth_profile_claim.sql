begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  requested_profile_id uuid;
  existing_profile public.profiles%rowtype;
  affected_rows integer;
begin
  requested_username := lower(btrim(new.raw_user_meta_data ->> 'username'));
  -- Only trusted Auth administration can set app_metadata. Public signup metadata
  -- therefore cannot select or take over a legacy Profile.
  requested_profile_id := nullif(btrim(new.raw_app_meta_data ->> 'legacy_profile_id'), '')::uuid;

  if new.email is null or btrim(new.email) = '' then
    raise exception using errcode = '23514', message = 'legacy_claim_email_required';
  end if;

  if requested_username is null
     or requested_username !~ '^[a-z0-9_]{3,32}$' then
    raise exception using errcode = '23514', message = 'profile_username_invalid';
  end if;

  if exists (
    select 1
    from auth.users as u
    where lower(u.email) = lower(new.email)
      and u.id <> new.id
  ) then
    raise exception using errcode = '23505', message = 'auth_email_collision';
  end if;

  select p.*
  into existing_profile
  from public.profiles as p
  where p.id = coalesce(requested_profile_id, new.id)
  for update;

  if found then
    if existing_profile.auth_user_id is not null then
      raise exception using errcode = '23505', message = 'profile_uuid_already_claimed';
    end if;

    if existing_profile.account_status <> 'ACTIVE' then
      raise exception using errcode = '23514', message = 'legacy_claim_profile_not_active';
    end if;

    if existing_profile.username <> requested_username then
      raise exception using errcode = '23514', message = 'legacy_claim_username_mismatch';
    end if;

    update public.profiles as p
    set auth_user_id = new.id,
        account_status = case
          when new.email_confirmed_at is null then 'CLAIM_PENDING'
          else 'ACTIVE'
        end,
        updated_at = timezone('utc'::text, now())
    where p.id = existing_profile.id
      and p.auth_user_id is null;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception using errcode = '40001', message = 'legacy_claim_concurrent_update';
    end if;
  else
    if exists (
      select 1
      from public.profiles as p
      where p.username = requested_username
    ) then
      raise exception using errcode = '23505', message = 'profile_username_collision';
    end if;

    insert into public.profiles (
      id,
      auth_user_id,
      username,
      display_name,
      avatar_url,
      account_status
    ) values (
      new.id,
      new.id,
      requested_username,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), requested_username),
      nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
      case
        when new.email_confirmed_at is null then 'CLAIM_PENDING'
        else 'ACTIVE'
      end
    );
  end if;

  return new;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'profile_username_collision';
end;
$$;

create or replace function public.activate_verified_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles as p
    set account_status = 'ACTIVE',
        updated_at = timezone('utc'::text, now())
    where p.auth_user_id = new.id
      and p.account_status = 'CLAIM_PENDING';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_verified on auth.users;
create trigger on_auth_user_email_verified
  after update of email_confirmed_at on auth.users
  for each row execute function public.activate_verified_profile();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.activate_verified_profile() from public, anon, authenticated;

commit;
