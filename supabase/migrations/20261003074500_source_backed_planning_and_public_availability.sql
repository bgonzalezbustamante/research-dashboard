-- Rustic Peak rc.2:
-- extend Planning from milestone-backed research to source-backed conferences,
-- Teaching Portfolio commitments, and dated blocked events; expose a narrow
-- public availability projection for external timeline consumers.

alter table public.conference_presentations
  add column personal_attendance boolean not null default false,
  add column involves_trip boolean not null default false;

alter table public.conference_presentations
  add constraint conference_presentations_trip_requires_attendance
  check (
    not involves_trip
    or personal_attendance
  );

alter table public.teaching_portfolio
  add column planning_months integer[] not null default '{}'::integer[],
  add column committed_days_per_week smallint not null default 0;

alter table public.teaching_portfolio
  add constraint teaching_portfolio_planning_months_check
  check (
    planning_months <@ array[
      1, 2, 3, 4, 5, 6,
      7, 8, 9, 10, 11, 12
    ]::integer[]
    and cardinality(planning_months) <= 12
    and cardinality(planning_months) = (
      select count(distinct month_value)
      from unnest(planning_months) month_value
    )
  ),
  add constraint teaching_portfolio_committed_days_per_week_check
  check (
    committed_days_per_week in (0, 1, 2)
  );

create table public.planning_blocked_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.profiles(id)
    on delete cascade,
  event_type text not null,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint planning_blocked_events_type_check
    check (
      event_type in (
        'winter_holiday',
        'summer_holiday',
        'administrative',
        'sick'
      )
    ),

  constraint planning_blocked_events_date_range_check
    check (
      end_date >= start_date
    )
);

alter table public.planning_blocked_events
  enable row level security;

revoke all
  on table public.planning_blocked_events
  from public, anon;

grant select, insert, update, delete
  on table public.planning_blocked_events
  to authenticated, service_role;

create policy "Dashboard members can view planning blocked events"
  on public.planning_blocked_events
  for select
  to authenticated
  using (
    private.can_view_dashboard(owner_id)
  );

create policy "Dashboard owners can create planning blocked events"
  on public.planning_blocked_events
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard owners can update planning blocked events"
  on public.planning_blocked_events
  for update
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
  )
  with check (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard owners can delete planning blocked events"
  on public.planning_blocked_events
  for delete
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
  );

create index planning_blocked_events_owner_dates_idx
  on public.planning_blocked_events (
    owner_id,
    start_date,
    end_date
  );

create trigger planning_blocked_events_updated_at
before update
on public.planning_blocked_events
for each row
execute function public.handle_updated_at();

create table public.planning_source_period_states (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.profiles(id)
    on delete cascade,
  source_type text not null,
  source_id uuid not null,
  period_start date not null,
  flowsavvy_added boolean not null default false,
  flowsavvy_added_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint planning_source_period_states_source_type_check
    check (
      source_type in (
        'conference',
        'teaching',
        'blocked_event'
      )
    ),

  constraint planning_source_period_states_period_start_check
    check (
      extract(day from period_start) in (1, 16)
    ),

  constraint planning_source_period_states_flowsavvy_timestamp_check
    check (
      (
        flowsavvy_added
        and flowsavvy_added_at is not null
      )
      or
      (
        not flowsavvy_added
        and flowsavvy_added_at is null
      )
    ),

  constraint planning_source_period_states_unique
    unique (
      owner_id,
      source_type,
      source_id,
      period_start
    )
);

alter table public.planning_source_period_states
  enable row level security;

revoke all
  on table public.planning_source_period_states
  from public, anon;

grant select, insert, update, delete
  on table public.planning_source_period_states
  to authenticated, service_role;

