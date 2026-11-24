-- Steady Orchard rc.6: the document registry.
--
-- Documents signed with the signing tool carry a QR code and an identifier that
-- verify.bgonzalezbustamante.com resolves. The registry behind it moves here:
--   signed_documents   one row per issued document (code, title, issue time,
--                      SHA-256 of the final PDF, registered or revoked)
--   legacy_documents   the historical records once published at
--                      bgonzalezbustamante.com/validation/docs/<slug>/
-- Both tables are readable by the Owner only and written only through Owner
-- RPCs, each of which records an access audit event:
--   document_registered, document_revoked, document_removed,
--   legacy_documents_imported
-- Anonymous consumers get one record per lookup and no listing:
--   get_public_signed_document(code)
--   get_public_legacy_document(slug)
-- Record contents are entered on the Documents page, never in migrations.
--
-- Precheck (read-only; it must return no rows):
-- select 'table' as kind, to_regclass(t.name)::text as name
-- from (values ('public.signed_documents'), ('public.legacy_documents')) as t(name)
-- where to_regclass(t.name) is not null
-- union all
-- select 'function', p.proname
-- from pg_proc p
-- join pg_namespace n
--   on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'register_signed_document',
--     'revoke_signed_document',
--     'remove_signed_document',
--     'import_legacy_documents',
--     'get_public_signed_document',
--     'get_public_legacy_document'
--   );

-- 1. Tables --------------------------------------------------------------------------

create table public.signed_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  title text not null,
  issued_at timestamptz not null,
  sha256 text not null,
  status text not null default 'registered',
  registered_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signed_documents_code_key unique (code),
  constraint signed_documents_code_check check (
    code ~ '^[0-9a-f]{32}$'
  ),
  constraint signed_documents_title_check check (
    char_length(btrim(title)) between 1 and 500
  ),
  constraint signed_documents_sha256_check check (
    sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint signed_documents_revocation_check check (
    (
      status = 'registered'
      and revoked_at is null
      and revocation_note is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
    )
  ),
  constraint signed_documents_revocation_note_check check (
    revocation_note is null
    or char_length(btrim(revocation_note)) between 1 and 1000
  )
);

-- A named constraint of its own, so the Academic API contract check can read the
-- document-status vocabulary from it.
alter table public.signed_documents
  add constraint signed_documents_status_check check (
    status in (
      'registered',
      'revoked'
    )
  );

comment on table public.signed_documents is
  'Documents issued with the signing tool and registered for verification. Owner-only; anonymous consumers read one row by code through get_public_signed_document().';

create index signed_documents_owner_idx
  on public.signed_documents (owner_id);

create table public.legacy_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  title text not null,
  issued_at text not null,
  fingerprint text not null,
  original_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_documents_slug_key unique (slug),
  constraint legacy_documents_slug_check check (
    slug ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-document$'
  ),
  constraint legacy_documents_title_check check (
    char_length(btrim(title)) between 1 and 500
  ),
  constraint legacy_documents_issued_at_check check (
    issued_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2}))?$'
  ),
  constraint legacy_documents_fingerprint_check check (
    fingerprint ~ '^[0-9a-f]{32}$'
  ),
  constraint legacy_documents_original_url_check check (
    original_url = 'https://bgonzalezbustamante.com/validation/docs/' || slug || '/'
  )
);

comment on table public.legacy_documents is
  'Historical document records first published at bgonzalezbustamante.com/validation/docs/. issued_at keeps the original text and offset. Owner-only; anonymous consumers read one row by slug through get_public_legacy_document().';

create index legacy_documents_owner_idx
  on public.legacy_documents (owner_id);

create trigger signed_documents_updated_at
before update
on public.signed_documents
for each row
execute function public.handle_updated_at();

create trigger legacy_documents_updated_at
before update
on public.legacy_documents
for each row
execute function public.handle_updated_at();

-- 2. Row Level Security ------------------------------------------------------------
-- The Owner reads both tables; Viewers do not. There are no write grants: every
-- change goes through the Owner RPCs below.

alter table public.signed_documents enable row level security;
alter table public.legacy_documents enable row level security;

revoke all
  on table public.signed_documents
  from public, anon, authenticated;

revoke all
  on table public.legacy_documents
  from public, anon, authenticated;

grant select
  on table public.signed_documents
  to authenticated;

grant select
  on table public.legacy_documents
  to authenticated;

create policy "Owners can view signed documents"
  on public.signed_documents
  for select
  to authenticated
  using (private.is_dashboard_owner(owner_id));

create policy "Owners can view legacy documents"
  on public.legacy_documents
  for select
  to authenticated
  using (private.is_dashboard_owner(owner_id));

-- 3. Audit event types ---------------------------------------------------------------

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
      'document_registered',
      'document_revoked',
      'document_removed',
      'legacy_documents_imported',
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

-- 4. Owner RPCs ----------------------------------------------------------------------

