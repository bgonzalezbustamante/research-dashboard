-- Distant Forge follow-up: keep conference notes private and add presentation-specific ordered authors.

alter table public.conference_presentations
  add column authors text[] not null default '{}'::text[];

update public.conference_presentations cp
set authors = coalesce(
  (
    select array_agg(
      a.full_name
      order by
        pa.author_order,
        a.full_name
    )
    from public.paper_authors pa
    join public.authors a
      on a.id = pa.author_id
    where pa.paper_id = cp.paper_id
  ),
  '{}'::text[]
)
where cp.paper_id is not null
  and cardinality(cp.authors) = 0;

drop function if exists public.list_public_conference_presentations();

create function public.list_public_conference_presentations()
returns table (
  event_name text,
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
  'Anonymous-safe conference presentation listing. Ordered presentation authors are public; notes, owner, and optional linked paper are deliberately excluded.';

revoke all
  on function public.list_public_conference_presentations()
  from public;

grant execute
  on function public.list_public_conference_presentations()
  to anon, service_role;
