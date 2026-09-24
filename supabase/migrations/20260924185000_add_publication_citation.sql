-- Distant Forge rc.1 follow-up:
-- add an optional public citation string for publication detail pages.

alter table public.paper_public_metadata
  add column citation text;

alter table public.paper_public_metadata
  add constraint paper_public_metadata_citation_length
  check (
    citation is null
    or char_length(btrim(citation))
      between 1 and 2000
  );

grant update (
  citation
)
  on table public.paper_public_metadata
  to authenticated;

drop function if exists public.get_public_paper(text);

create function public.get_public_paper(
  p_slug text
)
returns table (
  slug text,
  title text,
  authors text[],
  abstract text,
  venue text,
  publication_date date,
  doi_url text,
  publication_url text,
  preprint_url text,
  github_url text,
  dataset_url text,
  featured boolean,
  publication_index text,
  citation text,
  highlight_text text,
  highlight_image_filename text,
  highlight_image_alt text,
  highlight_image_caption text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    p.title,
    array(
      select a.full_name
      from public.paper_authors pa
      join public.authors a
        on a.id = pa.author_id
      where pa.paper_id = p.id
      order by
        pa.author_order,
        a.full_name
    ) as authors,
    p.abstract,
    p.current_venue as venue,
    p.published_on as publication_date,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'doi'
      order by
        pl.sort_order,
        pl.id
      limit 1
    ) as doi_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'publication'
      order by
        pl.sort_order,
        pl.id
      limit 1
    ) as publication_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'preprint'
      order by
        pl.sort_order,
        pl.id
      limit 1
    ) as preprint_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'github'
      order by
        pl.sort_order,
        pl.id
      limit 1
    ) as github_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'dataverse'
      order by
        pl.sort_order,
        pl.id
      limit 1
    ) as dataset_url,
    ppm.featured,
    ppm.publication_index,
    ppm.citation,
    ppm.highlight_text,
    ppm.highlight_image_filename,
    ppm.highlight_image_alt,
    ppm.highlight_image_caption
  from public.paper_public_metadata ppm
  join public.papers p
    on p.id = ppm.paper_id
  where ppm.visibility = 'public'
    and ppm.slug =
      lower(
        btrim(
          p_slug
        )
      )
  limit 1;
$$;

comment on column public.paper_public_metadata.citation is
  'Optional owner-entered public citation string for the academic website publication detail page.';

comment on function public.get_public_paper(text) is
  'Anonymous-safe slug lookup for explicitly Public papers, including optional citation and Key highlight detail fields.';

revoke all
  on function public.get_public_paper(text)
  from public;

grant execute
  on function public.get_public_paper(text)
  to anon, service_role;
