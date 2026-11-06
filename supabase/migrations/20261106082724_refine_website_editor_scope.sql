-- Velvet Torch rc.4: refine the Website Editor scope (additive).
--
-- Two categories of papers get different levels of control:
-- 1. The Dashboard Owner's own Papers: Website Editors edit only the
--    citation and publication index of assigned Papers. Key highlight,
--    title, authors, visibility, slug and Featured stay Owner-only.
-- 2. Other people's papers (external publications): Website Editors may add
--    their own and edit or delete them while they are Private. Everything an
--    editor adds is Private until the Owner publishes it, and only the Owner
--    links external publications to Projects.

-- 1. Citation-only content RPC -------------------------------------------------

drop function public.update_paper_website_content(uuid, text, text, text, text, text, text);

create function public.update_paper_website_content(
  p_paper_id uuid,
  p_publication_index text default null,
  p_citation text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_short_title text;
begin
  if auth.uid() is null
     or not private.can_edit_paper_website_content(p_paper_id) then
    raise exception 'Website content access required for this paper'
      using errcode = '42501';
  end if;

  -- Column CHECK constraints remain authoritative for the vocabulary and
  -- citation length. Key highlight fields are deliberately untouched.
  update public.paper_public_metadata
  set
    publication_index = nullif(btrim(coalesce(p_publication_index, '')), ''),
    citation = nullif(btrim(coalesce(p_citation, '')), '')
  where paper_id = p_paper_id;

  if not found then
    raise exception 'Website metadata was not found for that paper'
      using errcode = 'P0002';
  end if;

  select p.owner_id, p.short_title
    into v_owner_id, v_short_title
  from public.papers p
  where p.id = p_paper_id;

  if not private.is_dashboard_owner(v_owner_id) then
    perform private.record_access_event(
      v_owner_id,
      'website_content_updated',
      auth.uid(),
      p_paper_id,
      null,
      jsonb_build_object(
        'subject_label', private.access_subject_label(auth.uid()),
        'paper_short_title', v_short_title
      )
    );
  end if;
end;
$$;

comment on function public.update_paper_website_content(uuid, text, text) is
  'Updates only the citation and publication index of a Paper''s Website card. Key highlight, visibility, slug and Featured remain Owner-only.';

revoke all on function public.update_paper_website_content(uuid, text, text) from public, anon;
grant execute on function public.update_paper_website_content(uuid, text, text) to authenticated;

-- 2. Editor-submitted external publications -------------------------------------

alter table public.external_publications
  add column created_by uuid
    references public.profiles(id)
    on delete set null;

update public.external_publications
set created_by = owner_id
where created_by is null;

create index external_publications_created_by_idx
  on public.external_publications (created_by);

comment on column public.external_publications.created_by is
  'Account that added the publication: the Owner or a Website Editor. Editor-added rows stay Private until the Owner publishes them.';

-- The Owner's own create path records the Owner as creator.
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
  p_project_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_id uuid;
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
    visibility
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
    coalesce(nullif(btrim(coalesce(p_visibility, '')), ''), 'private')
  )
  returning id into v_id;

  perform private.set_external_publication_projects(
    v_owner_id,
    v_id,
    p_project_ids
  );

  return v_id;
end;
$$;

-- The single dashboard owner whose Papers the caller edits as a Website
-- Editor; null for anyone else.
create or replace function private.website_editor_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.owner_id
  from public.paper_website_editors pwe
  join public.papers p
    on p.id = pwe.paper_id
  where pwe.user_id = auth.uid()
    and private.has_website_editor_access()
  order by pwe.created_at
  limit 1;
$$;

revoke all on function private.website_editor_owner_id() from public, anon;
grant execute on function private.website_editor_owner_id() to authenticated;

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

create function public.list_my_external_publications()
returns table (
  id uuid,
  title text,
  authors text[],
  venue text,
  publication_year integer,
  published_on date,
  doi_url text,
  publication_url text,
  language text,
  visibility text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ep.id,
    ep.title,
    ep.authors,
    ep.venue,
    ep.publication_year,
    ep.published_on,
    ep.doi_url,
    ep.publication_url,
    ep.language,
    ep.visibility,
    ep.created_at,
    ep.updated_at
  from public.external_publications ep
  where ep.created_by = auth.uid()
    and private.is_active_profile(auth.uid())
  order by
    ep.visibility = 'public',
    ep.publication_year desc,
    ep.title asc;
$$;

comment on function public.list_my_external_publications() is
  'Website Editor read path: external publications the caller added, without Project links.';

create function public.create_my_external_publication(
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
begin
  if v_user_id is null
     or v_owner_id is null then
    raise exception 'Website Editor access required'
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

create function public.update_my_external_publication(
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
begin
  if v_user_id is null
     or v_owner_id is null then
    raise exception 'Website Editor access required'
      using errcode = '42501';
  end if;

  update public.external_publications
  set
    title = v_title,
    authors = private.normalise_external_publication_authors(p_authors),
    venue = nullif(btrim(coalesce(p_venue, '')), ''),
    publication_year = p_publication_year,
    published_on = p_published_on,
    doi_url = nullif(btrim(coalesce(p_doi_url, '')), ''),
    publication_url = nullif(btrim(coalesce(p_publication_url, '')), ''),
    language = nullif(btrim(coalesce(p_language, '')), '')
  where id = p_id
    and created_by = v_user_id
    and owner_id = v_owner_id
    and visibility = 'private';

  if not found then
    raise exception 'Only your own Private external publications can be edited'
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
      'title', v_title
    )
  );

  return p_id;
end;
$$;

create function public.delete_my_external_publication(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid := private.website_editor_owner_id();
  v_title text;
begin
  if v_user_id is null
     or v_owner_id is null then
    raise exception 'Website Editor access required'
      using errcode = '42501';
  end if;

  delete from public.external_publications
  where id = p_id
    and created_by = v_user_id
    and owner_id = v_owner_id
    and visibility = 'private'
  returning title into v_title;

  if not found then
    raise exception 'Only your own Private external publications can be deleted'
      using errcode = '42501';
  end if;

  perform private.record_access_event(
    v_owner_id,
    'external_publication_deleted',
    v_user_id,
    null,
    null,
    jsonb_build_object(
      'subject_label', private.access_subject_label(v_user_id),
      'external_publication_id', p_id,
      'title', v_title
    )
  );
end;
$$;

revoke all on function public.list_my_external_publications() from public, anon;
revoke all on function public.create_my_external_publication(text, text[], integer, date, text, text, text, text) from public, anon;
revoke all on function public.update_my_external_publication(uuid, text, text[], integer, date, text, text, text, text) from public, anon;
revoke all on function public.delete_my_external_publication(uuid) from public, anon;

grant execute on function public.list_my_external_publications() to authenticated;
grant execute on function public.create_my_external_publication(text, text[], integer, date, text, text, text, text) to authenticated;
grant execute on function public.update_my_external_publication(uuid, text, text[], integer, date, text, text, text, text) to authenticated;
grant execute on function public.delete_my_external_publication(uuid) to authenticated;

notify pgrst, 'reload schema';
