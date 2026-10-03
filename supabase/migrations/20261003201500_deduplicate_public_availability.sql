-- Rustic Peak rc.2:
-- collapse identical anonymous-safe availability projections produced by
-- multiple source records, while preserving the strict consumer contract.

create or replace function public.list_public_availability(
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
  with dashboard_owner as (
    select dm.owner_id
    from public.dashboard_members dm
    where dm.role = 'owner'
      and dm.owner_id = dm.user_id
    limit 1
  ),
  public_ranges as (
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
    join dashboard_owner owner
      on owner.owner_id = cp.owner_id
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
    join dashboard_owner owner
      on owner.owner_id = pbe.owner_id
    where pbe.event_type in (
        'winter_holiday',
        'summer_holiday',
        'sick'
      )
      and pbe.start_date <= v_year_end
      and pbe.end_date >= v_year_start
  )
  select distinct
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
  'Anonymous-safe yearly availability projection for public timeline consumers: conference trips, winter/summer holidays, and generic unavailable ranges. Identical public ranges from multiple source records are collapsed. Administrative commitments, sickness labels, notes, source IDs, and owner metadata remain private.';
