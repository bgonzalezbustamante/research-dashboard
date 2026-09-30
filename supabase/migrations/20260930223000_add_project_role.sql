-- Add canonical project role and expose it through anonymous-safe Public project RPCs.

alter table public.projects
  add column role text;

alter table public.projects
  add constraint projects_role_length
  check (
    role is null
    or (
      length(btrim(role)) between 1 and 200
    )
  );

drop function if exists public.create_project_with_details(
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
  uuid[],
  uuid[]
);

create function public.create_project_with_details(
  p_short_title text,
  p_title text,
  p_abstract text,
  p_role text,
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
  p_presentation_ids uuid[] default '{}'::uuid[],
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
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
    role,
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
    nullif(btrim(p_role), ''),
    btrim(p_funder),
    nullif(btrim(p_funder_note), ''),
    nullif(btrim(p_url), ''),
    p_start_year,
    p_end_year,
    p_status
  )
  returning id
  into v_project_id;

  update public.project_public_metadata
  set
    visibility = p_visibility,
    slug = lower(nullif(btrim(p_slug), '')),
    featured = coalesce(p_featured, false),
    project_image_filename =
      nullif(btrim(p_project_image_filename), ''),
    funder_image_filename =
      nullif(btrim(p_funder_image_filename), '')
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
      unnest(coalesce(p_paper_ids, '{}'::uuid[])) as paper_id
  ) links;

  insert into public.project_conference_presentations (
    project_id,
    presentation_id
  )
  select
    v_project_id,
    presentation_id
  from (
    select distinct
      unnest(coalesce(p_presentation_ids, '{}'::uuid[])) as presentation_id
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
      unnest(coalesce(p_activity_label_ids, '{}'::uuid[])) as activity_label_id
  ) links;

  return v_project_id;
end;
$$;

revoke all on function public.create_project_with_details(
  text,
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
  uuid[],
  uuid[]
) from public, anon, authenticated;

grant execute on function public.create_project_with_details(
  text,
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
  uuid[],
  uuid[]
) to authenticated, service_role;

drop function if exists public.update_project_with_details(
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
  uuid[],
  uuid[]
);

