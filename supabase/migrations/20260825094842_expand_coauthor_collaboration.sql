create or replace function private.has_coauthor_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.paper_members pm
    where pm.user_id = auth.uid()
      and pm.role = 'coauthor'
  );
$$;

create or replace function private.can_collaborate_paper(
  p_paper_id uuid
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
      and (
        private.is_dashboard_owner(p.owner_id)
        or private.is_paper_coauthor(p.id)
      )
  );
$$;

create or replace function private.can_view_author(
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
    from public.authors a
    where a.id = p_author_id
      and (
        a.created_by = auth.uid()
        or private.can_view_dashboard(a.created_by)
      )
  )
  or exists (
    select 1
    from public.paper_authors pa
    join public.paper_members pm
      on pm.paper_id = pa.paper_id
    where pa.author_id = p_author_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'coauthor', 'viewer')
  );
$$;

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
      and (
        (
          private.is_dashboard_owner(p.owner_id)
          and a.created_by = p.owner_id
        )
        or (
          private.is_paper_coauthor(p.id)
          and (
            a.created_by = auth.uid()
            or a.created_by = p.owner_id
            or exists (
              select 1
              from public.paper_authors pa
              where pa.paper_id = p.id
                and pa.author_id = a.id
            )
          )
        )
      )
  );
$$;

create policy "Coauthors can create authors for collaboration"
  on public.authors
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_coauthor_access()
  );

drop policy if exists "Owners can add paper authors"
  on public.paper_authors;
drop policy if exists "Owners can update paper authors"
  on public.paper_authors;
drop policy if exists "Owners can remove paper authors"
  on public.paper_authors;

create policy "Paper collaborators can add paper authors"
  on public.paper_authors
  for insert
  to authenticated
  with check (
    private.can_collaborate_paper(paper_id)
    and private.can_use_author_for_paper(
      paper_id,
      author_id
    )
  );

create policy "Paper collaborators can update paper authors"
  on public.paper_authors
  for update
  to authenticated
  using (
    private.can_collaborate_paper(paper_id)
  )
  with check (
    private.can_collaborate_paper(paper_id)
    and private.can_use_author_for_paper(
      paper_id,
      author_id
    )
  );

create policy "Paper collaborators can remove paper authors"
  on public.paper_authors
  for delete
  to authenticated
  using (
    private.can_collaborate_paper(paper_id)
  );

drop policy if exists "Owners can create paper links"
  on public.paper_links;
drop policy if exists "Owners can update paper links"
  on public.paper_links;
drop policy if exists "Owners can delete paper links"
  on public.paper_links;

create policy "Paper collaborators can create paper links"
  on public.paper_links
  for insert
  to authenticated
  with check (
    private.can_collaborate_paper(paper_id)
  );

create policy "Paper collaborators can update paper links"
  on public.paper_links
  for update
  to authenticated
  using (
    private.can_collaborate_paper(paper_id)
  )
  with check (
    private.can_collaborate_paper(paper_id)
  );

create policy "Paper collaborators can delete paper links"
  on public.paper_links
  for delete
  to authenticated
  using (
    private.can_collaborate_paper(paper_id)
  );

drop policy if exists "Owners can create paper milestones"
  on public.paper_milestones;
drop policy if exists "Owners can update paper milestones"
  on public.paper_milestones;
drop policy if exists "Owners can delete paper milestones"
  on public.paper_milestones;

create policy "Paper collaborators can create paper milestones"
  on public.paper_milestones
  for insert
  to authenticated
  with check (
    private.can_collaborate_paper(paper_id)
  );

create policy "Paper collaborators can update paper milestones"
  on public.paper_milestones
  for update
  to authenticated
  using (
    private.can_collaborate_paper(paper_id)
  )
  with check (
    private.can_collaborate_paper(paper_id)
  );

create policy "Paper collaborators can delete paper milestones"
  on public.paper_milestones
  for delete
  to authenticated
  using (
    private.can_collaborate_paper(paper_id)
  );

drop policy if exists "Owners can create paper presentations"
  on public.paper_presentations;
