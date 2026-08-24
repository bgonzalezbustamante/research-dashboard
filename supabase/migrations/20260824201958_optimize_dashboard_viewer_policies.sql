drop policy "Users can view own activity labels" on public.activity_labels;
drop policy "Users can view authors they created" on public.authors;
drop policy "Owners can view citation snapshots" on public.citation_snapshots;
drop policy "Users can view own daily logs" on public.daily_logs;
drop policy "Users can view own location labels" on public.location_labels;
drop policy "Owners can view paper authors" on public.paper_authors;
drop policy "Owners can view paper history" on public.paper_history;
drop policy "Owners can view paper links" on public.paper_links;
drop policy "Owners can view paper members" on public.paper_members;
drop policy "Owners can view paper milestones" on public.paper_milestones;
drop policy "Owners can view paper notes" on public.paper_notes;
drop policy "Owners can view paper presentations" on public.paper_presentations;
drop policy "Owners can view their papers" on public.papers;
drop policy "Users can view own planning allocations" on public.planning_allocations;
drop policy "Users can view own planning periods" on public.planning_periods;
drop policy "Users can view own work sessions" on public.work_sessions;

alter policy "Members can view dashboard membership"
  on public.dashboard_members
  using (
    user_id = (select auth.uid())
    or private.is_dashboard_owner(owner_id)
  );

alter policy "Owners can create paper notes"
  on public.paper_notes
  with check (
    created_by = (select auth.uid())
    and private.can_edit_paper(paper_id)
  );

alter policy "Owners can delete paper notes"
  on public.paper_notes
  using (
    created_by = (select auth.uid())
    and private.can_edit_paper(paper_id)
  );

alter policy "Owners can update paper notes"
  on public.paper_notes
  using (
    created_by = (select auth.uid())
    and private.can_edit_paper(paper_id)
  )
  with check (
    created_by = (select auth.uid())
    and private.can_edit_paper(paper_id)
  );

drop policy "Users can view their own profile" on public.profiles;
drop policy "Dashboard members can view dashboard owner profile" on public.profiles;

create policy "Users can view accessible profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.can_view_dashboard(id)
  );
