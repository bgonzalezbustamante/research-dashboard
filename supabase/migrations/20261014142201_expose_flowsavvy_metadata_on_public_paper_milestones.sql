-- Add FlowSavvy state to the public, read-only Paper milestones RPC.
-- A change to RETURNS TABLE requires recreation of the function.
-- Unpublished Paper names and identifiers remain concealed.

drop function public.list_public_paper_milestones();

create function public.list_public_paper_milestones()
returns table (
  target_date date,
  completed_on date,
  status text,
  committed_days integer,
  paper_slug text,
  flowsavvy_added boolean,
  flowsavvy_added_at timestamptz
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
    end as paper_slug,
    pm.flowsavvy_added,
    pm.flowsavvy_added_at
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

notify pgrst, 'reload schema';
