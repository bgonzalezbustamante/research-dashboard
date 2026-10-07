-- rc.3: separate mixed-purpose consultancy work from the broader Empiria Lab label.
--
-- This is intentionally narrow and guarded. It preserves the source label's
-- major-activity classification and description, creates a dedicated Project
-- label, and moves only the Paper-linked sessions for the Time Use consultancy.

do $$
declare
  v_project_id uuid;
  v_owner_id uuid;
  v_paper_id uuid;
  v_source_label_id uuid;
  v_target_label_id uuid := gen_random_uuid();
  v_source_description text;
  v_source_major_activity text;
  v_session_count integer;
  v_total_minutes numeric;
  v_updated integer;
begin
  select
    p.id,
    p.owner_id
  into strict
    v_project_id,
    v_owner_id
  from public.projects p
  where p.short_title =
      'Time Use consultancy'
    and p.title =
      'Time Use and Relationship with Cultural Participation Profiles';

  select
    paper.id
  into strict
    v_paper_id
  from public.papers paper
  join public.project_papers pp
    on pp.paper_id =
      paper.id
  where pp.project_id =
      v_project_id
    and paper.short_title =
      'Estudio análisis de uso del tiempo'
    and paper.owner_id =
      v_owner_id;

  select
    label.id,
    label.description,
    label.major_activity
  into strict
    v_source_label_id,
    v_source_description,
    v_source_major_activity
  from public.activity_labels label
  where label.owner_id =
      v_owner_id
    and lower(btrim(label.name)) =
      lower(btrim('Empiria Lab'))
    and label.merged_into_id is null;

  if exists (
    select 1
    from public.project_activity_labels pal
    where pal.project_id =
      v_project_id
  ) then
    raise exception
      'Time Use consultancy already has an Activity-label assignment'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.project_activity_labels pal
    where pal.activity_label_id =
      v_source_label_id
  ) then
    raise exception
      'Empiria Lab is already assigned to a Project'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.activity_labels label
    where label.owner_id =
        v_owner_id
      and lower(btrim(label.name)) =
        lower(btrim('Time Use consultancy'))
      and label.merged_into_id is null
  ) then
    raise exception
      'A canonical Time Use consultancy Activity label already exists'
      using errcode = '23514';
  end if;

  select
    count(*)::integer,
    coalesce(
      sum(
        extract(
          epoch from (
            ws.end_time -
            ws.start_time
          )
        ) / 60.0
      ),
      0
    )
  into
    v_session_count,
    v_total_minutes
  from public.work_sessions ws
  where ws.paper_id =
      v_paper_id
    and ws.activity_label_id =
      v_source_label_id;

  if v_session_count <> 30
     or v_total_minutes <> 5760 then
    raise exception
      'Expected 30 Empiria Lab sessions / 5760 minutes for the Time Use Paper, found % sessions / % minutes',
      v_session_count,
      v_total_minutes
      using errcode = '23514';
  end if;

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
    v_target_label_id,
    v_owner_id,
    'Time Use consultancy',
    v_source_description,
    false,
    false,
    true,
    v_source_major_activity
  );

  insert into public.project_activity_labels (
    project_id,
    activity_label_id
  )
  values (
    v_project_id,
    v_target_label_id
  );

  update public.work_sessions
  set activity_label_id =
    v_target_label_id
  where paper_id =
      v_paper_id
    and activity_label_id =
      v_source_label_id;

  get diagnostics
    v_updated = row_count;

  if v_updated <> 30 then
    raise exception
      'Expected to move 30 Time Use work sessions, moved %',
      v_updated
      using errcode = '23514';
  end if;
end;
$$;
