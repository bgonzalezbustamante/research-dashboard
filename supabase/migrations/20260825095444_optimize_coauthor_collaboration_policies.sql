drop policy if exists "Users can create authors"
  on public.authors;
drop policy if exists "Coauthors can create authors for collaboration"
  on public.authors;

create policy "Owners and coauthors can create authors"
  on public.authors
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(created_by)
    or (
      created_by = (select auth.uid())
      and private.has_coauthor_access()
    )
  );

drop policy if exists "Owners can update their papers"
  on public.papers;
drop policy if exists "Coauthors can update assigned paper collaboration fields"
  on public.papers;

create policy "Owners and coauthors can update accessible papers"
  on public.papers
  for update
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
    or private.is_paper_coauthor(id)
  )
  with check (
    private.is_dashboard_owner(owner_id)
    or private.is_paper_coauthor(id)
  );
