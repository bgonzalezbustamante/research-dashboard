-- Distant Forge rc.1 follow-up:
-- allow Teaching Portfolio items to span more than one academic level.

drop function if exists public.list_public_teaching();

drop function if exists public.create_teaching_with_details(
  text,
  text,
  text,
  integer,
  integer,
  boolean,
  text,
  integer,
  integer,
  text,
  text,
  text,
  uuid[]
);

drop function if exists public.update_teaching_with_details(
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  boolean,
  text,
  integer,
  integer,
  text,
  text,
  text,
  uuid[]
);

alter table public.teaching_portfolio
  drop constraint teaching_portfolio_level_check;

alter table public.teaching_portfolio
  alter column level type text[]
  using array[level];

alter table public.teaching_portfolio
  rename column level to levels;

alter table public.teaching_portfolio
  add constraint teaching_portfolio_levels_check
  check (
    cardinality(levels) between 1 and 3
    and levels <@
      array[
        'undergraduate',
        'master',
        'phd'
      ]::text[]
  );

comment on column public.teaching_portfolio.levels is
  'One or more academic levels: undergraduate, master, and/or phd.';

create function public.create_teaching_with_details(
  p_name text,
  p_institution text,
  p_summary text,
  p_start_year integer,
  p_end_year integer,
  p_is_current boolean,
  p_levels text[],
  p_times_taught integer,
  p_student_count integer,
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
    start_year,
    end_year,
    is_current,
    levels,
    times_taught,
    student_count
  )
  values (
    v_owner_id,
    btrim(p_name),
    btrim(p_institution),
    btrim(p_summary),
    p_start_year,
    case
      when coalesce(p_is_current, false)
        then null
      else p_end_year
    end,
    coalesce(p_is_current, false),
    p_levels,
    p_times_taught,
    p_student_count
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
  p_start_year integer,
  p_end_year integer,
  p_is_current boolean,
  p_levels text[],
  p_times_taught integer,
  p_student_count integer,
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
    student_count = p_student_count
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
    integer,
    integer,
    boolean,
    text[],
    integer,
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
    integer,
    integer,
    boolean,
    text[],
    integer,
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
    integer,
    integer,
    boolean,
    text[],
    integer,
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
    integer,
    integer,
    boolean,
    text[],
    integer,
    integer,
    text,
    text,
    text,
    uuid[]
  )
  to authenticated, service_role;

create function public.list_public_teaching()
returns table (
  slug text,
  name text,
  institution text,
  summary text,
  start_year integer,
  end_year integer,
  is_current boolean,
  levels text[],
  times_taught integer,
  student_count integer,
  course_image_filename text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tpm.slug,
    tp.name,
    tp.institution,
    tp.summary,
    tp.start_year,
    tp.end_year,
    tp.is_current,
    tp.levels,
    tp.times_taught,
    tp.student_count,
    tpm.course_image_filename
  from public.teaching_portfolio tp
  join public.teaching_public_metadata tpm
    on tpm.teaching_id = tp.id
  where tpm.visibility = 'public'
  order by
    tp.is_current desc,
    tp.start_year desc,
    tp.name asc;
$$;

comment on function public.list_public_teaching() is
  'Anonymous-safe listing of explicitly Public Teaching Portfolio items for academic-website cards, including one or more academic levels. Activity labels, tracked hours, sessions, owner metadata, and internal IDs remain private.';

revoke all
  on function public.list_public_teaching()
  from public, authenticated;

grant execute
  on function public.list_public_teaching()
  to anon, service_role;
