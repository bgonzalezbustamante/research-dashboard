-- rc.3: soft consolidation for Hours activity and location labels.

alter table public.activity_labels
  add column merged_into_id uuid,
  add column merged_at timestamptz;

alter table public.activity_labels
  add constraint activity_labels_merged_into_fkey
    foreign key (merged_into_id)
    references public.activity_labels(id)
    on delete restrict
    deferrable initially deferred,
  add constraint activity_labels_merge_state_check
    check (
      (
        merged_into_id is null
        and merged_at is null
      )
      or
      (
        merged_into_id is not null
        and merged_at is not null
        and is_active = false
        and merged_into_id <> id
      )
    );

comment on column public.activity_labels.merged_into_id is
  'Canonical replacement label after a soft consolidation. Merged source labels remain as immutable inactive provenance records.';

comment on column public.activity_labels.merged_at is
  'Timestamp when this activity label became an immutable merged source label.';

drop index if exists public.activity_labels_owner_name_unique;

create unique index activity_labels_owner_name_unique
  on public.activity_labels (
    owner_id,
    lower(btrim(name))
  )
  where merged_into_id is null;

create index activity_labels_merged_into_idx
  on public.activity_labels (
    merged_into_id
  )
  where merged_into_id is not null;

alter table public.location_labels
  add column merged_into_id uuid,
  add column merged_at timestamptz;

alter table public.location_labels
  add constraint location_labels_merged_into_fkey
    foreign key (merged_into_id)
    references public.location_labels(id)
    on delete restrict
    deferrable initially deferred,
  add constraint location_labels_merge_state_check
    check (
      (
        merged_into_id is null
        and merged_at is null
      )
      or
      (
        merged_into_id is not null
        and merged_at is not null
        and is_active = false
        and is_default = false
        and merged_into_id <> id
      )
    );

comment on column public.location_labels.merged_into_id is
  'Canonical replacement location after a soft consolidation. Merged source labels remain as immutable inactive provenance records.';

comment on column public.location_labels.merged_at is
  'Timestamp when this location label became an immutable merged source label.';

drop index if exists public.location_labels_owner_name_unique;

create unique index location_labels_owner_name_unique
  on public.location_labels (
    owner_id,
    lower(btrim(name))
  )
  where merged_into_id is null;

create index location_labels_merged_into_idx
  on public.location_labels (
    merged_into_id
  )
  where merged_into_id is not null;

create or replace function private.guard_merged_activity_label()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.merged_into_id is not null then
    raise exception
      'Merged activity labels are read-only'
      using errcode = '23514';
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

revoke all
  on function private.guard_merged_activity_label()
  from public, anon, authenticated;

create trigger guard_merged_activity_label
before update or delete
on public.activity_labels
for each row
execute function private.guard_merged_activity_label();

create or replace function private.guard_merged_location_label()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.merged_into_id is not null then
    raise exception
      'Merged location labels are read-only'
      using errcode = '23514';
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

revoke all
  on function private.guard_merged_location_label()
  from public, anon, authenticated;

create trigger guard_merged_location_label
before update or delete
on public.location_labels
for each row
execute function private.guard_merged_location_label();

