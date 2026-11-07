-- Collection access suite for Steady Orchard rc.6 (own Papers in collections).
--
-- Run the whole file in the Supabase SQL editor after the
-- 20261107191338_add_paper_collections.sql migration. It needs no test
-- accounts and no placeholders: it acts as the Dashboard Owner, as an
-- unknown signed-in user and as anonymous, and uses an existing Viewer or
-- Website Editor only if one exists. It creates a temporary collection and
-- always ends with ROLLBACK, so nothing it writes persists.
-- A failed assertion raises an exception naming the check; success ends with
-- a single row: 'rc.6 collection policy suite passed'.

begin;

-- Setup (as the database owner) -------------------------------------------------------

do $$
declare
  v_owner_id uuid;
  v_public_paper uuid;
  v_private_paper uuid;
begin
  select dm.owner_id
    into v_owner_id
  from public.dashboard_members dm
  where dm.role = 'owner'
    and dm.user_id = dm.owner_id
  limit 1;

  if v_owner_id is null then
    raise exception 'Precondition: no Dashboard Owner found';
  end if;

  select p.id
    into v_public_paper
  from public.papers p
  join public.paper_public_metadata m
    on m.paper_id = p.id
  where p.owner_id = v_owner_id
    and m.visibility = 'public'
    and m.slug is not null
  order by p.id
  limit 1;

  select p.id
    into v_private_paper
  from public.papers p
  join public.paper_public_metadata m
    on m.paper_id = p.id
  where p.owner_id = v_owner_id
    and m.visibility <> 'public'
  order by p.id
  limit 1;

  if v_public_paper is null then
    raise exception 'Precondition: the Owner needs at least one Public Paper with a slug';
  end if;

  perform set_config('rc6.owner_id', v_owner_id::text, true);
  perform set_config('rc6.public_paper', v_public_paper::text, true);
  perform set_config('rc6.private_paper', coalesce(v_private_paper::text, ''), true);
end;
$$;

-- Owner: create a collection and set a Paper's collections ----------------------------

do $$
declare
  v_owner_id uuid := current_setting('rc6.owner_id')::uuid;
  v_public_paper uuid := current_setting('rc6.public_paper')::uuid;
  v_private_paper uuid := nullif(current_setting('rc6.private_paper'), '')::uuid;
  v_collection_id uuid;
  v_count bigint;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  insert into public.external_publication_collections (
    owner_id,
    slug,
    name
  )
  values (
    v_owner_id,
    'rc6-qa-collection',
    'rc.6 QA collection'
  )
  returning id into v_collection_id;

  perform set_config('rc6.collection_id', v_collection_id::text, true);

  perform public.set_paper_collections(
    v_public_paper,
    array[v_collection_id]
  );

  select count(*)
    into v_count
  from public.paper_collection_items
  where collection_id = v_collection_id
    and paper_id = v_public_paper;

  if v_count <> 1 then
    raise exception 'Owner could not add a Paper to a collection';
  end if;

  -- Setting the same collections again changes nothing.
  perform public.set_paper_collections(
    v_public_paper,
    array[v_collection_id, v_collection_id]
  );

  select count(*)
    into v_count
  from public.paper_collection_items
  where paper_id = v_public_paper
    and collection_id = v_collection_id;

  if v_count <> 1 then
    raise exception 'Repeated collection ids created duplicate items';
  end if;

  -- An empty list removes the Paper from the collection.
  perform public.set_paper_collections(
    v_public_paper,
    '{}'::uuid[]
  );

  select count(*)
    into v_count
  from public.paper_collection_items
  where collection_id = v_collection_id;

  if v_count <> 0 then
    raise exception 'Owner could not remove a Paper from a collection';
  end if;

  perform public.set_paper_collections(
    v_public_paper,
    array[v_collection_id]
  );

  if v_private_paper is not null then
    perform public.set_paper_collections(
      v_private_paper,
      array[v_collection_id]
    );
  end if;

  -- An unknown or foreign collection is refused.
  begin
    perform public.set_paper_collections(
      v_public_paper,
      array[gen_random_uuid()]
    );
    raise exception 'An unavailable collection was accepted';
  exception
    when invalid_parameter_value then
      null;
  end;

  -- Items are written only through the RPC.
  begin
    insert into public.paper_collection_items (
      collection_id,
      paper_id
    )
    values (
      v_collection_id,
      v_public_paper
    );
    raise exception 'A direct insert into paper_collection_items was allowed';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);
end;
$$;

-- Unknown signed-in user: no rows, no writes ------------------------------------------

do $$
declare
  v_public_paper uuid := current_setting('rc6.public_paper')::uuid;
  v_collection_id uuid := current_setting('rc6.collection_id')::uuid;
  v_count bigint;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  select count(*)
    into v_count
  from public.paper_collection_items;

  if v_count <> 0 then
    raise exception 'An unknown signed-in user can read paper_collection_items';
  end if;

  begin
    perform public.set_paper_collections(
      v_public_paper,
      array[v_collection_id]
    );
    raise exception 'An unknown signed-in user could set a Paper''s collections';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);
