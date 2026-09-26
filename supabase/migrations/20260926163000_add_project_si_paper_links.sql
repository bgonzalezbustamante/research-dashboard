alter table public.paper_links
  drop constraint if exists paper_links_link_type_check;

alter table public.paper_links
  add constraint paper_links_link_type_check
  check (
    link_type in (
      'overleaf',
      'dataverse',
      'github',
      'project',
      'si-file',
      'preprint',
      'doi',
      'publication',
      'other'
    )
  );

create or replace function public.update_paper_with_details(
  p_paper_id uuid,
  p_short_title text,
  p_title text,
  p_abstract text default null,
  p_status text default 'writing',
  p_revision_round smallint default null,
  p_target_venue text default null,
  p_current_venue text default null,
  p_started_on date default null,
  p_published_on date default null,
  p_authors jsonb default '[]'::jsonb,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_author jsonb;
  v_author_name text;
  v_author_id uuid;
  v_author_order smallint := 0;
  v_link jsonb;
  v_link_type text;
  v_link_label text;
  v_link_url text;
  v_link_sort_order smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and p.owner_id = v_user_id
      and private.is_dashboard_owner(p.owner_id)
  ) then
    raise exception 'Paper not found or access denied';
  end if;

  if p_short_title is null or length(btrim(p_short_title)) = 0 then
    raise exception 'Short title is required';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Full title is required';
  end if;

  if p_status not in (
    'writing', 'under-review', 'revise-round',
    'published', 'reframing', 'vor-typesetting',
    'standby', 'deprecated'
  ) then
    raise exception 'Invalid paper status';
  end if;

  if p_status = 'revise-round'
     and (p_revision_round is null or p_revision_round < 1) then
    raise exception 'Revision round is required for revise-round status';
  end if;

  update public.papers
  set
    short_title = btrim(p_short_title),
    title = btrim(p_title),
    abstract = nullif(btrim(p_abstract), ''),
    status = p_status,
    revision_round = case
      when p_status = 'revise-round' then p_revision_round
      else null
    end,
    target_venue = nullif(btrim(p_target_venue), ''),
    current_venue = nullif(btrim(p_current_venue), ''),
    started_on = p_started_on,
    published_on = p_published_on
  where id = p_paper_id
    and owner_id = v_user_id;

  delete from public.paper_authors
  where paper_id = p_paper_id;

  for v_author in
    select value
    from jsonb_array_elements(coalesce(p_authors, '[]'::jsonb))
  loop
    v_author_name := btrim(v_author ->> 'full_name');

    if v_author_name is null or length(v_author_name) = 0 then
      continue;
    end if;

    v_author_id := private.resolve_author_for_paper(
      p_paper_id,
      v_author_name
    );

    if exists (
      select 1
      from public.paper_authors pa
      where pa.paper_id = p_paper_id
        and pa.author_id = v_author_id
    ) then
      continue;
    end if;

    v_author_order := v_author_order + 1;

    insert into public.paper_authors (
      paper_id, author_id, author_order
    )
    values (
      p_paper_id, v_author_id, v_author_order
    );
  end loop;

  if v_author_order = 0 then
    raise exception 'At least one author is required';
  end if;

  delete from public.paper_links
  where paper_id = p_paper_id;

  for v_link in
    select value
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    v_link_type := nullif(btrim(v_link ->> 'link_type'), '');
    v_link_label := nullif(btrim(v_link ->> 'label'), '');
    v_link_url := nullif(btrim(v_link ->> 'url'), '');
    v_link_sort_order := coalesce((v_link ->> 'sort_order')::smallint, 1);

    if v_link_url is null then
      continue;
    end if;

    if v_link_type not in (
      'overleaf', 'dataverse', 'github', 'project',
      'si-file', 'preprint', 'doi', 'publication', 'other'
    ) then
      raise exception 'Invalid link type';
    end if;

    if v_link_url !~* '^https?://' then
      raise exception 'Invalid link URL';
    end if;

    insert into public.paper_links (
      paper_id, link_type, label, url, sort_order
    )
    values (
      p_paper_id, v_link_type, v_link_label,
      v_link_url, v_link_sort_order
    );
  end loop;

  return p_paper_id;
end;
$$;



