create or replace function private.create_access_invitation(
  p_email text,
  p_viewer_enabled boolean default false,
  p_paper_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_invitation_id uuid;
  v_invalid_paper_count integer := 0;
  v_paper_count integer := 0;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if v_email = ''
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_owner_id
      and lower(btrim(coalesce(p.email, ''))) = v_email
  ) then
    raise exception 'You cannot invite your own account'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.profiles p
    left join auth.users au
      on au.id = p.id
    where lower(btrim(coalesce(p.email, ''))) = v_email
      and not (
        au.id is not null
        and au.confirmed_at is null
        and au.invited_at is not null
      )
  ) then
    raise exception 'An account already exists for this email address'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.access_invitations i
    where i.owner_id = v_owner_id
      and lower(btrim(i.email)) = v_email
      and i.status in ('pending', 'sent')
  ) then
    raise exception 'An active invitation already exists for this email address'
      using errcode = '23505';
  end if;

  select count(*)
    into v_invalid_paper_count
  from (
    select distinct unnest(
      coalesce(p_paper_ids, array[]::uuid[])
    ) as paper_id
  ) requested
  left join public.papers p
    on p.id = requested.paper_id
   and p.owner_id = v_owner_id
  where p.id is null;

  if v_invalid_paper_count > 0 then
    raise exception 'One or more selected papers are invalid'
      using errcode = '22023';
  end if;

  select count(*)
    into v_paper_count
  from (
    select distinct unnest(
      coalesce(p_paper_ids, array[]::uuid[])
    ) as paper_id
  ) requested;

  if not coalesce(p_viewer_enabled, false)
     and v_paper_count = 0 then
    raise exception 'Select Viewer access, at least one Coauthor paper, or both'
      using errcode = '22023';
  end if;

  insert into public.access_invitations (
    owner_id,
    email,
    viewer_enabled,
    status,
    invited_by
  )
  values (
    v_owner_id,
    v_email,
    coalesce(p_viewer_enabled, false),
    'pending',
    v_owner_id
  )
  returning id into v_invitation_id;

  insert into public.access_invitation_papers (
    invitation_id,
    paper_id
  )
  select
    v_invitation_id,
    requested.paper_id
  from (
    select distinct unnest(
      coalesce(p_paper_ids, array[]::uuid[])
    ) as paper_id
  ) requested;

  return v_invitation_id;
end;
$$;
