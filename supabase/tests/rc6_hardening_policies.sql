-- Hardening suite for Steady Orchard rc.6.
--
-- Run the whole file in the Supabase SQL editor after the
-- 20261124122508_harden_privileges_and_access_checks.sql migration. It needs no
-- test accounts and no placeholders: it acts as the Dashboard Owner and as
-- anonymous, writes nothing that persists, and always ends with ROLLBACK.
-- A failed assertion raises an exception naming the check; success ends with
-- a single row: 'rc.6 hardening suite passed'.

begin;

-- Setup (as the database owner) -------------------------------------------------------

do $$
declare
  v_owner_id uuid;
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

  perform set_config('rc6h.owner_id', v_owner_id::text, true);
end;
$$;

-- Privileges (as the database owner) --------------------------------------------------

do $$
declare
  v_table text;
  v_function text;
begin
  -- 1. anon keeps no privileges on these tables.
  foreach v_table in array array[
    'public.dashboard_members',
    'public.location_labels'
  ] loop
    if has_table_privilege(
      'anon',
      v_table,
      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    ) then
      raise exception 'anon still holds a privilege on %', v_table;
    end if;
  end loop;

  -- 2. authenticated keeps no TRUNCATE, REFERENCES or TRIGGER on these tables.
  foreach v_table in array array[
    'public.planning_blocked_events',
    'public.planning_source_period_states',
    'public.teaching_settings',
    'public.software_items',
    'public.software_public_metadata',
    'public.calendar_settings'
  ] loop
    if has_table_privilege(
      'authenticated',
      v_table,
      'TRUNCATE, REFERENCES, TRIGGER'
    ) then
      raise exception 'authenticated still holds TRUNCATE, REFERENCES or TRIGGER on %', v_table;
    end if;
  end loop;

  -- 3. No PUBLIC EXECUTE on the six private functions.
  foreach v_function in array array[
    'private.can_view_author(uuid)',
    'private.shares_paper_with_profile(uuid)',
    'private.can_use_author_for_paper(uuid, uuid)',
    'private.resolve_author_for_paper(uuid, text)',
    'private.preserve_paper_note_creator()',
    'private.prevent_new_manual_paper_planning_allocations()'
  ] loop
    if exists (
      select 1
      from pg_proc p
      where p.oid = v_function::regprocedure
        and (
          p.proacl is null
          or exists (
            select 1
            from aclexplode(p.proacl) a
            where a.grantee = 0
              and a.privilege_type = 'EXECUTE'
          )
        )
    ) then
      raise exception 'PUBLIC can still execute %', v_function;
    end if;

    if has_function_privilege('anon', v_function, 'EXECUTE') then
      raise exception 'anon can still execute %', v_function;
    end if;
  end loop;

  -- The four helpers that RLS policies call stay executable for authenticated.
  foreach v_function in array array[
    'private.can_view_author(uuid)',
    'private.shares_paper_with_profile(uuid)',
    'private.can_use_author_for_paper(uuid, uuid)',
    'private.resolve_author_for_paper(uuid, text)'
  ] loop
    if not has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception 'authenticated lost EXECUTE on %', v_function;
    end if;
  end loop;

  -- 4. Anon-only analytics and the public trigger functions.
  if has_function_privilege('authenticated', 'public.get_public_work_analytics(integer)', 'EXECUTE') then
    raise exception 'authenticated can still execute get_public_work_analytics';
  end if;

  if not has_function_privilege('anon', 'public.get_public_work_analytics(integer)', 'EXECUTE') then
    raise exception 'anon lost EXECUTE on get_public_work_analytics';
  end if;

  foreach v_function in array array[
    'public.normalise_location_label_default()',
    'public.handle_updated_at()'
  ] loop
    if has_function_privilege('anon', v_function, 'EXECUTE')
       or has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception 'anon or authenticated can still execute %', v_function;
    end if;
  end loop;

  -- 5. Only the current teaching signatures remain.
  if to_regprocedure('public.create_teaching_with_details(text, text, text, text, integer, integer, boolean, text[], integer, integer, text, text, text, uuid[])') is not null
     or to_regprocedure('public.update_teaching_with_details(uuid, text, text, text, text, integer, integer, boolean, text[], integer, integer, text, text, text, uuid[])') is not null then
    raise exception 'A superseded teaching overload still exists';
  end if;

  if (select count(*) from pg_proc where proname = 'create_teaching_with_details') <> 1
     or (select count(*) from pg_proc where proname = 'update_teaching_with_details') <> 1 then
    raise exception 'Expected exactly one current teaching create and update function';
  end if;
end;
$$;

-- Owner: triggers still fire and access checks still pass -------------------------------

do $$
declare
  v_owner_id uuid := current_setting('rc6h.owner_id')::uuid;
  v_count bigint;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  -- Trigger functions run without an EXECUTE grant (rolled back at the end).
  update public.calendar_settings
  set updated_at = updated_at
  where owner_id = v_owner_id;

  -- Merged labels are read-only by design, so only active labels are touched.
  update public.location_labels
  set is_default = is_default
  where owner_id = v_owner_id
    and merged_into_id is null;

  select count(*)
    into v_count
  from public.profiles
  where id = v_owner_id;

  if v_count <> 1 then
    raise exception 'The Owner can no longer read their own profile';
  end if;

  -- 7. The Owner cannot rename themselves or an unknown account here.
  begin
    perform public.rename_managed_profile(v_owner_id, 'rc.6 QA name');
    raise exception 'The Owner renamed their own account through the managed path';
  exception
    when invalid_parameter_value then
      null;
  end;

  begin
    perform public.rename_managed_profile(gen_random_uuid(), 'rc.6 QA name');
    raise exception 'An unknown account was renamed';
  exception
    when no_data_found then
      null;
  end;

  perform set_config('role', 'none', true);
end;
$$;

-- Anonymous: public year checks use the Amsterdam date ----------------------------------

do $$
declare
  v_year integer :=
    extract(year from (now() at time zone 'Europe/Amsterdam'))::integer;
  v_count bigint;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
  perform set_config('role', 'anon', true);

  -- 8. The current Amsterdam year is accepted, the next one is not.
  perform public.get_public_work_analytics(v_year);

  begin
    perform public.get_public_work_analytics(v_year + 1);
    raise exception 'get_public_work_analytics accepted next year';
  exception
    when invalid_parameter_value then
      null;
  end;

  select count(*)
    into v_count
  from public.list_public_availability(v_year);

  perform set_config('role', 'none', true);
end;
$$;

select 'rc.6 hardening suite passed' as result;

rollback;