create function public.register_signed_document(
  p_code text,
  p_title text,
  p_issued_at timestamptz,
  p_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_id uuid;
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_title text := btrim(coalesce(p_title, ''));
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  insert into public.signed_documents (
    owner_id,
    code,
    title,
    issued_at,
    sha256
  )
  values (
    v_owner_id,
    v_code,
    v_title,
    p_issued_at,
    lower(btrim(coalesce(p_sha256, '')))
  )
  returning id into v_id;

  perform private.record_access_event(
    v_owner_id,
    'document_registered',
    null,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(v_owner_id),
      'document_code', v_code,
      'title', v_title
    )
  );

  return v_id;
end;
$$;

create function public.revoke_signed_document(
  p_code text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_title text;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  update public.signed_documents
  set
    status = 'revoked',
    revoked_at = now(),
    revocation_note = v_note
  where owner_id = v_owner_id
    and code = v_code
    and status = 'registered'
  returning title into v_title;

  if v_title is null then
    raise exception 'No registered document with this code'
      using errcode = 'P0002';
  end if;

  perform private.record_access_event(
    v_owner_id,
    'document_revoked',
    null,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(v_owner_id),
      'document_code', v_code,
      'title', v_title,
      'note', v_note
    )
  );
end;
$$;

create function public.remove_signed_document(
  p_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_title text;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  delete from public.signed_documents
  where owner_id = v_owner_id
    and code = v_code
  returning title into v_title;

  if v_title is null then
    raise exception 'No document with this code'
      using errcode = 'P0002';
  end if;

  perform private.record_access_event(
    v_owner_id,
    'document_removed',
    null,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(v_owner_id),
      'document_code', v_code,
      'title', v_title
    )
  );
end;
$$;

create function public.import_legacy_documents(
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_count integer;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'Legacy import needs an array of 1 to 100 records'
      using errcode = '22023';
  end if;

  insert into public.legacy_documents (
    owner_id,
    slug,
    title,
    issued_at,
    fingerprint,
    original_url
  )
  select
    v_owner_id,
    lower(btrim(r.slug)),
    btrim(r.title),
    btrim(r.issued_at),
    lower(btrim(r.fingerprint)),
    btrim(r.original_url)
  from jsonb_to_recordset(p_rows) as r(
    slug text,
    title text,
    issued_at text,
    fingerprint text,
    original_url text
  )
  on conflict (slug) do update
  set
    title = excluded.title,
    issued_at = excluded.issued_at,
    fingerprint = excluded.fingerprint,
    original_url = excluded.original_url
  where public.legacy_documents.owner_id = excluded.owner_id;

  get diagnostics v_count = row_count;

  perform private.record_access_event(
    v_owner_id,
    'legacy_documents_imported',
    null,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(v_owner_id),
      'records', v_count
    )
  );

  return v_count;
end;
$$;

revoke all
  on function public.register_signed_document(text, text, timestamptz, text)
  from public, anon;

revoke all
  on function public.revoke_signed_document(text, text)
  from public, anon;

revoke all
  on function public.remove_signed_document(text)
  from public, anon;

revoke all
  on function public.import_legacy_documents(jsonb)
  from public, anon;

grant execute
  on function public.register_signed_document(text, text, timestamptz, text)
  to authenticated;

grant execute
  on function public.revoke_signed_document(text, text)
  to authenticated;

grant execute
  on function public.remove_signed_document(text)
  to authenticated;

grant execute
  on function public.import_legacy_documents(jsonb)
  to authenticated;

-- 5. Public RPCs ---------------------------------------------------------------------

create function public.get_public_signed_document(
  p_code text
)
returns table (
  code text,
  title text,
  issued_at timestamptz,
  sha256 text,
  status text,
  registered_at timestamptz,
  revoked_at timestamptz,
  revocation_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.code,
    d.title,
    d.issued_at,
    d.sha256,
    d.status,
    d.registered_at,
    d.revoked_at,
    d.revocation_note
  from public.signed_documents d
  where d.code =
    lower(
      btrim(
        p_code
      )
    )
  limit 1;
$$;

create function public.get_public_legacy_document(
  p_slug text
)
returns table (
  slug text,
  title text,
  issued_at text,
  fingerprint text,
  fingerprint_algorithm text,
  original_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.slug,
    l.title,
    l.issued_at,
    l.fingerprint,
    'unconfirmed-32-hex'::text as fingerprint_algorithm,
    l.original_url
  from public.legacy_documents l
  where l.slug =
    lower(
      btrim(
        p_slug
      )
    )
  limit 1;
$$;

comment on function public.get_public_signed_document(text) is
  'Anonymous-safe lookup of one registered or revoked signed document by its 32-character code. There is no listing; unknown codes return no row.';

comment on function public.get_public_legacy_document(text) is
  'Anonymous-safe lookup of one historical document record by its slug. There is no listing; unknown slugs return no row.';

revoke all
  on function public.get_public_signed_document(text)
  from public, anon, authenticated;

revoke all
  on function public.get_public_legacy_document(text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_signed_document(text)
  to anon, service_role;

grant execute
  on function public.get_public_legacy_document(text)
  to anon, service_role;

notify pgrst, 'reload schema';
