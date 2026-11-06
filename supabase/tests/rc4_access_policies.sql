-- Velvet Torch rc.4 access policy suite.
--
-- Run the whole file in the Supabase SQL editor. It impersonates temporary QA
-- accounts and always ends with ROLLBACK, so nothing it writes persists.
-- A failed assertion raises an exception naming the check; success ends with
-- a single row: 'rc.4 access policy suite passed'.
--
-- Before running, replace the four placeholder UUIDs below:
--   editor_id     a temporary Website Editor account (assigned to paper_id)
--   viewer_id     a temporary Viewer account
--   paper_id      a disposable test Paper assigned to the editor
--   other_paper   any Paper NOT assigned to the editor
--
-- Before the release-window migration retires Coauthor access, accepted
-- invitations also create legacy Coauthor rows; the suite removes the
-- editor's Coauthor rows inside the transaction to test the rc.4 state.

begin;

create temporary table rc4_qa on commit drop as
select
  '00000000-0000-0000-0000-000000000001'::uuid as editor_id,
  '00000000-0000-0000-0000-000000000002'::uuid as viewer_id,
  '00000000-0000-0000-0000-000000000003'::uuid as paper_id,
  '00000000-0000-0000-0000-000000000004'::uuid as other_paper;

-- Preconditions -------------------------------------------------------------------

do $$
declare
  v record;
begin
  select * into v from pg_temp.rc4_qa;

  if v.editor_id = '00000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Replace the placeholder UUIDs at the top of the suite first';
  end if;

  if not exists (
    select 1
    from public.paper_website_editors
    where user_id = v.editor_id
      and paper_id = v.paper_id
  ) then
    raise exception 'Precondition: editor_id must be a Website Editor of paper_id';
  end if;

  if exists (
    select 1
    from public.paper_website_editors
    where user_id = v.editor_id
      and paper_id = v.other_paper
  ) then
    raise exception 'Precondition: other_paper must not be assigned to editor_id';
  end if;

  if exists (
    select 1
    from public.dashboard_members
    where user_id = v.editor_id
  ) then
    raise exception 'Precondition: editor_id must not have Dashboard membership';
  end if;

  if not exists (
    select 1
    from public.dashboard_members
    where user_id = v.viewer_id
      and role = 'viewer'
  ) then
    raise exception 'Precondition: viewer_id must be a Dashboard Viewer';
  end if;

  delete from public.paper_members
  where user_id = v.editor_id
    and role = 'coauthor';
end;
$$;

-- Snapshot Owner-only Website fields so the editor write can be compared.
alter table pg_temp.rc4_qa
  add column highlight_text_before text,
  add column highlight_image_before text,
  add column visibility_before text,
  add column slug_before text,
  add column featured_before boolean;

update pg_temp.rc4_qa q
set
  highlight_text_before = m.highlight_text,
  highlight_image_before = m.highlight_image_filename,
  visibility_before = m.visibility,
  slug_before = m.slug,
  featured_before = m.featured
from public.paper_public_metadata m
where m.paper_id = q.paper_id;

-- Website Editor isolation ----------------------------------------------------------

do $$
declare
  v record;
  v_table text;
  v_count bigint;
  v_rows bigint;
