-- Velvet Torch rc.4: other people's papers become a library of their own.
--
-- External publications are consumed by other sites through the Academic
-- API and relate to the Owner's research Projects only sometimes. Each Public
-- external publication now has a stable public slug, can belong to named
-- Owner-defined collections that sites filter by, and is listed by its own
-- feed, list_public_external_publications(). Project links stay optional.
-- No consumer uses the project feed yet, so its slug column is renamed before
-- release.

-- 1. Public slug ------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from public.external_publications
    where visibility = 'public'
  ) then
    raise exception
      'Public external publications exist without slugs; assign slugs before applying this migration';
  end if;
end;
$$;

alter table public.external_publications
  add column slug text;

alter table public.external_publications
  add constraint external_publications_slug_format
    check (
      slug is null
      or (
        char_length(slug) <= 200
        and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      )
    ),
  add constraint external_publications_public_slug_required
    check (
      visibility <> 'public'
      or slug is not null
    );

create unique index external_publications_slug_key
  on public.external_publications (slug)
  where slug is not null;

-- 2. Collections ------------------------------------------------------------------

create table public.external_publication_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.profiles(id)
    on delete cascade,
  slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_publication_collections_slug_format
    check (
      char_length(slug) <= 100
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint external_publication_collections_name_length
    check (
      char_length(btrim(name))
      between 1 and 200
    ),
  constraint external_publication_collections_description_length
    check (
      description is null
      or char_length(btrim(description))
        between 1 and 1000
    )
);

comment on table public.external_publication_collections is
  'Owner-defined groups of external publications that consuming sites filter by slug.';

create unique index external_publication_collections_owner_slug_key
  on public.external_publication_collections (owner_id, slug);

create table public.external_publication_collection_items (
  collection_id uuid not null
    references public.external_publication_collections(id)
    on delete cascade,
  external_publication_id uuid not null
    references public.external_publications(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (
    collection_id,
    external_publication_id
  )
);

create index external_publication_collection_items_publication_idx
  on public.external_publication_collection_items (external_publication_id);

create or replace function private.validate_external_publication_collection_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection_owner uuid;
  v_publication_owner uuid;
begin
  select c.owner_id
  into v_collection_owner
  from public.external_publication_collections c
  where c.id = new.collection_id;

  select ep.owner_id
  into v_publication_owner
  from public.external_publications ep
  where ep.id = new.external_publication_id;

  if v_collection_owner is null
     or v_publication_owner is null
     or v_collection_owner <> v_publication_owner then
    raise exception
      'Collection and external publication must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_external_publication_collection_item()
  from public, anon, authenticated;

create trigger validate_external_publication_collection_item
before insert or update
on public.external_publication_collection_items
for each row
execute function private.validate_external_publication_collection_item();

create trigger external_publication_collections_updated_at
before update
on public.external_publication_collections
for each row
execute function public.handle_updated_at();

alter table public.external_publication_collections
  enable row level security;

alter table public.external_publication_collection_items
  enable row level security;

revoke all
  on table public.external_publication_collections
  from public, anon, authenticated;

revoke all
  on table public.external_publication_collection_items
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.external_publication_collections
  to authenticated;

grant select
  on table public.external_publication_collection_items
  to authenticated;

create policy "Dashboard members can view external publication collections"
  on public.external_publication_collections
  for select
  to authenticated
  using (private.can_view_dashboard(owner_id));

create policy "Owners can create external publication collections"
  on public.external_publication_collections
  for insert
  to authenticated
  with check (private.is_dashboard_owner(owner_id));

create policy "Owners can update external publication collections"
  on public.external_publication_collections
  for update
  to authenticated
  using (private.is_dashboard_owner(owner_id))
  with check (private.is_dashboard_owner(owner_id));

create policy "Owners can delete external publication collections"
  on public.external_publication_collections
  for delete
  to authenticated
  using (private.is_dashboard_owner(owner_id));

create policy "Dashboard members can view external publication collection items"
  on public.external_publication_collection_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.external_publication_collections c
      where c.id = collection_id
        and private.can_view_dashboard(c.owner_id)
    )
  );

