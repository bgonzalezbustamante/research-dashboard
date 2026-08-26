-- Break is part of the owner's Hours vocabulary, not a property of every account.
-- Stop provisioning it on every profile and create it only when a user is a dashboard owner.

drop trigger if exists on_profile_create_activity_labels on public.profiles;
drop function if exists public.create_default_activity_labels();

create or replace function private.ensure_owner_break_activity_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'owner' then
    insert into public.activity_labels (
      owner_id,
      name,
      description,
      is_system,
      is_break,
      is_active
    )
    select
      new.user_id,
      'Break',
      'Protected system label used for breaks.',
      true,
      true,
      true
    where not exists (
      select 1
      from public.activity_labels al
      where al.owner_id = new.user_id
        and al.is_break = true
    );
  end if;

  return new;
end;
$$;

revoke all on function private.ensure_owner_break_activity_label() from public;

create trigger on_dashboard_owner_create_activity_labels
after insert or update of role on public.dashboard_members
for each row
when (new.role = 'owner')
execute function private.ensure_owner_break_activity_label();

-- Backfill defensively for any owner that somehow lacks a Break label.
insert into public.activity_labels (
  owner_id,
  name,
  description,
  is_system,
  is_break,
  is_active
)
select
  dm.user_id,
  'Break',
  'Protected system label used for breaks.',
  true,
  true,
  true
from public.dashboard_members dm
where dm.role = 'owner'
  and not exists (
    select 1
    from public.activity_labels al
    where al.owner_id = dm.user_id
      and al.is_break = true
  );

-- Remove only unused system Break labels from accounts that are not dashboard owners.
-- The protection trigger remains the normal invariant; it is disabled only for this
-- tightly-scoped migration cleanup and restored immediately afterwards.
alter table public.activity_labels disable trigger protect_system_activity_labels;

delete from public.activity_labels al
where al.is_system = true
  and al.is_break = true
  and not exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = al.owner_id
      and dm.role = 'owner'
  )
  and not exists (
    select 1
    from public.work_sessions ws
    where ws.activity_label_id = al.id
  );

alter table public.activity_labels enable trigger protect_system_activity_labels;

-- Preserve deleted-account profiles only when they still anchor durable historical
-- attribution or personal dashboard data. Access-only rows are cleaned separately.
create or replace function private.profile_requires_preservation(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.paper_notes n
      where n.created_by = p_user_id
    )
    or exists (
      select 1
      from public.authors a
      where a.created_by = p_user_id
         or a.owner_id = p_user_id
    )
    or exists (
      select 1
      from public.papers p
      where p.owner_id = p_user_id
    )
    or exists (
      select 1
      from public.access_invitations ai
      where ai.invited_by = p_user_id
         or ai.owner_id = p_user_id
    )
    or exists (
      select 1
      from public.daily_logs dl
      where dl.owner_id = p_user_id
    )
    or exists (
      select 1
      from public.planning_periods pp
      where pp.owner_id = p_user_id
    )
    or exists (
      select 1
      from public.activity_labels al
      where al.owner_id = p_user_id
    )
    or exists (
      select 1
      from public.location_labels ll
      where ll.owner_id = p_user_id
    );
$$;

revoke all on function private.profile_requires_preservation(uuid) from public;

create or replace function private.get_managed_account_deletion_plan(p_user_id uuid)
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
  v_preserve_profile boolean := false;
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

  v_preserve_profile := private.profile_requires_preservation(p_user_id);

  return jsonb_build_object(
    'user_id', p_user_id,
    'email', v_email,
    'note_count', v_note_count,
    'author_count', v_author_count,
    'preserve_profile', v_preserve_profile
  );
end;
$$;

create or replace function private.finalize_managed_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_note_count integer := 0;
  v_author_count integer := 0;
  v_preserve_profile boolean := false;
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

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
  ) then
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

  v_preserve_profile := private.profile_requires_preservation(p_user_id);

  if v_preserve_profile then
    update public.profiles
    set
      email = null,
      deactivated_at = coalesce(deactivated_at, now()),
      updated_at = now()
    where id = p_user_id;
  else
    delete from public.profiles
    where id = p_user_id;
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'note_count', v_note_count,
    'author_count', v_author_count,
    'profile_preserved', v_preserve_profile
  );
end;
$$;

-- Existing deactivated test profiles that were retained solely because of the
-- mistakenly provisioned Break label are now genuinely unreferenced and can go.
delete from public.profiles p
where p.deactivated_at is not null
  and not private.profile_requires_preservation(p.id)
  and not exists (
    select 1
    from auth.users u
    where u.id = p.id
  );