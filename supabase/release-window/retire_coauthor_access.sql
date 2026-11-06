-- Velvet Torch rc.4: retire Coauthor access (contract phase).
--
-- Held outside supabase/migrations so `supabase db push` cannot apply it
-- early. In the rc.4 release window, after a /backups run: move it to
-- supabase/migrations/<fresh UTC timestamp>_retire_coauthor_access.sql,
-- push it, then deploy the rc.4 app. The rc.3 app still depends on the
-- Coauthor paths removed here.
--
-- Precheck (read-only, run in the SQL editor first). Every function listed
-- must be one this migration drops or redefines; anything else must be
-- redefined here before applying:
--
--   select n.nspname, p.proname
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.prosrc ~ '(can_collaborate_paper|is_paper_coauthor|has_coauthor_access|can_assign_paper_coauthor)'
--   order by 1, 2;
--
-- Policies are not function bodies, and a leftover one would make the DROP
-- FUNCTION statements below abort mid-release. This must return no rows:
--
--   select schemaname, tablename, policyname
--   from pg_policies
--   where coalesce(qual, '') || coalesce(with_check, '')
--     ~ '(can_collaborate_paper|is_paper_coauthor|has_coauthor_access|can_assign_paper_coauthor)'
--   order by 1, 2, 3;
--
-- Repository history accounts for (some may not appear):
-- private.can_collaborate_paper, private.can_use_author_for_paper,
-- private.enforce_coauthor_paper_title_only, private.resolve_author_for_paper,
-- public.set_coauthor_paper_assignments and
-- public.update_coauthor_paper_collaboration.
--
-- Coauthor assignments become Website Editor assignments (backfilled again
-- here for any created since the additive migration). The collaborator write
-- policies on Paper tables are replaced with Owner-only policies under their
-- original Owner policy names; the production inventory confirmed no separate
-- Owner write policies remain on those tables, so the replacements must be
-- created before the collaborator policies are dropped.

-- 1. Final Coauthor conversion ---------------------------------------------------

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

-- 2. Owner-only write policies ---------------------------------------------------

drop policy if exists "Owners can update their papers"
  on public.papers;

create policy "Owners can update their papers"
  on public.papers
  for update
  to authenticated
  using (private.is_dashboard_owner(owner_id))
  with check (private.is_dashboard_owner(owner_id));

drop policy if exists "Owners and coauthors can update accessible papers"
  on public.papers;

drop policy if exists "Owners can add paper authors"
  on public.paper_authors;
drop policy if exists "Owners can update paper authors"
  on public.paper_authors;
drop policy if exists "Owners can remove paper authors"
  on public.paper_authors;

create policy "Owners can add paper authors"
  on public.paper_authors
  for insert
  to authenticated
  with check (
    private.can_edit_paper(paper_id)
    and private.can_use_author_for_paper(
      paper_id,
      author_id
    )
  );

create policy "Owners can update paper authors"
  on public.paper_authors
  for update
  to authenticated
  using (private.can_edit_paper(paper_id))
  with check (
    private.can_edit_paper(paper_id)
    and private.can_use_author_for_paper(
      paper_id,
      author_id
    )
  );

create policy "Owners can remove paper authors"
  on public.paper_authors
  for delete
  to authenticated
  using (private.can_edit_paper(paper_id));

drop policy if exists "Paper collaborators can add paper authors"
  on public.paper_authors;
drop policy if exists "Paper collaborators can update paper authors"
  on public.paper_authors;
drop policy if exists "Paper collaborators can remove paper authors"
  on public.paper_authors;

drop policy if exists "Owners can create paper links"
  on public.paper_links;
drop policy if exists "Owners can update paper links"
  on public.paper_links;
drop policy if exists "Owners can delete paper links"
  on public.paper_links;

create policy "Owners can create paper links"
  on public.paper_links
  for insert
  to authenticated
  with check (private.can_edit_paper(paper_id));

create policy "Owners can update paper links"
  on public.paper_links
  for update
  to authenticated
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

create policy "Owners can delete paper links"
  on public.paper_links
  for delete
  to authenticated
  using (private.can_edit_paper(paper_id));

drop policy if exists "Paper collaborators can create paper links"
  on public.paper_links;
drop policy if exists "Paper collaborators can update paper links"
  on public.paper_links;
drop policy if exists "Paper collaborators can delete paper links"
  on public.paper_links;