create function public.update_project_with_details(
  p_project_id uuid,
  p_short_title text,
  p_title text,
  p_abstract text,
  p_role text,
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
  p_presentation_ids uuid[] default '{}'::uuid[],
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  if not private.can_edit_project(p_project_id) then
    raise exception 'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  update public.projects
  set
    short_title = btrim(p_short_title),
    title = btrim(p_title),
    abstract = btrim(p_abstract),
    role = nullif(btrim(p_role), ''),
    funder = btrim(p_funder),
    funder_note = nullif(btrim(p_funder_note), ''),
    url = nullif(btrim(p_url), ''),
    start_year = p_start_year,
    end_year = p_end_year,
    status = p_status
  where id = p_project_id;

  update public.project_public_metadata
  set
    visibility = p_visibility,
    slug = lower(nullif(btrim(p_slug), '')),
    featured = coalesce(p_featured, false),
    project_image_filename =
      nullif(btrim(p_project_image_filename), ''),
    funder_image_filename =
      nullif(btrim(p_funder_image_filename), '')
  where project_id = p_project_id;

  delete from public.project_papers
  where project_id = p_project_id;

  insert into public.project_papers (
    project_id,
    paper_id
  )
  select
    p_project_id,
    paper_id
  from (
    select distinct
      unnest(coalesce(p_paper_ids, '{}'::uuid[])) as paper_id
  ) links;

  delete from public.project_conference_presentations
  where project_id = p_project_id;

  insert into public.project_conference_presentations (
    project_id,
    presentation_id
  )
  select
    p_project_id,
    presentation_id
  from (
    select distinct
      unnest(coalesce(p_presentation_ids, '{}'::uuid[])) as presentation_id
  ) links;

  delete from public.project_activity_labels
  where project_id = p_project_id;

  insert into public.project_activity_labels (
    project_id,
    activity_label_id
  )
  select
    p_project_id,
    activity_label_id
  from (
    select distinct
      unnest(coalesce(p_activity_label_ids, '{}'::uuid[])) as activity_label_id
  ) links;

  return p_project_id;
end;
$$;

revoke all on function public.update_project_with_details(
  uuid,
  text,
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
  uuid[],
  uuid[]
) from public, anon, authenticated;

grant execute on function public.update_project_with_details(
  uuid,
  text,
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
  uuid[],
  uuid[]
) to authenticated, service_role;

drop function if exists public.list_public_projects();

create function public.list_public_projects()
returns table(
  slug text,
  short_title text,
  title text,
  abstract text,
  role text,
  funder text,
  funder_note text,
  url text,
  start_year integer,
  end_year integer,
  status text,
  featured boolean,
  project_image_filename text,
  funder_image_filename text,
  publication_slugs text[],
  conference_presentations jsonb
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
    p.role,
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
        on paper_meta.paper_id = paper.id
      where pp.project_id = p.id
        and paper_meta.visibility = 'public'
        and paper_meta.slug is not null
      order by
        paper.published_on desc nulls last,
        paper.title asc
    ) as publication_slugs,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'event_name', cp.event_name,
            'event_short_name', cp.event_short_name,
            'location', cp.location,
            'presentation_date', cp.start_date,
            'start_date', cp.start_date,
            'end_date', cp.end_date,
            'presentation_title', cp.presentation_title,
            'authors', cp.authors,
            'presentation_type', cp.presentation_type,
            'url', cp.url
          )
          order by
            cp.start_date desc,
            cp.event_name asc
        )
        from public.project_conference_presentations pcp
        join public.conference_presentations cp
          on cp.id = pcp.presentation_id
        where pcp.project_id = p.id
      ),
      '[]'::jsonb
    ) as conference_presentations
  from public.projects p
  join public.project_public_metadata ppm
    on ppm.project_id = p.id
  where ppm.visibility = 'public'
    and ppm.slug is not null
  order by
    case when p.status = 'active' then 0 else 1 end,
    p.title asc;
$$;

revoke all on function public.list_public_projects()
  from public, anon, authenticated;
grant execute on function public.list_public_projects()
  to anon, service_role;

drop function if exists public.get_public_project(text);

create function public.get_public_project(p_slug text)
returns table(
  slug text,
  short_title text,
  title text,
  abstract text,
  role text,
  funder text,
  funder_note text,
  url text,
  start_year integer,
  end_year integer,
  status text,
  featured boolean,
  project_image_filename text,
  funder_image_filename text,
  publication_slugs text[],
  conference_presentations jsonb
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
    p.role,
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
        on paper_meta.paper_id = paper.id
      where pp.project_id = p.id
        and paper_meta.visibility = 'public'
        and paper_meta.slug is not null
      order by
        paper.published_on desc nulls last,
        paper.title asc
    ) as publication_slugs,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'event_name', cp.event_name,
            'event_short_name', cp.event_short_name,
            'location', cp.location,
            'presentation_date', cp.start_date,
            'start_date', cp.start_date,
            'end_date', cp.end_date,
            'presentation_title', cp.presentation_title,
            'authors', cp.authors,
            'presentation_type', cp.presentation_type,
            'url', cp.url
          )
          order by
            cp.start_date desc,
            cp.event_name asc
        )
        from public.project_conference_presentations pcp
        join public.conference_presentations cp
          on cp.id = pcp.presentation_id
        where pcp.project_id = p.id
      ),
      '[]'::jsonb
    ) as conference_presentations
  from public.projects p
  join public.project_public_metadata ppm
    on ppm.project_id = p.id
  where ppm.visibility = 'public'
    and ppm.slug = lower(btrim(p_slug))
  limit 1;
$$;

revoke all on function public.get_public_project(text)
  from public, anon, authenticated;
grant execute on function public.get_public_project(text)
  to anon, service_role;
