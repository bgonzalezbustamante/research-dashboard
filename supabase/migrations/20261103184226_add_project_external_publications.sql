-- Velvet Torch rc.4: external project publications.
--
-- External publications are research outputs relevant to a Project on which
-- the Dashboard Owner is not an author. They live in their own table, so no
-- Papers view, workflow, Planning, analytics, citation or Hours code sees
-- them, and they never appear in list_public_papers() or get_public_paper().
-- Each one is Private by default and is exposed anonymously only through
-- list_public_project_publications(), when it is Public and linked to a
-- Public Project.

create table public.external_publications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.profiles(id)
    on delete cascade,
  title text not null,
  authors text[] not null,
  venue text,
  publication_year integer not null,
  published_on date,
  doi_url text,
  publication_url text,
  language text,
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_publications_title_length
    check (
      char_length(btrim(title))
      between 1 and 500
    ),
  constraint external_publications_authors_count
    check (
      cardinality(authors)
      between 1 and 100
    ),
  constraint external_publications_venue_length
    check (
      venue is null
      or char_length(btrim(venue))
        between 1 and 300
    ),
  constraint external_publications_year_range
    check (
      publication_year
      between 1900 and 2100
    ),
  constraint external_publications_date_matches_year
    check (
      published_on is null
      or extract(year from published_on)::integer = publication_year
    ),
  constraint external_publications_doi_url_format
    check (
      doi_url is null
      or (
        char_length(doi_url) <= 2048
        and doi_url ~* '^https?://'
      )
    ),
  constraint external_publications_publication_url_format
    check (
      publication_url is null
      or (
        char_length(publication_url) <= 2048
        and publication_url ~* '^https?://'
      )
    ),
  constraint external_publications_language_check
    check (
      language is null
      or language in (
        'English',
        'Spanish',
        'Portuguese',
        'Dutch',
        'German',
        'French',
        'Italian'
      )
    ),
  constraint external_publications_visibility_check
    check (
      visibility in ('private', 'public')
    )
);

comment on table public.external_publications is
  'Project-relevant publications not authored by the Dashboard Owner. Exposed anonymously only through list_public_project_publications().';

create index external_publications_owner_idx
  on public.external_publications (owner_id);