begin
  select * into v from pg_temp.rc4_qa;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v.editor_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  foreach v_table in array array[
    'papers',
    'paper_authors',
    'paper_links',
    'paper_notes',
    'paper_milestones',
    'paper_history',
    'paper_members',
    'paper_public_metadata',
    'citation_snapshots',
    'authors',
    'projects',
    'project_papers',
    'external_publications',
    'project_external_publications',
    'conference_presentations',
    'teaching_portfolio',
    'software_items',
    'dashboard_members',
    'access_invitations',
    'access_invitation_papers',
    'access_audit_log',
    'daily_logs',
    'work_sessions',
    'planning_periods',
    'planning_allocations'
  ] loop
    begin
      execute format('select count(*) from public.%I', v_table)
        into v_count;
    exception
      when insufficient_privilege then
        v_count := 0;
    end;

    if v_count <> 0 then
      raise exception 'Editor can read % row(s) from %', v_count, v_table;
    end if;
  end loop;

  select count(*) into v_count
  from public.profiles
  where id <> v.editor_id;

  if v_count <> 0 then
    raise exception 'Editor can read % other profile(s)', v_count;
  end if;

  select count(*) into v_count
  from public.paper_website_editors
  where user_id <> v.editor_id;

  if v_count <> 0 then
    raise exception 'Editor can read other Website Editor assignments';
  end if;

  -- Direct writes are refused or touch nothing.
  begin
    update public.papers
    set language = language
    where id = v.paper_id;
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then
      v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'Editor updated papers directly';
  end if;

  begin
    update public.paper_public_metadata
    set visibility = visibility,
        slug = slug,
        featured = featured
    where paper_id = v.paper_id;
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then
      v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'Editor updated Website visibility, slug or Featured directly';
  end if;

  begin
    insert into public.paper_website_editors (paper_id, user_id)
    values (v.other_paper, v.editor_id);
    raise exception 'Editor inserted a Website Editor assignment';
  exception
    when insufficient_privilege then
      null;
  end;

  -- The read RPCs return only the assigned Paper.
  select count(*) into v_count
  from public.list_my_website_editor_papers()
  where paper_id <> v.paper_id
    and paper_id not in (
      select paper_id
      from public.paper_website_editors
      where user_id = v.editor_id
    );

  if v_count <> 0 then
    raise exception 'list_my_website_editor_papers returned unassigned papers';
  end if;

  select count(*) into v_count
  from public.get_website_editor_paper(v.other_paper);

  if v_count <> 0 then
    raise exception 'get_website_editor_paper returned an unassigned paper';
  end if;

  -- The citation RPC works on the assigned Paper only.
  perform public.update_paper_website_content(
    v.paper_id,
    'Working paper',
    'rc.4 QA citation'
  );

  begin
    perform public.update_paper_website_content(
      v.other_paper,
      null,
      'rc.4 QA citation'
    );
    raise exception 'Editor updated an unassigned paper';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.set_website_editor_paper_assignments(
      v.editor_id,
      array[v.other_paper]
    );
    raise exception 'Editor ran the Owner assignment RPC';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);
end;
$$;

-- The citation RPC changed only the citation fields -----------------------------

do $$
declare
  v record;
  m record;
begin
  select * into v from pg_temp.rc4_qa;

  select * into m
  from public.paper_public_metadata
  where paper_id = v.paper_id;

  if m.citation is distinct from 'rc.4 QA citation'
     or m.publication_index is distinct from 'Working paper' then
    raise exception 'Website citation RPC did not store the citation fields';
  end if;

  if m.highlight_text is distinct from v.highlight_text_before
     or m.highlight_image_filename is distinct from v.highlight_image_before
     or m.visibility is distinct from v.visibility_before
     or m.slug is distinct from v.slug_before
     or m.featured is distinct from v.featured_before then
    raise exception 'Website citation RPC changed Owner-only Website fields';
  end if;

  if not exists (
    select 1
    from public.access_audit_log
    where event_type = 'website_content_updated'
      and target_user_id = v.editor_id
      and paper_id = v.paper_id
  ) then
    raise exception 'Website content edit was not audited';
  end if;
end;
$$;

-- Viewer stays read-only -----------------------------------------------------------------

do $$
declare
  v record;
  v_count bigint;
  v_rows bigint;
begin
  select * into v from pg_temp.rc4_qa;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v.viewer_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  select count(*) into v_count
  from public.papers;

  if v_count = 0 then
    raise exception 'Viewer can no longer read papers';
  end if;

  begin
    update public.papers
    set language = language
    where id = v.paper_id;
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then
      v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'Viewer updated papers';
  end if;

  begin
    perform public.update_paper_website_content(
      v.paper_id,
      null,
      'viewer write'
    );
    raise exception 'Viewer updated Website content';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.create_my_external_publication(
      'Viewer submission',
      array['A. Viewer'],
      2026
    );
    raise exception 'Viewer submitted an external publication';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);
