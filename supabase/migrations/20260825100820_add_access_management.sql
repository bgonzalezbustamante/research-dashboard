drop policy if exists "Users can view accessible profiles"
  on public.profiles;

create policy "Users can view accessible profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.is_dashboard_owner((select auth.uid()))
    or private.can_view_dashboard(id)
    or private.shares_paper_with_profile(id)
  );

create policy "Owners can assign paper coauthors"
  on public.paper_members
  for insert
  to authenticated
  with check (
    role = 'coauthor'
    and user_id <> (select auth.uid())
    and private.can_edit_paper(paper_id)
  );

create policy "Owners can remove paper coauthors"
  on public.paper_members
  for delete
  to authenticated
  using (
    role = 'coauthor'
    and private.can_edit_paper(paper_id)
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

  if p_user_id is null or p_user_id = v_owner_id then
    raise exception 'A different dashboard account is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
  ) then
    raise exception 'Profile not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(v_paper_ids) as selected(paper_id)
    left join public.papers p
      on p.id = selected.paper_id
     and p.owner_id = v_owner_id
    where p.id is null
  ) then
    raise exception 'One or more papers are not owned by this dashboard'
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
    and p.id = any(v_paper_ids)
  on conflict (paper_id, user_id) do nothing;
end;
$$;

revoke all
  on function public.set_coauthor_paper_assignments(uuid, uuid[])
  from public;

grant execute
  on function public.set_coauthor_paper_assignments(uuid, uuid[])
  to authenticated;
