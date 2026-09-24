-- Distant Forge refinement: simplify publication curation and add aggregate public work analytics.

update public.paper_public_metadata
set visibility = 'private'
where visibility = 'unlisted';

alter table public.paper_public_metadata
  drop constraint paper_public_metadata_visibility_check;

alter table public.paper_public_metadata
  add constraint paper_public_metadata_visibility_check
  check (visibility in ('private', 'public'));

alter table public.paper_public_metadata
  drop constraint paper_public_metadata_category_nonempty;

alter table public.paper_public_metadata
  rename column public_category to publication_index;

alter table public.paper_public_metadata
  add constraint paper_public_metadata_publication_index_nonempty
  check (
    publication_index is null
    or char_length(btrim(publication_index)) > 0
  );

alter table public.paper_public_metadata
  drop constraint paper_public_metadata_summary_nonempty,
  drop constraint paper_public_metadata_venue_nonempty,
  drop constraint paper_public_metadata_display_order_nonnegative;

alter table public.paper_public_metadata
  drop column public_summary,
  drop column public_venue,
  drop column display_order;

drop index if exists public.paper_public_metadata_listing_idx;

create index paper_public_metadata_listing_idx
  on public.paper_public_metadata (
    visibility,
    featured desc,
    paper_id
  );

drop function public.list_public_papers();
drop function public.get_public_paper(text);

create function public.list_public_papers()
returns table (
  slug text,
  title text,
  authors text[],
  abstract text,
  venue text,
  publication_date date,
  doi_url text,
  publication_url text,
  preprint_url text,
  github_url text,
  dataset_url text,
  featured boolean,
  publication_index text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    p.title,
    array(
      select a.full_name
      from public.paper_authors pa
      join public.authors a
        on a.id = pa.author_id
      where pa.paper_id = p.id
      order by pa.author_order, a.full_name
    ) as authors,
    p.abstract,
    p.current_venue as venue,
    p.published_on as publication_date,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'doi'
      order by pl.sort_order, pl.id
      limit 1
    ) as doi_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'publication'
      order by pl.sort_order, pl.id
      limit 1
    ) as publication_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'preprint'
      order by pl.sort_order, pl.id
      limit 1
    ) as preprint_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'github'
      order by pl.sort_order, pl.id
      limit 1
    ) as github_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'dataverse'
      order by pl.sort_order, pl.id
      limit 1
    ) as dataset_url,
    ppm.featured,
    ppm.publication_index
  from public.paper_public_metadata ppm
  join public.papers p
    on p.id = ppm.paper_id
  where ppm.visibility = 'public'
    and ppm.slug is not null
  order by
    p.published_on desc nulls last,
    p.title asc;
$$;

create function public.get_public_paper(p_slug text)
returns table (
  slug text,
  title text,
  authors text[],
  abstract text,
  venue text,
  publication_date date,
  doi_url text,
  publication_url text,
  preprint_url text,
  github_url text,
  dataset_url text,
  featured boolean,
  publication_index text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    p.title,
    array(
      select a.full_name
      from public.paper_authors pa
      join public.authors a
        on a.id = pa.author_id
      where pa.paper_id = p.id
      order by pa.author_order, a.full_name
    ) as authors,
    p.abstract,
    p.current_venue as venue,
    p.published_on as publication_date,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'doi'
      order by pl.sort_order, pl.id
      limit 1
    ) as doi_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'publication'
      order by pl.sort_order, pl.id
      limit 1
    ) as publication_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'preprint'
      order by pl.sort_order, pl.id
      limit 1
    ) as preprint_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'github'
      order by pl.sort_order, pl.id
      limit 1
    ) as github_url,
    (
      select pl.url
      from public.paper_links pl
      where pl.paper_id = p.id
        and pl.link_type = 'dataverse'
      order by pl.sort_order, pl.id
      limit 1
    ) as dataset_url,
    ppm.featured,
    ppm.publication_index
  from public.paper_public_metadata ppm
  join public.papers p
    on p.id = ppm.paper_id
  where ppm.visibility = 'public'
    and ppm.slug = lower(btrim(p_slug))
  limit 1;
