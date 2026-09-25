create or replace function private.try_link_author_profile(
  p_owner_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_count integer := 0;
  v_author_id uuid;
begin
  if p_owner_id is null
     or p_user_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = p_user_id
      and pr.deactivated_at is null
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.authors a
    where a.owner_id = p_owner_id
      and a.profile_id = p_user_id
  ) then
    return;
  end if;

  select
    count(*)::integer,
    (
      array_agg(
        candidates.author_id
        order by candidates.author_id
      )
    )[1]
    into
      v_candidate_count,
      v_author_id
  from (
    select distinct
      a.id as author_id
    from public.authors a
    join public.paper_authors pa
      on pa.author_id = a.id
    join public.papers p
      on p.id = pa.paper_id
     and p.owner_id = p_owner_id
    join public.paper_members pm
      on pm.paper_id = p.id
     and pm.user_id = p_user_id
     and pm.role in ('owner', 'coauthor')
    join public.profiles pr
      on pr.id = p_user_id
     and pr.deactivated_at is null
    where a.owner_id = p_owner_id
      and a.profile_id is null
      and (
        (
          pr.full_name is not null
          and btrim(pr.full_name) <> ''
          and lower(btrim(a.full_name)) =
              lower(btrim(pr.full_name))
        )
        or (
          a.email is not null
          and pr.email is not null
          and btrim(a.email) <> ''
          and btrim(pr.email) <> ''
          and lower(btrim(a.email)) =
              lower(btrim(pr.email))
        )
      )
  ) candidates;

  if v_candidate_count <> 1
     or v_author_id is null then
    return;
  end if;

  update public.authors a
  set
    profile_id = p_user_id,
    updated_at = now()
  where a.id = v_author_id
    and a.owner_id = p_owner_id
    and a.profile_id is null
    and not exists (
      select 1
      from public.authors linked
      where linked.profile_id = p_user_id
        and linked.id <> a.id
    );
end;
$$;

create or replace function private.sync_author_profile_from_paper_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  if new.role not in ('owner', 'coauthor') then
    return new;
  end if;

  select p.owner_id
    into v_owner_id
  from public.papers p
  where p.id = new.paper_id;

  if v_owner_id is not null then
    perform private.try_link_author_profile(
      v_owner_id,
      new.user_id
    );
  end if;

  return new;
end;
$$;

create or replace function private.sync_author_profiles_from_paper_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_member record;
begin
  select p.owner_id
    into v_owner_id
  from public.papers p
  where p.id = new.paper_id;

  if v_owner_id is null then
    return new;
  end if;

  for v_member in
    select distinct pm.user_id
    from public.paper_members pm
    where pm.paper_id = new.paper_id
      and pm.role in ('owner', 'coauthor')
  loop
    perform private.try_link_author_profile(
      v_owner_id,
      v_member.user_id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists sync_author_profile_from_paper_member
  on public.paper_members;

create trigger sync_author_profile_from_paper_member
after insert or update of paper_id, user_id, role
on public.paper_members
for each row
execute function private.sync_author_profile_from_paper_member();

drop trigger if exists sync_author_profiles_from_paper_author
  on public.paper_authors;

create trigger sync_author_profiles_from_paper_author
after insert or update of paper_id, author_id
on public.paper_authors
for each row
execute function private.sync_author_profiles_from_paper_author();

revoke all
  on function private.try_link_author_profile(uuid, uuid)
  from public, anon, authenticated;

revoke all
  on function private.sync_author_profile_from_paper_member()
  from public, anon, authenticated;

revoke all
  on function private.sync_author_profiles_from_paper_author()
  from public, anon, authenticated;

do $$
declare
  v_link record;
begin
  for v_link in
    select distinct
      p.owner_id,
      pm.user_id
    from public.paper_members pm
    join public.papers p
      on p.id = pm.paper_id
    where pm.role in ('owner', 'coauthor')
  loop
    perform private.try_link_author_profile(
      v_link.owner_id,
      v_link.user_id
    );
  end loop;
end;
$$;