drop policy if exists "Owners can update paper presentations"
  on public.paper_presentations;
drop policy if exists "Owners can delete paper presentations"
  on public.paper_presentations;

create policy "Paper collaborators can create paper presentations"
  on public.paper_presentations
  for insert
  to authenticated
  with check (
    private.can_collaborate_paper(paper_id)
  );

create policy "Paper collaborators can update paper presentations"
  on public.paper_presentations
  for update
  to authenticated
  using (
    private.can_collaborate_paper(paper_id)
  )
  with check (
    private.can_collaborate_paper(paper_id)
  );

create policy "Paper collaborators can delete paper presentations"
  on public.paper_presentations
  for delete
  to authenticated
  using (
    private.can_collaborate_paper(paper_id)
  );

drop policy if exists "Owners can create paper notes"
  on public.paper_notes;
drop policy if exists "Owners can update paper notes"
  on public.paper_notes;
drop policy if exists "Owners can delete paper notes"
  on public.paper_notes;

create policy "Paper collaborators can create attributed notes"
  on public.paper_notes
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and private.can_collaborate_paper(paper_id)
  );

create policy "Owners and note authors can update notes"
  on public.paper_notes
  for update
  to authenticated
  using (
    private.can_edit_paper(paper_id)
    or (
      private.is_paper_coauthor(paper_id)
      and created_by = (select auth.uid())
    )
  )
  with check (
    private.can_edit_paper(paper_id)
    or (
      private.is_paper_coauthor(paper_id)
      and created_by = (select auth.uid())
    )
  );

create policy "Owners and note authors can delete notes"
  on public.paper_notes
  for delete
  to authenticated
  using (
    private.can_edit_paper(paper_id)
    or (
      private.is_paper_coauthor(paper_id)
      and created_by = (select auth.uid())
    )
  );

create or replace function private.preserve_paper_note_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Note attribution cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists preserve_paper_note_creator
  on public.paper_notes;

create trigger preserve_paper_note_creator
before update of created_by
on public.paper_notes
for each row
execute function private.preserve_paper_note_creator();

create or replace function private.enforce_coauthor_paper_title_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_paper_coauthor(old.id)
     and not private.is_dashboard_owner(old.owner_id) then
    if new.id is distinct from old.id
       or new.owner_id is distinct from old.owner_id
       or new.short_title is distinct from old.short_title
       or new.status is distinct from old.status
       or new.revision_round is distinct from old.revision_round
       or new.started_on is distinct from old.started_on
       or new.published_on is distinct from old.published_on
       or new.archived_at is distinct from old.archived_at
       or new.created_at is distinct from old.created_at
       or new.updated_at is distinct from old.updated_at then
      raise exception 'Coauthors may update only collaborative paper fields'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "Coauthors can update assigned paper titles"
  on public.papers;

create policy "Coauthors can update assigned paper collaboration fields"
  on public.papers
  for update
  to authenticated
  using (
    private.is_paper_coauthor(id)
  )
  with check (
    private.is_paper_coauthor(id)
  );

