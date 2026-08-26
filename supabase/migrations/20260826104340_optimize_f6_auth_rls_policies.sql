-- Phase F.6 follow-up: evaluate auth.uid() once per statement in affected policies.

drop policy if exists "Owners can assign paper coauthors"
  on public.paper_members;

create policy "Owners can assign paper coauthors"
  on public.paper_members
  for insert
  to authenticated
  with check (
    role = 'coauthor'
    and user_id <> (select auth.uid())
    and private.can_assign_paper_coauthor(paper_id, user_id)
  );

drop policy if exists "Paper collaborators can create attributed notes"
  on public.paper_notes;

create policy "Paper collaborators can create attributed notes"
  on public.paper_notes
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
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
      and created_by = (select auth.uid())
    )
  )
  with check (
    private.can_edit_paper(paper_id)
    or (
      private.can_collaborate_paper(paper_id)
      and created_by = (select auth.uid())
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
      and created_by = (select auth.uid())
    )
  );