create or replace function private.validate_planning_source_period_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  case new.source_type
    when 'conference' then
      select cp.owner_id
      into v_owner_id
      from public.conference_presentations cp
      where cp.id = new.source_id;

    when 'teaching' then
      select tp.owner_id
      into v_owner_id
      from public.teaching_portfolio tp
      where tp.id = new.source_id;

    when 'blocked_event' then
      select pbe.owner_id
      into v_owner_id
      from public.planning_blocked_events pbe
      where pbe.id = new.source_id;
  end case;

  if v_owner_id is null then
    raise exception
      'Planning source does not exist'
      using errcode = '23503';
  end if;

  if v_owner_id <> new.owner_id then
    raise exception
      'Planning source and state must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_planning_source_period_state()
  from public, anon, authenticated;

create trigger validate_planning_source_period_state
before insert or update
on public.planning_source_period_states
for each row
execute function private.validate_planning_source_period_state();

create policy "Dashboard members can view planning source states"
  on public.planning_source_period_states
  for select
  to authenticated
  using (
    private.can_view_dashboard(owner_id)
  );

create policy "Dashboard owners can create planning source states"
  on public.planning_source_period_states
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard owners can update planning source states"
  on public.planning_source_period_states
  for update
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
  )
  with check (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard owners can delete planning source states"
  on public.planning_source_period_states
  for delete
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
  );

create index planning_source_period_states_owner_period_idx
  on public.planning_source_period_states (
    owner_id,
    period_start
  );

create trigger planning_source_period_states_updated_at
before update
on public.planning_source_period_states
for each row
execute function public.handle_updated_at();

create or replace function private.clear_planning_source_period_states()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.planning_source_period_states pss
  where pss.source_type = tg_argv[0]
    and pss.source_id = old.id;

  return old;
end;
$$;

revoke all
  on function private.clear_planning_source_period_states()
  from public, anon, authenticated;

create or replace function private.reset_planning_source_period_states()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.planning_source_period_states pss
  where pss.source_type = tg_argv[0]
    and pss.source_id = new.id;

  return new;
end;
$$;

revoke all
  on function private.reset_planning_source_period_states()
  from public, anon, authenticated;

create trigger clear_conference_planning_states
after delete
on public.conference_presentations
for each row
execute function private.clear_planning_source_period_states('conference');

create trigger reset_conference_planning_states
after update of
  start_date,
  end_date,
  personal_attendance,
  involves_trip
on public.conference_presentations
for each row
when (
  old.start_date is distinct from new.start_date
  or old.end_date is distinct from new.end_date
  or old.personal_attendance is distinct from new.personal_attendance
  or old.involves_trip is distinct from new.involves_trip
)
execute function private.reset_planning_source_period_states('conference');

create trigger clear_teaching_planning_states
after delete
on public.teaching_portfolio
for each row
execute function private.clear_planning_source_period_states('teaching');

create trigger reset_teaching_planning_states
after update of
  start_year,
  end_year,
  is_current,
  planning_months,
  committed_days_per_week
on public.teaching_portfolio
for each row
when (
  old.start_year is distinct from new.start_year
  or old.end_year is distinct from new.end_year
  or old.is_current is distinct from new.is_current
  or old.planning_months is distinct from new.planning_months
  or old.committed_days_per_week is distinct from new.committed_days_per_week
)
execute function private.reset_planning_source_period_states('teaching');

create trigger clear_blocked_event_planning_states
after delete
on public.planning_blocked_events
for each row
execute function private.clear_planning_source_period_states('blocked_event');

create trigger reset_blocked_event_planning_states
after update of
  event_type,
  start_date,
  end_date
on public.planning_blocked_events
for each row
when (
  old.event_type is distinct from new.event_type
  or old.start_date is distinct from new.start_date
  or old.end_date is distinct from new.end_date
)
execute function private.reset_planning_source_period_states('blocked_event');

-- New Teaching RPC overloads add Planning metadata while preserving the
-- previous overloads until this release is fully deployed.

