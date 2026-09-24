-- Distant Forge rc.1 close-out:
-- 1) add an optional public funder note to Projects;
-- 2) expose safe read-only conference presentation summaries inside accessible Paper workspaces.

alter table public.projects
  add column funder_note text;

alter table public.projects
  add constraint projects_funder_note_length
  check (
    funder_note is null
    or char_length(btrim(funder_note))
      between 1 and 1000
  );

drop function if exists public.create_project_with_details(
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  text,
  boolean,
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
  p_funder_note text,
  p_url text,
  p_start_year integer,
  p_end_year integer,
  p_status text,
  p_visibility text,
  p_slug text,
  p_featured boolean,
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
    funder_note,
    url,
    start_year,
    end_year,
    status
  )
  values (
    v_owner_id,
    btrim(p_short_title),
    btrim(p_title),
    btrim(p_abstract),
    btrim(p_funder),
    nullif(
      btrim(p_funder_note),
      ''
    ),
    nullif(
      btrim(p_url),
      ''
    ),
    p_start_year,
    p_end_year,
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
    featured = coalesce(
      p_featured,
      false
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
  integer,
  integer,
  text,
  text,
  text,
  boolean,
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
  p_funder_note text,
  p_url text,
  p_start_year integer,
  p_end_year integer,
  p_status text,
  p_visibility text,
  p_slug text,
  p_featured boolean,
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
    funder_note =
      nullif(
        btrim(p_funder_note),
        ''
      ),
    url =
      nullif(
        btrim(p_url),
        ''
      ),
    start_year =
      p_start_year,
    end_year =
      p_end_year,
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
    featured = coalesce(
      p_featured,
      false
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
    integer,
    integer,
    text,
    text,
    text,
    boolean,
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
    integer,
    integer,
    text,
    text,
    text,
    boolean,
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
    integer,
    integer,
    text,
    text,
    text,
    boolean,
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
    integer,
    integer,
    text,
    text,
    text,
    boolean,
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
  funder_note text,
  url text,
  start_year integer,
  end_year integer,
  status text,
  featured boolean,
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
    p.funder_note,
    p.url,
    p.start_year,
    p.end_year,
    p.status,
    ppm.featured,
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
  funder_note text,
  url text,
  start_year integer,
  end_year integer,
  status text,
  featured boolean,
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
    p.funder_note,
    p.url,
    p.start_year,
    p.end_year,
    p.status,
    ppm.featured,
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
  'Anonymous-safe listing of explicitly Public projects with canonical funding details, project URL/years, Featured state, static asset filenames, and associated Public paper slugs only.';

comment on function public.get_public_project(text) is
  'Anonymous-safe slug lookup for an explicitly Public project with canonical funding details, project URL/years, Featured state, static asset filenames, and associated Public paper slugs only.';

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

create or replace function public.list_paper_conference_presentations(
  p_paper_id uuid
)
returns table (
  id uuid,
  event_name text,
  event_short_name text,
  location text,
  presentation_date date,
  presentation_title text,
  authors text[],
  presentation_type text,
  url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not private.can_view_paper(
    p_paper_id
  ) then
    raise exception 'Paper access is required'
      using errcode = '42501';
  end if;

  return query
  select
    cp.id,
    cp.event_name,
    cp.event_short_name,
    cp.location,
    cp.presentation_date,
    cp.presentation_title,
    cp.authors,
    cp.presentation_type,
    cp.url
  from public.conference_presentations cp
  where cp.paper_id = p_paper_id
  order by
    cp.presentation_date desc nulls last,
    cp.event_name asc;
end;
$$;

comment on function public.list_paper_conference_presentations(uuid) is
  'Authenticated read-only conference presentation summaries for an accessible linked paper. Private conference notes and owner metadata are excluded.';

revoke all
  on function public.list_paper_conference_presentations(uuid)
  from public, anon;

grant execute
  on function public.list_paper_conference_presentations(uuid)
  to authenticated, service_role;
