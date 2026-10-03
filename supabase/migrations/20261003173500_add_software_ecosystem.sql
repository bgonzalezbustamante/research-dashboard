-- Rustic Peak rc.2:
-- add the Software Ecosystem administrative module and curated public API.

create table public.software_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.profiles(id)
    on delete cascade,
  name text not null,
  short_description text not null,
  category text not null,
  current_version text,
  development_stage text not null,
  status text not null default 'active',
  repository_visibility text not null default 'private',
  repository_url text,
  production_url text,
  documentation_url text,
  start_year integer,
  end_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint software_items_name_length
    check (
      char_length(btrim(name))
      between 1 and 200
    ),
  constraint software_items_short_description_length
    check (
      char_length(btrim(short_description))
      between 1 and 500
    ),
  constraint software_items_current_version_length
    check (
      current_version is null
      or char_length(btrim(current_version))
        between 1 and 100
    ),
  constraint software_items_start_year_range
    check (
      start_year is null
      or start_year between 1000 and 9999
    ),
  constraint software_items_end_year_range
    check (
      end_year is null
      or end_year between 1000 and 9999
    ),
  constraint software_items_year_order
    check (
      start_year is null
      or end_year is null
      or end_year >= start_year
    )
);

alter table public.software_items
  add constraint software_items_category_check
  check (
    category in (
      'Application',
      'Website',
      'Utility',
      'Reusable component',
      'Package/library',
      'API/service',
      'Data product',
      'Template',
      'Other'
    )
  );

alter table public.software_items
  add constraint software_items_development_stage_check
  check (
    development_stage in (
      'Alpha',
      'Beta',
      'Release candidate',
      'Stable',
      'Maintenance'
    )
  );

alter table public.software_items
  add constraint software_items_status_check
  check (
    status in (
      'active',
      'paused',
      'completed',
      'archived'
    )
  );

alter table public.software_items
  add constraint software_items_repository_visibility_check
  check (
    repository_visibility in (
      'public',
      'private'
    )
  );

create unique index software_items_owner_name_key
  on public.software_items (
    owner_id,
    lower(name)
  );

create table public.software_public_metadata (
  software_id uuid primary key
    references public.software_items(id)
    on delete cascade,
  visibility text not null default 'private',
  slug text not null,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint software_public_metadata_visibility_check
    check (
      visibility in (
        'private',
        'public'
      )
    ),
  constraint software_public_metadata_slug_check
    check (
      slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      and char_length(slug)
        between 1 and 120
    ),
  constraint software_public_metadata_slug_key
    unique (slug)
);

comment on table public.software_items is
  'Owner-managed Software Ecosystem records. Repository visibility is independent from public software-profile exposure.';

comment on table public.software_public_metadata is
  'One-to-one public presentation metadata for Software Ecosystem records. Private repository URLs are never exposed by the public RPCs.';

alter table public.software_items
  enable row level security;

alter table public.software_public_metadata
  enable row level security;

revoke all
  on table public.software_items,
    public.software_public_metadata
  from public, anon;

grant select, insert, update, delete
  on table public.software_items,
    public.software_public_metadata
  to authenticated, service_role;

create policy "Dashboard members can view software"
  on public.software_items
  for select
  to authenticated
  using (
    private.can_view_dashboard(owner_id)
  );

create policy "Dashboard owners can create software"
  on public.software_items
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard owners can update software"
  on public.software_items
  for update
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
  )
  with check (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard owners can delete software"
  on public.software_items
  for delete
  to authenticated
  using (
    private.is_dashboard_owner(owner_id)
  );

create policy "Dashboard members can view software public metadata"
  on public.software_public_metadata
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.software_items s
      where s.id = software_id
        and private.can_view_dashboard(
          s.owner_id
        )
    )
  );

create policy "Dashboard owners can create software public metadata"
  on public.software_public_metadata
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.software_items s
      where s.id = software_id
        and private.is_dashboard_owner(
          s.owner_id
        )
    )
  );

create policy "Dashboard owners can update software public metadata"
  on public.software_public_metadata
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.software_items s
      where s.id = software_id
        and private.is_dashboard_owner(
          s.owner_id
        )
    )
  )
  with check (
    exists (
      select 1
      from public.software_items s
      where s.id = software_id
        and private.is_dashboard_owner(
          s.owner_id
        )
    )
  );

create policy "Dashboard owners can delete software public metadata"
  on public.software_public_metadata
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.software_items s
      where s.id = software_id
        and private.is_dashboard_owner(
          s.owner_id
        )
    )
  );

create trigger software_items_updated_at
before update
on public.software_items
for each row
execute function public.handle_updated_at();

create trigger software_public_metadata_updated_at
before update
on public.software_public_metadata
for each row
execute function public.handle_updated_at();

