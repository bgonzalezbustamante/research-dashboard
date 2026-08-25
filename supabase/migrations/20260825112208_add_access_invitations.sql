create table public.access_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  viewer_enabled boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'accepted', 'cancelled', 'failed')),
  auth_user_id uuid references public.profiles(id) on delete set null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  sent_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(email)) > 3)
);

create table public.access_invitation_papers (
  invitation_id uuid not null references public.access_invitations(id) on delete cascade,
  paper_id uuid not null references public.papers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (invitation_id, paper_id)
);

create unique index access_invitations_active_email_idx
  on public.access_invitations (owner_id, lower(btrim(email)))
  where status in ('pending', 'sent');

create index access_invitations_auth_user_idx
  on public.access_invitations (auth_user_id)
  where auth_user_id is not null;

create index access_invitations_status_idx
  on public.access_invitations (owner_id, status, created_at desc);

alter table public.access_invitations enable row level security;
alter table public.access_invitation_papers enable row level security;

revoke all on public.access_invitations from anon;
revoke all on public.access_invitation_papers from anon;
revoke all on public.access_invitations from authenticated;
revoke all on public.access_invitation_papers from authenticated;

grant select on public.access_invitations to authenticated;
grant select on public.access_invitation_papers to authenticated;

create policy "Owners can view access invitations"
on public.access_invitations
for select
to authenticated
using (private.is_dashboard_owner(owner_id));

create policy "Owners can view invitation papers"
on public.access_invitation_papers
for select
to authenticated
using (
  exists (
    select 1
    from public.access_invitations i
    where i.id = invitation_id
      and private.is_dashboard_owner(i.owner_id)
  )
);

create or replace function public.create_access_invitation(
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
    where lower(btrim(coalesce(p.email, ''))) = v_email
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

create or replace function public.cancel_access_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
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
    and status in ('pending', 'sent', 'failed');

  if not found then
    raise exception 'Invitation not found or no longer cancellable'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.get_my_pending_access_invitation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation public.access_invitations%rowtype;
  v_papers jsonb;
  v_owner_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select lower(btrim(coalesce(p.email, '')))
    into v_email
  from public.profiles p
  where p.id = v_user_id;

  if v_email is null or v_email = '' then
    return null;
  end if;

  select i.*
    into v_invitation
  from public.access_invitations i
  where i.status = 'sent'
    and (
      i.auth_user_id = v_user_id
      or (
        i.auth_user_id is null
        and lower(btrim(i.email)) = v_email
      )
    )
  order by i.sent_at desc nulls last, i.created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  select p.full_name
    into v_owner_name
  from public.profiles p
  where p.id = v_invitation.owner_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'short_title', p.short_title,
        'title', p.title,
        'archived', p.archived_at is not null
      )
      order by p.short_title
    ),
    '[]'::jsonb
  )
    into v_papers
  from public.access_invitation_papers ip
  join public.papers p
    on p.id = ip.paper_id
   and p.owner_id = v_invitation.owner_id
  where ip.invitation_id = v_invitation.id;

  return jsonb_build_object(
    'id', v_invitation.id,
    'email', v_invitation.email,
    'viewer_enabled', v_invitation.viewer_enabled,
    'owner_id', v_invitation.owner_id,
    'owner_name', v_owner_name,
    'papers', v_papers
  );
end;
$$;

create or replace function public.accept_access_invitation()
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
  if v_user_id is null then
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

revoke all on function public.create_access_invitation(text, boolean, uuid[]) from public;
revoke all on function public.cancel_access_invitation(uuid) from public;
revoke all on function public.get_my_pending_access_invitation() from public;
revoke all on function public.accept_access_invitation() from public;

grant execute on function public.create_access_invitation(text, boolean, uuid[]) to authenticated;
grant execute on function public.cancel_access_invitation(uuid) to authenticated;
grant execute on function public.get_my_pending_access_invitation() to authenticated;
grant execute on function public.accept_access_invitation() to authenticated;
