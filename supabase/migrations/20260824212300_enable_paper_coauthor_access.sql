alter table public.paper_members
  drop constraint paper_members_role_check;

update public.paper_members
set role = 'coauthor'
where role = 'editor';

alter table public.paper_members
  add constraint paper_members_role_check
  check (role in ('owner', 'coauthor', 'viewer'));

create or replace function private.is_paper_member(
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
    from public.paper_members pm
    where pm.paper_id = p_paper_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'coauthor', 'viewer')
  );
$$;

create or replace function private.is_paper_coauthor(
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
    from public.paper_members pm
    where pm.paper_id = p_paper_id
      and pm.user_id = auth.uid()
      and pm.role = 'coauthor'
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
      and (
        private.can_view_dashboard(p.owner_id)
        or private.is_paper_member(p.id)
      )
  );
$$;

create or replace function private.can_view_author(
  p_author_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.authors a
    where a.id = p_author_id
      and private.can_view_dashboard(a.created_by)
  )
  or exists (
    select 1
    from public.paper_authors pa
    join public.paper_members pm
      on pm.paper_id = pa.paper_id
    where pa.author_id = p_author_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'coauthor', 'viewer')
  );
$$;

create or replace function private.shares_paper_with_profile(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.paper_members mine
    join public.paper_members theirs
      on theirs.paper_id = mine.paper_id
    where mine.user_id = auth.uid()
      and mine.role in ('owner', 'coauthor', 'viewer')
      and theirs.user_id = p_profile_id
  );
$$;

drop policy if exists "Dashboard members can view papers"
  on public.papers;

create policy "Accessible members can view papers"
  on public.papers
  for select
  to authenticated
  using (
    private.can_view_dashboard(owner_id)
    or private.is_paper_member(id)
  );

drop policy if exists "Dashboard members can view authors"
  on public.authors;

create policy "Accessible members can view authors"
  on public.authors
  for select
  to authenticated
  using (private.can_view_author(id));

drop policy if exists "Users can view accessible profiles"
  on public.profiles;

create policy "Users can view accessible profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.can_view_dashboard(id)
    or private.shares_paper_with_profile(id)
  );

create or replace function public.update_coauthor_paper_title(
  p_paper_id uuid,
  p_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(p_title);
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if v_title is null or char_length(v_title) = 0 then
    raise exception 'Paper title is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.paper_members pm
    where pm.paper_id = p_paper_id
      and pm.user_id = v_user_id
      and pm.role = 'coauthor'
  ) then
    raise exception 'Coauthor access required'
      using errcode = '42501';
  end if;

  update public.papers
  set title = v_title
  where id = p_paper_id;

  if not found then
    raise exception 'Paper not found'
      using errcode = 'P0002';
  end if;

  return p_paper_id;
end;
$$;

revoke all
  on function public.update_coauthor_paper_title(uuid, text)
  from public;

grant execute
  on function public.update_coauthor_paper_title(uuid, text)
  to authenticated;
