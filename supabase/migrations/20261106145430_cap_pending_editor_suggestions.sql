-- Ancient Glacier rc.5: cap pending Website Editor suggestions.
--
-- A Website Editor may have at most 20 external publications awaiting review
-- (their own Private rows). Published entries do not count, and the Owner is
-- never capped. A per-editor advisory lock serialises concurrent submissions,
-- so two parallel requests cannot both pass the count. The limit raises
-- SQLSTATE 53400 (configuration_limit_exceeded), which the app maps to its
-- own message.

create or replace function public.create_my_external_publication(
  p_title text,
  p_authors text[],
  p_publication_year integer,
  p_published_on date default null,
  p_venue text default null,
  p_doi_url text default null,
  p_publication_url text default null,
  p_language text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid := private.website_editor_owner_id();
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_pending integer;
  v_limit constant integer := 20;
begin
  if v_user_id is null
     or v_owner_id is null then
    raise exception 'Website Editor access required'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'external-publication-pending-cap:' || v_user_id::text,
      0
    )
  );

  select count(*)::integer
    into v_pending
  from public.external_publications ep
  where ep.created_by = v_user_id
    and ep.owner_id = v_owner_id
    and ep.visibility = 'private';

  if v_pending >= v_limit then
    raise exception 'You already have % publications awaiting review', v_limit
      using errcode = '53400';
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
    visibility
  )
  values (
    v_owner_id,
    v_user_id,
    v_title,
    private.normalise_external_publication_authors(p_authors),
    nullif(btrim(coalesce(p_venue, '')), ''),
    p_publication_year,
    p_published_on,
    nullif(btrim(coalesce(p_doi_url, '')), ''),
    nullif(btrim(coalesce(p_publication_url, '')), ''),
    nullif(btrim(coalesce(p_language, '')), ''),
    'private'
  )
  returning id into v_id;

  perform private.record_access_event(
    v_owner_id,
    'external_publication_submitted',
    v_user_id,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(v_user_id),
      'external_publication_id', v_id,
      'title', v_title
    )
  );

  return v_id;
end;
$$;

notify pgrst, 'reload schema';