create function public.create_teaching_with_details(
  p_name text,
  p_institution text,
  p_summary text,
  p_role text,
  p_start_year integer,
  p_end_year integer,
  p_is_current boolean,
  p_levels text[],
  p_times_taught integer,
  p_student_count integer,
  p_planning_months integer[],
  p_committed_days_per_week integer,
  p_visibility text,
  p_slug text,
  p_course_image_filename text,
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_teaching_id uuid;
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

  insert into public.teaching_portfolio (
    owner_id,
    name,
    institution,
    summary,
    role,
    start_year,
    end_year,
    is_current,
    levels,
    times_taught,
    student_count,
    planning_months,
    committed_days_per_week
  )
  values (
    v_owner_id,
    btrim(p_name),
    btrim(p_institution),
    btrim(p_summary),
    nullif(btrim(p_role), ''),
    p_start_year,
    case
      when coalesce(p_is_current, false)
        then null
      else p_end_year
    end,
    coalesce(p_is_current, false),
    p_levels,
    p_times_taught,
    p_student_count,
    coalesce(p_planning_months, '{}'::integer[]),
    p_committed_days_per_week
  )
  returning id
  into v_teaching_id;

  update public.teaching_public_metadata
  set
    visibility = p_visibility,
    slug = lower(
      nullif(
        btrim(p_slug),
        ''
      )
    ),
    course_image_filename =
      nullif(
        btrim(
          p_course_image_filename
        ),
        ''
      )
  where teaching_id =
    v_teaching_id;

  insert into public.teaching_activity_labels (
    teaching_id,
    activity_label_id
  )
  select
    v_teaching_id,
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

  return v_teaching_id;
end;
$$;

create function public.update_teaching_with_details(
  p_teaching_id uuid,
  p_name text,
  p_institution text,
  p_summary text,
  p_role text,
  p_start_year integer,
  p_end_year integer,
  p_is_current boolean,
  p_levels text[],
  p_times_taught integer,
  p_student_count integer,
  p_planning_months integer[],
  p_committed_days_per_week integer,
  p_visibility text,
  p_slug text,
  p_course_image_filename text,
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.can_edit_teaching(
    p_teaching_id
  ) then
    raise exception 'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  update public.teaching_portfolio
  set
    name = btrim(p_name),
    institution = btrim(p_institution),
    summary = btrim(p_summary),
    role = nullif(btrim(p_role), ''),
    start_year = p_start_year,
    end_year =
      case
        when coalesce(
          p_is_current,
          false
        )
          then null
        else p_end_year
      end,
    is_current =
      coalesce(
        p_is_current,
        false
      ),
    levels = p_levels,
    times_taught = p_times_taught,
    student_count = p_student_count,
    planning_months =
      coalesce(
        p_planning_months,
        '{}'::integer[]
      ),
    committed_days_per_week =
      p_committed_days_per_week
  where id = p_teaching_id;

  update public.teaching_public_metadata
  set
    visibility = p_visibility,
    slug = lower(
      nullif(
        btrim(p_slug),
        ''
      )
    ),
    course_image_filename =
      nullif(
        btrim(
          p_course_image_filename
        ),
        ''
      )
  where teaching_id =
    p_teaching_id;

  delete from public.teaching_activity_labels
  where teaching_id =
    p_teaching_id;

  insert into public.teaching_activity_labels (
    teaching_id,
    activity_label_id
  )
  select
    p_teaching_id,
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

  return p_teaching_id;
end;
$$;

revoke all
  on function public.create_teaching_with_details(
    text,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text[],
    integer,
    integer,
    integer[],
    integer,
    text,
    text,
    text,
    uuid[]
  )
  from public, anon;

revoke all
  on function public.update_teaching_with_details(
    uuid,
    text,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text[],
    integer,
    integer,
    integer[],
    integer,
    text,
    text,
    text,
    uuid[]
  )
  from public, anon;

grant execute
  on function public.create_teaching_with_details(
    text,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text[],
    integer,
    integer,
    integer[],
    integer,
    text,
    text,
    text,
    uuid[]
  )
  to authenticated, service_role;

grant execute
  on function public.update_teaching_with_details(
    uuid,
    text,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text[],
    integer,
    integer,
    integer[],
    integer,
    text,
    text,
    text,
    uuid[]
  )
  to authenticated, service_role;

-- Conference public contract: personal attendance and trip status are public.
drop function if exists public.list_public_conference_presentations();

create function public.list_public_conference_presentations()
returns table (
  event_name text,
  event_short_name text,
  location text,
  presentation_date date,
  start_date date,
  end_date date,
  personal_attendance boolean,
  involves_trip boolean,
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
    cp.personal_attendance,
    cp.involves_trip,
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
  'Anonymous-safe conference presentation listing with event date ranges, personal attendance, and trip status. presentation_date remains a deprecated alias for start_date. Notes, owner, and optional linked paper remain private.';

revoke all
  on function public.list_public_conference_presentations()
  from public, authenticated;

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
  personal_attendance boolean,
  involves_trip boolean,
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
    cp.personal_attendance,
    cp.involves_trip,
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
  'Authenticated read-only conference presentation summaries for an accessible linked paper, including event dates, personal attendance, and trip status. Private conference notes and owner metadata are excluded.';

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
            'personal_attendance', cp.personal_attendance,
            'involves_trip', cp.involves_trip,
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
            'personal_attendance', cp.personal_attendance,
            'involves_trip', cp.involves_trip,
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

-- Public availability is deliberately narrower than internal Planning.
-- Sick records are projected only as generic unavailable ranges; notes and
-- internal event IDs are never exposed. Administrative commitments stay private.
create function public.list_public_availability(
  p_year integer
)
returns table (
  type text,
  start_date date,
  end_date date,
  label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_year_start date;
  v_year_end date;
  v_current_year integer;
begin
  v_current_year :=
    extract(
      year from current_date
    )::integer;

  if p_year < 2000
     or p_year > v_current_year + 5 then
    raise exception
      'Year must be between 2000 and five years after the current calendar year';
  end if;

  v_year_start :=
    make_date(
      p_year,
      1,
      1
    );

  v_year_end :=
    make_date(
      p_year,
      12,
      31
    );

  return query
  with public_ranges as (
    select
      'trip'::text as type,
      greatest(
        cp.start_date - 1,
        v_year_start
      ) as start_date,
      least(
        cp.end_date + 1,
        v_year_end
      ) as end_date,
      cp.event_short_name as label
    from public.conference_presentations cp
    where cp.personal_attendance
      and cp.involves_trip
      and cp.start_date - 1 <= v_year_end
      and cp.end_date + 1 >= v_year_start

    union all

    select
      case pbe.event_type
        when 'winter_holiday'
          then 'winter_holiday'
        when 'summer_holiday'
          then 'summer_holiday'
        when 'sick'
          then 'unavailable'
      end as type,
      greatest(
        pbe.start_date,
        v_year_start
      ) as start_date,
      least(
        pbe.end_date,
        v_year_end
      ) as end_date,
      case pbe.event_type
        when 'winter_holiday'
          then 'Winter holiday'
        when 'summer_holiday'
          then 'Summer holiday'
        when 'sick'
          then 'Unavailable'
      end as label
    from public.planning_blocked_events pbe
    where pbe.event_type in (
        'winter_holiday',
        'summer_holiday',
        'sick'
      )
      and pbe.start_date <= v_year_end
      and pbe.end_date >= v_year_start
  )
  select
    public_ranges.type,
    public_ranges.start_date,
    public_ranges.end_date,
    public_ranges.label
  from public_ranges
  order by
    public_ranges.start_date asc,
    public_ranges.end_date asc,
    public_ranges.type asc,
    public_ranges.label asc;
end;
$$;

comment on function public.list_public_availability(integer) is
  'Anonymous-safe yearly availability projection for public timeline consumers: conference trips, winter/summer holidays, and generic unavailable ranges. Administrative commitments, sickness labels, notes, source IDs, and owner metadata remain private.';

revoke all
  on function public.list_public_availability(integer)
  from public, authenticated;

grant execute
  on function public.list_public_availability(integer)
  to anon, service_role;
