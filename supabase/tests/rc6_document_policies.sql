-- Document registry suite for Steady Orchard rc.6.
--
-- Run the whole file in the Supabase SQL editor after the
-- 20261124103453_add_document_registry.sql migration. It needs no test
-- accounts and no placeholders: it acts as the Dashboard Owner, as an
-- unknown signed-in user and as anonymous, and uses an existing Viewer only
-- if one exists. It registers a synthetic document and a synthetic historical
-- record and always ends with ROLLBACK, so nothing it writes persists.
-- A failed assertion raises an exception naming the check; success ends with
-- a single row: 'rc.6 document registry suite passed'.

begin;

-- Setup (as the database owner) -------------------------------------------------------

do $$
declare
  v_owner_id uuid;
  v_audit_before bigint;
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

  select count(*)
    into v_audit_before
  from public.access_audit_log
  where owner_id = v_owner_id
    and event_type in (
      'document_registered',
      'document_revoked',
      'document_removed',
      'legacy_documents_imported'
    );

  perform set_config('rc6.owner_id', v_owner_id::text, true);
  perform set_config('rc6.audit_before', v_audit_before::text, true);
end;
$$;

-- Owner: register, revoke, remove, import -------------------------------------------------

do $$
declare
  v_owner_id uuid := current_setting('rc6.owner_id')::uuid;
  v_count bigint;
  v_status text;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  perform public.register_signed_document(
    ' 0123456789ABCDEF0123456789ABCDEF ',
    'rc.6 QA document',
    '2026-11-22T10:00:00Z',
    repeat('A', 64)
  );

  select count(*)
    into v_count
  from public.signed_documents
  where code = '0123456789abcdef0123456789abcdef'
    and sha256 = repeat('a', 64)
    and status = 'registered';

  if v_count <> 1 then
    raise exception 'Owner could not register a signed document (or the code and hash were not normalised)';
  end if;

  begin
    perform public.register_signed_document(
      '0123456789abcdef0123456789abcdef',
      'rc.6 QA duplicate',
      '2026-11-22T10:00:00Z',
      repeat('b', 64)
    );
    raise exception 'A duplicate code was accepted';
  exception
    when unique_violation then
      null;
  end;

  begin
    perform public.register_signed_document(
      'not-a-code',
      'rc.6 QA invalid',
      '2026-11-22T10:00:00Z',
      repeat('b', 64)
    );
    raise exception 'An invalid code was accepted';
  exception
    when check_violation then
      null;
  end;

  perform public.revoke_signed_document(
    '0123456789abcdef0123456789abcdef',
    'rc.6 QA revocation'
  );

  select status
    into v_status
  from public.signed_documents
  where code = '0123456789abcdef0123456789abcdef'
    and revoked_at is not null
    and revocation_note = 'rc.6 QA revocation';

  if v_status is distinct from 'revoked' then
    raise exception 'Owner could not revoke a signed document';
  end if;

  begin
    perform public.revoke_signed_document(
      '0123456789abcdef0123456789abcdef',
      null
    );
    raise exception 'A revoked document was revoked again';
  exception
    when no_data_found then
      null;
  end;

  perform public.remove_signed_document(
    '0123456789abcdef0123456789abcdef'
  );

  select count(*)
    into v_count
  from public.signed_documents
  where code = '0123456789abcdef0123456789abcdef';

  if v_count <> 0 then
    raise exception 'Owner could not remove a signed document';
  end if;

  -- Registered again for the anonymous checks below.
  perform public.register_signed_document(
    '0123456789abcdef0123456789abcdef',
    'rc.6 QA document',
    '2026-11-22T10:00:00Z',
    repeat('a', 64)
  );

  if public.import_legacy_documents(
    jsonb_build_array(
      jsonb_build_object(
        'slug', '1900-01-02-document',
        'title', 'rc.6 QA historical record',
        'issued_at', '1900-01-02T10:00:00+01:00',
        'fingerprint', repeat('C', 32),
        'original_url', 'https://bgonzalezbustamante.com/validation/docs/1900-01-02-document/'
      )
    )
  ) <> 1 then
    raise exception 'Owner could not import a historical record';
  end if;

  -- Importing the same slug again updates it rather than adding a row.
  perform public.import_legacy_documents(
    jsonb_build_array(
      jsonb_build_object(
        'slug', '1900-01-02-document',
        'title', 'rc.6 QA historical record, corrected',
        'issued_at', '1900-01-02T10:00:00+01:00',
        'fingerprint', repeat('c', 32),
        'original_url', 'https://bgonzalezbustamante.com/validation/docs/1900-01-02-document/'
      )
    )
  );

  select count(*)
    into v_count
  from public.legacy_documents
  where slug = '1900-01-02-document'
    and title = 'rc.6 QA historical record, corrected'
    and fingerprint = repeat('c', 32);

  if v_count <> 1 then
    raise exception 'Re-importing a historical record did not update it in place';
  end if;

  begin
    perform public.import_legacy_documents('{}'::jsonb);
    raise exception 'A non-array legacy import was accepted';
  exception
    when invalid_parameter_value then
      null;
  end;

  begin
    perform public.import_legacy_documents(
      jsonb_build_array(
        jsonb_build_object(
          'slug', '1900-01-03-document',
          'title', 'rc.6 QA mismatched address',
          'issued_at', '1900-01-03',
          'fingerprint', repeat('d', 32),
          'original_url', 'https://bgonzalezbustamante.com/validation/docs/1900-01-02-document/'
        )
      )
    );
    raise exception 'A historical record whose address does not match its slug was accepted';
  exception
    when check_violation then
      null;
  end;

  perform set_config('role', 'none', true);
