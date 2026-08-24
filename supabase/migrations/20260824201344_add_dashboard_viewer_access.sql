create table public.dashboard_members (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (owner_id, user_id),
  constraint dashboard_members_role_check
    check (role in ('owner', 'viewer')),
  constraint dashboard_members_owner_self_check
    check (
      (role = 'owner' and owner_id = user_id)
      or
      (role = 'viewer' and owner_id <> user_id)
    )
);

create unique index dashboard_members_user_unique
  on public.dashboard_members (user_id);

insert into public.dashboard_members (
  owner_id,
  user_id,
  role
)
select
  owner_id,
  owner_id,
  'owner'
from (
  select owner_id from public.papers
  union
  select owner_id from public.daily_logs
  union
  select owner_id from public.planning_periods
  union
  select owner_id from public.activity_labels
  union
  select owner_id from public.location_labels
) owners
on conflict (owner_id, user_id) do nothing;

alter table public.dashboard_members
  enable row level security;

create or replace function public.is_dashboard_owner(
  p_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dashboard_members dm
    where dm.owner_id = p_owner_id
      and dm.user_id = auth.uid()
      and dm.role = 'owner'
  );
$$;

create or replace function public.can_view_dashboard(
  p_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dashboard_members dm
    where dm.owner_id = p_owner_id
      and dm.user_id = auth.uid()
      and dm.role in ('owner', 'viewer')
  );
$$;

create or replace function public.can_view_paper(
  p_paper_id uuid
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
      and public.can_view_dashboard(p.owner_id)
  );
$$;

create or replace function public.can_view_daily_log(
  p_daily_log_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.daily_logs d
    where d.id = p_daily_log_id
      and public.can_view_dashboard(d.owner_id)
  );
$$;

create or replace function public.can_view_planning_period(
  p_planning_period_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.planning_periods pp
    where pp.id = p_planning_period_id
      and public.can_view_dashboard(pp.owner_id)
  );
$$;

revoke all on function public.is_dashboard_owner(uuid) from public;
revoke all on function public.can_view_dashboard(uuid) from public;
revoke all on function public.can_view_paper(uuid) from public;
revoke all on function public.can_view_daily_log(uuid) from public;
revoke all on function public.can_view_planning_period(uuid) from public;

grant execute on function public.is_dashboard_owner(uuid) to authenticated;
grant execute on function public.can_view_dashboard(uuid) to authenticated;
grant execute on function public.can_view_paper(uuid) to authenticated;
grant execute on function public.can_view_daily_log(uuid) to authenticated;
grant execute on function public.can_view_planning_period(uuid) to authenticated;

grant select, insert, update, delete
  on public.dashboard_members
  to authenticated;

create policy "Members can view dashboard membership"
  on public.dashboard_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_dashboard_owner(owner_id)
  );

create policy "Owners can add dashboard viewers"
  on public.dashboard_members
  for insert
  to authenticated
  with check (
    role = 'viewer'
    and public.is_dashboard_owner(owner_id)
  );

create policy "Owners can update dashboard viewers"
  on public.dashboard_members
  for update
  to authenticated
  using (
    role = 'viewer'
    and public.is_dashboard_owner(owner_id)
  )
  with check (
    role = 'viewer'
    and public.is_dashboard_owner(owner_id)
  );

create policy "Owners can remove dashboard viewers"
  on public.dashboard_members
  for delete
  to authenticated
  using (
    role = 'viewer'
    and public.is_dashboard_owner(owner_id)
  );

create policy "Dashboard members can view activity labels"
  on public.activity_labels
  for select
  to authenticated
  using (public.can_view_dashboard(owner_id));

create policy "Dashboard members can view authors"
  on public.authors
  for select
  to authenticated
  using (public.can_view_dashboard(created_by));

create policy "Dashboard members can view citation snapshots"
  on public.citation_snapshots
  for select
  to authenticated
  using (public.can_view_paper(paper_id));

create policy "Dashboard members can view daily logs"
  on public.daily_logs
  for select
  to authenticated
  using (public.can_view_dashboard(owner_id));

create policy "Dashboard members can view location labels"
  on public.location_labels
  for select
  to authenticated
  using (public.can_view_dashboard(owner_id));

create policy "Dashboard members can view paper authors"
  on public.paper_authors
  for select
  to authenticated
  using (public.can_view_paper(paper_id));

create policy "Dashboard members can view paper history"
  on public.paper_history
  for select
  to authenticated
  using (public.can_view_paper(paper_id));

create policy "Dashboard members can view paper links"
  on public.paper_links
  for select
  to authenticated
  using (public.can_view_paper(paper_id));

create policy "Dashboard members can view paper members"
  on public.paper_members
  for select
  to authenticated
  using (public.can_view_paper(paper_id));

create policy "Dashboard members can view paper milestones"
  on public.paper_milestones
  for select
  to authenticated
  using (public.can_view_paper(paper_id));

create policy "Dashboard members can view paper notes"
  on public.paper_notes
  for select
  to authenticated
  using (public.can_view_paper(paper_id));

create policy "Dashboard members can view paper presentations"
  on public.paper_presentations
  for select
  to authenticated
  using (public.can_view_paper(paper_id));

create policy "Dashboard members can view papers"
  on public.papers
  for select
  to authenticated
  using (public.can_view_dashboard(owner_id));

create policy "Dashboard members can view planning allocations"
  on public.planning_allocations
  for select
  to authenticated
  using (public.can_view_planning_period(planning_period_id));

create policy "Dashboard members can view planning periods"
  on public.planning_periods
  for select
  to authenticated
  using (public.can_view_dashboard(owner_id));

create policy "Dashboard members can view dashboard owner profile"
  on public.profiles
  for select
  to authenticated
  using (public.can_view_dashboard(id));

create policy "Dashboard members can view work sessions"
  on public.work_sessions
  for select
  to authenticated
  using (public.can_view_daily_log(daily_log_id));
