-- Steady Orchard rc.6: the Owner's own Papers can join collections.
--
-- Collections were built in rc.4 for external publications only. Sites that
-- select publications by collection (OBPEX, SUDAKAS, Empiria Lab and others)
-- also need the Owner's own Papers. paper_collection_items links a Paper to a
-- collection, written only through the Owner RPC set_paper_collections(), and
-- list_public_collection_publications() returns each collection's Public Papers
-- (authorship own) and Public external publications (authorship external),
-- mirroring list_public_project_publications(). Existing feeds are unchanged.
--
-- Precheck (read-only; it must return no rows):
-- select 'table' as kind, to_regclass('public.paper_collection_items')::text as name
-- where to_regclass('public.paper_collection_items') is not null
-- union all
-- select 'function', p.proname
-- from pg_proc p
-- join pg_namespace n
--   on n.oid = p.pronamespace
-- where (n.nspname = 'public' and p.proname in ('set_paper_collections', 'list_public_collection_publications'))
--    or (n.nspname = 'private' and p.proname = 'validate_paper_collection_item');

-- 1. Paper collection items ----------------------------------------------------------

create table public.paper_collection_items (
  collection_id uuid not null
    references public.external_publication_collections(id)
    on delete cascade,
  paper_id uuid not null
    references public.papers(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (
    collection_id,
    paper_id
  )
);

comment on table public.paper_collection_items is
  'The Owner''s own Papers in Owner-defined collections; only Public Papers with a slug reach the collection feed.';

create index paper_collection_items_paper_idx
  on public.paper_collection_items (paper_id);

create or replace function private.validate_paper_collection_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection_owner uuid;
  v_paper_owner uuid;
begin
  select c.owner_id
  into v_collection_owner
  from public.external_publication_collections c
  where c.id = new.collection_id;

  select p.owner_id
  into v_paper_owner
  from public.papers p
  where p.id = new.paper_id;

  if v_collection_owner is null
     or v_paper_owner is null
     or v_collection_owner <> v_paper_owner then
    raise exception
      'Collection and paper must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_paper_collection_item()
  from public, anon, authenticated;

create trigger validate_paper_collection_item
before insert or update
on public.paper_collection_items
for each row
execute function private.validate_paper_collection_item();

alter table public.paper_collection_items
  enable row level security;

revoke all
  on table public.paper_collection_items
  from public, anon, authenticated;

grant select
  on table public.paper_collection_items
  to authenticated;

create policy "Dashboard members can view paper collection items"
  on public.paper_collection_items
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

-- 2. Owner RPC ----------------------------------------------------------------------

create function public.set_paper_collections(
  p_paper_id uuid,
  p_collection_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_collection_ids uuid[] := coalesce(p_collection_ids, '{}'::uuid[]);
begin
  select p.owner_id
  into v_owner_id
  from public.papers p
  where p.id = p_paper_id;

  if v_owner_id is null
     or not private.can_edit_paper(p_paper_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(v_collection_ids) as selected(collection_id)
    left join public.external_publication_collections c
      on c.id = selected.collection_id
     and c.owner_id = v_owner_id
    where c.id is null
  ) then
    raise exception 'One or more selected collections are unavailable'
      using errcode = '22023';
  end if;

  delete from public.paper_collection_items item
  where item.paper_id = p_paper_id
    and not (item.collection_id = any(v_collection_ids));

  insert into public.paper_collection_items (
    collection_id,
    paper_id
  )
  select distinct
    selected.collection_id,
    p_paper_id
  from unnest(v_collection_ids) as selected(collection_id)
  on conflict (collection_id, paper_id) do nothing;
end;
$$;

comment on function public.set_paper_collections(uuid, uuid[]) is
  'Owner-only: replaces the collections a Paper belongs to.';

revoke all
  on function public.set_paper_collections(uuid, uuid[])
  from public, anon;

grant execute
  on function public.set_paper_collections(uuid, uuid[])
  to authenticated;

-- 3. Public collection feed -----------------------------------------------------------

create function public.list_public_collection_publications()
returns table (
  collection_slug text,
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
  with publications as (
    select
      c.slug as collection_slug,
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
    from public.paper_collection_items item
    join public.external_publication_collections c
      on c.id = item.collection_id
    join public.papers paper
      on paper.id = item.paper_id
    join public.paper_public_metadata paper_meta
      on paper_meta.paper_id = paper.id
    where paper_meta.visibility = 'public'
      and paper_meta.slug is not null

    union all

    select
      c.slug,
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
    from public.external_publication_collection_items item
    join public.external_publication_collections c
      on c.id = item.collection_id
    join public.external_publications ep
      on ep.id = item.external_publication_id
    where ep.visibility = 'public'
      and ep.slug is not null
  )
  select
    collection_slug,
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
    collection_slug asc,
    coalesce(
      publication_date,
      make_date(publication_year, 1, 1)
    ) desc nulls last,
    title asc;
$$;

comment on function public.list_public_collection_publications() is
  'Anonymous-safe list of each collection''s publications: the Owner''s explicitly Public Papers (authorship own) and Public external publications (authorship external), each with its public slug.';

revoke all
  on function public.list_public_collection_publications()
  from public, anon, authenticated;

grant execute
  on function public.list_public_collection_publications()
  to anon, service_role;

notify pgrst, 'reload schema';
