-- Phase F.6: make access changes traceable and close direct-API edge cases.

create table public.access_audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  actor_id uuid,
  target_user_id uuid,
  paper_id uuid,
  invitation_id uuid,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint access_audit_log_event_type_check check (
    event_type in (
      'audit_enabled',
      'viewer_granted',
      'viewer_revoked',
      'coauthor_granted',
      'coauthor_revoked',
      'invitation_created',
      'invitation_sent',
      'invitation_failed',
      'invitation_cancelled',
      'invitation_accepted',
      'account_renamed',
      'account_deactivated',
      'account_deleted'
    )
  ),
  constraint access_audit_log_details_object_check check (
    jsonb_typeof(details) = 'object'
  )
);

comment on table public.access_audit_log is
  'Owner-visible, append-only record of dashboard access and collaborator lifecycle changes.';

create index access_audit_log_owner_created_idx
  on public.access_audit_log (owner_id, created_at desc, id desc);

create index access_audit_log_target_user_idx
  on public.access_audit_log (target_user_id)
  where target_user_id is not null;

alter table public.access_audit_log enable row level security;

revoke all on public.access_audit_log from anon, authenticated;
revoke all on sequence public.access_audit_log_id_seq from anon, authenticated;
grant select on public.access_audit_log to authenticated;

create policy "Owners can view access audit log"
  on public.access_audit_log
  for select
  to authenticated
  using (private.is_dashboard_owner(owner_id));

-- RLS does not govern TRUNCATE. These broad privileges came from the initial
-- schema grants and are unnecessary for the Data API.
revoke truncate, references, trigger
  on table
    public.activity_labels,
    public.daily_logs,
    public.dashboard_members,
    public.location_labels,
    public.planning_allocations,
    public.planning_periods,
    public.profiles,
    public.work_sessions
  from anon, authenticated;

create or replace function private.is_active_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.deactivated_at is null
  );
$$;

revoke all on function private.is_active_profile(uuid) from public;