$$;

create function public.get_public_work_analytics(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_year integer :=
    extract(year from current_date)::integer;
  v_result jsonb;
begin
  if p_year < 2000
     or p_year > v_current_year then
    raise exception 'Year must be between 2000 and %', v_current_year
      using errcode = '22023';
  end if;

  with dashboard_owner as (
    select dm.owner_id
    from public.dashboard_members dm
    where dm.role = 'owner'
      and dm.owner_id = dm.user_id
    limit 1
  ),
  year_logs as (
    select
      dl.id,
      dl.log_date,
      dl.coffee_count
    from public.daily_logs dl
    join dashboard_owner owner
      on owner.owner_id = dl.owner_id
    where dl.log_date >= make_date(p_year, 1, 1)
      and dl.log_date < make_date(p_year + 1, 1, 1)
  ),
  daily_work as (
    select
      yl.id,
      yl.log_date,
      yl.coffee_count,
      count(ws.id) as session_count,
      coalesce(
        sum(
          case
            when ws.id is null
              or al.is_break then 0
            else (
              extract(
                epoch from (
                  ws.end_time -
                  ws.start_time
                )
              ) / 60
            )::integer
          end
        ),
        0
      )::integer as net_minutes
    from year_logs yl
    left join public.work_sessions ws
      on ws.daily_log_id = yl.id
    left join public.activity_labels al
      on al.id = ws.activity_label_id
    group by
      yl.id,
      yl.log_date,
      yl.coffee_count
  ),
  summary as (
    select
      coalesce(
        sum(dw.net_minutes),
        0
      )::integer as net_minutes,
      coalesce(
        sum(dw.coffee_count),
        0
      )::integer as coffee_count,
      count(*) filter (
        where dw.session_count > 0
      )::integer as working_days
    from daily_work dw
  ),
  calendar_days as (
    select
      day::date as date
    from generate_series(
      make_date(p_year, 1, 1)::timestamp,
      make_date(p_year, 12, 31)::timestamp,
      interval '1 day'
    ) as day
  )
  select jsonb_build_object(
    'year',
    p_year,
    'average_net_minutes_per_working_day',
    case
      when s.working_days > 0 then
        round(
          s.net_minutes::numeric /
          s.working_days
        )::integer
      else 0
    end,
    'average_coffees_per_working_day',
    case
      when s.working_days > 0 then
        round(
          s.coffee_count::numeric /
          s.working_days,
          2
        )
      else 0::numeric
    end,
    'days',
    (
      select jsonb_agg(
        jsonb_build_object(
          'date',
          cd.date,
          'net_minutes',
          coalesce(
            dw.net_minutes,
            0
          )
        )
        order by cd.date
      )
      from calendar_days cd
      left join daily_work dw
        on dw.log_date = cd.date
    )
  )
  into v_result
  from summary s;

  return v_result;
end;
$$;

comment on function public.list_public_papers() is
  'Anonymous-safe publication-date-ordered listing of papers explicitly marked public.';

comment on function public.get_public_paper(text) is
  'Anonymous-safe slug lookup for papers explicitly marked public.';

comment on function public.get_public_work_analytics(integer) is
  'Anonymous-safe yearly aggregate work analytics: daily net minutes, average net minutes per working day, and average coffees per working day.';

revoke all
  on function public.list_public_papers()
  from public;

revoke all
  on function public.get_public_paper(text)
  from public;

revoke all
  on function public.get_public_work_analytics(integer)
  from public;

grant execute
  on function public.list_public_papers()
  to anon, service_role;

grant execute
  on function public.get_public_paper(text)
  to anon, service_role;

grant execute
  on function public.get_public_work_analytics(integer)
  to anon, service_role;
