drop policy if exists "Accessible members can view authors"
  on public.authors;

create policy "Accessible members can view authors"
  on public.authors
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or private.can_view_author(id)
  );
