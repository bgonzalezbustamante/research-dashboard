-- Distant Forge rc.1 follow-up:
-- link Projects to existing conference presentations and expose only public-safe presentation metadata.

create table public.project_conference_presentations (
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  presentation_id uuid not null
    references public.conference_presentations(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (
    project_id,
    presentation_id
  )
);

alter table public.project_conference_presentations
  enable row level security;

revoke all
  on table public.project_conference_presentations
  from public, anon, authenticated;

grant select, insert, delete
  on table public.project_conference_presentations
  to authenticated;

create or replace function private.validate_project_conference_presentation_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_owner uuid;
  v_presentation_owner uuid;
begin
  select p.owner_id
  into v_project_owner
  from public.projects p
  where p.id = new.project_id;

  select cp.owner_id
  into v_presentation_owner
  from public.conference_presentations cp
  where cp.id = new.presentation_id;

  if v_project_owner is null
     or v_presentation_owner is null
     or v_project_owner <> v_presentation_owner then
    raise exception
      'Project and conference presentation must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_project_conference_presentation_link()
  from public, anon, authenticated;

create trigger validate_project_conference_presentation_link
before insert or update
on public.project_conference_presentations
for each row
execute function private.validate_project_conference_presentation_link();

create policy "Dashboard members can view project conference presentations"
  on public.project_conference_presentations
  for select
  to authenticated
  using (
    private.can_view_project(
      project_id
    )
  );

create policy "Dashboard owners can link project conference presentations"
  on public.project_conference_presentations
  for insert
  to authenticated
  with check (
    private.can_edit_project(
      project_id
    )
  );

create policy "Dashboard owners can unlink project conference presentations"
  on public.project_conference_presentations
  for delete
  to authenticated
  using (
    private.can_edit_project(
      project_id
    )
  );

create index project_conference_presentations_presentation_idx
  on public.project_conference_presentations (
    presentation_id
  );

drop function if exists public.create_project_with_details(
  text, text, text, text, text, text,
  integer, integer,
  text, text, text, boolean,
  text, text,
  uuid[], uuid[]
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
  p_presentation_ids uuid[] default '{}'::uuid[],
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

drop function if exists public.update_project_with_details(
  uuid,
  text, text, text, text, text, text,
  integer, integer,
  text, text, text, boolean,
  text, text,
  uuid[], uuid[]
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
  p_presentation_ids uuid[] default '{}'::uuid[],
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
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

revoke all
  on function public.create_project_with_details(
    text, text, text, text, text, text,
    integer, integer,
    text, text, text, boolean,
    text, text,
    uuid[], uuid[], uuid[]
  )
  from public, anon;

revoke all
  on function public.update_project_with_details(
    uuid,
    text, text, text, text, text, text,
    integer, integer,
    text, text, text, boolean,
    text, text,
    uuid[], uuid[], uuid[]
  )
  from public, anon;

grant execute
  on function public.create_project_with_details(
    text, text, text, text, text, text,
    integer, integer,
    text, text, text, boolean,
    text, text,
    uuid[], uuid[], uuid[]
  )
  to authenticated, service_role;

grant execute
  on function public.update_project_with_details(
    uuid,
    text, text, text, text, text, text,
    integer, integer,
    text, text, text, boolean,
    text, text,
    uuid[], uuid[], uuid[]
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
            'presentation_date', cp.presentation_date,
            'presentation_title', cp.presentation_title,
            'authors', cp.authors,
            'presentation_type', cp.presentation_type,
            'url', cp.url
          )
          order by
            cp.presentation_date desc nulls last,
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
            'presentation_date', cp.presentation_date,
            'presentation_title', cp.presentation_title,
            'authors', cp.authors,
            'presentation_type', cp.presentation_type,
            'url', cp.url
          )
          order by
            cp.presentation_date desc nulls last,
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

comment on function public.list_public_projects() is
  'Anonymous-safe listing of explicitly Public projects with public-safe associated publication slugs and conference presentation metadata. Internal presentation IDs, paper links, notes, owner metadata, activity labels, and work-session detail remain private.';

comment on function public.get_public_project(text) is
  'Anonymous-safe Public project lookup with public-safe associated publication slugs and conference presentation metadata. Internal presentation IDs, paper links, notes, owner metadata, activity labels, and work-session detail remain private.';

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
