-- Velvet Torch rc.4: harden external publication inputs before release.
--
-- Website Editors write these rows and the anonymous Academic API serves
-- them to downstream sites, so the database enforces what the forms check:
-- DOI and publication links must be absolute HTTP(S) URLs with a host and no
-- whitespace, and each author name is 1-300 characters. Editor edits record
-- which fields changed and their previous values, so the Owner can review a
-- live edit after the "Edited since approval" flag has been cleared.
--
-- Precheck (read-only, must return no rows before db push):
--   select id, doi_url, publication_url from public.external_publications
--   where (doi_url is not null and doi_url !~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$')
--      or (publication_url is not null and publication_url !~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$');
--   select e.id from public.external_publications e, unnest(e.authors) a
--   where char_length(a) not between 1 and 300;

-- 1. Stricter URL formats ----------------------------------------------------------

alter table public.external_publications
  drop constraint external_publications_doi_url_format;

alter table public.external_publications
  add constraint external_publications_doi_url_format
  check (
    doi_url is null
    or (
      char_length(doi_url) <= 2048
      and doi_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    )
  );

alter table public.external_publications
  drop constraint external_publications_publication_url_format;

alter table public.external_publications
  add constraint external_publications_publication_url_format
  check (
    publication_url is null
    or (
      char_length(publication_url) <= 2048
      and publication_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    )
  );

-- 2. Author name length --------------------------------------------------------------

create or replace function private.external_publication_authors_valid(
  p_authors text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    bool_and(char_length(author) between 1 and 300),
    false
  )
  from unnest(p_authors) as entries(author);
$$;

revoke all
  on function private.external_publication_authors_valid(text[])
  from public, anon;

grant execute
  on function private.external_publication_authors_valid(text[])
  to authenticated;

alter table public.external_publications
  add constraint external_publications_author_length
  check (private.external_publication_authors_valid(authors));

-- 3. Editor edits record what changed ----------------------------------------------

create or replace function public.update_my_external_publication(
  p_id uuid,
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
  v_title text := btrim(coalesce(p_title, ''));
  v_authors text[] := private.normalise_external_publication_authors(p_authors);
  v_venue text := nullif(btrim(coalesce(p_venue, '')), '');
  v_doi_url text := nullif(btrim(coalesce(p_doi_url, '')), '');
  v_publication_url text := nullif(btrim(coalesce(p_publication_url, '')), '');
  v_language text := nullif(btrim(coalesce(p_language, '')), '');
  v_old jsonb;
  v_new jsonb;
  v_visibility text;
  v_field text;
  v_changed text[] := '{}'::text[];
  v_previous jsonb := '{}'::jsonb;
begin
  if v_user_id is null
     or v_owner_id is null then
    raise exception 'Website Editor access required'
      using errcode = '42501';
  end if;

  select to_jsonb(ep), ep.visibility
    into v_old, v_visibility
  from public.external_publications ep
  where ep.id = p_id
    and ep.created_by = v_user_id
    and ep.owner_id = v_owner_id
  for update;

  if not found then
    raise exception 'Only your own external publications can be edited'
      using errcode = '42501';
  end if;

  v_new := jsonb_build_object(
    'title', v_title,
    'authors', to_jsonb(v_authors),
    'venue', v_venue,
    'publication_year', p_publication_year,
    'published_on', p_published_on,
    'doi_url', v_doi_url,
    'publication_url', v_publication_url,
    'language', v_language
  );

  foreach v_field in array array[
    'title',
    'authors',
    'venue',
    'publication_year',
    'published_on',
    'doi_url',
    'publication_url',
    'language'
  ] loop
    if coalesce(v_old -> v_field, 'null'::jsonb)
       is distinct from coalesce(v_new -> v_field, 'null'::jsonb) then
      v_changed := v_changed || v_field;
      v_previous := v_previous || jsonb_build_object(
        v_field,
        v_old -> v_field
      );
    end if;
  end loop;

  -- Bibliographic fields only: slug, visibility, collections and Projects
  -- stay with the Owner. Only a real change to a published row raises the
  -- "Edited since approval" flag.
  update public.external_publications
  set
    title = v_title,
    authors = v_authors,
    venue = v_venue,
    publication_year = p_publication_year,
    published_on = p_published_on,
    doi_url = v_doi_url,
    publication_url = v_publication_url,
    language = v_language,
    editor_edited_at = case
      when visibility = 'public'
       and cardinality(v_changed) > 0 then now()
      else editor_edited_at
    end
  where id = p_id;

  perform private.record_access_event(
    v_owner_id,
    'external_publication_updated',
    v_user_id,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(v_user_id),
      'external_publication_id', p_id,
      'title', v_title,
      'published', v_visibility = 'public',
      'changed_fields', to_jsonb(v_changed),
      'previous', v_previous
    )
  );

  return p_id;
end;
$$;

notify pgrst, 'reload schema';