drop policy if exists "Owners can create paper milestones"
  on public.paper_milestones;
drop policy if exists "Owners can update paper milestones"
  on public.paper_milestones;
drop policy if exists "Owners can delete paper milestones"
  on public.paper_milestones;

create policy "Owners can create paper milestones"
  on public.paper_milestones
  for insert
  to authenticated
  with check (private.can_edit_paper(paper_id));

create policy "Owners can update paper milestones"
  on public.paper_milestones
  for update
  to authenticated
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

create policy "Owners can delete paper milestones"
  on public.paper_milestones
  for delete
  to authenticated
  using (private.can_edit_paper(paper_id));

drop policy if exists "Paper collaborators can create paper milestones"
  on public.paper_milestones;
drop policy if exists "Paper collaborators can update paper milestones"
  on public.paper_milestones;
drop policy if exists "Paper collaborators can delete paper milestones"
  on public.paper_milestones;

drop policy if exists "Owners can create paper notes"
  on public.paper_notes;
drop policy if exists "Owners can update paper notes"
  on public.paper_notes;
drop policy if exists "Owners can delete paper notes"
  on public.paper_notes;

create policy "Owners can create paper notes"
  on public.paper_notes
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and private.can_edit_paper(paper_id)
  );

-- Owners keep the ability to edit and delete every note on their Papers,
-- including historical notes written by former Coauthors.
create policy "Owners can update paper notes"
  on public.paper_notes
  for update
  to authenticated
  using (private.can_edit_paper(paper_id))
  with check (private.can_edit_paper(paper_id));

create policy "Owners can delete paper notes"
  on public.paper_notes
  for delete
  to authenticated
  using (private.can_edit_paper(paper_id));

drop policy if exists "Paper collaborators can create attributed notes"
  on public.paper_notes;
drop policy if exists "Owners and note authors can update notes"
  on public.paper_notes;
drop policy if exists "Owners and note authors can delete notes"
  on public.paper_notes;

-- 3. Paper membership: no more Coauthor rows or assignment path -----------------

drop policy if exists "Owners can assign paper coauthors"
  on public.paper_members;
drop policy if exists "Owners can remove paper coauthors"
  on public.paper_members;

revoke insert, update, delete
  on table public.paper_members
  from authenticated;

delete from public.paper_members
where role = 'coauthor';

alter table public.paper_members
  drop constraint paper_members_role_check;

alter table public.paper_members
  add constraint paper_members_role_check
  check (role in ('owner', 'viewer'));

-- 4a. Repoint author helpers away from can_collaborate_paper -------------------
--
-- plpgsql/SQL bodies are not dependency-tracked, so these must be redefined
-- before can_collaborate_paper is dropped: the Owner's create/update Paper
-- RPCs and the Owner paper_authors policies above depend on them.

create or replace function private.can_use_author_for_paper(
  p_paper_id uuid,
  p_author_id uuid
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
    join public.authors a
      on a.id = p_author_id
    where p.id = p_paper_id
      and a.owner_id = p.owner_id
      and private.can_edit_paper(p.id)
  );
$$;

create or replace function private.resolve_author_for_paper(
  p_paper_id uuid,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_name text := btrim(p_full_name);
  v_author_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Author name is required'
      using errcode = '22023';
  end if;

  select p.owner_id
    into v_owner_id
  from public.papers p
  where p.id = p_paper_id
    and private.can_edit_paper(p.id);

  if v_owner_id is null then
    raise exception 'Paper owner access required'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_owner_id::text || ':' || lower(v_name),
      0
    )
  );

  select a.id
    into v_author_id
  from public.authors a
  where a.owner_id = v_owner_id
    and lower(btrim(a.full_name)) = lower(v_name)
  order by a.created_at, a.id
  limit 1;

  if v_author_id is null then
    insert into public.authors (
      owner_id,
      full_name,
      created_by
    )
    values (
      v_owner_id,
      v_name,
      v_user_id
    )
    returning id into v_author_id;
  end if;

  return v_author_id;
end;
$$;

-- 4b. Remove the Coauthor write paths and helpers -------------------------------

drop trigger if exists enforce_coauthor_paper_title_only
  on public.papers;

