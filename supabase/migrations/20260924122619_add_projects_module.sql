-- Distant Forge: canonical Projects module, public project presentation, paper links, and Dashboard-only activity tracking.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.profiles(id)
    on delete cascade,
  short_title text not null
    check (char_length(btrim(short_title)) > 0),
  title text not null
    check (char_length(btrim(title)) > 0),
  abstract text not null
    check (char_length(btrim(abstract)) > 0),
  funder text not null
    check (char_length(btrim(funder)) > 0),
  status text not null default 'active'
    check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projects_owner_short_title_unique_idx
  on public.projects (
    owner_id,
    lower(btrim(short_title))
  );

alter table public.projects
  enable row level security;

revoke all
  on table public.projects
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.projects
  to authenticated;

create or replace function private.can_view_project(
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and private.can_view_dashboard(
        p.owner_id
      )
  );
$$;

create or replace function private.can_edit_project(
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and private.is_dashboard_owner(
        p.owner_id
      )
  );
$$;

revoke all
  on function private.can_view_project(uuid)
  from public, anon;

revoke all
  on function private.can_edit_project(uuid)
  from public, anon;

grant execute
  on function private.can_view_project(uuid)
  to authenticated, service_role;

grant execute
  on function private.can_edit_project(uuid)
  to authenticated, service_role;

create policy "Dashboard members can view projects"
  on public.projects
  for select
  to authenticated
  using (
    private.can_view_dashboard(
      owner_id
    )
  );

create policy "Dashboard owners can create projects"
  on public.projects
  for insert
  to authenticated
  with check (
    private.is_dashboard_owner(
      owner_id
    )
  );

create policy "Dashboard owners can update projects"
  on public.projects
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

create policy "Dashboard owners can delete projects"
  on public.projects
  for delete
  to authenticated
  using (
    private.is_dashboard_owner(
      owner_id
    )
  );

create trigger projects_updated_at
before update on public.projects
for each row
execute function public.handle_updated_at();

