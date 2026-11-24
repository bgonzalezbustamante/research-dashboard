-- Steady Orchard rc.6: database hardening.
--
-- Closes the leftover privileges and access checks found in the rc.6 review.
-- Row Level Security already protected every table involved; these changes
-- remove the privileges RLS was compensating for. No public RPC changes its
-- signature or fields.
--
-- 1. anon keeps no table privileges on dashboard_members and location_labels.
-- 2. authenticated loses TRUNCATE, REFERENCES and TRIGGER on six tables.
-- 3. Six private functions lose their PUBLIC EXECUTE grant.
-- 4. authenticated loses EXECUTE on the anon-only work analytics RPC, and the
--    two public trigger functions lose anon and authenticated EXECUTE
--    (triggers do not need it to fire).
-- 5. The superseded 14-argument teaching overloads are dropped.
-- 6. can_view_author and shares_paper_with_profile require active profiles
--    and no longer list the retired coauthor role.
-- 7. rename_managed_profile and finalize_managed_account_deletion only act on
--    accounts that no other dashboard uses.
-- 8. The public year checks use the Europe/Amsterdam date.

-- 1. anon table privileges ------------------------------------------------------------

revoke all
  on table public.dashboard_members, public.location_labels
  from anon;

-- 2. authenticated table privileges ---------------------------------------------------

revoke truncate, references, trigger
  on table
    public.planning_blocked_events,
    public.planning_source_period_states,
    public.teaching_settings,
    public.software_items,
    public.software_public_metadata,
    public.calendar_settings
  from authenticated;

-- 3. private functions ----------------------------------------------------------------
-- Schema usage on private is already limited to authenticated. The four helpers
-- that RLS policies call keep EXECUTE for authenticated; the two trigger
-- functions need no grant.

revoke all on function private.can_view_author(uuid) from public, anon;
revoke all on function private.shares_paper_with_profile(uuid) from public, anon;
revoke all on function private.can_use_author_for_paper(uuid, uuid) from public, anon;
revoke all on function private.resolve_author_for_paper(uuid, text) from public, anon;
revoke all on function private.preserve_paper_note_creator() from public, anon;
revoke all on function private.prevent_new_manual_paper_planning_allocations() from public, anon;

grant execute on function private.can_view_author(uuid) to authenticated;
grant execute on function private.shares_paper_with_profile(uuid) to authenticated;
grant execute on function private.can_use_author_for_paper(uuid, uuid) to authenticated;
grant execute on function private.resolve_author_for_paper(uuid, text) to authenticated;

-- 4. public functions -----------------------------------------------------------------
-- Supabase grants EXECUTE to anon and authenticated by default, so a revoke from
-- PUBLIC alone left these in place.

revoke execute
  on function public.get_public_work_analytics(integer)
  from authenticated;

revoke all
  on function public.normalise_location_label_default()
  from anon, authenticated;

revoke all
  on function public.handle_updated_at()
  from anon, authenticated;

-- 5. Superseded teaching overloads ----------------------------------------------------
-- 20261003074500 added the planning-aware versions and kept these until that
-- release was deployed. The app calls only the newer signatures.

drop function public.create_teaching_with_details(
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
  text,
  text,
  text,
  uuid[]
);

drop function public.update_teaching_with_details(
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
  text,
  text,
  text,
  uuid[]
);

-- 6. Active-profile checks ------------------------------------------------------------

create or replace function private.can_view_author(
  p_author_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.authors a
    where a.id = p_author_id
      and private.can_view_dashboard(a.owner_id)
  )
  or (
    private.is_active_profile(auth.uid())
    and exists (
      select 1
      from public.paper_authors pa
      join public.paper_members pm
        on pm.paper_id = pa.paper_id
      where pa.author_id = p_author_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'viewer')
    )
  );
$$;

