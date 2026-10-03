-- Rustic Peak rc.2:
-- add an owner-level Teaching season status and expose it through the
-- anonymous-safe Academic API without exposing the underlying settings table.

create table public.teaching_settings (
  owner_id uuid primary key
    references public.profiles(id)
    on delete cascade,
  teaching_season_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teaching_settings is
  'Dashboard-only owner-level Teaching settings. Public consumers receive only the curated Teaching season boolean through get_public_teaching_settings().';

alter table public.teaching_settings
  enable row level security;

revoke all
  on table public.teaching_settings
  from public, anon;

grant select, insert, update
  on table public.teaching_settings
  to authenticated, service_role;

create policy "Dashboard members can view Teaching settings"
  on public.teaching_settings
  for select
  to authenticated
  using (
    private.can_view_dashboard(owner_id)
  );

create policy "Dashboard owners can create Teaching settings"
  on public.teaching_settings
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard owners can update Teaching settings"
  on public.teaching_settings
  for update
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
  )
  with check (
    private.is_dashboard_owner(owner_id)
  );

create trigger teaching_settings_updated_at
before update
on public.teaching_settings
for each row
execute function public.handle_updated_at();

insert into public.teaching_settings (
  owner_id
)
select dm.owner_id
from public.dashboard_members dm
where dm.role = 'owner'
  and dm.owner_id = dm.user_id
on conflict (owner_id)
do nothing;

create function public.get_public_teaching_settings()
returns table (
  teaching_season_active boolean
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
          ts.teaching_season_active
        from public.teaching_settings ts
        join public.dashboard_members dm
          on dm.owner_id = ts.owner_id
        where dm.role = 'owner'
          and dm.owner_id = dm.user_id
        limit 1
      ),
      false
    ) as teaching_season_active;
$$;

comment on function public.get_public_teaching_settings() is
  'Anonymous-safe owner-level Teaching settings. Returns only whether Teaching season is currently active.';

revoke all
  on function public.get_public_teaching_settings()
  from public, authenticated;

grant execute
  on function public.get_public_teaching_settings()
  to anon, service_role;
