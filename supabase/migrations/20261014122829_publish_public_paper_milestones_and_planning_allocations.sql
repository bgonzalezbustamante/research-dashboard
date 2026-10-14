-- Additive Public Academic API endpoints for availability records.
-- All private database tables retain their existing RLS policies.
-- Intentionally return availability fields for the Dashboard owner, but never
-- reveal private Paper titles, internal IDs, notes or FlowSavvy metadata.
-- paper_slug is populated only for a Paper explicitly marked public.

create function public.list_public_paper_milestones()
returns table (
  target_date date,
  completed_on date,
  status text,
  committed_days integer,
  paper_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  with dashboard_owner as (
    select dm.owner_id
    from public.dashboard_members dm
    where dm.role = 'owner'
      and dm.user_id = dm.owner_id
    limit 1
  )
  select
    pm.target_date,
    pm.completed_on,
    pm.status,
    pm.committed_days,
    case
      when ppm.visibility = 'public'
        and ppm.slug is not null then ppm.slug
      else null
    end as paper_slug
  from public.paper_milestones pm
  join public.papers p
    on p.id = pm.paper_id
  join dashboard_owner owner
    on owner.owner_id = p.owner_id
  left join public.paper_public_metadata ppm
    on ppm.paper_id = p.id
  order by
    pm.target_date asc nulls last,
    pm.status asc,
    pm.id asc;
$$;

revoke all on function public.list_public_paper_milestones()
  from public, anon, authenticated;
grant execute on function public.list_public_paper_milestones()
  to anon, service_role;

create function public.list_public_planning_allocations()
returns table (
  period_start date,
  period_end date,
  allocation_type text,
  blocked_type text,
  committed_days integer,
  paper_slug text,
  superseded_by_milestone boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with dashboard_owner as (
    select dm.owner_id
    from public.dashboard_members dm
    where dm.role = 'owner'
      and dm.user_id = dm.owner_id
    limit 1
  )
  select
    pp.period_start,
    pp.period_end,
    pa.allocation_type,
    pa.blocked_type,
    pa.committed_days::integer,
    case
      when ppm.visibility = 'public'
        and ppm.slug is not null then ppm.slug
      else null
    end as paper_slug,
    case
      when pa.allocation_type = 'paper' then exists (
        select 1
        from public.paper_milestones pm
        where pm.paper_id = pa.paper_id
          and pm.status = 'planned'
          and pm.committed_days is not null
          and pm.target_date between pp.period_start and pp.period_end
      )
      else false
    end as superseded_by_milestone
  from public.planning_allocations pa
  join public.planning_periods pp
    on pp.id = pa.planning_period_id
  join dashboard_owner owner
    on owner.owner_id = pp.owner_id
  left join public.paper_public_metadata ppm
    on ppm.paper_id = pa.paper_id
  order by
    pp.period_start asc,
    pa.sort_order asc,
    pa.id asc;
$$;

revoke all on function public.list_public_planning_allocations()
  from public, anon, authenticated;
grant execute on function public.list_public_planning_allocations()
  to anon, service_role;
