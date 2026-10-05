-- Bold Ridge rc.3:
-- add an owner-level Catholic Calendar feature flag and expose it through
-- the anonymous-safe Academic API without exposing the underlying settings table.

create table public.calendar_settings (
  owner_id uuid primary key
    references public.profiles(id)
    on delete cascade,
  catholic_calendar_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.calendar_settings is
  'Dashboard-only owner-level Catholic Calendar settings. Public consumers receive only the curated activation boolean through get_public_calendar_settings().';

alter table public.calendar_settings
  enable row level security;

revoke all
  on table public.calendar_settings
  from public, anon;

grant select, insert, update
  on table public.calendar_settings
  to authenticated, service_role;

create policy "Dashboard members can view Calendar settings"
  on public.calendar_settings
  for select
  to authenticated
  using (
    private.can_view_dashboard(owner_id)
  );

create policy "Dashboard owners can create Calendar settings"
  on public.calendar_settings
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard owners can update Calendar settings"
  on public.calendar_settings
  for update
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
  )
  with check (
    private.is_dashboard_owner(owner_id)
  );

create trigger calendar_settings_updated_at
before update
on public.calendar_settings
for each row
execute function public.handle_updated_at();

insert into public.calendar_settings (
  owner_id
)
select dm.owner_id
from public.dashboard_members dm
where dm.role = 'owner'
  and dm.owner_id = dm.user_id
on conflict (owner_id)
do nothing;

create function public.get_public_calendar_settings()
returns table (
  catholic_calendar_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      (
        select
          cs.catholic_calendar_active
        from public.calendar_settings cs
        join public.dashboard_members dm
          on dm.owner_id = cs.owner_id
        where dm.role = 'owner'
          and dm.owner_id = dm.user_id
        limit 1
      ),
      false
    ) as catholic_calendar_active;
$$;

comment on function public.get_public_calendar_settings() is
  'Anonymous-safe owner-level Catholic Calendar settings. Returns only whether the public Calendar integration is active.';

revoke all
  on function public.get_public_calendar_settings()
  from public, authenticated;

grant execute
  on function public.get_public_calendar_settings()
  to anon, service_role;