end;
$$;

-- Audit trail -------------------------------------------------------------------------------

do $$
declare
  v_owner_id uuid := current_setting('rc6.owner_id')::uuid;
  v_before bigint := current_setting('rc6.audit_before')::bigint;
  v_after bigint;
begin
  select count(*)
    into v_after
  from public.access_audit_log
  where owner_id = v_owner_id
    and event_type in (
      'document_registered',
      'document_revoked',
      'document_removed',
      'legacy_documents_imported'
    );

  -- registered, revoked, removed, registered again, imported twice
  if v_after - v_before <> 6 then
    raise exception 'Expected 6 document audit events, found %', v_after - v_before;
  end if;
end;
$$;

-- Unknown user and Viewer: no reads, no writes ----------------------------------------------

do $$
declare
  v_owner_id uuid := current_setting('rc6.owner_id')::uuid;
  v_viewer_id uuid;
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
  from public.signed_documents;

  if v_count <> 0 then
    raise exception 'An unknown signed-in user can read signed_documents';
  end if;

  select count(*)
    into v_count
  from public.legacy_documents;

  if v_count <> 0 then
    raise exception 'An unknown signed-in user can read legacy_documents';
  end if;

  begin
    perform public.revoke_signed_document(
      '0123456789abcdef0123456789abcdef',
      null
    );
    raise exception 'An unknown signed-in user could revoke a document';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('role', 'none', true);

  select dm.user_id
    into v_viewer_id
  from public.dashboard_members dm
  where dm.owner_id = v_owner_id
    and dm.role = 'viewer'
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
    from public.signed_documents;

    if v_count <> 0 then
      raise exception 'A Viewer can read signed_documents';
    end if;

    begin
      perform public.remove_signed_document(
        '0123456789abcdef0123456789abcdef'
      );
      raise exception 'A Viewer could remove a document';
    exception
      when insufficient_privilege then
        null;
    end;

    perform set_config('role', 'none', true);
  end if;
end;
$$;

-- Anonymous: one record per lookup; the tables and Owner RPCs stay closed -------------------

do $$
declare
  v_count bigint;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
  perform set_config('role', 'anon', true);

  select count(*)
    into v_count
  from public.get_public_signed_document(' 0123456789ABCDEF0123456789ABCDEF ') d
  where d.title = 'rc.6 QA document'
    and d.status = 'registered'
    and d.revoked_at is null;

  if v_count <> 1 then
    raise exception 'get_public_signed_document did not return the registered document';
  end if;

  select count(*)
    into v_count
  from public.get_public_signed_document('ffffffffffffffffffffffffffffffff');

  if v_count <> 0 then
    raise exception 'get_public_signed_document returned a row for an unknown code';
  end if;

  select count(*)
    into v_count
  from public.get_public_legacy_document('1900-01-02-document') l
  where l.fingerprint_algorithm = 'unconfirmed-32-hex'
    and l.issued_at = '1900-01-02T10:00:00+01:00';

  if v_count <> 1 then
    raise exception 'get_public_legacy_document did not return the historical record as recorded';
  end if;

  select count(*)
    into v_count
  from public.get_public_legacy_document('1900-01-04-document');

  if v_count <> 0 then
    raise exception 'get_public_legacy_document returned a row for an unknown slug';
  end if;

  begin
    select count(*)
      into v_count
    from public.signed_documents;
    raise exception 'Anonymous users can read signed_documents';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    select count(*)
      into v_count
    from public.legacy_documents;
    raise exception 'Anonymous users can read legacy_documents';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.register_signed_document(
      'ffffffffffffffffffffffffffffffff',
      'rc.6 QA anonymous',
      '2026-11-22T10:00:00Z',
      repeat('f', 64)
    );
    raise exception 'Anonymous users could register a document';
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
    'get_public_legacy_document',
    'get_public_paper',
    'get_public_project',
    'get_public_signed_document',
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

select 'rc.6 document registry suite passed' as result;

rollback;
