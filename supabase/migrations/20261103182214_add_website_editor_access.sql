-- Velvet Torch rc.4: restricted Website Editor access (additive phase).
--
-- Website Editors are invited colleagues who may read limited context for
-- explicitly assigned Papers and edit only the Website card content fields:
-- publication index, citation and the Key highlight text, image filename,
-- alt text and caption. Visibility, slug and Featured stay Owner-only.
--
-- Assignments live in a dedicated table that no existing Paper, Dashboard or
-- profile policy references, so an assignment grants nothing beyond the RPCs
-- defined here. Editors have no table access to papers or Website metadata;
-- every read and write goes through SECURITY DEFINER RPCs with explicit
-- checks. Existing Coauthor assignments are copied as Website Editor
-- assignments; Coauthor access itself is retired in a later migration.

create table public.paper_website_editors (
  paper_id uuid not null references public.papers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (paper_id, user_id)
);

comment on table public.paper_website_editors is
  'Paper-scoped Website Editor assignments. Grants only the Website content RPCs; no Dashboard, Paper or profile table access.';

create index paper_website_editors_user_idx
  on public.paper_website_editors (user_id);

alter table public.paper_website_editors
  enable row level security;

revoke all
  on table public.paper_website_editors
  from public, anon, authenticated;

grant select
  on table public.paper_website_editors
  to authenticated;

create policy "Editors and owners can view Website Editor assignments"
  on public.paper_website_editors
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or private.can_edit_paper(paper_id)
  );

-- Helpers -------------------------------------------------------------------