end;
$$;

-- Existing Viewer and Website Editor, when there are any -------------------------------

do $$
declare
  v_owner_id uuid := current_setting('rc6.owner_id')::uuid;
  v_public_paper uuid := current_setting('rc6.public_paper')::uuid;
  v_collection_id uuid := current_setting('rc6.collection_id')::uuid;
  v_viewer_id uuid;
  v_editor_id uuid;
  v_count bigint;
begin
  select dm.user_id
    into v_viewer_id
  from public.dashboard_members dm
  where dm.owner_id = v_owner_id
    and dm.role = 'viewer'
  limit 1;

  select pwe.user_id
    into v_editor_id
  from public.paper_website_editors pwe
  where not exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = pwe.user_id
  )
  limit 1;

  if v_viewer_id is null then
    raise notice 'No Viewer account: Viewer checks skipped';
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_viewer_id, 'role', 'authenticated')::text,
      true
    );
    perform set_config('role', 'authenticated', true);

    select count(*)
      into v_count
    from public.paper_collection_items
    where collection_id = v_collection_id;

    if v_count = 0 then
      raise exception 'A Viewer cannot read paper_collection_items';
    end if;

    begin
      perform public.set_paper_collections(
        v_public_paper,
        '{}'::uuid[]
      );
      raise exception 'A Viewer could set a Paper''s collections';
    exception
      when insufficient_privilege then
        null;
    end;

    perform set_config('role', 'none', true);
  end if;

  if v_editor_id is null then
    raise notice 'No Website Editor account: Website Editor checks skipped';
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_editor_id, 'role', 'authenticated')::text,
      true
    );
    perform set_config('role', 'authenticated', true);

    select count(*)
      into v_count
    from public.paper_collection_items;

    if v_count <> 0 then
      raise exception 'A Website Editor can read paper_collection_items';
    end if;

    begin
      perform public.set_paper_collections(
        v_public_paper,
        '{}'::uuid[]
      );
      raise exception 'A Website Editor could set a Paper''s collections';
    exception
      when insufficient_privilege then
        null;
    end;

    perform set_config('role', 'none', true);
  end if;
end;
$$;

-- Anonymous: the feed shows only Public Papers; the table stays closed ---------------

do $$
declare
  v_public_paper uuid := current_setting('rc6.public_paper')::uuid;
  v_private_paper uuid := nullif(current_setting('rc6.private_paper'), '')::uuid;
  v_public_slug text;
  v_count bigint;
begin
  select m.slug
    into v_public_slug
  from public.paper_public_metadata m
  where m.paper_id = v_public_paper;

  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
  perform set_config('role', 'anon', true);

  select count(*)
    into v_count
  from public.list_public_collection_publications() f
  where f.collection_slug = 'rc6-qa-collection'
    and f.authorship = 'own'
    and f.publication_slug = v_public_slug;

  if v_count <> 1 then
    raise exception 'The collection feed does not list the Public Paper';
  end if;

  select count(*)
    into v_count
  from public.list_public_collection_publications() f
  where f.collection_slug = 'rc6-qa-collection';

  if v_count <> 1 then
    raise exception 'The collection feed lists % rows for the QA collection; expected only the Public Paper%',
      v_count,
      case when v_private_paper is null then '' else ' (the Private Paper must not appear)' end;
  end if;

  begin
    select count(*)
      into v_count
    from public.paper_collection_items;

    if v_count <> 0 then
      raise exception 'Anonymous users can read paper_collection_items';
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.set_paper_collections(
      v_public_paper,
      '{}'::uuid[]
    );
    raise exception 'Anonymous users could call set_paper_collections';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);
end;
$$;

-- Anonymous EXECUTE surface ----------------------------------------------------------------

do $$
declare
  v_expected text[] := array[
    'get_public_calendar_settings',
    'get_public_paper',
    'get_public_project',
    'get_public_software',
    'get_public_teaching_settings',
    'get_public_work_analytics',
    'list_public_availability',
    'list_public_collection_publications',
    'list_public_conference_presentations',
    'list_public_external_publications',
    'list_public_paper_milestones',
    'list_public_papers',
    'list_public_planning_allocations',
    'list_public_project_publications',
    'list_public_projects',
    'list_public_software',
    'list_public_teaching'
  ];
  v_actual text[];
begin
  select coalesce(array_agg(p.proname::text order by p.proname), '{}')
    into v_actual
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if v_actual is distinct from v_expected then
    raise exception 'Anon EXECUTE set differs. Expected %, actual %',
      v_expected,
      v_actual;
  end if;
end;
$$;

select 'rc.6 collection policy suite passed' as result;

rollback;
