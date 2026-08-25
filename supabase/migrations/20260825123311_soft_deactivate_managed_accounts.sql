create or replace function private.get_managed_account_deletion_plan(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_note_count integer := 0;
  v_author_count integer := 0;
  v_email text;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = v_owner_id then
    raise exception 'The dashboard owner account cannot be deleted here'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = p_user_id
      and dm.role = 'owner'
  ) or exists (
    select 1
    from public.papers p
    where p.owner_id = p_user_id
  ) then
    raise exception 'Owner accounts cannot be deleted from another dashboard'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = p_user_id
      and dm.owner_id <> v_owner_id
  ) or exists (
    select 1
    from public.paper_members pm
    join public.papers p
      on p.id = pm.paper_id
    where pm.user_id = p_user_id
      and p.owner_id <> v_owner_id
  ) then
    raise exception 'This account is also used by another dashboard'
      using errcode = '42501';
  end if;

  select p.email
    into v_email
  from public.profiles p
  where p.id = p_user_id
    and p.deactivated_at is null;

  if not found then
    raise exception 'Managed account not found'
      using errcode = 'P0002';
  end if;

  select count(*)
    into v_note_count
  from public.paper_notes n
  where n.created_by = p_user_id;

  select count(*)
    into v_author_count
  from public.authors a
  where a.created_by = p_user_id;

  return jsonb_build_object(
    'user_id', p_user_id,
    'email', v_email,
    'note_count', v_note_count,
    'author_count', v_author_count,
    'preserve_profile', true
  );
end;
$$;

create or replace function private.finalize_managed_account_deletion(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_note_count integer := 0;
  v_author_count integer := 0;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = v_owner_id then
    raise exception 'The dashboard owner account cannot be deleted here'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = p_user_id
      and dm.role = 'owner'
  ) or exists (
    select 1
    from public.papers p
    where p.owner_id = p_user_id
  ) then
    raise exception 'Owner accounts cannot be deleted from another dashboard'
      using errcode = '42501';
  end if;

  select count(*)
    into v_note_count
  from public.paper_notes n
  where n.created_by = p_user_id;

  select count(*)
    into v_author_count
  from public.authors a
  where a.created_by = p_user_id;

  delete from public.dashboard_members
  where owner_id = v_owner_id
    and user_id = p_user_id
    and role = 'viewer';

  delete from public.paper_members pm
  using public.papers p
  where pm.paper_id = p.id
    and p.owner_id = v_owner_id
    and pm.user_id = p_user_id
    and pm.role = 'coauthor';

  update public.access_invitations
  set
    status = case
      when status in ('pending', 'sent', 'failed') then 'cancelled'
      else status
    end,
    cancelled_at = case
      when status in ('pending', 'sent', 'failed') then coalesce(cancelled_at, now())
      else cancelled_at
    end,
    auth_user_id = null,
    updated_at = now()
  where owner_id = v_owner_id
    and auth_user_id = p_user_id;

  update public.authors
  set profile_id = null
  where profile_id = p_user_id;

  update public.profiles
  set
    email = null,
    deactivated_at = coalesce(deactivated_at, now()),
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Managed account not found'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'note_count', v_note_count,
    'author_count', v_author_count,
    'profile_preserved', true
  );
end;
$$;
