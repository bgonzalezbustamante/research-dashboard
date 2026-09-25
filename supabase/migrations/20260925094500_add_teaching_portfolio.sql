-- Distant Forge rc.1: Teaching Portfolio with public course cards and private activity-based analytics.

create table public.teaching_portfolio (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.profiles(id)
    on delete cascade,
  name text not null
    check (char_length(btrim(name)) > 0),
  institution text not null
    check (char_length(btrim(institution)) > 0),
  summary text not null
    check (char_length(btrim(summary)) > 0),
  start_year integer not null
    check (start_year between 1900 and 2100),
  end_year integer,
  is_current boolean not null default false,
  level text not null
    check (
      level in (
        'undergraduate',
        'master',
        'phd'
      )
    ),
  times_taught integer not null
    check (times_taught >= 1),
  student_count integer not null
    check (student_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teaching_portfolio_period_check
    check (
      (
        is_current
        and end_year is null
      )
      or
      (
        not is_current
        and end_year is not null
      )
    ),
  constraint teaching_portfolio_year_order_check
    check (
      end_year is null
      or end_year >= start_year
    )
);

create unique index teaching_portfolio_owner_name_institution_unique_idx
  on public.teaching_portfolio (
    owner_id,
    lower(btrim(name)),
    lower(btrim(institution))
  );

alter table public.teaching_portfolio
  enable row level security;

revoke all
  on table public.teaching_portfolio
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.teaching_portfolio
  to authenticated;

create or replace function private.can_view_teaching(
  p_teaching_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teaching_portfolio tp
    where tp.id = p_teaching_id
      and private.can_view_dashboard(
        tp.owner_id
      )
  );
$$;

create or replace function private.can_edit_teaching(
  p_teaching_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teaching_portfolio tp
    where tp.id = p_teaching_id
      and private.is_dashboard_owner(
        tp.owner_id
      )
  );
$$;

revoke all
  on function private.can_view_teaching(uuid)
  from public, anon, authenticated;

revoke all
  on function private.can_edit_teaching(uuid)
  from public, anon, authenticated;

grant execute
  on function private.can_view_teaching(uuid)
  to authenticated, service_role;

grant execute
  on function private.can_edit_teaching(uuid)
  to authenticated, service_role;

create policy "Dashboard members can view teaching portfolio"
  on public.teaching_portfolio
  for select
  to authenticated
  using (
    private.can_view_dashboard(
      owner_id
    )
  );

create policy "Dashboard owners can create teaching portfolio"
  on public.teaching_portfolio
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(
      owner_id
    )
  );

create policy "Dashboard owners can update teaching portfolio"
  on public.teaching_portfolio
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

create policy "Dashboard owners can delete teaching portfolio"
  on public.teaching_portfolio
  for delete
  to authenticated
  using (
    private.is_dashboard_owner(
      owner_id
    )
  );

create trigger teaching_portfolio_updated_at
before update on public.teaching_portfolio
for each row
execute function public.handle_updated_at();