create or replace function private.shares_paper_with_profile(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_profile(auth.uid())
    and private.is_active_profile(p_profile_id)
    and exists (
      select 1
      from public.paper_members mine
      join public.paper_members theirs
        on theirs.paper_id = mine.paper_id
      where mine.user_id = auth.uid()
        and mine.role in ('owner', 'viewer')
        and theirs.user_id = p_profile_id
    );
$$;

-- 7. Managed-account scope ------------------------------------------------------------

create or replace function private.rename_managed_profile(
  p_user_id uuid,
  p_full_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_full_name text := btrim(coalesce(p_full_name, ''));
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = v_owner_id then
    raise exception 'Select a different account to manage'
      using errcode = '22023';
  end if;

  if v_full_name = '' or char_length(v_full_name) > 160 then
    raise exception 'Enter a valid account name'
      using errcode = '22023';
  end if;

  -- Another Owner, or an account used by another dashboard, is not managed here.
  if not private.is_active_managed_profile(v_owner_id, p_user_id) then
    raise exception 'Managed account not found'
      using errcode = 'P0002';
  end if;

  update public.profiles
  set
    full_name = v_full_name,
    updated_at = now()
  where id = p_user_id
    and deactivated_at is null;

  if not found then
    raise exception 'Managed account not found'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function private.finalize_managed_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_note_count integer := 0;
  v_author_count integer := 0;
  v_preserve_profile boolean := false;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = v_owner_id then
    raise exception 'The dashboard owner account cannot be deleted here'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = p_user_id
      and dm.role = 'owner'
  ) or exists (
    select 1
    from public.papers p
    where p.owner_id = p_user_id
  ) then
    raise exception 'Owner accounts cannot be deleted from another dashboard'
      using errcode = '42501';
  end if;

  -- Same check as get_managed_account_deletion_plan, so the final step cannot
  -- run for an account that another dashboard still uses.
  if exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = p_user_id
      and dm.owner_id <> v_owner_id
  ) or exists (
    select 1
    from public.paper_members pm
    join public.papers p
      on p.id = pm.paper_id
    where pm.user_id = p_user_id
      and p.owner_id <> v_owner_id
  ) or exists (
    select 1
    from public.paper_website_editors pwe
    join public.papers p
      on p.id = pwe.paper_id
    where pwe.user_id = p_user_id
      and p.owner_id <> v_owner_id
  ) then
    raise exception 'This account is also used by another dashboard'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
  ) then
    raise exception 'Managed account not found'
      using errcode = 'P0002';
  end if;

  select count(*)
    into v_note_count
  from public.paper_notes n
  where n.created_by = p_user_id;

  select count(*)
    into v_author_count
  from public.authors a
  where a.created_by = p_user_id;

  delete from public.dashboard_members
  where owner_id = v_owner_id
    and user_id = p_user_id
    and role = 'viewer';

  delete from public.paper_website_editors pwe
  using public.papers p
  where pwe.paper_id = p.id
    and p.owner_id = v_owner_id
    and pwe.user_id = p_user_id;

  update public.access_invitations
  set
    status = case
      when status in ('pending', 'sent', 'failed') then 'cancelled'
      else status
    end,
    cancelled_at = case
      when status in ('pending', 'sent', 'failed') then coalesce(cancelled_at, now())
      else cancelled_at
    end,
    auth_user_id = null,
    updated_at = now()
  where owner_id = v_owner_id
    and auth_user_id = p_user_id;

  update public.authors
  set profile_id = null
  where profile_id = p_user_id;

  v_preserve_profile := private.profile_requires_preservation(p_user_id);

  if v_preserve_profile then
    update public.profiles
    set
      email = null,
      deactivated_at = coalesce(deactivated_at, now()),
      updated_at = now()
    where id = p_user_id;
  else
    delete from public.profiles
    where id = p_user_id;
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'note_count', v_note_count,
    'author_count', v_author_count,
    'profile_preserved', v_preserve_profile
  );
end;
$$;

-- 8. Public year checks in Europe/Amsterdam --------------------------------------------
-- Same bodies as the latest definitions (20261002092907 and 20261005112119);
-- only the current-year expression changes. Grants are kept by create or replace.

create or replace function public.get_public_work_analytics(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_year integer :=
    extract(year from (now() at time zone 'Europe/Amsterdam'))::integer;
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
      year from (now() at time zone 'Europe/Amsterdam')
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
  conference_events as (
    select
      cp.owner_id,
      cp.event_name,
      cp.event_short_name,
      cp.start_date,
      cp.end_date,
      bool_or(
        cp.personal_attendance
      ) as personal_attendance,
      bool_or(
        cp.involves_trip
      ) as involves_trip
    from public.conference_presentations cp
    join dashboard_owner owner
      on owner.owner_id = cp.owner_id
    group by
      cp.owner_id,
      cp.event_name,
      cp.event_short_name,
      cp.start_date,
      cp.end_date
  ),
  public_ranges as (
    select
      'trip'::text as type,
      greatest(
        ce.start_date - 1,
        v_year_start
      ) as start_date,
      least(
        ce.end_date + 1,
        v_year_end
      ) as end_date,
      ce.event_short_name as label
    from conference_events ce
    where ce.personal_attendance
      and ce.involves_trip
      and ce.start_date - 1 <= v_year_end
      and ce.end_date + 1 >= v_year_start

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

notify pgrst, 'reload schema';