create or replace function private.set_external_publication_collections(
  p_owner_id uuid,
  p_external_publication_id uuid,
  p_collection_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection_ids uuid[] := coalesce(p_collection_ids, '{}'::uuid[]);
begin
  if exists (
    select 1
    from unnest(v_collection_ids) as selected(collection_id)
    left join public.external_publication_collections c
      on c.id = selected.collection_id
     and c.owner_id = p_owner_id
    where c.id is null
  ) then
    raise exception 'One or more selected collections are unavailable'
      using errcode = '22023';
  end if;

  delete from public.external_publication_collection_items item
  where item.external_publication_id = p_external_publication_id
    and not (item.collection_id = any(v_collection_ids));

  insert into public.external_publication_collection_items (
    collection_id,
    external_publication_id
  )
  select distinct
    selected.collection_id,
    p_external_publication_id
  from unnest(v_collection_ids) as selected(collection_id)
  on conflict (collection_id, external_publication_id) do nothing;
end;
$$;

revoke all
  on function private.set_external_publication_collections(uuid, uuid, uuid[])
  from public, anon, authenticated;

-- 3. Owner RPCs gain slug and collections ----------------------------------------

drop function public.create_external_publication(text, text[], integer, date, text, text, text, text, text, uuid[]);
drop function public.update_external_publication(uuid, text, text[], integer, date, text, text, text, text, text, uuid[]);

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
  p_slug text default null,
  p_project_ids uuid[] default '{}'::uuid[],
  p_collection_ids uuid[] default '{}'::uuid[]
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
    created_by,
    title,
    authors,
    venue,
    publication_year,
    published_on,
    doi_url,
    publication_url,
    language,
    visibility,
    slug
  )
  values (
    v_owner_id,
    v_owner_id,
    btrim(coalesce(p_title, '')),
    private.normalise_external_publication_authors(p_authors),
    nullif(btrim(coalesce(p_venue, '')), ''),
    p_publication_year,
    p_published_on,
    nullif(btrim(coalesce(p_doi_url, '')), ''),
    nullif(btrim(coalesce(p_publication_url, '')), ''),
    nullif(btrim(coalesce(p_language, '')), ''),
    coalesce(nullif(btrim(coalesce(p_visibility, '')), ''), 'private'),
    nullif(lower(btrim(coalesce(p_slug, ''))), '')
  )
  returning id into v_id;

  perform private.set_external_publication_projects(
    v_owner_id,
    v_id,
    p_project_ids
  );

  perform private.set_external_publication_collections(
    v_owner_id,
    v_id,
    p_collection_ids
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
  p_slug text default null,
  p_project_ids uuid[] default '{}'::uuid[],
  p_collection_ids uuid[] default '{}'::uuid[]
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
    visibility = coalesce(nullif(btrim(coalesce(p_visibility, '')), ''), 'private'),
    slug = nullif(lower(btrim(coalesce(p_slug, ''))), '')
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

  perform private.set_external_publication_collections(
    v_owner_id,
    p_id,
    p_collection_ids
  );

  return p_id;
end;
$$;

revoke all
  on function public.create_external_publication(text, text[], integer, date, text, text, text, text, text, text, uuid[], uuid[])
  from public, anon;

revoke all
  on function public.update_external_publication(uuid, text, text[], integer, date, text, text, text, text, text, text, uuid[], uuid[])
  from public, anon;

grant execute
  on function public.create_external_publication(text, text[], integer, date, text, text, text, text, text, text, uuid[], uuid[])
  to authenticated;

grant execute
  on function public.update_external_publication(uuid, text, text[], integer, date, text, text, text, text, text, text, uuid[], uuid[])
  to authenticated;

-- 4. Public feeds -------------------------------------------------------------------

create function public.list_public_external_publications()
returns table (
  slug text,
  title text,
  authors text[],
  venue text,
  publication_date date,
  publication_year integer,
  doi_url text,
  publication_url text,
  language text,
  project_slugs text[],
  collection_slugs text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ep.slug,
    ep.title,
    ep.authors,
    ep.venue,
    ep.published_on,
    ep.publication_year,
    ep.doi_url,
    ep.publication_url,
    ep.language,
    array(
      select ppm.slug
      from public.project_external_publications pep
      join public.project_public_metadata ppm
        on ppm.project_id = pep.project_id
      where pep.external_publication_id = ep.id
        and ppm.visibility = 'public'
        and ppm.slug is not null
      order by ppm.slug
    ) as project_slugs,
    array(
      select c.slug
      from public.external_publication_collection_items item
      join public.external_publication_collections c
        on c.id = item.collection_id
      where item.external_publication_id = ep.id
      order by c.slug
    ) as collection_slugs
  from public.external_publications ep
  where ep.visibility = 'public'
    and ep.slug is not null
  order by
    coalesce(
      ep.published_on,
      make_date(ep.publication_year, 1, 1)
    ) desc,
    ep.title asc;
$$;

comment on function public.list_public_external_publications() is
  'Anonymous-safe list of Public external publications (papers by other authors) with their public Project and collection slugs.';

revoke all
  on function public.list_public_external_publications()
  from public, anon, authenticated;

grant execute
  on function public.list_public_external_publications()
  to anon, service_role;

drop function public.list_public_project_publications();

create function public.list_public_project_publications()
returns table (
  project_slug text,
  authorship text,
  publication_slug text,
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
      paper_meta.slug as publication_slug,
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
      ep.slug,
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
      and ep.slug is not null
  )
  select
    project_slug,
    authorship,
    publication_slug,
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
  'Anonymous-safe list of each Public Project''s publications: its own explicitly Public Papers (authorship own) and its Public external publications (authorship external), each with its public slug.';

revoke all
  on function public.list_public_project_publications()
  from public, anon, authenticated;

grant execute
  on function public.list_public_project_publications()
  to anon, service_role;

notify pgrst, 'reload schema';
