-- Distant Forge: move conference presentations out of paper workspaces into a Dashboard-level Conferences module.

alter table public.paper_presentations
  rename to conference_presentations;

alter table public.conference_presentations
  add column owner_id uuid;

update public.conference_presentations cp
set owner_id = p.owner_id
from public.papers p
where p.id = cp.paper_id;

alter table public.conference_presentations
  alter column owner_id set not null;

alter table public.conference_presentations
  add constraint conference_presentations_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;

alter table public.conference_presentations
  alter column paper_id drop not null;

drop policy if exists "Dashboard members can view paper presentations"
  on public.conference_presentations;
drop policy if exists "Paper collaborators can create paper presentations"
  on public.conference_presentations;
drop policy if exists "Paper collaborators can update paper presentations"
  on public.conference_presentations;
drop policy if exists "Paper collaborators can delete paper presentations"
  on public.conference_presentations;

create or replace function private.validate_conference_paper_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper_owner uuid;
begin
  if new.paper_id is null then
    return new;
  end if;

  select p.owner_id
  into v_paper_owner
  from public.papers p
  where p.id = new.paper_id;

  if v_paper_owner is null
     or v_paper_owner <> new.owner_id then
    raise exception
      'Conference presentation and linked paper must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_conference_paper_link()
  from public, anon, authenticated;

drop trigger if exists validate_conference_paper_link
  on public.conference_presentations;

create trigger validate_conference_paper_link
before insert or update
on public.conference_presentations
for each row
execute function private.validate_conference_paper_link();

create policy "Dashboard members can view conference presentations"
  on public.conference_presentations
  for select
  to authenticated
  using (
    private.can_view_dashboard(
      owner_id
    )
  );

create policy "Dashboard owners can create conference presentations"
  on public.conference_presentations
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(
      owner_id
    )
  );

create policy "Dashboard owners can update conference presentations"
  on public.conference_presentations
  for update
  to authenticated
  using (
    private.is_dashboard_owner(
      owner_id
    )
  )
  with check (
    private.is_dashboard_owner(
      owner_id
    )
  );

create policy "Dashboard owners can delete conference presentations"
  on public.conference_presentations
  for delete
  to authenticated
  using (
    private.is_dashboard_owner(
      owner_id
    )
  );

create index if not exists conference_presentations_owner_date_idx
  on public.conference_presentations (
    owner_id,
    presentation_date
  );

create index if not exists conference_presentations_paper_idx
  on public.conference_presentations (
    paper_id
  );

create or replace function public.list_public_conference_presentations()
returns table (
  event_name text,
  location text,
  presentation_date date,
  presentation_title text,
  presentation_type text,
  url text,
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.event_name,
    cp.location,
    cp.presentation_date,
    cp.presentation_title,
    cp.presentation_type,
    cp.url,
    cp.notes
  from public.conference_presentations cp
  order by
    cp.presentation_date desc nulls last,
    cp.event_name asc;
$$;

comment on function public.list_public_conference_presentations() is
  'Anonymous-safe conference presentation listing. Notes are public; owner and optional linked paper are deliberately excluded.';

revoke all
  on function public.list_public_conference_presentations()
  from public;

grant execute
  on function public.list_public_conference_presentations()
  to anon, service_role;
