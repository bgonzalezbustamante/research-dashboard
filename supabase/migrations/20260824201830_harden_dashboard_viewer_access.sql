create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_dashboard_owner(
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

create or replace function private.can_view_dashboard(
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

create or replace function private.can_view_paper(
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
      and private.can_view_dashboard(p.owner_id)
  );
$$;

create or replace function private.can_view_daily_log(
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
      and private.can_view_dashboard(d.owner_id)
  );
$$;

create or replace function private.can_view_planning_period(
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
      and private.can_view_dashboard(pp.owner_id)
  );
$$;

create or replace function private.can_edit_paper(
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
      and private.is_dashboard_owner(p.owner_id)
  );
$$;

create or replace function private.can_edit_daily_log(
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
      and private.is_dashboard_owner(d.owner_id)
  );
$$;

create or replace function private.can_edit_planning_period(
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
      and private.is_dashboard_owner(pp.owner_id)
  );
$$;

revoke all on function private.is_dashboard_owner(uuid) from public;
revoke all on function private.can_view_dashboard(uuid) from public;
revoke all on function private.can_view_paper(uuid) from public;
revoke all on function private.can_view_daily_log(uuid) from public;
revoke all on function private.can_view_planning_period(uuid) from public;
revoke all on function private.can_edit_paper(uuid) from public;
revoke all on function private.can_edit_daily_log(uuid) from public;
revoke all on function private.can_edit_planning_period(uuid) from public;

grant execute on function private.is_dashboard_owner(uuid) to authenticated;
grant execute on function private.can_view_dashboard(uuid) to authenticated;
grant execute on function private.can_view_paper(uuid) to authenticated;
grant execute on function private.can_view_daily_log(uuid) to authenticated;
grant execute on function private.can_view_planning_period(uuid) to authenticated;
grant execute on function private.can_edit_paper(uuid) to authenticated;
grant execute on function private.can_edit_daily_log(uuid) to authenticated;
grant execute on function private.can_edit_planning_period(uuid) to authenticated;

alter policy "Members can view dashboard membership"
  on public.dashboard_members
  using (
    user_id = auth.uid()
    or private.is_dashboard_owner(owner_id)
  );

alter policy "Owners can add dashboard viewers"
  on public.dashboard_members
  with check (
    role = 'viewer'
    and private.is_dashboard_owner(owner_id)
  );

alter policy "Owners can update dashboard viewers"
  on public.dashboard_members
  using (
    role = 'viewer'
    and private.is_dashboard_owner(owner_id)
  )
  with check (
    role = 'viewer'
    and private.is_dashboard_owner(owner_id)
  );

alter policy "Owners can remove dashboard viewers"
  on public.dashboard_members
  using (
    role = 'viewer'
    and private.is_dashboard_owner(owner_id)
  );

alter policy "Dashboard members can view activity labels"
  on public.activity_labels
  using (private.can_view_dashboard(owner_id));

alter policy "Dashboard members can view authors"
  on public.authors
  using (private.can_view_dashboard(created_by));

alter policy "Dashboard members can view citation snapshots"
  on public.citation_snapshots
  using (private.can_view_paper(paper_id));

alter policy "Dashboard members can view daily logs"
  on public.daily_logs
  using (private.can_view_dashboard(owner_id));

alter policy "Dashboard members can view location labels"
  on public.location_labels
  using (private.can_view_dashboard(owner_id));

alter policy "Dashboard members can view paper authors"
  on public.paper_authors
  using (private.can_view_paper(paper_id));

alter policy "Dashboard members can view paper history"
  on public.paper_history
  using (private.can_view_paper(paper_id));

alter policy "Dashboard members can view paper links"
  on public.paper_links
  using (private.can_view_paper(paper_id));

alter policy "Dashboard members can view paper members"
  on public.paper_members
  using (private.can_view_paper(paper_id));

alter policy "Dashboard members can view paper milestones"
  on public.paper_milestones
  using (private.can_view_paper(paper_id));

alter policy "Dashboard members can view paper notes"
  on public.paper_notes
  using (private.can_view_paper(paper_id));

alter policy "Dashboard members can view paper presentations"
  on public.paper_presentations
  using (private.can_view_paper(paper_id));

alter policy "Dashboard members can view papers"
  on public.papers
  using (private.can_view_dashboard(owner_id));

alter policy "Dashboard members can view planning allocations"
  on public.planning_allocations
  using (private.can_view_planning_period(planning_period_id));

alter policy "Dashboard members can view planning periods"
  on public.planning_periods
  using (private.can_view_dashboard(owner_id));

alter policy "Dashboard members can view dashboard owner profile"
  on public.profiles
  using (private.can_view_dashboard(id));

alter policy "Dashboard members can view work sessions"
  on public.work_sessions
  using (private.can_view_daily_log(daily_log_id));

alter policy "Users can create own custom activity labels"
  on public.activity_labels
  with check (
    private.is_dashboard_owner(owner_id)
    and is_system = false
    and is_break = false
  );

alter policy "Users can delete own custom activity labels"
  on public.activity_labels
  using (
    private.is_dashboard_owner(owner_id)
    and is_system = false
  );

alter policy "Users can update own custom activity labels"
  on public.activity_labels
  using (
    private.is_dashboard_owner(owner_id)
    and is_system = false
  )
  with check (
    private.is_dashboard_owner(owner_id)
    and is_system = false
    and is_break = false
  );

alter policy "Users can view own activity labels"
  on public.activity_labels
  using (private.is_dashboard_owner(owner_id));

alter policy "Users can create authors"
  on public.authors
  with check (private.is_dashboard_owner(created_by));

alter policy "Users can delete authors they created"
  on public.authors
  using (private.is_dashboard_owner(created_by));

alter policy "Users can update authors they created"
  on public.authors
  using (private.is_dashboard_owner(created_by))
  with check (private.is_dashboard_owner(created_by));

alter policy "Users can view authors they created"
  on public.authors
  using (private.is_dashboard_owner(created_by));

alter policy "Owners can create citation snapshots"
  on public.citation_snapshots
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can delete citation snapshots"
  on public.citation_snapshots
  using (private.can_edit_paper(paper_id));

alter policy "Owners can update citation snapshots"
  on public.citation_snapshots
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can view citation snapshots"
  on public.citation_snapshots
  using (private.can_edit_paper(paper_id));

alter policy "Users can create own daily logs"
  on public.daily_logs
  with check (private.is_dashboard_owner(owner_id));

alter policy "Users can delete own daily logs"
  on public.daily_logs
  using (private.is_dashboard_owner(owner_id));

alter policy "Users can update own daily logs"
  on public.daily_logs
  using (private.is_dashboard_owner(owner_id))
  with check (private.is_dashboard_owner(owner_id));

alter policy "Users can view own daily logs"
  on public.daily_logs
  using (private.is_dashboard_owner(owner_id));

alter policy "Users can create own location labels"
  on public.location_labels
  with check (private.is_dashboard_owner(owner_id));

alter policy "Users can delete own location labels"
  on public.location_labels
  using (private.is_dashboard_owner(owner_id));

alter policy "Users can update own location labels"
  on public.location_labels
  using (private.is_dashboard_owner(owner_id))
  with check (private.is_dashboard_owner(owner_id));

alter policy "Users can view own location labels"
  on public.location_labels
  using (private.is_dashboard_owner(owner_id));

alter policy "Owners can add paper authors"
  on public.paper_authors
  with check (
    private.can_edit_paper(paper_id)
    and exists (
      select 1
      from public.authors a
      where a.id = author_id
        and private.is_dashboard_owner(a.created_by)
    )
  );

alter policy "Owners can remove paper authors"
  on public.paper_authors
  using (private.can_edit_paper(paper_id));

alter policy "Owners can update paper authors"
  on public.paper_authors
  using (private.can_edit_paper(paper_id))
  with check (
    private.can_edit_paper(paper_id)
    and exists (
      select 1
      from public.authors a
      where a.id = author_id
        and private.is_dashboard_owner(a.created_by)
    )
  );

alter policy "Owners can view paper authors"
  on public.paper_authors
  using (private.can_edit_paper(paper_id));

alter policy "Owners can create paper history"
  on public.paper_history
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can delete paper history"
  on public.paper_history
  using (private.can_edit_paper(paper_id));

alter policy "Owners can update paper history"
  on public.paper_history
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can view paper history"
  on public.paper_history
  using (private.can_edit_paper(paper_id));

alter policy "Owners can create paper links"
  on public.paper_links
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can delete paper links"
  on public.paper_links
  using (private.can_edit_paper(paper_id));

alter policy "Owners can update paper links"
  on public.paper_links
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can view paper links"
  on public.paper_links
  using (private.can_edit_paper(paper_id));

alter policy "Owners can create paper milestones"
  on public.paper_milestones
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can delete paper milestones"
  on public.paper_milestones
  using (private.can_edit_paper(paper_id));

alter policy "Owners can update paper milestones"
  on public.paper_milestones
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can view paper milestones"
  on public.paper_milestones
  using (private.can_edit_paper(paper_id));

alter policy "Owners can create paper notes"
  on public.paper_notes
  with check (
    created_by = auth.uid()
    and private.can_edit_paper(paper_id)
  );

alter policy "Owners can delete paper notes"
  on public.paper_notes
  using (
    created_by = auth.uid()
    and private.can_edit_paper(paper_id)
  );

alter policy "Owners can update paper notes"
  on public.paper_notes
  using (
    created_by = auth.uid()
    and private.can_edit_paper(paper_id)
  )
  with check (
    created_by = auth.uid()
    and private.can_edit_paper(paper_id)
  );

alter policy "Owners can view paper notes"
  on public.paper_notes
  using (private.can_edit_paper(paper_id));

alter policy "Owners can create paper presentations"
  on public.paper_presentations
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can delete paper presentations"
  on public.paper_presentations
  using (private.can_edit_paper(paper_id));

alter policy "Owners can update paper presentations"
  on public.paper_presentations
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

alter policy "Owners can view paper presentations"
  on public.paper_presentations
  using (private.can_edit_paper(paper_id));

alter policy "Owners can create papers"
  on public.papers
  with check (private.is_dashboard_owner(owner_id));

alter policy "Owners can update their papers"
  on public.papers
  using (private.is_dashboard_owner(owner_id))
  with check (private.is_dashboard_owner(owner_id));

alter policy "Owners can view their papers"
  on public.papers
  using (private.is_dashboard_owner(owner_id));

alter policy "Users can create own planning allocations"
  on public.planning_allocations
  with check (private.can_edit_planning_period(planning_period_id));

alter policy "Users can delete own planning allocations"
  on public.planning_allocations
  using (private.can_edit_planning_period(planning_period_id));

alter policy "Users can update own planning allocations"
  on public.planning_allocations
  using (private.can_edit_planning_period(planning_period_id))
  with check (private.can_edit_planning_period(planning_period_id));

alter policy "Users can view own planning allocations"
  on public.planning_allocations
  using (private.can_edit_planning_period(planning_period_id));

alter policy "Users can create own planning periods"
  on public.planning_periods
  with check (private.is_dashboard_owner(owner_id));

alter policy "Users can delete own planning periods"
  on public.planning_periods
  using (private.is_dashboard_owner(owner_id));

alter policy "Users can update own planning periods"
  on public.planning_periods
  using (private.is_dashboard_owner(owner_id))
  with check (private.is_dashboard_owner(owner_id));

alter policy "Users can view own planning periods"
  on public.planning_periods
  using (private.is_dashboard_owner(owner_id));

alter policy "Users can create own work sessions"
  on public.work_sessions
  with check (private.can_edit_daily_log(daily_log_id));

alter policy "Users can delete own work sessions"
  on public.work_sessions
  using (private.can_edit_daily_log(daily_log_id));

alter policy "Users can update own work sessions"
  on public.work_sessions
  using (private.can_edit_daily_log(daily_log_id))
  with check (private.can_edit_daily_log(daily_log_id));

alter policy "Users can view own work sessions"
  on public.work_sessions
  using (private.can_edit_daily_log(daily_log_id));

alter function public.create_paper_with_details(
  text,
  text,
  text,
  text,
  smallint,
  text,
  text,
  date,
  date,
  jsonb,
  jsonb
) security invoker;

alter function public.update_paper_with_details(
  uuid,
  text,
  text,
  text,
  text,
  smallint,
  text,
  text,
  date,
  date,
  jsonb,
  jsonb
) security invoker;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

drop function public.can_view_daily_log(uuid);
drop function public.can_view_planning_period(uuid);
drop function public.can_view_paper(uuid);
drop function public.can_view_dashboard(uuid);
drop function public.is_dashboard_owner(uuid);