create table public.project_public_metadata (
  project_id uuid primary key
    references public.projects(id)
    on delete cascade,
  visibility text not null default 'private'
    check (
      visibility in (
        'private',
        'public'
      )
    ),
  slug text unique,
  project_image_filename text,
  funder_image_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_public_metadata_slug_format
    check (
      slug is null
      or (
        char_length(slug)
          between 1 and 160
        and slug ~
          '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      )
    ),
  constraint project_public_metadata_visible_slug_required
    check (
      visibility = 'private'
      or slug is not null
    ),
  constraint project_public_metadata_project_image_format
    check (
      project_image_filename is null
      or (
        char_length(
          project_image_filename
        ) between 1 and 180
        and project_image_filename ~
          '^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$'
      )
    ),
  constraint project_public_metadata_funder_image_format
    check (
      funder_image_filename is null
      or (
        char_length(
          funder_image_filename
        ) between 1 and 180
        and funder_image_filename ~
          '^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$'
      )
    )
);

comment on table public.project_public_metadata is
  'Website-only presentation settings for projects. Canonical project content remains in public.projects.';

alter table public.project_public_metadata
  enable row level security;

revoke all
  on table public.project_public_metadata
  from public, anon, authenticated;

grant select
  on table public.project_public_metadata
  to authenticated;

grant update (
  visibility,
  slug,
  project_image_filename,
  funder_image_filename
)
  on table public.project_public_metadata
  to authenticated;

create policy "Dashboard members can view public project metadata"
  on public.project_public_metadata
  for select
  to authenticated
  using (
    private.can_view_project(
      project_id
    )
  );

create policy "Dashboard owners can update public project metadata"
  on public.project_public_metadata
  for update
  to authenticated
  using (
    private.can_edit_project(
      project_id
    )
  )
  with check (
    private.can_edit_project(
      project_id
    )
  );

create or replace function private.ensure_project_public_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_public_metadata (
    project_id
  )
  values (
    new.id
  )
  on conflict (
    project_id
  ) do nothing;

  return new;
end;
$$;

revoke all
  on function private.ensure_project_public_metadata()
  from public, anon, authenticated;

create trigger ensure_project_public_metadata
after insert on public.projects
for each row
execute function private.ensure_project_public_metadata();

create trigger project_public_metadata_updated_at
before update on public.project_public_metadata
for each row
execute function public.handle_updated_at();

create index project_public_metadata_listing_idx
  on public.project_public_metadata (
    visibility,
    project_id
  );

create table public.project_papers (
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  paper_id uuid not null
    references public.papers(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (
    project_id,
    paper_id
  )
);

alter table public.project_papers
  enable row level security;

revoke all
  on table public.project_papers
  from public, anon, authenticated;

grant select, insert, delete
  on table public.project_papers
  to authenticated;

create or replace function private.validate_project_paper_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_owner uuid;
  v_paper_owner uuid;
begin
  select p.owner_id
  into v_project_owner
  from public.projects p
  where p.id = new.project_id;

  select p.owner_id
  into v_paper_owner
  from public.papers p
  where p.id = new.paper_id;

  if v_project_owner is null
     or v_paper_owner is null
     or v_project_owner <> v_paper_owner then
    raise exception
      'Project and paper must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_project_paper_link()
  from public, anon, authenticated;

create trigger validate_project_paper_link
before insert or update
on public.project_papers
for each row
execute function private.validate_project_paper_link();

create policy "Dashboard members can view project papers"
  on public.project_papers
  for select
  to authenticated
  using (
    private.can_view_project(
      project_id
    )
    and private.can_view_paper(
      paper_id
    )
  );

create policy "Dashboard owners can link project papers"
  on public.project_papers
  for insert
  to authenticated
  with check (
    private.can_edit_project(
      project_id
    )
    and private.can_edit_paper(
      paper_id
    )
  );

create policy "Dashboard owners can unlink project papers"
  on public.project_papers
  for delete
  to authenticated
  using (
    private.can_edit_project(
      project_id
    )
    and private.can_edit_paper(
      paper_id
    )
  );

create index project_papers_paper_idx
  on public.project_papers (
    paper_id
  );

create table public.project_activity_labels (
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  activity_label_id uuid not null
    references public.activity_labels(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (
    project_id,
    activity_label_id
  ),
  unique (
    activity_label_id
  )
);

comment on table public.project_activity_labels is
  'Dashboard-only project time-tracking assignments. Each activity label may belong to at most one project to avoid double-counting work sessions.';

alter table public.project_activity_labels
  enable row level security;

revoke all
  on table public.project_activity_labels
  from public, anon, authenticated;

grant select, insert, delete
  on table public.project_activity_labels
  to authenticated;

create or replace function private.validate_project_activity_label_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_owner uuid;
  v_label_owner uuid;
  v_is_break boolean;
begin
  select p.owner_id
  into v_project_owner
  from public.projects p
  where p.id = new.project_id;

  select
    al.owner_id,
    al.is_break
  into
    v_label_owner,
    v_is_break
  from public.activity_labels al
  where al.id =
    new.activity_label_id;

  if v_project_owner is null
     or v_label_owner is null
     or v_project_owner <> v_label_owner then
    raise exception
      'Project and activity label must belong to the same dashboard owner'
      using errcode = '23514';
  end if;

  if coalesce(
    v_is_break,
    false
  ) then
    raise exception
      'Break labels cannot be assigned to projects'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
  on function private.validate_project_activity_label_link()
  from public, anon, authenticated;

create trigger validate_project_activity_label_link
before insert or update
on public.project_activity_labels
for each row
execute function private.validate_project_activity_label_link();

create policy "Dashboard members can view project activity labels"
  on public.project_activity_labels
  for select
  to authenticated
  using (
    private.can_view_project(
      project_id
    )
  );

create policy "Dashboard owners can link project activity labels"
  on public.project_activity_labels
  for insert
  to authenticated
  with check (
    private.can_edit_project(
      project_id
    )
  );

create policy "Dashboard owners can unlink project activity labels"
  on public.project_activity_labels
  for delete
  to authenticated
  using (
    private.can_edit_project(
      project_id
    )
  );

create index project_activity_labels_project_idx
  on public.project_activity_labels (
    project_id
  );

create or replace function public.get_project_hours()
returns table (
  project_id uuid,
  net_minutes bigint,
  session_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id as project_id,
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
  from public.projects p
  left join public.project_activity_labels pal
    on pal.project_id = p.id
  left join public.work_sessions ws
    on ws.activity_label_id =
      pal.activity_label_id
  where private.can_view_dashboard(
    p.owner_id
  )
  group by p.id
  order by p.id;
$$;

comment on function public.get_project_hours() is
  'Authenticated Dashboard-only aggregate project hours derived from assigned activity labels.';

revoke all
  on function public.get_project_hours()
  from public, anon;

grant execute
  on function public.get_project_hours()
  to authenticated, service_role;

create or replace function public.list_public_projects()
returns table (
  slug text,
  short_title text,
  title text,
  abstract text,
  funder text,
  status text,
  project_image_filename text,
  funder_image_filename text,
  publication_slugs text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    p.short_title,
    p.title,
    p.abstract,
    p.funder,
    p.status,
    ppm.project_image_filename,
    ppm.funder_image_filename,
    array(
      select paper_meta.slug
      from public.project_papers pp
      join public.papers paper
        on paper.id = pp.paper_id
      join public.paper_public_metadata paper_meta
        on paper_meta.paper_id =
          paper.id
      where pp.project_id = p.id
        and paper_meta.visibility =
          'public'
        and paper_meta.slug is not null
      order by
        paper.published_on desc
          nulls last,
        paper.title asc
    ) as publication_slugs
  from public.projects p
  join public.project_public_metadata ppm
    on ppm.project_id = p.id
  where ppm.visibility = 'public'
    and ppm.slug is not null
  order by
    case
      when p.status = 'active'
        then 0
      else 1
    end,
    p.title asc;
$$;

create or replace function public.get_public_project(
  p_slug text
)
returns table (
  slug text,
  short_title text,
  title text,
  abstract text,
  funder text,
  status text,
  project_image_filename text,
  funder_image_filename text,
  publication_slugs text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ppm.slug,
    p.short_title,
    p.title,
    p.abstract,
    p.funder,
    p.status,
    ppm.project_image_filename,
    ppm.funder_image_filename,
    array(
      select paper_meta.slug
      from public.project_papers pp
      join public.papers paper
        on paper.id = pp.paper_id
      join public.paper_public_metadata paper_meta
        on paper_meta.paper_id =
          paper.id
      where pp.project_id = p.id
        and paper_meta.visibility =
          'public'
        and paper_meta.slug is not null
      order by
        paper.published_on desc
          nulls last,
        paper.title asc
    ) as publication_slugs
  from public.projects p
  join public.project_public_metadata ppm
    on ppm.project_id = p.id
  where ppm.visibility = 'public'
    and ppm.slug =
      lower(
        btrim(
          p_slug
        )
      )
  limit 1;
$$;

comment on function public.list_public_projects() is
  'Anonymous-safe listing of explicitly Public projects with static asset filenames and associated Public paper slugs only.';

comment on function public.get_public_project(text) is
  'Anonymous-safe slug lookup for an explicitly Public project with static asset filenames and associated Public paper slugs only.';

revoke all
  on function public.list_public_projects()
  from public;

revoke all
  on function public.get_public_project(text)
  from public;

grant execute
  on function public.list_public_projects()
  to anon, service_role;

grant execute
  on function public.get_public_project(text)
  to anon, service_role;