create function public.create_software_with_details(
  p_name text,
  p_slug text,
  p_short_description text,
  p_category text,
  p_current_version text,
  p_development_stage text,
  p_status text,
  p_repository_visibility text,
  p_repository_url text,
  p_production_url text,
  p_documentation_url text,
  p_start_year integer,
  p_end_year integer,
  p_featured boolean,
  p_public_visibility text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_software_id uuid;
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

  insert into public.software_items (
    owner_id,
    name,
    short_description,
    category,
    current_version,
    development_stage,
    status,
    repository_visibility,
    repository_url,
    production_url,
    documentation_url,
    start_year,
    end_year
  )
  values (
    v_owner_id,
    btrim(p_name),
    btrim(p_short_description),
    p_category,
    nullif(btrim(p_current_version), ''),
    p_development_stage,
    p_status,
    p_repository_visibility,
    nullif(btrim(p_repository_url), ''),
    nullif(btrim(p_production_url), ''),
    nullif(btrim(p_documentation_url), ''),
    p_start_year,
    p_end_year
  )
  returning id
  into v_software_id;

  insert into public.software_public_metadata (
    software_id,
    visibility,
    slug,
    featured
  )
  values (
    v_software_id,
    p_public_visibility,
    lower(btrim(p_slug)),
    coalesce(p_featured, false)
  );

  return v_software_id;
end;
$$;

create function public.update_software_with_details(
  p_software_id uuid,
  p_name text,
  p_slug text,
  p_short_description text,
  p_category text,
  p_current_version text,
  p_development_stage text,
  p_status text,
  p_repository_visibility text,
  p_repository_url text,
  p_production_url text,
  p_documentation_url text,
  p_start_year integer,
  p_end_year integer,
  p_featured boolean,
  p_public_visibility text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select s.owner_id
  into v_owner_id
  from public.software_items s
  where s.id = p_software_id;

  if v_owner_id is null
    or not private.is_dashboard_owner(
      v_owner_id
    ) then
    raise exception 'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  update public.software_items
  set
    name = btrim(p_name),
    short_description =
      btrim(p_short_description),
    category = p_category,
    current_version =
      nullif(
        btrim(p_current_version),
        ''
      ),
    development_stage =
      p_development_stage,
    status = p_status,
    repository_visibility =
      p_repository_visibility,
    repository_url =
      nullif(
        btrim(p_repository_url),
        ''
      ),
    production_url =
      nullif(
        btrim(p_production_url),
        ''
      ),
    documentation_url =
      nullif(
        btrim(p_documentation_url),
        ''
      ),
    start_year = p_start_year,
    end_year = p_end_year
  where id = p_software_id;

  insert into public.software_public_metadata (
    software_id,
    visibility,
    slug,
    featured
  )
  values (
    p_software_id,
    p_public_visibility,
    lower(btrim(p_slug)),
    coalesce(p_featured, false)
  )
  on conflict (software_id)
  do update
  set
    visibility =
      excluded.visibility,
    slug = excluded.slug,
    featured = excluded.featured;

  return p_software_id;
end;
$$;

revoke all
  on function public.create_software_with_details(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text
  )
  from public, anon;

revoke all
  on function public.update_software_with_details(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text
  )
  from public, anon;

grant execute
  on function public.create_software_with_details(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text
  )
  to authenticated, service_role;

grant execute
  on function public.update_software_with_details(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    boolean,
    text
  )
  to authenticated, service_role;

create function public.list_public_software()
returns table (
  slug text,
  name text,
  short_description text,
  category text,
  current_version text,
  development_stage text,
  status text,
  repository_visibility text,
  repository_url text,
  production_url text,
  documentation_url text,
  start_year integer,
  end_year integer,
  featured boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    spm.slug,
    s.name,
    s.short_description,
    s.category,
    s.current_version,
    s.development_stage,
    s.status,
    s.repository_visibility,
    case
      when s.repository_visibility =
        'public'
        then s.repository_url
      else null
    end as repository_url,
    s.production_url,
    s.documentation_url,
    s.start_year,
    s.end_year,
    spm.featured
  from public.software_items s
  join public.software_public_metadata spm
    on spm.software_id = s.id
  where spm.visibility = 'public'
  order by
    spm.featured desc,
    case s.status
      when 'active' then 0
      when 'paused' then 1
      when 'completed' then 2
      else 3
    end,
    s.start_year desc nulls last,
    s.name asc;
$$;

create function public.get_public_software(
  p_slug text
)
returns table (
  slug text,
  name text,
  short_description text,
  category text,
  current_version text,
  development_stage text,
  status text,
  repository_visibility text,
  repository_url text,
  production_url text,
  documentation_url text,
  start_year integer,
  end_year integer,
  featured boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    spm.slug,
    s.name,
    s.short_description,
    s.category,
    s.current_version,
    s.development_stage,
    s.status,
    s.repository_visibility,
    case
      when s.repository_visibility =
        'public'
        then s.repository_url
      else null
    end as repository_url,
    s.production_url,
    s.documentation_url,
    s.start_year,
    s.end_year,
    spm.featured
  from public.software_items s
  join public.software_public_metadata spm
    on spm.software_id = s.id
  where spm.visibility = 'public'
    and spm.slug =
      lower(
        btrim(
          p_slug
        )
      )
  limit 1;
$$;

comment on function public.list_public_software() is
  'Anonymous-safe listing of explicitly Public Software Ecosystem profiles. Private repository URLs remain hidden even when the software profile itself is public.';

comment on function public.get_public_software(text) is
  'Anonymous-safe slug lookup for an explicitly Public Software Ecosystem profile. Private repository URLs remain hidden even when the software profile itself is public.';

revoke all
  on function public.list_public_software()
  from public, authenticated;

revoke all
  on function public.get_public_software(text)
  from public, authenticated;

grant execute
  on function public.list_public_software()
  to anon, service_role;

grant execute
  on function public.get_public_software(text)
  to anon, service_role;
