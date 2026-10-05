-- Bold Ridge rc.3:
-- extend the public Catholic Calendar feature settings with an independent
-- stress-test flag for the Academic Website.

alter table public.calendar_settings
  add column stress_test_active boolean not null default false;

comment on column public.calendar_settings.catholic_calendar_active is
  'Whether the Academic Website should enable its Catholic Calendar integration.';

comment on column public.calendar_settings.stress_test_active is
  'Whether the Academic Website should use a deliberately long Catholic Calendar display for layout testing.';

drop function public.get_public_calendar_settings();

create function public.get_public_calendar_settings()
returns table (
  catholic_calendar_active boolean,
  stress_test_active boolean
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
    ) as catholic_calendar_active,
    coalesce(
      (
        select
          cs.stress_test_active
        from public.calendar_settings cs
        join public.dashboard_members dm
          on dm.owner_id = cs.owner_id
        where dm.role = 'owner'
          and dm.owner_id = dm.user_id
        limit 1
      ),
      false
    ) as stress_test_active;
$$;

comment on function public.get_public_calendar_settings() is
  'Anonymous-safe owner-level Catholic Calendar settings for the Academic Website. Returns only activation and stress-test booleans.';

revoke all
  on function public.get_public_calendar_settings()
  from public, authenticated;

grant execute
  on function public.get_public_calendar_settings()
  to anon, service_role;
