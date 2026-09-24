-- Distant Forge follow-up: add an optional canonical project URL and expose it through public project contracts.

alter table public.projects
  add column url text;

alter table public.projects
  add constraint projects_url_http_https
  check (
    url is null
    or url ~* '^https?://[^[:space:]]+$'
  );

drop function if exists public.create_project_with_details(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
);

create function public.create_project_with_details(
  p_short_title text,
  p_title text,
  p_abstract text,
  p_funder text,
  p_url text,
  p_status text,
  p_visibility text,
  p_slug text,
  p_project_image_filename text,
  p_funder_image_filename text,
  p_paper_ids uuid[] default '{}'::uuid[],
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_project_id uuid;
begin
  select dm.owner_id
  into v_owner_id
  from public.dashboard_members dm
  where dm.user_id = auth.uid()
    and dm.role = 'owner'
  limit 1;

  if v_owner_id is null then
    raise exception 'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  insert into public.projects (
    owner_id,
    short_title,
    title,
    abstract,
    funder,
    url,
    status
  )
  values (
    v_owner_id,
    btrim(p_short_title),
    btrim(p_title),
    btrim(p_abstract),
    btrim(p_funder),
    nullif(
      btrim(p_url),
      ''
    ),
    p_status
  )
  returning id
  into v_project_id;

  update public.project_public_metadata
  set
    visibility = p_visibility,
    slug = lower(
      nullif(
        btrim(p_slug),
        ''
      )
    ),
    project_image_filename =
      nullif(
        btrim(
          p_project_image_filename
        ),
        ''
      ),
    funder_image_filename =
      nullif(
        btrim(
          p_funder_image_filename
        ),
        ''
      )
  where project_id = v_project_id;

  insert into public.project_papers (
    project_id,
    paper_id
  )
  select
    v_project_id,
    paper_id
  from (
    select distinct
      unnest(
        coalesce(
          p_paper_ids,
          '{}'::uuid[]
        )
      ) as paper_id
  ) links;

  insert into public.project_activity_labels (
    project_id,
    activity_label_id
  )
  select
    v_project_id,
    activity_label_id
  from (
    select distinct
      unnest(
        coalesce(
          p_activity_label_ids,
          '{}'::uuid[]
        )
      ) as activity_label_id
  ) links;

  return v_project_id;
end;
$$;

drop function if exists public.update_project_with_details(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
);

create function public.update_project_with_details(
  p_project_id uuid,
  p_short_title text,
  p_title text,
  p_abstract text,
  p_funder text,
  p_url text,
  p_status text,
  p_visibility text,
  p_slug text,
  p_project_image_filename text,
  p_funder_image_filename text,
  p_paper_ids uuid[] default '{}'::uuid[],
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.can_edit_project(
    p_project_id
  ) then
    raise exception 'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  update public.projects
  set
    short_title =
      btrim(p_short_title),
    title =
      btrim(p_title),
    abstract =
      btrim(p_abstract),
    funder =
      btrim(p_funder),
    url =
      nullif(
        btrim(p_url),
        ''
      ),
    status =
      p_status
  where id = p_project_id;

  update public.project_public_metadata
  set
    visibility = p_visibility,
    slug = lower(
      nullif(
        btrim(p_slug),
        ''
      )
    ),
    project_image_filename =
      nullif(
        btrim(
          p_project_image_filename
        ),
        ''
      ),
    funder_image_filename =
      nullif(
        btrim(
          p_funder_image_filename
        ),
        ''
      )
  where project_id =
    p_project_id;

  delete from public.project_papers
  where project_id =
    p_project_id;

  insert into public.project_papers (
    project_id,
    paper_id
  )
  select
    p_project_id,
    paper_id
  from (
    select distinct
      unnest(
        coalesce(
          p_paper_ids,
          '{}'::uuid[]
        )
      ) as paper_id
  ) links;

  delete from public.project_activity_labels
  where project_id =
    p_project_id;

  insert into public.project_activity_labels (
    project_id,
    activity_label_id
  )
  select
    p_project_id,
    activity_label_id
  from (
    select distinct
      unnest(
        coalesce(
          p_activity_label_ids,
          '{}'::uuid[]
        )
      ) as activity_label_id
  ) links;

  return p_project_id;
end;
$$;

revoke all
  on function public.create_project_with_details(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    uuid[],
    uuid[]
  )
  from public, anon;

revoke all
  on function public.update_project_with_details(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    uuid[],
    uuid[]
  )
  from public, anon;

grant execute
  on function public.create_project_with_details(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    uuid[],
    uuid[]
  )
  to authenticated, service_role;

grant execute
  on function public.update_project_with_details(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    uuid[],
    uuid[]
  )
  to authenticated, service_role;

drop function if exists public.list_public_projects();

create function public.list_public_projects()
returns table (
  slug text,
  short_title text,
  title text,
  abstract text,
  funder text,
  url text,
  status text,
  project_image_filename text,
  funder_image_filename text,
  publication_slugs text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    p.short_title,
    p.title,
    p.abstract,
    p.funder,
    p.url,
    p.status,
    ppm.project_image_filename,
    ppm.funder_image_filename,
    array(
      select paper_meta.slug
      from public.project_papers pp
      join public.papers paper
        on paper.id = pp.paper_id
      join public.paper_public_metadata paper_meta
        on paper_meta.paper_id =
          paper.id
      where pp.project_id = p.id
        and paper_meta.visibility =
          'public'
        and paper_meta.slug is not null
      order by
        paper.published_on desc
          nulls last,
        paper.title asc
    ) as publication_slugs
  from public.projects p
  join public.project_public_metadata ppm
    on ppm.project_id = p.id
  where ppm.visibility = 'public'
    and ppm.slug is not null
  order by
    case
      when p.status = 'active'
        then 0
      else 1
    end,
    p.title asc;
$$;

drop function if exists public.get_public_project(text);

create function public.get_public_project(
  p_slug text
)
returns table (
  slug text,
  short_title text,
  title text,
  abstract text,
  funder text,
  url text,
  status text,
  project_image_filename text,
  funder_image_filename text,
  publication_slugs text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    p.short_title,
    p.title,
    p.abstract,
    p.funder,
    p.url,
    p.status,
    ppm.project_image_filename,
    ppm.funder_image_filename,
    array(
      select paper_meta.slug
      from public.project_papers pp
      join public.papers paper
        on paper.id = pp.paper_id
      join public.paper_public_metadata paper_meta
        on paper_meta.paper_id =
          paper.id
      where pp.project_id = p.id
        and paper_meta.visibility =
          'public'
        and paper_meta.slug is not null
      order by
        paper.published_on desc
          nulls last,
        paper.title asc
    ) as publication_slugs
  from public.projects p
  join public.project_public_metadata ppm
    on ppm.project_id = p.id
  where ppm.visibility = 'public'
    and ppm.slug =
      lower(
        btrim(
          p_slug
        )
      )
  limit 1;
$$;

comment on function public.list_public_projects() is
  'Anonymous-safe listing of explicitly Public projects with canonical project URLs, static asset filenames, and associated Public paper slugs only.';

comment on function public.get_public_project(text) is
  'Anonymous-safe slug lookup for an explicitly Public project with its canonical project URL, static asset filenames, and associated Public paper slugs only.';

revoke all
  on function public.list_public_projects()
  from public;

revoke all
  on function public.get_public_project(text)
  from public;

grant execute
  on function public.list_public_projects()
  to anon, service_role;

grant execute
  on function public.get_public_project(text)
  to anon, service_role;
