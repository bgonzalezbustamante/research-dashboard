-- Distant Forge rc.2:
-- expose daily coffee counts alongside daily net working minutes
-- in the existing anonymous-safe yearly work analytics RPC.

create or replace function public.get_public_work_analytics(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_year integer :=
    extract(year from current_date)::integer;
  v_result jsonb;
begin
  if p_year < 2000
     or p_year > v_current_year then
    raise exception 'Year must be between 2000 and %', v_current_year
      using errcode = '22023';
  end if;

  with dashboard_owner as (
    select dm.owner_id
    from public.dashboard_members dm
    where dm.role = 'owner'
      and dm.owner_id = dm.user_id
    limit 1
  ),
  year_logs as (
    select
      dl.id,
      dl.log_date,
      dl.coffee_count
    from public.daily_logs dl
    join dashboard_owner owner
      on owner.owner_id = dl.owner_id
    where dl.log_date >= make_date(p_year, 1, 1)
      and dl.log_date < make_date(p_year + 1, 1, 1)
  ),
  daily_work as (
    select
      yl.id,
      yl.log_date,
      yl.coffee_count,
      count(ws.id) as session_count,
      coalesce(
        sum(
          case
            when ws.id is null
              or al.is_break then 0
            else (
              extract(
                epoch from (
                  ws.end_time -
                  ws.start_time
                )
              ) / 60
            )::integer
          end
        ),
        0
      )::integer as net_minutes
    from year_logs yl
    left join public.work_sessions ws
      on ws.daily_log_id = yl.id
    left join public.activity_labels al
      on al.id = ws.activity_label_id
    group by
      yl.id,
      yl.log_date,
      yl.coffee_count
  ),
  summary as (
    select
      coalesce(
        sum(dw.net_minutes),
        0
      )::integer as net_minutes,
      coalesce(
        sum(dw.coffee_count),
        0
      )::integer as coffee_count,
      count(*) filter (
        where dw.session_count > 0
      )::integer as working_days
    from daily_work dw
  ),
  calendar_days as (
    select
      day::date as date
    from generate_series(
      make_date(p_year, 1, 1)::timestamp,
      make_date(p_year, 12, 31)::timestamp,
      interval '1 day'
    ) as day
  )
  select jsonb_build_object(
    'year',
    p_year,
    'average_net_minutes_per_working_day',
    case
      when s.working_days > 0 then
        round(
          s.net_minutes::numeric /
          s.working_days
        )::integer
      else 0
    end,
    'average_coffees_per_working_day',
    case
      when s.working_days > 0 then
        round(
          s.coffee_count::numeric /
          s.working_days,
          2
        )
      else 0::numeric
    end,
    'days',
    (
      select jsonb_agg(
        jsonb_build_object(
          'date',
          cd.date,
          'net_minutes',
          coalesce(
            dw.net_minutes,
            0
          ),
          'coffee_count',
          coalesce(
            dw.coffee_count,
            0
          )
        )
        order by cd.date
      )
      from calendar_days cd
      left join daily_work dw
        on dw.log_date = cd.date
    )
  )
  into v_result
  from summary s;

  return v_result;
end;
$$;

comment on function public.get_public_work_analytics(integer) is
  'Anonymous-safe yearly work analytics: daily net minutes and coffee counts, plus average net minutes and coffees per working day.';

revoke all
  on function public.get_public_work_analytics(integer)
  from public;

grant execute
  on function public.get_public_work_analytics(integer)
  to anon, service_role;