drop function if exists private.enforce_coauthor_paper_title_only();
drop function if exists public.update_coauthor_paper_collaboration(uuid, text, text, text, text, jsonb, jsonb);
drop function if exists public.set_coauthor_paper_assignments(uuid, uuid[]);
drop function if exists private.can_collaborate_paper(uuid);
drop function if exists private.can_assign_paper_coauthor(uuid, uuid);
drop function if exists private.has_coauthor_access();
drop function if exists private.is_paper_coauthor(uuid);

-- 5. Invitations grant Website Editor assignments -------------------------------

comment on table public.access_invitation_papers is
  'Papers an invitation assigns to the invitee as a Website Editor when accepted (Coauthor before rc.4).';

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
      else '/website'
    end
  );
end;
$$;

-- 6. Managed account lifecycle covers Website Editor assignments ----------------

create or replace function private.get_managed_account_deletion_plan(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_note_count integer := 0;
  v_author_count integer := 0;
  v_email text;
  v_preserve_profile boolean := false;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = v_owner_id then
    raise exception 'The dashboard owner account cannot be deleted here'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = p_user_id
      and dm.role = 'owner'
  ) or exists (
    select 1
    from public.papers p
    where p.owner_id = p_user_id
  ) then
    raise exception 'Owner accounts cannot be deleted from another dashboard'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = p_user_id
      and dm.owner_id <> v_owner_id
  ) or exists (
    select 1
    from public.paper_members pm
    join public.papers p
      on p.id = pm.paper_id
    where pm.user_id = p_user_id
      and p.owner_id <> v_owner_id
  ) or exists (
    select 1
    from public.paper_website_editors pwe
    join public.papers p
      on p.id = pwe.paper_id
    where pwe.user_id = p_user_id
      and p.owner_id <> v_owner_id
  ) then
    raise exception 'This account is also used by another dashboard'
      using errcode = '42501';
  end if;

  select p.email
    into v_email
  from public.profiles p
  where p.id = p_user_id
    and p.deactivated_at is null;

  if not found then
    raise exception 'Managed account not found'
      using errcode = 'P0002';
  end if;

  select count(*)
    into v_note_count
  from public.paper_notes n
  where n.created_by = p_user_id;

  select count(*)
    into v_author_count
  from public.authors a
  where a.created_by = p_user_id;

  v_preserve_profile := private.profile_requires_preservation(p_user_id);

  return jsonb_build_object(
    'user_id', p_user_id,
    'email', v_email,
    'note_count', v_note_count,
    'author_count', v_author_count,
    'preserve_profile', v_preserve_profile
  );
end;
$$;

create or replace function private.finalize_managed_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_note_count integer := 0;
  v_author_count integer := 0;
  v_preserve_profile boolean := false;
begin
  if v_owner_id is null
     or not private.is_dashboard_owner(v_owner_id) then
    raise exception 'Dashboard owner access required'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = v_owner_id then
    raise exception 'The dashboard owner account cannot be deleted here'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.dashboard_members dm
    where dm.user_id = p_user_id
      and dm.role = 'owner'
  ) or exists (
    select 1
    from public.papers p
    where p.owner_id = p_user_id
  ) then
    raise exception 'Owner accounts cannot be deleted from another dashboard'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
  ) then
    raise exception 'Managed account not found'
      using errcode = 'P0002';
  end if;

  select count(*)
    into v_note_count
  from public.paper_notes n
  where n.created_by = p_user_id;

  select count(*)
    into v_author_count
  from public.authors a
  where a.created_by = p_user_id;

  delete from public.dashboard_members
  where owner_id = v_owner_id
    and user_id = p_user_id
    and role = 'viewer';

  delete from public.paper_website_editors pwe
  using public.papers p
  where pwe.paper_id = p.id
    and p.owner_id = v_owner_id
    and pwe.user_id = p_user_id;

  update public.access_invitations
  set
    status = case
      when status in ('pending', 'sent', 'failed') then 'cancelled'
      else status
    end,
    cancelled_at = case
      when status in ('pending', 'sent', 'failed') then coalesce(cancelled_at, now())
      else cancelled_at
    end,
    auth_user_id = null,
    updated_at = now()
  where owner_id = v_owner_id
    and auth_user_id = p_user_id;

  update public.authors
  set profile_id = null
  where profile_id = p_user_id;

  v_preserve_profile := private.profile_requires_preservation(p_user_id);

  if v_preserve_profile then
    update public.profiles
    set
      email = null,
      deactivated_at = coalesce(deactivated_at, now()),
      updated_at = now()
    where id = p_user_id;
  else
    delete from public.profiles
    where id = p_user_id;
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'note_count', v_note_count,
    'author_count', v_author_count,
    'profile_preserved', v_preserve_profile
  );
