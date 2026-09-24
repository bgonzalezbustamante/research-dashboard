-- Distant Forge: atomic Owner mutations for Projects and their related presentation/tracking links.

create or replace function public.create_project_with_details(
  p_short_title text,
  p_title text,
  p_abstract text,
  p_funder text,
  p_status text,
  p_visibility text,
  p_slug text,
  p_project_image_filename text,
  p_funder_image_filename text,
  p_paper_ids uuid[] default '{}'::uuid[],
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_project_id uuid;
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

  insert into public.projects (
    owner_id,
    short_title,
    title,
    abstract,
    funder,
    status
  )
  values (
    v_owner_id,
    btrim(p_short_title),
    btrim(p_title),
    btrim(p_abstract),
    btrim(p_funder),
    p_status
  )
  returning id
  into v_project_id;

  update public.project_public_metadata
  set
    visibility = p_visibility,
    slug = lower(
      nullif(
        btrim(p_slug),
        ''
      )
    ),
    project_image_filename =
      nullif(
        btrim(
          p_project_image_filename
        ),
        ''
      ),
    funder_image_filename =
      nullif(
        btrim(
          p_funder_image_filename
        ),
        ''
      )
  where project_id = v_project_id;

  insert into public.project_papers (
    project_id,
    paper_id
  )
  select
    v_project_id,
    paper_id
  from (
    select distinct
      unnest(
        coalesce(
          p_paper_ids,
          '{}'::uuid[]
        )
      ) as paper_id
  ) links;

  insert into public.project_activity_labels (
    project_id,
    activity_label_id
  )
  select
    v_project_id,
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

  return v_project_id;
end;
$$;

create or replace function public.update_project_with_details(
  p_project_id uuid,
  p_short_title text,
  p_title text,
  p_abstract text,
  p_funder text,
  p_status text,
  p_visibility text,
  p_slug text,
  p_project_image_filename text,
  p_funder_image_filename text,
  p_paper_ids uuid[] default '{}'::uuid[],
  p_activity_label_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_project(
    p_project_id
  ) then
    raise exception 'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  update public.projects
  set
    short_title =
      btrim(p_short_title),
    title =
      btrim(p_title),
    abstract =
      btrim(p_abstract),
    funder =
      btrim(p_funder),
    status =
      p_status
  where id = p_project_id;

  update public.project_public_metadata
  set
    visibility = p_visibility,
    slug = lower(
      nullif(
        btrim(p_slug),
        ''
      )
    ),
    project_image_filename =
      nullif(
        btrim(
          p_project_image_filename
        ),
        ''
      ),
    funder_image_filename =
      nullif(
        btrim(
          p_funder_image_filename
        ),
        ''
      )
  where project_id =
    p_project_id;

  delete from public.project_papers
  where project_id =
    p_project_id;

  insert into public.project_papers (
    project_id,
    paper_id
  )
  select
    p_project_id,
    paper_id
  from (
    select distinct
      unnest(
        coalesce(
          p_paper_ids,
          '{}'::uuid[]
        )
      ) as paper_id
  ) links;

  delete from public.project_activity_labels
  where project_id =
    p_project_id;

  insert into public.project_activity_labels (
    project_id,
    activity_label_id
  )
  select
    p_project_id,
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

  return p_project_id;
end;
$$;

revoke all
  on function public.create_project_with_details(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    uuid[],
    uuid[]
  )
  from public, anon;

revoke all
  on function public.update_project_with_details(
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
    uuid[],
    uuid[]
  )
  from public, anon;

grant execute
  on function public.create_project_with_details(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    uuid[],
    uuid[]
  )
  to authenticated, service_role;

grant execute
  on function public.update_project_with_details(
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
    uuid[],
    uuid[]
  )
  to authenticated, service_role;