create or replace function public.consolidate_activity_labels(
  p_source_a_id uuid,
  p_source_b_id uuid,
  p_target_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_a public.activity_labels%rowtype;
  v_b public.activity_labels%rowtype;
  v_target_id uuid := gen_random_uuid();
  v_target_name text := btrim(p_target_name);
  v_target_description text;
  v_major_activity text;
  v_project_a uuid;
  v_project_b uuid;
  v_project_id uuid;
  v_teaching_a uuid;
  v_teaching_b uuid;
  v_teaching_id uuid;
  v_merged_at timestamptz := now();
begin
  if p_source_a_id is null
     or p_source_b_id is null
     or p_source_a_id = p_source_b_id then
    raise exception
      'Choose two different activity labels'
      using errcode = '22023';
  end if;

  if v_target_name = '' then
    raise exception
      'The new activity-label name is required'
      using errcode = '22023';
  end if;

  select *
  into v_a
  from public.activity_labels
  where id = p_source_a_id
  for update;

  if not found then
    raise exception
      'The first activity label was not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_b
  from public.activity_labels
  where id = p_source_b_id
  for update;

  if not found then
    raise exception
      'The second activity label was not found'
      using errcode = 'P0002';
  end if;

  if v_a.owner_id <> v_b.owner_id then
    raise exception
      'Activity labels must belong to the same dashboard'
      using errcode = '23514';
  end if;

  if not private.is_dashboard_owner(v_a.owner_id) then
    raise exception
      'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  if v_a.is_system
     or v_b.is_system
     or v_a.is_break
     or v_b.is_break then
    raise exception
      'System and Break labels cannot be consolidated'
      using errcode = '23514';
  end if;

  if not v_a.is_active
     or not v_b.is_active
     or v_a.merged_into_id is not null
     or v_b.merged_into_id is not null then
    raise exception
      'Only active, unmerged activity labels can be consolidated'
      using errcode = '23514';
  end if;

  if v_a.major_activity is not null
     and v_b.major_activity is not null
     and v_a.major_activity <> v_b.major_activity then
    raise exception
      'Classify both activity labels under the same major activity before consolidating them'
      using errcode = '23514';
  end if;

  v_major_activity :=
    coalesce(
      v_a.major_activity,
      v_b.major_activity
    );

  if lower(v_target_name) =
       lower(btrim(v_a.name)) then
    v_target_description :=
      v_a.description;
  elsif lower(v_target_name) =
          lower(btrim(v_b.name)) then
    v_target_description :=
      v_b.description;
  elsif v_a.description is not distinct from
        v_b.description then
    v_target_description :=
      v_a.description;
  else
    v_target_description := null;
  end if;

  select project_id
  into v_project_a
  from public.project_activity_labels
  where activity_label_id =
    v_a.id;

  select project_id
  into v_project_b
  from public.project_activity_labels
  where activity_label_id =
    v_b.id;

  if v_project_a is not null
     and v_project_b is not null
     and v_project_a <> v_project_b then
    raise exception
      'The activity labels belong to different Projects and cannot be consolidated'
      using errcode = '23514';
  end if;

  v_project_id :=
    coalesce(
      v_project_a,
      v_project_b
    );

  select teaching_id
  into v_teaching_a
  from public.teaching_activity_labels
  where activity_label_id =
    v_a.id;

  select teaching_id
  into v_teaching_b
  from public.teaching_activity_labels
  where activity_label_id =
    v_b.id;

  if v_teaching_a is not null
     and v_teaching_b is not null
     and v_teaching_a <> v_teaching_b then
    raise exception
      'The activity labels belong to different Teaching Portfolio items and cannot be consolidated'
      using errcode = '23514';
  end if;

  v_teaching_id :=
    coalesce(
      v_teaching_a,
      v_teaching_b
    );

  if v_teaching_id is not null
     and v_major_activity is distinct from 'teaching' then
    raise exception
      'A Teaching Portfolio label must remain classified as Teaching'
      using errcode = '23514';
  end if;

  update public.activity_labels
  set
    is_active = false,
    merged_into_id =
      v_target_id,
    merged_at =
      v_merged_at
  where id in (
    v_a.id,
    v_b.id
  );

  insert into public.activity_labels (
    id,
    owner_id,
    name,
    description,
    is_system,
    is_break,
    is_active,
    major_activity
  )
  values (
    v_target_id,
    v_a.owner_id,
    v_target_name,
    v_target_description,
    false,
    false,
    true,
    v_major_activity
  );

  update public.work_sessions
  set activity_label_id =
    v_target_id
  where activity_label_id in (
    v_a.id,
    v_b.id
  );

  delete from public.project_activity_labels
  where activity_label_id in (
    v_a.id,
    v_b.id
  );

  if v_project_id is not null then
    insert into public.project_activity_labels (
      project_id,
      activity_label_id
    )
    values (
      v_project_id,
      v_target_id
    );
  end if;

  delete from public.teaching_activity_labels
  where activity_label_id in (
    v_a.id,
    v_b.id
  );

  if v_teaching_id is not null then
    insert into public.teaching_activity_labels (
      teaching_id,
      activity_label_id
    )
    values (
      v_teaching_id,
      v_target_id
    );
  end if;

  return v_target_id;
end;
$$;

comment on function public.consolidate_activity_labels(uuid, uuid, text) is
  'Atomically consolidates two active custom activity labels into a new canonical label, reassigns work sessions and compatible Project/Teaching links, and retains both sources as immutable provenance records.';

revoke all
  on function public.consolidate_activity_labels(uuid, uuid, text)
  from public, anon;

grant execute
  on function public.consolidate_activity_labels(uuid, uuid, text)
  to authenticated, service_role;

create or replace function public.consolidate_location_labels(
  p_source_a_id uuid,
  p_source_b_id uuid,
  p_target_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_a public.location_labels%rowtype;
  v_b public.location_labels%rowtype;
  v_target_id uuid := gen_random_uuid();
  v_target_name text := btrim(p_target_name);
  v_target_description text;
  v_target_default boolean;
  v_merged_at timestamptz := now();
begin
  if p_source_a_id is null
     or p_source_b_id is null
     or p_source_a_id = p_source_b_id then
    raise exception
      'Choose two different location labels'
      using errcode = '22023';
  end if;

  if v_target_name = '' then
    raise exception
      'The new location-label name is required'
      using errcode = '22023';
  end if;

  select *
  into v_a
  from public.location_labels
  where id = p_source_a_id
  for update;

  if not found then
    raise exception
      'The first location label was not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_b
  from public.location_labels
  where id = p_source_b_id
  for update;

  if not found then
    raise exception
      'The second location label was not found'
      using errcode = 'P0002';
  end if;

  if v_a.owner_id <> v_b.owner_id then
    raise exception
      'Location labels must belong to the same dashboard'
      using errcode = '23514';
  end if;

  if not private.is_dashboard_owner(v_a.owner_id) then
    raise exception
      'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  if not v_a.is_active
     or not v_b.is_active
     or v_a.merged_into_id is not null
     or v_b.merged_into_id is not null then
    raise exception
      'Only active, unmerged location labels can be consolidated'
      using errcode = '23514';
  end if;

  if lower(v_target_name) =
       lower(btrim(v_a.name)) then
    v_target_description :=
      v_a.description;
  elsif lower(v_target_name) =
          lower(btrim(v_b.name)) then
    v_target_description :=
      v_b.description;
  elsif v_a.description is not distinct from
        v_b.description then
    v_target_description :=
      v_a.description;
  else
    v_target_description := null;
  end if;

  v_target_default :=
    v_a.is_default
    or v_b.is_default;

  update public.location_labels
  set
    is_active = false,
    is_default = false,
    merged_into_id =
      v_target_id,
    merged_at =
      v_merged_at
  where id in (
    v_a.id,
    v_b.id
  );

  insert into public.location_labels (
    id,
    owner_id,
    name,
    description,
    is_active,
    is_default
  )
  values (
    v_target_id,
    v_a.owner_id,
    v_target_name,
    v_target_description,
    true,
    false
  );

  if v_target_default then
    update public.location_labels
    set is_default = true
    where id =
      v_target_id;
  end if;

  return v_target_id;
end;
$$;

comment on function public.consolidate_location_labels(uuid, uuid, text) is
  'Atomically consolidates two active managed locations into a new canonical location while preserving historical work-session place text and retaining both source labels as immutable provenance records.';

revoke all
  on function public.consolidate_location_labels(uuid, uuid, text)
  from public, anon;

grant execute
  on function public.consolidate_location_labels(uuid, uuid, text)
  to authenticated, service_role;
