-- Distant Forge rc.1 follow-up:
-- replace single conference dates with start/end ranges and constrain presentation types.

alter table public.conference_presentations
  add column start_date date,
  add column end_date date;

update public.conference_presentations
set
  start_date = presentation_date,
  end_date = presentation_date
where start_date is null
   or end_date is null;

alter table public.conference_presentations
  alter column start_date set not null,
  alter column end_date set not null,
  alter column presentation_type set not null;

alter table public.conference_presentations
  add constraint conference_presentations_date_range_check
  check (
    end_date >= start_date
  );

alter table public.conference_presentations
  add constraint conference_presentations_type_check
  check (
    presentation_type in (
      'Conference paper',
      'Keynote',
      'Workshop'
    )
  );

create or replace function private.sync_conference_date_range()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.start_date is null then
      new.start_date :=
        new.presentation_date;
    end if;

    if new.end_date is null then
      new.end_date :=
        new.start_date;
    end if;

    new.presentation_date :=
      new.start_date;

    return new;
  end if;

  if new.start_date is distinct from old.start_date then
    new.presentation_date :=
      new.start_date;
  elsif new.presentation_date is distinct from old.presentation_date then
    new.start_date :=
      new.presentation_date;

    if new.end_date is not distinct from old.end_date then
      new.end_date :=
        new.presentation_date;
    end if;
  else
    new.presentation_date :=
      new.start_date;
  end if;

  return new;
end;
$$;

revoke all
  on function private.sync_conference_date_range()
  from public, anon, authenticated;

drop trigger if exists sync_conference_date_range
  on public.conference_presentations;

create trigger sync_conference_date_range
before insert or update of
  presentation_date,
  start_date,
  end_date
on public.conference_presentations
for each row
execute function private.sync_conference_date_range();

drop function if exists public.list_public_conference_presentations();

create function public.list_public_conference_presentations()
returns table (
  event_name text,
  event_short_name text,
  location text,
  presentation_date date,
  start_date date,
  end_date date,
  presentation_title text,
  authors text[],
  presentation_type text,
  url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.event_name,
    cp.event_short_name,
    cp.location,
    cp.start_date as presentation_date,
    cp.start_date,
    cp.end_date,
    cp.presentation_title,
    cp.authors,
    cp.presentation_type,
    cp.url
  from public.conference_presentations cp
  order by
    cp.start_date desc,
    cp.event_name asc;
$$;

comment on function public.list_public_conference_presentations() is
  'Anonymous-safe conference presentation listing with start/end event dates. presentation_date is retained temporarily as a deprecated alias for start_date. Notes, owner, and optional linked paper are deliberately excluded.';

revoke all
  on function public.list_public_conference_presentations()
  from public;

grant execute
  on function public.list_public_conference_presentations()
  to anon, service_role;

drop function if exists public.list_paper_conference_presentations(uuid);

create function public.list_paper_conference_presentations(
  p_paper_id uuid
)
returns table (
  id uuid,
  event_name text,
  event_short_name text,
  location text,
  presentation_date date,
  start_date date,
  end_date date,
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
    cp.start_date as presentation_date,
    cp.start_date,
    cp.end_date,
    cp.presentation_title,
    cp.authors,
    cp.presentation_type,
    cp.url
  from public.conference_presentations cp
  where cp.paper_id = p_paper_id
  order by
    cp.start_date desc,
    cp.event_name asc;
end;
$$;

comment on function public.list_paper_conference_presentations(uuid) is
  'Authenticated read-only conference presentation summaries for an accessible linked paper, including event date ranges. Private conference notes and owner metadata are excluded.';

revoke all
  on function public.list_paper_conference_presentations(uuid)
  from public, anon;

grant execute
  on function public.list_paper_conference_presentations(uuid)
  to authenticated, service_role;

create or replace function public.list_public_projects()
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

create or replace function public.get_public_project(
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

comment on function public.list_public_projects() is
  'Anonymous-safe listing of explicitly Public projects with public-safe associated publication slugs and conference presentation metadata, including event date ranges. Internal presentation IDs, paper links, notes, owner metadata, activity labels, and work-session detail remain private.';

comment on function public.get_public_project(text) is
  'Anonymous-safe Public project lookup with public-safe associated publication slugs and conference presentation metadata, including event date ranges. Internal presentation IDs, paper links, notes, owner metadata, activity labels, and work-session detail remain private.';
