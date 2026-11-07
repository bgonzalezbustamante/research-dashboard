-- Ancient Glacier rc.5: audit the Owner's own external publication changes.
--
-- Website Editor submissions, edits and deletions were already audited. The
-- Owner's create, update, publish and delete now are too, so the Access audit
-- trail shows every change to what the public feeds serve:
--   external_publication_created    Owner added a publication
--   external_publication_published  Owner made a Private publication Public
--                                   (including Approve and publish)
--   external_publication_updated    any other Owner change, with
--                                   changed_fields and previous values
--   external_publication_deleted    Owner deleted a publication
-- An Owner save that changes nothing records no event. Snapshots cover the
-- bibliographic fields, visibility, slug, and the Project and collection
-- links; editor_edited_at and timestamps are left out.

-- 1. Event types ------------------------------------------------------------------

alter table public.access_audit_log
  drop constraint access_audit_log_event_type_check;

alter table public.access_audit_log
  add constraint access_audit_log_event_type_check check (
    event_type in (
      'audit_enabled',
      'viewer_granted',
      'viewer_revoked',
      'coauthor_granted',
      'coauthor_revoked',
      'website_editor_granted',
      'website_editor_revoked',
      'website_content_updated',
      'external_publication_submitted',
      'external_publication_created',
      'external_publication_published',
      'external_publication_updated',
      'external_publication_deleted',
      'invitation_created',
      'invitation_sent',
      'invitation_failed',
      'invitation_cancelled',
      'invitation_accepted',
      'account_renamed',
      'account_deactivated',
      'account_deleted'
    )
  );

-- 2. Snapshot and diff helpers ---------------------------------------------------

create function private.external_publication_audit_snapshot(
  p_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', ep.title,
    'authors', to_jsonb(ep.authors),
    'venue', ep.venue,
    'publication_year', ep.publication_year,
    'published_on', ep.published_on,
    'doi_url', ep.doi_url,
    'publication_url', ep.publication_url,
    'language', ep.language,
    'visibility', ep.visibility,
    'slug', ep.slug,
    'project_ids', coalesce(
      (
        select jsonb_agg(pep.project_id order by pep.project_id)
        from public.project_external_publications pep
        where pep.external_publication_id = ep.id
      ),
      '[]'::jsonb
    ),
    'collection_ids', coalesce(
      (
        select jsonb_agg(ci.collection_id order by ci.collection_id)
        from public.external_publication_collection_items ci
        where ci.external_publication_id = ep.id
      ),
      '[]'::jsonb
    ),
    'created_by', ep.created_by
  )
  from public.external_publications ep
  where ep.id = p_id;
$$;

revoke all
  on function private.external_publication_audit_snapshot(uuid)
  from public, anon, authenticated;

create function private.external_publication_audit_diff(
  p_old jsonb,
  p_new jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'changed_fields', coalesce(
      jsonb_agg(f.field order by f.ord),
      '[]'::jsonb
    ),
    'previous', coalesce(
      jsonb_object_agg(f.field, coalesce(p_old -> f.field, 'null'::jsonb)),
      '{}'::jsonb
    )
  )
  from unnest(array[
    'title',
    'authors',
    'venue',
    'publication_year',
    'published_on',
    'doi_url',
    'publication_url',
    'language',
    'visibility',
    'slug',
    'project_ids',
    'collection_ids'
  ]) with ordinality as f(field, ord)
  where coalesce(p_old -> f.field, 'null'::jsonb)
        is distinct from coalesce(p_new -> f.field, 'null'::jsonb);
$$;

revoke all
  on function private.external_publication_audit_diff(jsonb, jsonb)
  from public, anon, authenticated;

-- 3. Owner create -------------------------------------------------------------------

create or replace function public.create_external_publication(
  p_title text,
  p_authors text[],
  p_publication_year integer,
  p_published_on date default null,
  p_venue text default null,
  p_doi_url text default null,
  p_publication_url text default null,
  p_language text default null,
  p_visibility text default 'private',
  p_slug text default null,
  p_project_ids uuid[] default '{}'::uuid[],
  p_collection_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_id uuid;
  v_after jsonb;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  insert into public.external_publications (
    owner_id,
    created_by,
    title,
    authors,
    venue,
    publication_year,
    published_on,
    doi_url,
    publication_url,
    language,
    visibility,
    slug
  )
  values (
    v_owner_id,
    v_owner_id,
    btrim(coalesce(p_title, '')),
    private.normalise_external_publication_authors(p_authors),
    nullif(btrim(coalesce(p_venue, '')), ''),
    p_publication_year,
    p_published_on,
    nullif(btrim(coalesce(p_doi_url, '')), ''),
    nullif(btrim(coalesce(p_publication_url, '')), ''),
    nullif(btrim(coalesce(p_language, '')), ''),
    coalesce(nullif(btrim(coalesce(p_visibility, '')), ''), 'private'),
    nullif(lower(btrim(coalesce(p_slug, ''))), '')
  )
  returning id into v_id;

  perform private.set_external_publication_projects(
    v_owner_id,
    v_id,
    p_project_ids
  );

  perform private.set_external_publication_collections(
    v_owner_id,
    v_id,
    p_collection_ids
  );

  v_after := private.external_publication_audit_snapshot(v_id);

  perform private.record_access_event(
    v_owner_id,
    'external_publication_created',
    null,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(v_owner_id),
      'external_publication_id', v_id,
      'title', v_after ->> 'title',
      'published', v_after ->> 'visibility' = 'public',
      'by_owner', true,
      'current', v_after - 'created_by'
    )
  );

  return v_id;