create or replace function private.is_paper_website_editor(p_paper_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_profile(auth.uid())
    and exists (
      select 1
      from public.paper_website_editors pwe
      where pwe.paper_id = p_paper_id
        and pwe.user_id = auth.uid()
    );
$$;

create or replace function private.has_website_editor_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_profile(auth.uid())
    and exists (
      select 1
      from public.paper_website_editors pwe
      where pwe.user_id = auth.uid()
    );
$$;

-- Owners may edit any Paper's Website content. Editors may edit assigned,
-- non-archived Papers only.
create or replace function private.can_edit_paper_website_content(p_paper_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and (
        private.is_dashboard_owner(p.owner_id)
        or (
          p.archived_at is null
          and private.is_paper_website_editor(p.id)
        )
      )
  );
$$;

create or replace function private.can_assign_paper_website_editor(
  p_paper_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and p.archived_at is null
      and private.is_dashboard_owner(p.owner_id)
      and private.is_active_managed_profile(
        p.owner_id,
        p_user_id
      )
  );
$$;

-- A managed account belongs to one dashboard: also reject accounts that edit
-- another owner's Paper websites.
create or replace function private.is_active_managed_profile(
  p_owner_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and p_user_id <> p_owner_id
    and private.is_active_profile(p_user_id)
    and not exists (
      select 1
      from public.dashboard_members dm
      where dm.user_id = p_user_id
        and dm.role = 'owner'
    )
    and not exists (
      select 1
      from public.dashboard_members dm
      where dm.user_id = p_user_id
        and dm.owner_id <> p_owner_id
    )
    and not exists (
      select 1
      from public.paper_members pm
      join public.papers p
        on p.id = pm.paper_id
      where pm.user_id = p_user_id
        and p.owner_id <> p_owner_id
    )
    and not exists (
      select 1
      from public.paper_website_editors pwe
      join public.papers p
        on p.id = pwe.paper_id
      where pwe.user_id = p_user_id
        and p.owner_id <> p_owner_id
    );
$$;

revoke all on function private.is_paper_website_editor(uuid) from public, anon;
revoke all on function private.has_website_editor_access() from public, anon;
revoke all on function private.can_edit_paper_website_content(uuid) from public, anon;
revoke all on function private.can_assign_paper_website_editor(uuid, uuid) from public, anon;
revoke all on function private.is_active_managed_profile(uuid, uuid) from public, anon;

grant execute on function private.is_paper_website_editor(uuid) to authenticated;
grant execute on function private.has_website_editor_access() to authenticated;
grant execute on function private.can_edit_paper_website_content(uuid) to authenticated;
grant execute on function private.can_assign_paper_website_editor(uuid, uuid) to authenticated;
grant execute on function private.is_active_managed_profile(uuid, uuid) to authenticated;

-- Audit ---------------------------------------------------------------------

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

create or replace function private.audit_paper_website_editor_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.paper_website_editors%rowtype;
  v_owner_id uuid;
  v_short_title text;
  v_source text := nullif(current_setting('app.access_source', true), '');
begin
  v_row := case when tg_op = 'DELETE' then old else new end;

  select p.owner_id, p.short_title
    into v_owner_id, v_short_title
  from public.papers p
  where p.id = v_row.paper_id;

  if v_owner_id is not null then
    perform private.record_access_event(
      v_owner_id,
      case
        when tg_op = 'DELETE' then 'website_editor_revoked'
        else 'website_editor_granted'
      end,
      v_row.user_id,
      v_row.paper_id,
      null,
      jsonb_strip_nulls(
        jsonb_build_object(
          'subject_label', private.access_subject_label(v_row.user_id),
          'paper_short_title', v_short_title,
          'source', v_source
        )
      )
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_paper_website_editor_change() from public, anon, authenticated;

create trigger audit_paper_website_editor_change
after insert or delete on public.paper_website_editors
for each row
execute function private.audit_paper_website_editor_change();

-- Editor read RPCs ------------------------------------------------------------

create function public.list_my_website_editor_papers()
returns table (
  paper_id uuid,
  short_title text,
  title text,
  abstract text,
  authors text[],
  archived boolean,
  visibility text,
  slug text,
  featured boolean,
  publication_index text,
  citation text,
  highlight_text text,
  highlight_image_filename text,
  highlight_image_alt text,
  highlight_image_caption text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.short_title,
    p.title,
    p.abstract,
    array(
      select a.full_name
      from public.paper_authors pa
      join public.authors a
        on a.id = pa.author_id
      where pa.paper_id = p.id
      order by pa.author_order, a.full_name
    ),
    p.archived_at is not null,
    ppm.visibility,
    ppm.slug,
    ppm.featured,
    ppm.publication_index,
    ppm.citation,
    ppm.highlight_text,
    ppm.highlight_image_filename,
    ppm.highlight_image_alt,
    ppm.highlight_image_caption
  from public.paper_website_editors pwe
  join public.papers p
    on p.id = pwe.paper_id
  join public.paper_public_metadata ppm
    on ppm.paper_id = p.id
  where pwe.user_id = auth.uid()
    and private.is_active_profile(auth.uid())
  order by
    p.archived_at is not null,
    lower(p.short_title),
    p.id;
$$;

comment on function public.list_my_website_editor_papers() is
  'Website Editor read path: assigned Papers with read-only context and Website card fields. Returns nothing for other callers.';

create function public.get_website_editor_paper(p_paper_id uuid)
returns table (
  paper_id uuid,
  short_title text,
  title text,
  abstract text,
  authors text[],
  archived boolean,
  visibility text,
  slug text,
  featured boolean,
  publication_index text,
  citation text,
  highlight_text text,
  highlight_image_filename text,
  highlight_image_alt text,
  highlight_image_caption text
)
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.list_my_website_editor_papers() editor_paper
  where editor_paper.paper_id = p_paper_id;
$$;

comment on function public.get_website_editor_paper(uuid) is
  'Website Editor read path for one assigned Paper; returns no row when the caller is not its Website Editor.';

-- Content write RPC -------------------------------------------------------------

create function public.update_paper_website_content(
  p_paper_id uuid,
  p_publication_index text default null,
  p_citation text default null,
  p_highlight_text text default null,
  p_highlight_image_filename text default null,
  p_highlight_image_alt text default null,
  p_highlight_image_caption text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_short_title text;
  v_filename text := nullif(btrim(coalesce(p_highlight_image_filename, '')), '');
begin
  if auth.uid() is null
     or not private.can_edit_paper_website_content(p_paper_id) then
    raise exception 'Website content access required for this paper'
      using errcode = '42501';
  end if;

  -- Column CHECK constraints remain authoritative for vocabularies, lengths
  -- and the asset filename format.
  update public.paper_public_metadata
  set
    publication_index = nullif(btrim(coalesce(p_publication_index, '')), ''),
    citation = nullif(btrim(coalesce(p_citation, '')), ''),
    highlight_text = nullif(btrim(coalesce(p_highlight_text, '')), ''),
    highlight_image_filename = v_filename,
    highlight_image_alt = case
      when v_filename is null then null
      else nullif(btrim(coalesce(p_highlight_image_alt, '')), '')
    end,
    highlight_image_caption = case
      when v_filename is null then null
      else nullif(btrim(coalesce(p_highlight_image_caption, '')), '')
    end
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

comment on function public.update_paper_website_content(uuid, text, text, text, text, text, text) is
  'Updates only the Website content fields (publication index, citation, Key highlight). Visibility, slug and Featured remain Owner-only.';

-- Owner assignment RPC ----------------------------------------------------------

create function public.set_website_editor_paper_assignments(
  p_user_id uuid,
  p_paper_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_paper_ids uuid[] := coalesce(p_paper_ids, '{}'::uuid[]);
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if not private.is_active_managed_profile(v_owner_id, p_user_id) then
    raise exception 'An active managed account is required'
      using errcode = '42501';
  end if;

  -- Archived papers can remain selected only when preserving an existing
  -- assignment. They cannot receive a new Website Editor assignment.
  if exists (
    select 1
    from unnest(v_paper_ids) as selected(paper_id)
    left join public.papers p
      on p.id = selected.paper_id
     and p.owner_id = v_owner_id
    left join public.paper_website_editors existing
      on existing.paper_id = selected.paper_id
     and existing.user_id = p_user_id
    where p.id is null
       or (
         p.archived_at is not null
         and existing.paper_id is null
       )
  ) then
    raise exception 'One or more papers are unavailable for Website Editor assignment'
      using errcode = '42501';
  end if;

  delete from public.paper_website_editors pwe
  using public.papers p
  where pwe.paper_id = p.id
    and p.owner_id = v_owner_id
    and pwe.user_id = p_user_id
    and not (pwe.paper_id = any(v_paper_ids));

  insert into public.paper_website_editors (
    paper_id,
    user_id,
    granted_by
  )
  select
    p.id,
    p_user_id,
    v_owner_id
  from public.papers p
  where p.owner_id = v_owner_id
    and p.archived_at is null
    and p.id = any(v_paper_ids)
  on conflict (paper_id, user_id) do nothing;
end;
$$;

revoke all on function public.list_my_website_editor_papers() from public, anon;
revoke all on function public.get_website_editor_paper(uuid) from public, anon;
revoke all on function public.update_paper_website_content(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.set_website_editor_paper_assignments(uuid, uuid[]) from public, anon;

grant execute on function public.list_my_website_editor_papers() to authenticated;
grant execute on function public.get_website_editor_paper(uuid) to authenticated;
grant execute on function public.update_paper_website_content(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_website_editor_paper_assignments(uuid, uuid[]) to authenticated;

-- Invitations (transition) --------------------------------------------------------

-- Until Coauthor access is retired, accepting an invitation grants both the
-- legacy Coauthor assignment (used by the rc.3 app) and the Website Editor
-- assignment (used by the rc.4 app) for each invited, non-archived Paper.
create or replace function private.accept_access_invitation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation public.access_invitations%rowtype;
  v_paper_count integer := 0;
begin
  if v_user_id is null
     or not private.is_active_profile(v_user_id) then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select lower(btrim(coalesce(p.email, '')))
    into v_email
  from public.profiles p
  where p.id = v_user_id;

  if v_email is null or v_email = '' then
    raise exception 'A profile email address is required'
      using errcode = '22023';
  end if;

  select i.*
    into v_invitation
  from public.access_invitations i
  where i.status = 'sent'
    and lower(btrim(i.email)) = v_email
    and (
      i.auth_user_id is null
      or i.auth_user_id = v_user_id
    )
  order by i.sent_at desc nulls last, i.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active invitation was found for this account'
      using errcode = 'P0002';
  end if;

  select count(*)
    into v_paper_count
  from public.access_invitation_papers ip
  join public.papers p
    on p.id = ip.paper_id
   and p.owner_id = v_invitation.owner_id
   and p.archived_at is null
  where ip.invitation_id = v_invitation.id;

  if not v_invitation.viewer_enabled
     and v_paper_count = 0 then
    raise exception 'This invitation no longer grants any access'
      using errcode = '42501';
  end if;

  if v_invitation.viewer_enabled then
    insert into public.dashboard_members (
      owner_id,
      user_id,
      role
    )
    values (
      v_invitation.owner_id,
      v_user_id,
      'viewer'
    )
    on conflict (owner_id, user_id)
    do update set role = 'viewer';
  end if;

  insert into public.paper_members (
    paper_id,
    user_id,
    role
  )
  select
    p.id,
    v_user_id,
    'coauthor'
  from public.access_invitation_papers ip
  join public.papers p
    on p.id = ip.paper_id
   and p.owner_id = v_invitation.owner_id
   and p.archived_at is null
  where ip.invitation_id = v_invitation.id
  on conflict (paper_id, user_id)
  do update set role = 'coauthor'
  where public.paper_members.role <> 'owner';

  insert into public.paper_website_editors (
    paper_id,
    user_id,
    granted_by
  )
  select
    p.id,
    v_user_id,
    v_invitation.invited_by
  from public.access_invitation_papers ip
  join public.papers p
    on p.id = ip.paper_id
   and p.owner_id = v_invitation.owner_id
   and p.archived_at is null
  where ip.invitation_id = v_invitation.id
  on conflict (paper_id, user_id) do nothing;

  update public.access_invitations
  set
    status = 'accepted',
    auth_user_id = v_user_id,
    accepted_at = now(),
    updated_at = now(),
    last_error = null
  where id = v_invitation.id;

  return jsonb_build_object(
    'invitation_id', v_invitation.id,
    'viewer_enabled', v_invitation.viewer_enabled,
    'paper_count', v_paper_count,
    'destination', case
      when v_invitation.viewer_enabled then '/dashboard'
      else '/papers'
    end
  );
end;
$$;

-- Backfill ----------------------------------------------------------------------

select set_config('app.access_source', 'coauthor_conversion', true);

insert into public.paper_website_editors (
  paper_id,
  user_id
)
select
  pm.paper_id,
  pm.user_id
from public.paper_members pm
where pm.role = 'coauthor'
on conflict (paper_id, user_id) do nothing;

select set_config('app.access_source', '', true);

notify pgrst, 'reload schema';