end;
$$;

-- Website Editor external publications ---------------------------------------------

do $$
declare
  v record;
  v_id uuid;
  v_count bigint;
  v_rows bigint;
  e record;
begin
  select * into v from pg_temp.rc4_qa;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v.editor_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  v_id := public.create_my_external_publication(
    'rc.4 QA external publication',
    array['A. Partner', ' ', 'B. Partner'],
    2025,
    null,
    'QA Venue',
    null,
    'https://example.org/rc4-qa',
    'English'
  );

  select count(*) into v_count
  from public.list_my_external_publications()
  where id = v_id
    and visibility = 'private'
    and authors = array['A. Partner', 'B. Partner'];

  if v_count <> 1 then
    raise exception 'Editor publication was not stored Private with normalised authors';
  end if;

  -- No direct table writes or Project links.
  begin
    update public.external_publications
    set visibility = 'public'
    where id = v_id;
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then
      v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'Editor published an external publication directly';
  end if;

  begin
    insert into public.project_external_publications (
      project_id,
      external_publication_id
    )
    select p.id, v_id
    from public.projects p
    limit 1;
    raise exception 'Editor linked an external publication to a Project';
  exception
    when insufficient_privilege then
      null;
  end;

  perform public.update_my_external_publication(
    v_id,
    'rc.4 QA external publication (edited)',
    array['A. Partner'],
    2025
  );

  perform set_config('role', 'none', true);

  select * into e
  from public.external_publications
  where id = v_id;

  if e.created_by is distinct from v.editor_id
     or e.visibility <> 'private'
     or e.title <> 'rc.4 QA external publication (edited)' then
    raise exception 'Editor publication has the wrong owner, visibility or title';
  end if;

  if exists (
    select 1
    from public.project_external_publications
    where external_publication_id = v_id
  ) then
    raise exception 'Editor publication gained Project links';
  end if;

  if not exists (
    select 1
    from public.access_audit_log
    where event_type = 'external_publication_submitted'
      and target_user_id = v.editor_id
      and details ->> 'external_publication_id' = v_id::text
  ) then
    raise exception 'Editor publication submission was not audited';
  end if;

  -- Once the Owner publishes it, the editor can no longer change it.
  update public.external_publications
  set visibility = 'public'
  where id = v_id;

  perform set_config('role', 'authenticated', true);

  begin
    perform public.update_my_external_publication(
      v_id,
      'Editor change after publication',
      array['A. Partner'],
      2025
    );
    raise exception 'Editor edited a published external publication';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.delete_my_external_publication(v_id);
    raise exception 'Editor deleted a published external publication';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);
end;
$$;

-- Anonymous surface ---------------------------------------------------------------------

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
    'list_public_conference_presentations',
    'list_public_paper_milestones',
    'list_public_papers',
    'list_public_planning_allocations',
    'list_public_project_publications',
    'list_public_projects',
    'list_public_software',
    'list_public_teaching'
  ];
  v_actual text[];
  v_tables text[];
  v_rls_tables text[];
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

  -- Anon table privileges are only safe behind RLS with no anon policy.
  select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    into v_tables
  from pg_class c
  join pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'v', 'm', 'p')
    and (
      has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE')
    )
    and (
      not c.relrowsecurity
      or exists (
        select 1
        from pg_policies pol
        where pol.schemaname = 'public'
          and pol.tablename = c.relname
          and (
            'anon' = any(pol.roles)
            or 'public' = any(pol.roles)
          )
      )
    );

  if cardinality(v_tables) > 0 then
    raise exception 'Anon can reach these tables without RLS protection: %', v_tables;
  end if;

  select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    into v_rls_tables
  from pg_class c
  join pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and has_table_privilege('anon', c.oid, 'SELECT');

  if cardinality(v_rls_tables) > 0 then
    raise notice 'Anon keeps RLS-filtered SELECT privilege on: %', v_rls_tables;
  end if;
end;
$$;

select 'rc.4 access policy suite passed' as result;

rollback;
