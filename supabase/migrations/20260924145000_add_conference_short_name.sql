-- Distant Forge follow-up: add a required short conference/event name for public presentation.

alter table public.conference_presentations
  add column event_short_name text;

update public.conference_presentations
set event_short_name = btrim(event_name)
where event_short_name is null;

alter table public.conference_presentations
  alter column event_short_name set not null;

alter table public.conference_presentations
  add constraint conference_presentations_event_short_name_nonempty
  check (
    char_length(
      btrim(event_short_name)
    ) between 1 and 160
  );

drop function if exists public.list_public_conference_presentations();

create function public.list_public_conference_presentations()
returns table (
  event_name text,
  event_short_name text,
  location text,
  presentation_date date,
  presentation_title text,
  authors text[],
  presentation_type text,
  url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.event_name,
    cp.event_short_name,
    cp.location,
    cp.presentation_date,
    cp.presentation_title,
    cp.authors,
    cp.presentation_type,
    cp.url
  from public.conference_presentations cp
  order by
    cp.presentation_date desc nulls last,
    cp.event_name asc;
$$;

comment on function public.list_public_conference_presentations() is
  'Anonymous-safe conference presentation listing. Full and short event names plus ordered presentation authors are public; notes, owner, and optional linked paper are deliberately excluded.';

revoke all
  on function public.list_public_conference_presentations()
  from public;

grant execute
  on function public.list_public_conference_presentations()
  to anon, service_role;
