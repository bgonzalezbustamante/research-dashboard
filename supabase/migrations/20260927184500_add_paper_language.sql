alter table public.papers
  add column language text;

alter table public.papers
  add constraint papers_language_check
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
  );

drop function if exists public.list_public_papers();

create function public.list_public_papers()
returns table(
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
  language text,
  project_url text,
  si_file_url text
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
      join public.authors a on a.id = pa.author_id
      where pa.paper_id = p.id
      order by pa.author_order, a.full_name
    ) as authors,
    p.abstract,
    p.current_venue as venue,
    p.published_on as publication_date,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'doi' order by pl.sort_order, pl.id limit 1) as doi_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'publication' order by pl.sort_order, pl.id limit 1) as publication_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'preprint' order by pl.sort_order, pl.id limit 1) as preprint_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'github' order by pl.sort_order, pl.id limit 1) as github_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'dataverse' order by pl.sort_order, pl.id limit 1) as dataset_url,
    ppm.featured,
    ppm.publication_index,
    p.language,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'project' order by pl.sort_order, pl.id limit 1) as project_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'si-file' order by pl.sort_order, pl.id limit 1) as si_file_url
  from public.paper_public_metadata ppm
  join public.papers p on p.id = ppm.paper_id
  where ppm.visibility = 'public'
    and ppm.slug is not null
  order by p.published_on desc nulls last, p.title asc;
$$;

revoke all on function public.list_public_papers()
  from public, anon, authenticated;
grant execute on function public.list_public_papers()
  to anon, service_role;

drop function if exists public.get_public_paper(text);

create function public.get_public_paper(p_slug text)
returns table(
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
  language text,
  citation text,
  highlight_text text,
  highlight_image_filename text,
  highlight_image_alt text,
  highlight_image_caption text,
  project_url text,
  si_file_url text
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
      join public.authors a on a.id = pa.author_id
      where pa.paper_id = p.id
      order by pa.author_order, a.full_name
    ) as authors,
    p.abstract,
    p.current_venue as venue,
    p.published_on as publication_date,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'doi' order by pl.sort_order, pl.id limit 1) as doi_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'publication' order by pl.sort_order, pl.id limit 1) as publication_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'preprint' order by pl.sort_order, pl.id limit 1) as preprint_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'github' order by pl.sort_order, pl.id limit 1) as github_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'dataverse' order by pl.sort_order, pl.id limit 1) as dataset_url,
    ppm.featured,
    ppm.publication_index,
    p.language,
    ppm.citation,
    ppm.highlight_text,
    ppm.highlight_image_filename,
    ppm.highlight_image_alt,
    ppm.highlight_image_caption,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'project' order by pl.sort_order, pl.id limit 1) as project_url,
    (select pl.url from public.paper_links pl where pl.paper_id = p.id and pl.link_type = 'si-file' order by pl.sort_order, pl.id limit 1) as si_file_url
  from public.paper_public_metadata ppm
  join public.papers p on p.id = ppm.paper_id
  where ppm.visibility = 'public'
    and ppm.slug = lower(btrim(p_slug))
  limit 1;
$$;

revoke all on function public.get_public_paper(text)
  from public, anon, authenticated;
grant execute on function public.get_public_paper(text)
  to anon, service_role;