create or replace function public.update_coauthor_paper_collaboration(
  p_paper_id uuid,
  p_title text,
  p_abstract text default null,
  p_target_venue text default null,
  p_current_venue text default null,
  p_authors jsonb default '[]'::jsonb,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_author jsonb;
  v_author_name text;
  v_author_id uuid;
  v_author_order smallint := 0;
  v_desired_author_ids uuid[] := array[]::uuid[];
  v_link jsonb;
  v_link_type text;
  v_link_label text;
  v_link_url text;
  v_link_sort_order smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not private.is_paper_coauthor(p_paper_id) then
    raise exception 'Coauthor access required'
      using errcode = '42501';
  end if;

  if p_title is null
     or char_length(btrim(p_title)) = 0 then
    raise exception 'Full title is required'
      using errcode = '22023';
  end if;

  update public.papers
  set
    title = btrim(p_title),
    abstract = nullif(btrim(p_abstract), ''),
    target_venue = nullif(btrim(p_target_venue), ''),
    current_venue = nullif(btrim(p_current_venue), '')
  where id = p_paper_id;

  if not found then
    raise exception 'Paper not found'
      using errcode = 'P0002';
  end if;

  update public.paper_authors
  set author_order =
    (author_order + 1000)::smallint
  where paper_id = p_paper_id;

  for v_author in
    select value
    from jsonb_array_elements(
      coalesce(p_authors, '[]'::jsonb)
    )
  loop
    v_author_name :=
      btrim(v_author ->> 'full_name');

    if v_author_name is null
       or char_length(v_author_name) = 0 then
      continue;
    end if;

    v_author_id := null;

    select a.id
      into v_author_id
    from public.paper_authors pa
    join public.authors a
      on a.id = pa.author_id
    where pa.paper_id = p_paper_id
      and lower(btrim(a.full_name)) =
          lower(v_author_name)
    order by pa.author_order
    limit 1;

    if v_author_id is null then
      select a.id
        into v_author_id
      from public.authors a
      where a.created_by = v_user_id
        and lower(btrim(a.full_name)) =
            lower(v_author_name)
      order by a.created_at
      limit 1;
    end if;

    if v_author_id is null then
      insert into public.authors (
        full_name,
        created_by
      )
      values (
        v_author_name,
        v_user_id
      )
      returning id into v_author_id;
    end if;

    if v_author_id = any(
      v_desired_author_ids
    ) then
      continue;
    end if;

    v_author_order :=
      v_author_order + 1;

    if exists (
      select 1
      from public.paper_authors pa
      where pa.paper_id = p_paper_id
        and pa.author_id = v_author_id
    ) then
      update public.paper_authors
      set author_order =
        v_author_order
      where paper_id = p_paper_id
        and author_id = v_author_id;
    else
      insert into public.paper_authors (
        paper_id,
        author_id,
        author_order
      )
      values (
        p_paper_id,
        v_author_id,
        v_author_order
      );
    end if;

    v_desired_author_ids :=
      array_append(
        v_desired_author_ids,
        v_author_id
      );
  end loop;

  if array_length(
    v_desired_author_ids,
    1
  ) is null then
    raise exception 'At least one author is required'
      using errcode = '22023';
  end if;

  delete from public.paper_authors
  where paper_id = p_paper_id
    and not (
      author_id = any(
        v_desired_author_ids
      )
    );

  delete from public.paper_links
  where paper_id = p_paper_id;

  for v_link in
    select value
    from jsonb_array_elements(
      coalesce(p_links, '[]'::jsonb)
    )
  loop
    v_link_type :=
      nullif(
        btrim(
          v_link ->> 'link_type'
        ),
        ''
      );

    v_link_label :=
      nullif(
        btrim(
          v_link ->> 'label'
        ),
        ''
      );

    v_link_url :=
      nullif(
        btrim(
          v_link ->> 'url'
        ),
        ''
      );

    v_link_sort_order :=
      coalesce(
        (v_link ->> 'sort_order')::smallint,
        1
      );

    if v_link_url is null then
      continue;
    end if;

    if v_link_type not in (
      'overleaf',
      'dataverse',
      'github',
      'preprint',
      'doi',
      'publication',
      'other'
    ) then
      raise exception 'Invalid link type'
        using errcode = '22023';
    end if;

    if v_link_url !~* '^https?://' then
      raise exception 'Invalid link URL'
        using errcode = '22023';
    end if;

    insert into public.paper_links (
      paper_id,
      link_type,
      label,
      url,
      sort_order
    )
    values (
      p_paper_id,
      v_link_type,
      v_link_label,
      v_link_url,
      v_link_sort_order
    );
  end loop;

  return p_paper_id;
end;
$$;

revoke all
  on function public.update_coauthor_paper_collaboration(
    uuid,
    text,
    text,
    text,
    text,
    jsonb,
    jsonb
  )
  from public;

grant execute
  on function public.update_coauthor_paper_collaboration(
    uuid,
    text,
    text,
    text,
    text,
    jsonb,
    jsonb
  )
  to authenticated;