create or replace function private.is_dashboard_owner(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_profile(auth.uid())
    and exists (
      select 1
      from public.dashboard_members dm
      where dm.owner_id = p_owner_id
        and dm.user_id = auth.uid()
        and dm.role = 'owner'
    );
$$;

create or replace function private.can_view_dashboard(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_profile(auth.uid())
    and exists (
      select 1
      from public.dashboard_members dm
      where dm.owner_id = p_owner_id
        and dm.user_id = auth.uid()
        and dm.role in ('owner', 'viewer')
    );
$$;

create or replace function private.is_paper_member(p_paper_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_profile(auth.uid())
    and exists (
      select 1
      from public.paper_members pm
      where pm.paper_id = p_paper_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'coauthor', 'viewer')
    );
$$;

create or replace function private.is_paper_coauthor(p_paper_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_profile(auth.uid())
    and exists (
      select 1
      from public.paper_members pm
      where pm.paper_id = p_paper_id
        and pm.user_id = auth.uid()
        and pm.role = 'coauthor'
    );
$$;

create or replace function private.has_coauthor_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_profile(auth.uid())
    and exists (
      select 1
      from public.paper_members pm
      where pm.user_id = auth.uid()
        and pm.role = 'coauthor'
    );
$$;

-- Owners may maintain and restore archived papers. Coauthors retain visibility
-- to an archived assignment, but collaboration resumes only after restoration.
create or replace function private.can_collaborate_paper(p_paper_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and (
        private.is_dashboard_owner(p.owner_id)
        or (
          p.archived_at is null
          and private.is_paper_coauthor(p.id)
        )
      )
  );
$$;

create or replace function private.is_active_managed_profile(
  p_owner_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and p_user_id <> p_owner_id
    and private.is_active_profile(p_user_id)
    and not exists (
      select 1
      from public.dashboard_members dm
      where dm.user_id = p_user_id
        and dm.role = 'owner'
    )
    and not exists (
      select 1
      from public.dashboard_members dm
      where dm.user_id = p_user_id
        and dm.owner_id <> p_owner_id
    )
    and not exists (
      select 1
      from public.paper_members pm
      join public.papers p
        on p.id = pm.paper_id
      where pm.user_id = p_user_id
        and p.owner_id <> p_owner_id
    );
$$;

create or replace function private.can_assign_paper_coauthor(
  p_paper_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and p.archived_at is null
      and private.is_dashboard_owner(p.owner_id)
      and private.is_active_managed_profile(
        p.owner_id,
        p_user_id
      )
  );
$$;

revoke all on function private.is_dashboard_owner(uuid) from public;
revoke all on function private.can_view_dashboard(uuid) from public;
revoke all on function private.is_paper_member(uuid) from public;
revoke all on function private.is_paper_coauthor(uuid) from public;
revoke all on function private.has_coauthor_access() from public;
revoke all on function private.can_collaborate_paper(uuid) from public;
revoke all on function private.is_active_managed_profile(uuid, uuid) from public;
revoke all on function private.can_assign_paper_coauthor(uuid, uuid) from public;

grant execute on function private.is_dashboard_owner(uuid) to authenticated;
grant execute on function private.can_view_dashboard(uuid) to authenticated;
grant execute on function private.is_paper_member(uuid) to authenticated;
grant execute on function private.is_paper_coauthor(uuid) to authenticated;
grant execute on function private.has_coauthor_access() to authenticated;
grant execute on function private.can_collaborate_paper(uuid) to authenticated;
grant execute on function private.is_active_managed_profile(uuid, uuid) to authenticated;
grant execute on function private.can_assign_paper_coauthor(uuid, uuid) to authenticated;

drop policy if exists "Owners can add dashboard viewers"
  on public.dashboard_members;

create policy "Owners can add dashboard viewers"
  on public.dashboard_members
  for insert
  to authenticated
  with check (
    role = 'viewer'
    and private.is_dashboard_owner(owner_id)
    and private.is_active_managed_profile(owner_id, user_id)
  );

drop policy if exists "Owners can update dashboard viewers"
  on public.dashboard_members;

create policy "Owners can update dashboard viewers"
  on public.dashboard_members
  for update
  to authenticated
  using (
    role = 'viewer'
    and private.is_dashboard_owner(owner_id)
  )
  with check (
    role = 'viewer'
    and private.is_dashboard_owner(owner_id)
    and private.is_active_managed_profile(owner_id, user_id)
  );

drop policy if exists "Owners can assign paper coauthors"
  on public.paper_members;

create policy "Owners can assign paper coauthors"
  on public.paper_members
  for insert
  to authenticated
  with check (
    role = 'coauthor'
    and user_id <> auth.uid()
    and private.can_assign_paper_coauthor(paper_id, user_id)
  );

drop policy if exists "Owners and coauthors can update accessible papers"
  on public.papers;

create policy "Owners and coauthors can update accessible papers"
  on public.papers
  for update
  to authenticated
  using (private.can_collaborate_paper(id))
  with check (private.can_collaborate_paper(id));

drop policy if exists "Paper collaborators can create attributed notes"
  on public.paper_notes;

create policy "Paper collaborators can create attributed notes"
  on public.paper_notes
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and private.can_collaborate_paper(paper_id)
  );

drop policy if exists "Owners and note authors can update notes"
  on public.paper_notes;

create policy "Owners and note authors can update notes"
  on public.paper_notes
  for update
  to authenticated
  using (
    private.can_edit_paper(paper_id)
    or (
      private.can_collaborate_paper(paper_id)
      and created_by = auth.uid()
    )
  )
  with check (
    private.can_edit_paper(paper_id)
    or (
      private.can_collaborate_paper(paper_id)
      and created_by = auth.uid()
    )
  );

drop policy if exists "Owners and note authors can delete notes"
  on public.paper_notes;

create policy "Owners and note authors can delete notes"
  on public.paper_notes
  for delete
  to authenticated
  using (
    private.can_edit_paper(paper_id)
    or (
      private.can_collaborate_paper(paper_id)
      and created_by = auth.uid()
    )
  );

create or replace function public.set_coauthor_paper_assignments(
  p_user_id uuid,
  p_paper_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_paper_ids uuid[] := coalesce(p_paper_ids, '{}'::uuid[]);
begin
  if v_owner_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if not private.is_active_managed_profile(v_owner_id, p_user_id) then
    raise exception 'An active managed account is required'
      using errcode = '42501';
  end if;

  -- Archived papers can remain selected only when preserving an assignment
  -- that already exists. They cannot receive a new coauthor assignment.
  if exists (
    select 1
    from unnest(v_paper_ids) as selected(paper_id)
    left join public.papers p
      on p.id = selected.paper_id
     and p.owner_id = v_owner_id
    left join public.paper_members existing
      on existing.paper_id = selected.paper_id
     and existing.user_id = p_user_id
     and existing.role = 'coauthor'
    where p.id is null
       or (
         p.archived_at is not null
         and existing.paper_id is null
       )
  ) then
    raise exception 'One or more papers are unavailable for coauthor assignment'
      using errcode = '42501';
  end if;

  delete from public.paper_members pm
  using public.papers p
  where pm.paper_id = p.id
    and p.owner_id = v_owner_id
    and pm.user_id = p_user_id
    and pm.role = 'coauthor'
    and not (pm.paper_id = any(v_paper_ids));

  insert into public.paper_members (
    paper_id,
    user_id,
    role
  )
  select
    p.id,
    p_user_id,
    'coauthor'
  from public.papers p
  where p.owner_id = v_owner_id
    and p.archived_at is null
    and p.id = any(v_paper_ids)
  on conflict (paper_id, user_id) do nothing;
end;
$$;

-- Invitations cannot create new assignments to archived papers.
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
   and p.archived_at is null
  where p.id is null;

  if v_invalid_paper_count > 0 then
    raise exception 'One or more selected papers are unavailable'
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

create or replace function private.accept_access_invitation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation public.access_invitations%rowtype;
  v_paper_count integer := 0;
begin
  if v_user_id is null
     or not private.is_active_profile(v_user_id) then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select lower(btrim(coalesce(p.email, '')))
    into v_email
  from public.profiles p
  where p.id = v_user_id;

  if v_email is null or v_email = '' then
    raise exception 'A profile email address is required'
      using errcode = '22023';
  end if;

  select i.*
    into v_invitation
  from public.access_invitations i
  where i.status = 'sent'
    and lower(btrim(i.email)) = v_email
    and (
      i.auth_user_id is null
      or i.auth_user_id = v_user_id
    )
  order by i.sent_at desc nulls last, i.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active invitation was found for this account'
      using errcode = 'P0002';
  end if;

  select count(*)
    into v_paper_count
  from public.access_invitation_papers ip
  join public.papers p
    on p.id = ip.paper_id
   and p.owner_id = v_invitation.owner_id
   and p.archived_at is null
  where ip.invitation_id = v_invitation.id;

  if not v_invitation.viewer_enabled
     and v_paper_count = 0 then
    raise exception 'This invitation no longer grants any access'
      using errcode = '42501';
  end if;

  if v_invitation.viewer_enabled then
    insert into public.dashboard_members (
      owner_id,
      user_id,
      role
    )
    values (
      v_invitation.owner_id,
      v_user_id,
      'viewer'
    )
    on conflict (owner_id, user_id)
    do update set role = 'viewer';
  end if;

  insert into public.paper_members (
    paper_id,
    user_id,
    role
  )
  select
    p.id,
    v_user_id,
    'coauthor'
  from public.access_invitation_papers ip
  join public.papers p
    on p.id = ip.paper_id
   and p.owner_id = v_invitation.owner_id
   and p.archived_at is null
  where ip.invitation_id = v_invitation.id
  on conflict (paper_id, user_id)
  do update set role = 'coauthor'
  where public.paper_members.role <> 'owner';

  update public.access_invitations
  set
    status = 'accepted',
    auth_user_id = v_user_id,
    accepted_at = now(),
    updated_at = now(),
    last_error = null
  where id = v_invitation.id;

  return jsonb_build_object(
    'invitation_id', v_invitation.id,
    'viewer_enabled', v_invitation.viewer_enabled,
    'paper_count', v_paper_count,
    'destination', case
      when v_invitation.viewer_enabled then '/dashboard'
      else '/papers'
    end
  );
end;
$$;

-- Return the unused onboarding account so the server action can remove it with
-- the existing authenticated account-lifecycle Edge Function.
drop function public.cancel_access_invitation(uuid);
drop function private.cancel_access_invitation(uuid);

create function private.cancel_access_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_auth_user_id uuid;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  update public.access_invitations
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where id = p_invitation_id
    and owner_id = v_owner_id
    and status in ('pending', 'sent', 'failed')
  returning auth_user_id into v_auth_user_id;

  if not found then
    raise exception 'Invitation not found or no longer cancellable'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'auth_user_id', v_auth_user_id
  );
end;
$$;

revoke all on function private.cancel_access_invitation(uuid) from public;
grant execute on function private.cancel_access_invitation(uuid) to authenticated;

create function public.cancel_access_invitation(p_invitation_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_access_invitation(p_invitation_id);
$$;

revoke all on function public.cancel_access_invitation(uuid) from public;
grant execute on function public.cancel_access_invitation(uuid) to authenticated;

create or replace function private.access_subject_label(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(p.email), ''),
    p_user_id::text
  )
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke all on function private.access_subject_label(uuid) from public;

create or replace function private.record_access_event(
  p_owner_id uuid,
  p_event_type text,
  p_target_user_id uuid default null,
  p_paper_id uuid default null,
  p_invitation_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner_id is null then
    raise exception 'Audit owner is required';
  end if;

  insert into public.access_audit_log (
    owner_id,
    actor_id,
    target_user_id,
    paper_id,
    invitation_id,
    event_type,
    details
  )
  values (
    p_owner_id,
    auth.uid(),
    p_target_user_id,
    p_paper_id,
    p_invitation_id,
    p_event_type,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function private.record_access_event(uuid, text, uuid, uuid, uuid, jsonb)
  from public;

create or replace function private.audit_dashboard_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.dashboard_members%rowtype;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;

  if v_row.role = 'viewer' then
    perform private.record_access_event(
      v_row.owner_id,
      case when tg_op = 'DELETE' then 'viewer_revoked' else 'viewer_granted' end,
      v_row.user_id,
      null,
      null,
      jsonb_build_object(
        'subject_label', private.access_subject_label(v_row.user_id)
      )
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_dashboard_membership_change() from public;

create trigger audit_dashboard_membership_change
after insert or delete on public.dashboard_members
for each row
execute function private.audit_dashboard_membership_change();

create or replace function private.audit_paper_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.paper_members%rowtype;
  v_owner_id uuid;
  v_short_title text;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;

  if v_row.role <> 'coauthor' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select p.owner_id, p.short_title
    into v_owner_id, v_short_title
  from public.papers p
  where p.id = v_row.paper_id;

  if v_owner_id is not null then
    perform private.record_access_event(
      v_owner_id,
      case when tg_op = 'DELETE' then 'coauthor_revoked' else 'coauthor_granted' end,
      v_row.user_id,
      v_row.paper_id,
      null,
      jsonb_build_object(
        'subject_label', private.access_subject_label(v_row.user_id),
        'paper_short_title', v_short_title
      )
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_paper_membership_change() from public;

create trigger audit_paper_membership_change
after insert or delete on public.paper_members
for each row
execute function private.audit_paper_membership_change();

create or replace function private.audit_access_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'invitation_created';
  elsif new.status is not distinct from old.status then
    return new;
  else
    v_event_type := case new.status
      when 'sent' then 'invitation_sent'
      when 'failed' then 'invitation_failed'
      when 'cancelled' then 'invitation_cancelled'
      when 'accepted' then 'invitation_accepted'
      else null
    end;
  end if;

  if v_event_type is not null then
    perform private.record_access_event(
      new.owner_id,
      v_event_type,
      coalesce(new.auth_user_id, old.auth_user_id),
      null,
      new.id,
      jsonb_build_object(
        'subject_label', new.email,
        'viewer_enabled', new.viewer_enabled,
        'status', new.status
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_access_invitation_change() from public;

create trigger audit_access_invitation_change
after insert or update on public.access_invitations
for each row
execute function private.audit_access_invitation_change();

create or replace function private.audit_managed_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_subject_label text;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_subject_label := coalesce(
      nullif(btrim(old.full_name), ''),
      nullif(btrim(old.email), ''),
      old.id::text
    );

    perform private.record_access_event(
      v_owner_id,
      'account_deleted',
      old.id,
      null,
      null,
      jsonb_build_object('subject_label', v_subject_label)
    );

    return old;
  end if;

  v_subject_label := coalesce(
    nullif(btrim(new.full_name), ''),
    nullif(btrim(new.email), ''),
    new.id::text
  );

  if new.id <> v_owner_id
     and new.full_name is distinct from old.full_name then
    perform private.record_access_event(
      v_owner_id,
      'account_renamed',
      new.id,
      null,
      null,
      jsonb_build_object('subject_label', v_subject_label)
    );
  end if;

  if new.id <> v_owner_id
     and new.deactivated_at is not null
     and old.deactivated_at is null then
    perform private.record_access_event(
      v_owner_id,
      'account_deactivated',
      new.id,
      null,
      null,
      jsonb_build_object('subject_label', v_subject_label)
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_managed_profile_change() from public;

create trigger audit_managed_profile_change
after update or delete on public.profiles
for each row
execute function private.audit_managed_profile_change();

-- Establish a clear starting point without fabricating historical events.
insert into public.access_audit_log (
  owner_id,
  actor_id,
  event_type,
  details
)
select
  dm.owner_id,
  dm.user_id,
  'audit_enabled',
  jsonb_build_object(
    'viewer_count', (
      select count(*)
      from public.dashboard_members viewers
      where viewers.owner_id = dm.owner_id
        and viewers.role = 'viewer'
    ),
    'coauthor_assignment_count', (
      select count(*)
      from public.paper_members pm
      join public.papers p
        on p.id = pm.paper_id
      where p.owner_id = dm.owner_id
        and pm.role = 'coauthor'
    )
  )
from public.dashboard_members dm
where dm.role = 'owner';
