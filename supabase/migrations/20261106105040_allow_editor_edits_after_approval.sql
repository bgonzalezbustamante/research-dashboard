-- Velvet Torch rc.4: Website Editors can keep their publications accurate
-- after approval.
--
-- Editors may edit the bibliographic fields of the external publications
-- they added at any time. Once the Owner has published one, the edit goes
-- live immediately, is audited and flags the row with editor_edited_at until
-- the Owner next saves it. Slug, visibility, collections and Projects remain
-- Owner-only, and editors may still delete a publication only while it is
-- awaiting review.

alter table public.external_publications
  add column editor_edited_at timestamptz;

comment on column public.external_publications.editor_edited_at is
  'Set when a Website Editor edits the publication after the Owner published it; cleared by the Owner''s next save.';

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
  v_visibility text;
begin
  if v_user_id is null
     or v_owner_id is null then
    raise exception 'Website Editor access required'
      using errcode = '42501';
  end if;

  -- Bibliographic fields only: slug, visibility, collections and Projects
  -- stay with the Owner.
  update public.external_publications
  set
    title = v_title,
    authors = private.normalise_external_publication_authors(p_authors),
    venue = nullif(btrim(coalesce(p_venue, '')), ''),
    publication_year = p_publication_year,
    published_on = p_published_on,
    doi_url = nullif(btrim(coalesce(p_doi_url, '')), ''),
    publication_url = nullif(btrim(coalesce(p_publication_url, '')), ''),
    language = nullif(btrim(coalesce(p_language, '')), ''),
    editor_edited_at = case
      when visibility = 'public' then now()
      else editor_edited_at
    end
  where id = p_id
    and created_by = v_user_id
    and owner_id = v_owner_id
  returning visibility into v_visibility;

  if not found then
    raise exception 'Only your own external publications can be edited'
      using errcode = '42501';
  end if;

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
      'published', v_visibility = 'public'
    )
  );

  return p_id;
end;
$$;

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
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

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

  if not found then
    raise exception 'External publication not found'
      using errcode = 'P0002';
  end if;

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

  return p_id;
end;
$$;

notify pgrst, 'reload schema';
