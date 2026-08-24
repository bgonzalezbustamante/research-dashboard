create table public.location_labels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint location_labels_name_not_blank
    check (char_length(btrim(name)) > 0)
);

create unique index location_labels_owner_name_unique
  on public.location_labels (
    owner_id,
    lower(btrim(name))
  );

alter table public.location_labels
  enable row level security;

create policy "Users can view own location labels"
  on public.location_labels
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create own location labels"
  on public.location_labels
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update own location labels"
  on public.location_labels
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete own location labels"
  on public.location_labels
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

grant select, insert, update, delete
  on public.location_labels
  to authenticated;

-- Preserve work_sessions.place as the historical snapshot and
-- seed the managed vocabulary from locations already in use.
insert into public.location_labels (
  owner_id,
  name
)
select distinct
  daily_logs.owner_id,
  btrim(work_sessions.place)
from public.work_sessions
join public.daily_logs
  on daily_logs.id = work_sessions.daily_log_id
where btrim(
  coalesce(work_sessions.place, '')
) <> ''
on conflict do nothing;
