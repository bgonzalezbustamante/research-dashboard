-- Look a signed document up by the SHA-256 of its final PDF.
--
-- The verification site hashes a dropped PDF in the visitor's browser and sends
-- only the hash. Each PDF hash is registered at most once, so a hash identifies
-- at most one document. Like get_public_signed_document(text), the lookup
-- returns one row for a known hash and no row otherwise; there is no listing.

-- 1. One registration per PDF -------------------------------------------------------

create unique index signed_documents_sha256_key
  on public.signed_documents (
    sha256
  );

-- 2. A clear error when the same PDF is registered twice ----------------------------
-- Same signature, body and grants as in 20261124103453_add_document_registry.sql,
-- with a duplicate-hash check before the insert.

create or replace function public.register_signed_document(
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
  v_sha256 text := lower(btrim(coalesce(p_sha256, '')));
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.signed_documents d
    where d.sha256 = v_sha256
  ) then
    raise exception 'This PDF is already registered'
      using errcode = '23505',
            detail = 'signed_documents_sha256_key';
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
    v_sha256
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

revoke all
  on function public.register_signed_document(text, text, timestamptz, text)
  from public, anon;

grant execute
  on function public.register_signed_document(text, text, timestamptz, text)
  to authenticated;

-- 3. Public RPC -----------------------------------------------------------------------

create function public.get_public_signed_document_by_sha256(
  p_sha256 text
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
  where lower(
      btrim(
        p_sha256
      )
    ) ~ '^[0-9a-f]{64}$'
    and d.sha256 =
      lower(
        btrim(
          p_sha256
        )
      )
  limit 1;
$$;

comment on function public.get_public_signed_document_by_sha256(text) is
  'Anonymous-safe lookup of one registered or revoked signed document by the SHA-256 of its final PDF. There is no listing; unknown or malformed hashes return no row.';

revoke all
  on function public.get_public_signed_document_by_sha256(text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_signed_document_by_sha256(text)
  to anon, service_role;

notify pgrst, 'reload schema';