end;
$$;

-- 7. Author profile links follow Website Editor assignments ---------------------

-- Candidate authors now come from the Owner's own Papers or the Papers a
-- Website Editor is assigned to. The previous body matched only
-- paper_members rows with role owner or coauthor, so after the coauthor rows
-- are deleted above, the editor sync triggers below would link nothing.
create or replace function private.try_link_author_profile(
  p_owner_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $
declare
  v_candidate_count integer := 0;
  v_author_id uuid;
begin
  if p_owner_id is null
     or p_user_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = p_user_id
      and pr.deactivated_at is null
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.authors a
    where a.owner_id = p_owner_id
      and a.profile_id = p_user_id
  ) then
    return;
  end if;

  select
    count(*)::integer,
    (
      array_agg(
        candidates.author_id
        order by candidates.author_id
      )
    )[1]
    into
      v_candidate_count,
      v_author_id
  from (
    select distinct
      a.id as author_id
    from public.authors a
    join public.paper_authors pa
      on pa.author_id = a.id
    join public.papers p
      on p.id = pa.paper_id
     and p.owner_id = p_owner_id
    join public.profiles pr
      on pr.id = p_user_id
     and pr.deactivated_at is null
    where a.owner_id = p_owner_id
      and a.profile_id is null
      and (
        exists (
          select 1
          from public.paper_members pm
          where pm.paper_id = p.id
            and pm.user_id = p_user_id
            and pm.role = 'owner'
        )
        or exists (
          select 1
          from public.paper_website_editors pwe
          where pwe.paper_id = p.id
            and pwe.user_id = p_user_id
        )
      )
      and (
        (
          pr.full_name is not null
          and btrim(pr.full_name) <> ''
          and lower(btrim(a.full_name)) =
              lower(btrim(pr.full_name))
        )
        or (
          a.email is not null
          and pr.email is not null
          and btrim(a.email) <> ''
          and btrim(pr.email) <> ''
          and lower(btrim(a.email)) =
              lower(btrim(pr.email))
        )
      )
  ) candidates;

  if v_candidate_count <> 1
     or v_author_id is null then
    return;
  end if;

  update public.authors a
  set
    profile_id = p_user_id,
    updated_at = now()
  where a.id = v_author_id
    and a.owner_id = p_owner_id
    and a.profile_id is null
    and not exists (
      select 1
      from public.authors linked
      where linked.profile_id = p_user_id
        and linked.id <> a.id
    );
end;
$;

revoke all
  on function private.try_link_author_profile(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.sync_author_profile_from_paper_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  if new.role <> 'owner' then
    return new;
  end if;

  select p.owner_id
    into v_owner_id
  from public.papers p
  where p.id = new.paper_id;

  if v_owner_id is not null then
    perform private.try_link_author_profile(
      v_owner_id,
      new.user_id
    );
  end if;

  return new;
end;
$$;

create or replace function private.sync_author_profile_from_website_editor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select p.owner_id
    into v_owner_id
  from public.papers p
  where p.id = new.paper_id;

  if v_owner_id is not null then
    perform private.try_link_author_profile(
      v_owner_id,
      new.user_id
    );
  end if;

  return new;
end;
$$;

create or replace function private.sync_author_profiles_from_paper_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_member record;
begin
  select p.owner_id
    into v_owner_id
  from public.papers p
  where p.id = new.paper_id;

  if v_owner_id is null then
    return new;
  end if;

  for v_member in
    select pm.user_id
    from public.paper_members pm
    where pm.paper_id = new.paper_id
      and pm.role = 'owner'
    union
    select pwe.user_id
    from public.paper_website_editors pwe
    where pwe.paper_id = new.paper_id
  loop
    perform private.try_link_author_profile(
      v_owner_id,
      v_member.user_id
    );
  end loop;

  return new;
end;
$$;

revoke all
  on function private.sync_author_profile_from_website_editor()
  from public, anon, authenticated;

drop trigger if exists sync_author_profile_from_website_editor
  on public.paper_website_editors;

create trigger sync_author_profile_from_website_editor
after insert
on public.paper_website_editors
for each row
execute function private.sync_author_profile_from_website_editor();

notify pgrst, 'reload schema';