create table public.teaching_public_metadata (
  teaching_id uuid primary key
    references public.teaching_portfolio(id)
    on delete cascade,
  visibility text not null default 'private'
    check (
      visibility in (
        'private',
        'public'
      )
    ),
  slug text unique,
  course_image_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teaching_public_metadata_slug_format
    check (
      slug is null
      or (
        char_length(slug)
          between 1 and 160
        and slug ~
          '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      )
    ),
  constraint teaching_public_metadata_image_format
    check (
      course_image_filename is null
      or (
        char_length(
          course_image_filename
        ) between 1 and 180
        and course_image_filename ~
          '^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$'
      )
    )
);

comment on table public.teaching_public_metadata is
  'Website-only presentation settings for Teaching Portfolio items. Canonical teaching content and tracked work remain separate.';

comment on column public.teaching_public_metadata.course_image_filename is
  'Static academic-website asset filename resolved under /teaching/<filename>.';

alter table public.teaching_public_metadata
  enable row level security;

revoke all
  on table public.teaching_public_metadata
  from public, anon, authenticated;

grant select
  on table public.teaching_public_metadata
  to authenticated;

grant update (
  visibility,
  slug,
  course_image_filename
)
  on table public.teaching_public_metadata
  to authenticated;

create policy "Dashboard members can view teaching public metadata"
  on public.teaching_public_metadata
  for select
  to authenticated
  using (
    private.can_view_teaching(
      teaching_id
    )
  );

create policy "Dashboard owners can update teaching public metadata"
  on public.teaching_public_metadata
  for update
  to authenticated
  using (
    private.can_edit_teaching(
      teaching_id
    )
  )
  with check (
    private.can_edit_teaching(
      teaching_id
    )
  );

create or replace function private.ensure_teaching_public_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.teaching_public_metadata (
    teaching_id
  )
  values (
    new.id
  )
  on conflict (
    teaching_id
  ) do nothing;

  return new;
end;
$$;

revoke all
  on function private.ensure_teaching_public_metadata()
  from public, anon, authenticated;

create trigger ensure_teaching_public_metadata
after insert on public.teaching_portfolio
for each row
execute function private.ensure_teaching_public_metadata();

create trigger teaching_public_metadata_updated_at
before update on public.teaching_public_metadata
for each row
execute function public.handle_updated_at();

create index teaching_public_metadata_listing_idx
  on public.teaching_public_metadata (
    visibility,
    teaching_id
  );

create table public.teaching_activity_labels (
  teaching_id uuid not null
    references public.teaching_portfolio(id)
    on delete cascade,
  activity_label_id uuid not null
    references public.activity_labels(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (
    teaching_id,
    activity_label_id
  ),
  unique (
    activity_label_id
  )
);

comment on table public.teaching_activity_labels is
  'Dashboard-only Teaching Portfolio time-tracking assignments. Only Teaching-classified activity labels may be assigned, and each label belongs to at most one Teaching Portfolio item.';

alter table public.teaching_activity_labels
  enable row level security;

revoke all
  on table public.teaching_activity_labels
  from public, anon, authenticated;

grant select, insert, delete
  on table public.teaching_activity_labels
  to authenticated;

create or replace function private.validate_teaching_activity_label_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teaching_owner uuid;
  v_label_owner uuid;
  v_is_break boolean;
  v_major_activity text;
begin
  select tp.owner_id
  into v_teaching_owner
  from public.teaching_portfolio tp
  where tp.id = new.teaching_id;

  select
    al.owner_id,
    al.is_break,
    al.major_activity
  into
    v_label_owner,
    v_is_break,
    v_major_activity
  from public.activity_labels al
  where al.id =
    new.activity_label_id;

  if v_teaching_owner is null
     or v_label_owner is null
     or v_teaching_owner <> v_label_owner then
    raise exception
      'Teaching item and activity label must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  if coalesce(
    v_is_break,
    false
  )
  or v_major_activity is distinct from 'teaching' then
    raise exception
      'Only non-Break activity labels classified as Teaching can be assigned to Teaching Portfolio items'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_teaching_activity_label_link()
  from public, anon, authenticated;

create trigger validate_teaching_activity_label_link
before insert or update
on public.teaching_activity_labels
for each row
execute function private.validate_teaching_activity_label_link();

create policy "Dashboard members can view teaching activity labels"
  on public.teaching_activity_labels
  for select
  to authenticated
  using (
    private.can_view_teaching(
      teaching_id
    )
  );

create policy "Dashboard owners can link teaching activity labels"
  on public.teaching_activity_labels
  for insert
  to authenticated
  with check (
    private.can_edit_teaching(
      teaching_id
    )
  );

create policy "Dashboard owners can unlink teaching activity labels"
  on public.teaching_activity_labels
  for delete
  to authenticated
  using (
    private.can_edit_teaching(
      teaching_id
    )
  );

create index teaching_activity_labels_teaching_idx
  on public.teaching_activity_labels (
    teaching_id
  );

create function public.create_teaching_with_details(
  p_name text,
  p_institution text,
  p_summary text,
  p_start_year integer,
  p_end_year integer,
  p_is_current boolean,
  p_level text,
  p_times_taught integer,
  p_student_count integer,
  p_visibility text,
  p_slug text,
  p_course_image_filename text,
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_teaching_id uuid;
begin
  select dm.owner_id
  into v_owner_id
  from public.dashboard_members dm
  where dm.user_id = auth.uid()
    and dm.role = 'owner'
  limit 1;

  if v_owner_id is null then
    raise exception 'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  insert into public.teaching_portfolio (
    owner_id,
    name,
    institution,
    summary,
    start_year,
    end_year,
    is_current,
    level,
    times_taught,
    student_count
  )
  values (
    v_owner_id,
    btrim(p_name),
    btrim(p_institution),
    btrim(p_summary),
    p_start_year,
    case
      when coalesce(p_is_current, false)
        then null
      else p_end_year
    end,
    coalesce(p_is_current, false),
    p_level,
    p_times_taught,
    p_student_count
  )
  returning id
  into v_teaching_id;

  update public.teaching_public_metadata
  set
    visibility = p_visibility,
    slug = lower(
      nullif(
        btrim(p_slug),
        ''
      )
    ),
    course_image_filename =
      nullif(
        btrim(
          p_course_image_filename
        ),
        ''
      )
  where teaching_id =
    v_teaching_id;

  insert into public.teaching_activity_labels (
    teaching_id,
    activity_label_id
  )
  select
    v_teaching_id,
    activity_label_id
  from (
    select distinct
      unnest(
        coalesce(
          p_activity_label_ids,
          '{}'::uuid[]
        )
      ) as activity_label_id
  ) links;

  return v_teaching_id;
end;
$$;

create function public.update_teaching_with_details(
  p_teaching_id uuid,
  p_name text,
  p_institution text,
  p_summary text,
  p_start_year integer,
  p_end_year integer,
  p_is_current boolean,
  p_level text,
  p_times_taught integer,
  p_student_count integer,
  p_visibility text,
  p_slug text,
  p_course_image_filename text,
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.can_edit_teaching(
    p_teaching_id
  ) then
    raise exception 'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  update public.teaching_portfolio
  set
    name = btrim(p_name),
    institution = btrim(p_institution),
    summary = btrim(p_summary),
    start_year = p_start_year,
    end_year =
      case
        when coalesce(
          p_is_current,
          false
        )
          then null
        else p_end_year
      end,
    is_current =
      coalesce(
        p_is_current,
        false
      ),
    level = p_level,
    times_taught = p_times_taught,
    student_count = p_student_count
  where id = p_teaching_id;

  update public.teaching_public_metadata
  set
    visibility = p_visibility,
    slug = lower(
      nullif(
        btrim(p_slug),
        ''
      )
    ),
    course_image_filename =
      nullif(
        btrim(
          p_course_image_filename
        ),
        ''
      )
  where teaching_id =
    p_teaching_id;

  delete from public.teaching_activity_labels
  where teaching_id =
    p_teaching_id;

  insert into public.teaching_activity_labels (
    teaching_id,
    activity_label_id
  )
  select
    p_teaching_id,
    activity_label_id
  from (
    select distinct
      unnest(
        coalesce(
          p_activity_label_ids,
          '{}'::uuid[]
        )
      ) as activity_label_id
  ) links;

  return p_teaching_id;
end;
$$;

revoke all
  on function public.create_teaching_with_details(
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text,
    integer,
    integer,
    text,
    text,
    text,
    uuid[]
  )
  from public, anon;

revoke all
  on function public.update_teaching_with_details(
    uuid,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text,
    integer,
    integer,
    text,
    text,
    text,
    uuid[]
  )
  from public, anon;

grant execute
  on function public.create_teaching_with_details(
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text,
    integer,
    integer,
    text,
    text,
    text,
    uuid[]
  )
  to authenticated, service_role;

grant execute
  on function public.update_teaching_with_details(
    uuid,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text,
    integer,
    integer,
    text,
    text,
    text,
    uuid[]
  )
  to authenticated, service_role;

create function public.get_teaching_hours()
returns table (
  teaching_id uuid,
  net_minutes bigint,
  session_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    tp.id as teaching_id,
    coalesce(
      sum(
        (
          extract(
            epoch from (
              ws.end_time -
              ws.start_time
            )
          ) / 60
        )::bigint
      ),
      0
    ) as net_minutes,
    count(
      ws.id
    )::bigint as session_count
  from public.teaching_portfolio tp
  left join public.teaching_activity_labels tal
    on tal.teaching_id = tp.id
  left join public.work_sessions ws
    on ws.activity_label_id =
      tal.activity_label_id
  where private.can_view_dashboard(
    tp.owner_id
  )
  group by tp.id
  order by tp.id;
$$;

comment on function public.get_teaching_hours() is
  'Authenticated Dashboard-only aggregate Teaching Portfolio hours and session counts derived from assigned Teaching activity labels.';

revoke all
  on function public.get_teaching_hours()
  from public, anon;

grant execute
  on function public.get_teaching_hours()
  to authenticated, service_role;

create function public.list_public_teaching()
returns table (
  slug text,
  name text,
  institution text,
  summary text,
  start_year integer,
  end_year integer,
  is_current boolean,
  level text,
  times_taught integer,
  student_count integer,
  course_image_filename text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tpm.slug,
    tp.name,
    tp.institution,
    tp.summary,
    tp.start_year,
    tp.end_year,
    tp.is_current,
    tp.level,
    tp.times_taught,
    tp.student_count,
    tpm.course_image_filename
  from public.teaching_portfolio tp
  join public.teaching_public_metadata tpm
    on tpm.teaching_id = tp.id
  where tpm.visibility = 'public'
  order by
    tp.is_current desc,
    tp.start_year desc,
    tp.name asc;
$$;

comment on function public.list_public_teaching() is
  'Anonymous-safe listing of explicitly Public Teaching Portfolio items for academic-website cards. Activity labels, tracked hours, sessions, owner metadata, and internal IDs remain private.';

revoke all
  on function public.list_public_teaching()
  from public, authenticated;

grant execute
  on function public.list_public_teaching()
  to anon, service_role;
