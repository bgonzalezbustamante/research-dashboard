alter table public.paper_milestones
  add column committed_days integer,
  add column flowsavvy_added boolean not null default false,
  add column flowsavvy_added_at timestamptz;

alter table public.paper_milestones
  add constraint paper_milestones_committed_days_check
    check (
      committed_days is null
      or committed_days in (5, 10, 15)
    ),
  add constraint paper_milestones_capacity_requires_target_date
    check (
      committed_days is null
      or target_date is not null
    ),
  add constraint paper_milestones_flowsavvy_requires_capacity
    check (
      not flowsavvy_added
      or committed_days is not null
    ),
  add constraint paper_milestones_flowsavvy_timestamp_check
    check (
      (
        flowsavvy_added
        and flowsavvy_added_at is not null
      )
      or (
        not flowsavvy_added
        and flowsavvy_added_at is null
      )
    );

create index paper_milestones_planning_target_idx
  on public.paper_milestones (target_date, paper_id)
  where status = 'planned'
    and committed_days is not null;

create or replace function private.prevent_new_manual_paper_planning_allocations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.allocation_type = 'paper' then
    raise exception
      'New paper planning allocations must be created through paper milestones.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_new_manual_paper_planning_allocations
  on public.planning_allocations;

create trigger prevent_new_manual_paper_planning_allocations
before insert on public.planning_allocations
for each row
execute function private.prevent_new_manual_paper_planning_allocations();