create or replace function public.update_coauthor_paper_collaboration(
  p_paper_id uuid,
  p_title text,
  p_abstract text default null,
  p_target_venue text default null,
  p_current_venue text default null,
  p_authors jsonb default '[]'::jsonb,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_author jsonb;
  v_author_name text;
  v_author_id uuid;
  v_author_order smallint := 0;
  v_desired_author_ids uuid[] := array[]::uuid[];
  v_link jsonb;
  v_link_type text;
  v_link_label text;
  v_link_url text;
  v_link_sort_order smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not private.is_paper_coauthor(p_paper_id) then
    raise exception 'Coauthor access required'
      using errcode = '42501';
  end if;

  if p_title is null or char_length(btrim(p_title)) = 0 then
    raise exception 'Full title is required'
      using errcode = '22023';
  end if;

  update public.papers
  set
    title = btrim(p_title),
    abstract = nullif(btrim(p_abstract), ''),
    target_venue = nullif(btrim(p_target_venue), ''),
    current_venue = nullif(btrim(p_current_venue), '')
  where id = p_paper_id;

  if not found then
    raise exception 'Paper not found'
      using errcode = 'P0002';
  end if;

  update public.paper_authors
  set author_order = (author_order + 1000)::smallint
  where paper_id = p_paper_id;

  for v_author in
    select value
    from jsonb_array_elements(coalesce(p_authors, '[]'::jsonb))
  loop
    v_author_name := btrim(v_author ->> 'full_name');

    if v_author_name is null or char_length(v_author_name) = 0 then
      continue;
    end if;

    v_author_id := private.resolve_author_for_paper(
      p_paper_id,
      v_author_name
    );

    if v_author_id = any(v_desired_author_ids) then
      continue;
    end if;

    v_author_order := v_author_order + 1;

    if exists (
      select 1
      from public.paper_authors pa
      where pa.paper_id = p_paper_id
        and pa.author_id = v_author_id
    ) then
      update public.paper_authors
      set author_order = v_author_order
      where paper_id = p_paper_id
        and author_id = v_author_id;
    else
      insert into public.paper_authors (
        paper_id, author_id, author_order
      )
      values (
        p_paper_id, v_author_id, v_author_order
      );
    end if;

    v_desired_author_ids := array_append(
      v_desired_author_ids,
      v_author_id
    );
  end loop;

  if array_length(v_desired_author_ids, 1) is null then
    raise exception 'At least one author is required'
      using errcode = '22023';
  end if;

  delete from public.paper_authors
  where paper_id = p_paper_id
    and not (author_id = any(v_desired_author_ids));

  delete from public.paper_links
  where paper_id = p_paper_id;

  for v_link in
    select value
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    v_link_type := nullif(btrim(v_link ->> 'link_type'), '');
    v_link_label := nullif(btrim(v_link ->> 'label'), '');
    v_link_url := nullif(btrim(v_link ->> 'url'), '');
    v_link_sort_order := coalesce((v_link ->> 'sort_order')::smallint, 1);

    if v_link_url is null then
      continue;
    end if;

    if v_link_type not in (
      'overleaf', 'dataverse', 'github', 'project',
      'si-file', 'preprint', 'doi', 'publication', 'other'
    ) then
      raise exception 'Invalid link type'
        using errcode = '22023';
    end if;

    if v_link_url !~* '^https?://' then
      raise exception 'Invalid link URL'
        using errcode = '22023';
    end if;

    insert into public.paper_links (
      paper_id, link_type, label, url, sort_order
    )
    values (
      p_paper_id, v_link_type, v_link_label,
      v_link_url, v_link_sort_order
    );
  end loop;

  return p_paper_id;
end;
$$;

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
      join public.authors a
        on a.id = pa.author_id
      where pa.paper_id = p.id
      order by pa.author_order, a.full_name
    ) as authors,
    p.abstract,
    p.current_venue as venue,
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
    ppm.publication_index,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'project'
      order by pl.sort_order, pl.id
      limit 1
    ) as project_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'si-file'
      order by pl.sort_order, pl.id
      limit 1
    ) as si_file_url
  from public.paper_public_metadata ppm
  join public.papers p
    on p.id = ppm.paper_id
  where ppm.visibility = 'public'
    and ppm.slug is not null
  order by
    p.published_on desc nulls last,
    p.title asc;
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
    ppm.highlight_image_caption,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'project'
      order by
        pl.sort_order,
        pl.id
      limit 1
    ) as project_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'si-file'
      order by
        pl.sort_order,
        pl.id
      limit 1
    ) as si_file_url
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

revoke all on function public.get_public_paper(text)
  from public, anon, authenticated;
grant execute on function public.get_public_paper(text)
  to anon, service_role;
