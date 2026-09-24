-- Phase 1/2: isolate public paper presentation metadata and expose a narrow anonymous RPC contract.

create table public.paper_public_metadata (
  paper_id uuid primary key
    references public.papers(id)
    on delete cascade,
  visibility text not null default 'private'
    check (visibility in ('private', 'public', 'unlisted')),
  slug text unique,
  featured boolean not null default false,
  public_category text,
  public_summary text,
  public_venue text,
  display_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_public_metadata_slug_format
    check (
      slug is null
      or (
        char_length(slug) between 1 and 160
        and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      )
    ),
  constraint paper_public_metadata_visible_slug_required
    check (
      visibility = 'private'
      or slug is not null
    ),
  constraint paper_public_metadata_category_nonempty
    check (
      public_category is null
      or char_length(btrim(public_category)) > 0
    ),
  constraint paper_public_metadata_summary_nonempty
    check (
      public_summary is null
      or char_length(btrim(public_summary)) > 0
    ),
  constraint paper_public_metadata_venue_nonempty
    check (
      public_venue is null
      or char_length(btrim(public_venue)) > 0
    ),
  constraint paper_public_metadata_display_order_nonnegative
    check (
      display_order is null
      or display_order >= 0
    )
);

comment on table public.paper_public_metadata is
  'Owner-managed public presentation settings for papers. Internal workflow state remains in public.papers.';

comment on column public.paper_public_metadata.visibility is
  'private: unavailable anonymously; public: listed and retrievable; unlisted: retrievable only by known slug.';

alter table public.paper_public_metadata
  enable row level security;

revoke all
  on table public.paper_public_metadata
  from public, anon, authenticated;

grant select
  on table public.paper_public_metadata
  to authenticated;

grant update (
  visibility,
  slug,
  featured,
  public_category,
  public_summary,
  public_venue,
  display_order
)
  on table public.paper_public_metadata
  to authenticated;

create policy "Dashboard owners can view public paper metadata"
  on public.paper_public_metadata
  for select
  to authenticated
  using (private.can_edit_paper(paper_id));

create policy "Dashboard owners can update public paper metadata"
  on public.paper_public_metadata
  for update
  to authenticated
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

create or replace function private.ensure_paper_public_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.paper_public_metadata (paper_id)
  values (new.id)
  on conflict (paper_id) do nothing;

  return new;
end;
$$;

revoke all
  on function private.ensure_paper_public_metadata()
  from public, anon, authenticated;

create or replace function private.touch_paper_public_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all
  on function private.touch_paper_public_metadata()
  from public, anon, authenticated;

drop trigger if exists ensure_paper_public_metadata
  on public.papers;

create trigger ensure_paper_public_metadata
after insert on public.papers
for each row
execute function private.ensure_paper_public_metadata();

drop trigger if exists touch_paper_public_metadata
  on public.paper_public_metadata;

create trigger touch_paper_public_metadata
before update on public.paper_public_metadata
for each row
execute function private.touch_paper_public_metadata();

insert into public.paper_public_metadata (paper_id)
select p.id
from public.papers p
on conflict (paper_id) do nothing;

create index paper_public_metadata_listing_idx
  on public.paper_public_metadata (
    visibility,
    featured desc,
    display_order,
    paper_id
  );

create or replace function public.list_public_papers()
returns table (
  slug text,
  visibility text,
  title text,
  authors text[],
  abstract text,
  summary text,
  venue text,
  publication_date date,
  doi_url text,
  publication_url text,
  preprint_url text,
  github_url text,
  dataset_url text,
  featured boolean,
  category text,
  display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    ppm.visibility,
    p.title,
    array(
      select a.full_name
      from public.paper_authors pa
      join public.authors a
        on a.id = pa.author_id
      where pa.paper_id = p.id
      order by pa.author_order, a.full_name
    ) as authors,
    p.abstract,
    ppm.public_summary as summary,
    ppm.public_venue as venue,
    p.published_on as publication_date,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'doi'
      order by pl.sort_order, pl.id
      limit 1
    ) as doi_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'publication'
      order by pl.sort_order, pl.id
      limit 1
    ) as publication_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'preprint'
      order by pl.sort_order, pl.id
      limit 1
    ) as preprint_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'github'
      order by pl.sort_order, pl.id
      limit 1
    ) as github_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'dataverse'
      order by pl.sort_order, pl.id
      limit 1
    ) as dataset_url,
    ppm.featured,
    ppm.public_category as category,
    ppm.display_order
  from public.paper_public_metadata ppm
  join public.papers p
    on p.id = ppm.paper_id
  where ppm.visibility = 'public'
    and ppm.slug is not null
  order by
    ppm.featured desc,
    ppm.display_order asc nulls last,
    p.published_on desc nulls last,
    p.title asc;
$$;

create or replace function public.get_public_paper(p_slug text)
returns table (
  slug text,
  visibility text,
  title text,
  authors text[],
  abstract text,
  summary text,
  venue text,
  publication_date date,
  doi_url text,
  publication_url text,
  preprint_url text,
  github_url text,
  dataset_url text,
  featured boolean,
  category text,
  display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    ppm.visibility,
    p.title,
    array(
      select a.full_name
      from public.paper_authors pa
      join public.authors a
        on a.id = pa.author_id
      where pa.paper_id = p.id
      order by pa.author_order, a.full_name
    ) as authors,
    p.abstract,
    ppm.public_summary as summary,
    ppm.public_venue as venue,
    p.published_on as publication_date,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'doi'
      order by pl.sort_order, pl.id
      limit 1
    ) as doi_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'publication'
      order by pl.sort_order, pl.id
      limit 1
    ) as publication_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'preprint'
      order by pl.sort_order, pl.id
      limit 1
    ) as preprint_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'github'
      order by pl.sort_order, pl.id
      limit 1
    ) as github_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'dataverse'
      order by pl.sort_order, pl.id
      limit 1
    ) as dataset_url,
    ppm.featured,
    ppm.public_category as category,
    ppm.display_order
  from public.paper_public_metadata ppm
  join public.papers p
    on p.id = ppm.paper_id
  where ppm.visibility in ('public', 'unlisted')
    and ppm.slug = lower(btrim(p_slug))
  limit 1;
$$;

comment on function public.list_public_papers() is
  'Anonymous-safe listing of papers explicitly marked public.';

comment on function public.get_public_paper(text) is
  'Anonymous-safe slug lookup for papers marked public or unlisted.';

revoke all
  on function public.list_public_papers()
  from public;

revoke all
  on function public.get_public_paper(text)
  from public;

grant execute
  on function public.list_public_papers()
  to anon, authenticated, service_role;

grant execute
  on function public.get_public_paper(text)
  to anon, authenticated, service_role;