create table public.project_external_publications (
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  external_publication_id uuid not null
    references public.external_publications(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (
    project_id,
    external_publication_id
  )
);

create index project_external_publications_publication_idx
  on public.project_external_publications (external_publication_id);

create or replace function private.validate_project_external_publication_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_owner uuid;
  v_publication_owner uuid;
begin
  select p.owner_id
  into v_project_owner
  from public.projects p
  where p.id = new.project_id;

  select ep.owner_id
  into v_publication_owner
  from public.external_publications ep
  where ep.id = new.external_publication_id;

  if v_project_owner is null
     or v_publication_owner is null
     or v_project_owner <> v_publication_owner then
    raise exception
      'Project and external publication must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_project_external_publication_link()
  from public, anon, authenticated;

create trigger validate_project_external_publication_link
before insert or update
on public.project_external_publications
for each row
execute function private.validate_project_external_publication_link();

create trigger external_publications_updated_at
before update
on public.external_publications
for each row
execute function public.handle_updated_at();

-- Access: Dashboard members read; writes go through Owner-only RPCs. -------------

alter table public.external_publications
  enable row level security;

alter table public.project_external_publications
  enable row level security;

revoke all
  on table public.external_publications
  from public, anon, authenticated;

revoke all
  on table public.project_external_publications
  from public, anon, authenticated;

grant select
  on table public.external_publications
  to authenticated;

grant select
  on table public.project_external_publications
  to authenticated;

create policy "Dashboard members can view external publications"
  on public.external_publications
  for select
  to authenticated
  using (private.can_view_dashboard(owner_id));

create policy "Dashboard members can view project external publications"
  on public.project_external_publications
  for select
  to authenticated
  using (private.can_view_project(project_id));

-- Owner mutation RPCs -------------------------------------------------------------

create or replace function private.normalise_external_publication_authors(
  p_authors text[]
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_agg(btrim(author) order by ordinality),
    '{}'::text[]
  )
  from unnest(coalesce(p_authors, '{}'::text[]))
    with ordinality as entries(author, ordinality)
  where nullif(btrim(author), '') is not null;
$$;

revoke all
  on function private.normalise_external_publication_authors(text[])
  from public, anon;

grant execute
  on function private.normalise_external_publication_authors(text[])
  to authenticated;

create or replace function private.set_external_publication_projects(
  p_owner_id uuid,
  p_external_publication_id uuid,
  p_project_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_ids uuid[] := coalesce(p_project_ids, '{}'::uuid[]);
begin
  if exists (
    select 1
    from unnest(v_project_ids) as selected(project_id)
    left join public.projects p
      on p.id = selected.project_id
     and p.owner_id = p_owner_id
    where p.id is null
  ) then
    raise exception 'One or more selected projects are unavailable'
      using errcode = '22023';
  end if;

  delete from public.project_external_publications pep
  where pep.external_publication_id = p_external_publication_id
    and not (pep.project_id = any(v_project_ids));

  insert into public.project_external_publications (
    project_id,
    external_publication_id
  )
  select distinct
    selected.project_id,
    p_external_publication_id
  from unnest(v_project_ids) as selected(project_id)
  on conflict (project_id, external_publication_id) do nothing;
end;
$$;

revoke all
  on function private.set_external_publication_projects(uuid, uuid, uuid[])
  from public, anon, authenticated;

create function public.create_external_publication(
  p_title text,
  p_authors text[],
  p_publication_year integer,
  p_published_on date default null,
  p_venue text default null,
  p_doi_url text default null,
  p_publication_url text default null,
  p_language text default null,
  p_visibility text default 'private',
  p_project_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_id uuid;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  insert into public.external_publications (
    owner_id,
    title,
    authors,
    venue,
    publication_year,
    published_on,
    doi_url,
    publication_url,
    language,
    visibility
  )
  values (
    v_owner_id,
    btrim(coalesce(p_title, '')),
    private.normalise_external_publication_authors(p_authors),
    nullif(btrim(coalesce(p_venue, '')), ''),
    p_publication_year,
    p_published_on,
    nullif(btrim(coalesce(p_doi_url, '')), ''),
    nullif(btrim(coalesce(p_publication_url, '')), ''),
    nullif(btrim(coalesce(p_language, '')), ''),
    coalesce(nullif(btrim(coalesce(p_visibility, '')), ''), 'private')
  )
  returning id into v_id;

  perform private.set_external_publication_projects(
    v_owner_id,
    v_id,
    p_project_ids
  );

  return v_id;
end;
$$;

create function public.update_external_publication(
  p_id uuid,
  p_title text,
  p_authors text[],
  p_publication_year integer,
  p_published_on date default null,
  p_venue text default null,
  p_doi_url text default null,
  p_publication_url text default null,
  p_language text default null,
  p_visibility text default 'private',
  p_project_ids uuid[] default '{}'::uuid[]
)
returns uuid
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

  update public.external_publications
  set
    title = btrim(coalesce(p_title, '')),
    authors = private.normalise_external_publication_authors(p_authors),
    venue = nullif(btrim(coalesce(p_venue, '')), ''),
    publication_year = p_publication_year,
    published_on = p_published_on,
    doi_url = nullif(btrim(coalesce(p_doi_url, '')), ''),
    publication_url = nullif(btrim(coalesce(p_publication_url, '')), ''),
    language = nullif(btrim(coalesce(p_language, '')), ''),
    visibility = coalesce(nullif(btrim(coalesce(p_visibility, '')), ''), 'private')
  where id = p_id
    and owner_id = v_owner_id;

  if not found then
    raise exception 'External publication not found'
      using errcode = 'P0002';
  end if;

  perform private.set_external_publication_projects(
    v_owner_id,
    p_id,
    p_project_ids
  );

  return p_id;
end;
$$;

create function public.delete_external_publication(p_id uuid)
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

  delete from public.external_publications
  where id = p_id
    and owner_id = v_owner_id;

  if not found then
    raise exception 'External publication not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all
  on function public.create_external_publication(text, text[], integer, date, text, text, text, text, text, uuid[])
  from public, anon;

revoke all
  on function public.update_external_publication(uuid, text, text[], integer, date, text, text, text, text, text, uuid[])
  from public, anon;

revoke all
  on function public.delete_external_publication(uuid)
  from public, anon;

grant execute
  on function public.create_external_publication(text, text[], integer, date, text, text, text, text, text, uuid[])
  to authenticated;

grant execute
  on function public.update_external_publication(uuid, text, text[], integer, date, text, text, text, text, text, uuid[])
  to authenticated;

grant execute
  on function public.delete_external_publication(uuid)
  to authenticated;

-- Public RPC ------------------------------------------------------------------------

create function public.list_public_project_publications()
returns table (
  project_slug text,
  authorship text,
  paper_slug text,
  title text,
  authors text[],
  venue text,
  publication_date date,
  publication_year integer,
  doi_url text,
  publication_url text,
  language text
)
language sql
stable
security definer
set search_path = ''
as $$
  with public_projects as (
    select
      p.id,
      ppm.slug
    from public.projects p
    join public.project_public_metadata ppm
      on ppm.project_id = p.id
    where ppm.visibility = 'public'
      and ppm.slug is not null
  ),
  publications as (
    select
      pp_public.slug as project_slug,
      'own'::text as authorship,
      paper_meta.slug as paper_slug,
      paper.title,
      array(
        select a.full_name
        from public.paper_authors pa
        join public.authors a
          on a.id = pa.author_id
        where pa.paper_id = paper.id
        order by pa.author_order, a.full_name
      ) as authors,
      paper.current_venue as venue,
      paper.published_on as publication_date,
      extract(year from paper.published_on)::integer as publication_year,
      (
        select pl.url
        from public.paper_links pl
        where pl.paper_id = paper.id
          and pl.link_type = 'doi'
        order by pl.sort_order, pl.id
        limit 1
      ) as doi_url,
      (
        select pl.url
        from public.paper_links pl
        where pl.paper_id = paper.id
          and pl.link_type = 'publication'
        order by pl.sort_order, pl.id
        limit 1
      ) as publication_url,
      paper.language
    from public_projects pp_public
    join public.project_papers pp
      on pp.project_id = pp_public.id
    join public.papers paper
      on paper.id = pp.paper_id
    join public.paper_public_metadata paper_meta
      on paper_meta.paper_id = paper.id
    where paper_meta.visibility = 'public'
      and paper_meta.slug is not null

    union all

    select
      pp_public.slug,
      'external'::text,
      null::text,
      ep.title,
      ep.authors,
      ep.venue,
      ep.published_on,
      ep.publication_year,
      ep.doi_url,
      ep.publication_url,
      ep.language
    from public_projects pp_public
    join public.project_external_publications pep
      on pep.project_id = pp_public.id
    join public.external_publications ep
      on ep.id = pep.external_publication_id
    where ep.visibility = 'public'
  )
  select
    project_slug,
    authorship,
    paper_slug,
    title,
    authors,
    venue,
    publication_date,
    publication_year,
    doi_url,
    publication_url,
    language
  from publications
  order by
    project_slug asc,
    coalesce(
      publication_date,
      make_date(publication_year, 1, 1)
    ) desc nulls last,
    title asc;
$$;

comment on function public.list_public_project_publications() is
  'Anonymous-safe list of each Public Project''s publications: its own explicitly Public Papers (authorship own) and its Public external publications (authorship external, no paper slug).';

revoke all
  on function public.list_public_project_publications()
  from public, anon, authenticated;

grant execute
  on function public.list_public_project_publications()
  to anon, service_role;

notify pgrst, 'reload schema';