end;
$$;

-- 4. Owner update (also used by Approve and publish) -------------------------------

create or replace function public.update_external_publication(
  p_id uuid,
  p_title text,
  p_authors text[],
  p_publication_year integer,
  p_published_on date default null,
  p_venue text default null,
  p_doi_url text default null,
  p_publication_url text default null,
  p_language text default null,
  p_visibility text default 'private',
  p_slug text default null,
  p_project_ids uuid[] default '{}'::uuid[],
  p_collection_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  v_created_by uuid;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  perform 1
  from public.external_publications ep
  where ep.id = p_id
    and ep.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'External publication not found'
      using errcode = 'P0002';
  end if;

  v_before := private.external_publication_audit_snapshot(p_id);

  -- Any Owner save, including Approve and publish, clears the editor flag.
  update public.external_publications
  set
    title = btrim(coalesce(p_title, '')),
    authors = private.normalise_external_publication_authors(p_authors),
    venue = nullif(btrim(coalesce(p_venue, '')), ''),
    publication_year = p_publication_year,
    published_on = p_published_on,
    doi_url = nullif(btrim(coalesce(p_doi_url, '')), ''),
    publication_url = nullif(btrim(coalesce(p_publication_url, '')), ''),
    language = nullif(btrim(coalesce(p_language, '')), ''),
    visibility = coalesce(nullif(btrim(coalesce(p_visibility, '')), ''), 'private'),
    slug = nullif(lower(btrim(coalesce(p_slug, ''))), ''),
    editor_edited_at = null
  where id = p_id
    and owner_id = v_owner_id;

  perform private.set_external_publication_projects(
    v_owner_id,
    p_id,
    p_project_ids
  );

  perform private.set_external_publication_collections(
    v_owner_id,
    p_id,
    p_collection_ids
  );

  v_after := private.external_publication_audit_snapshot(p_id);
  v_diff := private.external_publication_audit_diff(v_before, v_after);

  if jsonb_array_length(v_diff -> 'changed_fields') > 0 then
    v_created_by := (v_after ->> 'created_by')::uuid;

    perform private.record_access_event(
      v_owner_id,
      case
        when v_before ->> 'visibility' = 'private'
         and v_after ->> 'visibility' = 'public'
          then 'external_publication_published'
        else 'external_publication_updated'
      end,
      case
        when v_created_by is distinct from v_owner_id
          then v_created_by
      end,
      null,
      null,
      jsonb_build_object(
        'subject_label', private.access_subject_label(
          coalesce(
            nullif(v_created_by, v_owner_id),
            v_owner_id
          )
        ),
        'external_publication_id', p_id,
        'title', v_after ->> 'title',
        'published', v_after ->> 'visibility' = 'public',
        'by_owner', true
      ) || v_diff
    );
  end if;

  return p_id;
end;
$$;

-- 5. Owner delete -------------------------------------------------------------------

create or replace function public.delete_external_publication(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_before jsonb;
  v_created_by uuid;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  perform 1
  from public.external_publications ep
  where ep.id = p_id
    and ep.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'External publication not found'
      using errcode = 'P0002';
  end if;

  v_before := private.external_publication_audit_snapshot(p_id);
  v_created_by := (v_before ->> 'created_by')::uuid;

  delete from public.external_publications
  where id = p_id
    and owner_id = v_owner_id;

  perform private.record_access_event(
    v_owner_id,
    'external_publication_deleted',
    case
      when v_created_by is distinct from v_owner_id
        then v_created_by
    end,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(
        coalesce(
          nullif(v_created_by, v_owner_id),
          v_owner_id
        )
      ),
      'external_publication_id', p_id,
      'title', v_before ->> 'title',
      'by_owner', true,
      'previous', v_before - 'created_by'
    )
  );
end;
$$;

notify pgrst, 'reload schema';
