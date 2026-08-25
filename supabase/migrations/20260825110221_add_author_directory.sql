alter table public.authors
  add column owner_id uuid;

update public.authors a
set owner_id = coalesce(
  (
    select p.owner_id
    from public.paper_authors pa
    join public.papers p
      on p.id = pa.paper_id
    where pa.author_id = a.id
    order by p.created_at, p.id
    limit 1
  ),
  (
    select dm.owner_id
    from public.dashboard_members dm
    where dm.user_id = a.created_by
    order by case when dm.role = 'owner' then 0 else 1 end,
             dm.created_at
    limit 1
  ),
  a.created_by
);

alter table public.authors
  alter column owner_id set not null;

alter table public.authors
  add constraint authors_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete restrict;

create index authors_owner_name_lookup_idx
  on public.authors (
    owner_id,
    lower(btrim(full_name))
  );

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
      and private.can_view_dashboard(a.owner_id)
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
      and a.owner_id = p.owner_id
      and private.can_collaborate_paper(p.id)
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
    and private.can_collaborate_paper(p.id);

  if v_owner_id is null then
    raise exception 'Paper collaboration access required'
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

drop policy if exists "Users can create authors" on public.authors;
drop policy if exists "Owners and coauthors can create authors" on public.authors;
drop policy if exists "Users can update authors they created" on public.authors;
drop policy if exists "Users can delete authors they created" on public.authors;
drop policy if exists "Accessible members can view authors" on public.authors;

create policy "Accessible members can view authors"
  on public.authors
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or private.can_view_author(id)
  );

create policy "Dashboard owners can update authors"
  on public.authors
  for update
  to authenticated
  using (private.is_dashboard_owner(owner_id))
  with check (private.is_dashboard_owner(owner_id));

create policy "Dashboard owners can delete authors"
  on public.authors
  for delete
  to authenticated
  using (private.is_dashboard_owner(owner_id));

revoke insert on table public.authors from authenticated;

create or replace function public.create_paper_with_details(
  p_short_title text,
  p_title text,
  p_abstract text default null,
  p_status text default 'writing',
  p_revision_round smallint default null,
  p_target_venue text default null,
  p_current_venue text default null,
  p_started_on date default null,
  p_published_on date default null,
  p_authors jsonb default '[]'::jsonb,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_paper_id uuid;
  v_author jsonb;
  v_author_name text;
  v_author_id uuid;
  v_author_order smallint := 0;
  v_link jsonb;
  v_link_type text;
  v_link_label text;
  v_link_url text;
  v_link_sort_order smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_dashboard_owner(v_user_id) then
    raise exception 'Dashboard owner access required';
  end if;

  if p_short_title is null or length(btrim(p_short_title)) = 0 then
    raise exception 'Short title is required';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Full title is required';
  end if;

  if p_status not in (
    'writing', 'under-review', 'revise-round',
    'published', 'standby', 'deprecated'
  ) then
    raise exception 'Invalid paper status';
  end if;

  if p_status = 'revise-round'
     and (p_revision_round is null or p_revision_round < 1) then
    raise exception 'Revision round is required for revise-round status';
  end if;

  insert into public.papers (
    owner_id, short_title, title, abstract, status,
    revision_round, target_venue, current_venue,
    started_on, published_on
  )
  values (
    v_user_id,
    btrim(p_short_title),
    btrim(p_title),
    nullif(btrim(p_abstract), ''),
    p_status,
    case when p_status = 'revise-round' then p_revision_round else null end,
    nullif(btrim(p_target_venue), ''),
    nullif(btrim(p_current_venue), ''),
    p_started_on,
    p_published_on
  )
  returning id into v_paper_id;

  for v_author in
    select value
    from jsonb_array_elements(coalesce(p_authors, '[]'::jsonb))
  loop
    v_author_name := btrim(v_author ->> 'full_name');

    if v_author_name is null or length(v_author_name) = 0 then
      continue;
    end if;

    v_author_id := private.resolve_author_for_paper(
      v_paper_id,
      v_author_name
    );

    if exists (
      select 1
      from public.paper_authors pa
      where pa.paper_id = v_paper_id
        and pa.author_id = v_author_id
    ) then
      continue;
    end if;

    v_author_order := v_author_order + 1;

    insert into public.paper_authors (
      paper_id, author_id, author_order
    )
    values (
      v_paper_id, v_author_id, v_author_order
    );
  end loop;

  if v_author_order = 0 then
    raise exception 'At least one author is required';
  end if;

  for v_link in
    select value
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    v_link_type := nullif(btrim(v_link ->> 'link_type'), '');
    v_link_label := nullif(btrim(v_link ->> 'label'), '');
    v_link_url := nullif(btrim(v_link ->> 'url'), '');
    v_link_sort_order := coalesce((v_link ->> 'sort_order')::smallint, 1);

    if v_link_url is null then
      continue;
    end if;

    insert into public.paper_links (
      paper_id, link_type, label, url, sort_order
    )
    values (
      v_paper_id, v_link_type, v_link_label,
      v_link_url, v_link_sort_order
    );
  end loop;

  return v_paper_id;
end;
$$;

create or replace function public.update_paper_with_details(
  p_paper_id uuid,
  p_short_title text,
  p_title text,
  p_abstract text default null,
  p_status text default 'writing',
  p_revision_round smallint default null,
  p_target_venue text default null,
  p_current_venue text default null,
  p_started_on date default null,
  p_published_on date default null,
  p_authors jsonb default '[]'::jsonb,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_author jsonb;
  v_author_name text;
  v_author_id uuid;
  v_author_order smallint := 0;
  v_link jsonb;
  v_link_type text;
  v_link_label text;
  v_link_url text;
  v_link_sort_order smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and p.owner_id = v_user_id
      and private.is_dashboard_owner(p.owner_id)
  ) then
    raise exception 'Paper not found or access denied';
  end if;

  if p_short_title is null or length(btrim(p_short_title)) = 0 then
    raise exception 'Short title is required';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Full title is required';
  end if;

  if p_status not in (
    'writing', 'under-review', 'revise-round',
    'published', 'standby', 'deprecated'
  ) then
    raise exception 'Invalid paper status';
  end if;

  if p_status = 'revise-round'
     and (p_revision_round is null or p_revision_round < 1) then
    raise exception 'Revision round is required for revise-round status';
  end if;

  update public.papers
  set
    short_title = btrim(p_short_title),
    title = btrim(p_title),
    abstract = nullif(btrim(p_abstract), ''),
    status = p_status,
    revision_round = case
      when p_status = 'revise-round' then p_revision_round
      else null
    end,
    target_venue = nullif(btrim(p_target_venue), ''),
    current_venue = nullif(btrim(p_current_venue), ''),
    started_on = p_started_on,
    published_on = p_published_on
  where id = p_paper_id
    and owner_id = v_user_id;

  delete from public.paper_authors
  where paper_id = p_paper_id;

  for v_author in
    select value
    from jsonb_array_elements(coalesce(p_authors, '[]'::jsonb))
  loop
    v_author_name := btrim(v_author ->> 'full_name');

    if v_author_name is null or length(v_author_name) = 0 then
      continue;
    end if;

    v_author_id := private.resolve_author_for_paper(
      p_paper_id,
      v_author_name
    );

    if exists (
      select 1
      from public.paper_authors pa
      where pa.paper_id = p_paper_id
        and pa.author_id = v_author_id
    ) then
      continue;
    end if;

    v_author_order := v_author_order + 1;

    insert into public.paper_authors (
      paper_id, author_id, author_order
    )
    values (
      p_paper_id, v_author_id, v_author_order
    );
  end loop;

  if v_author_order = 0 then
    raise exception 'At least one author is required';
  end if;

  delete from public.paper_links
  where paper_id = p_paper_id;

  for v_link in
    select value
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    v_link_type := nullif(btrim(v_link ->> 'link_type'), '');
    v_link_label := nullif(btrim(v_link ->> 'label'), '');
    v_link_url := nullif(btrim(v_link ->> 'url'), '');
    v_link_sort_order := coalesce((v_link ->> 'sort_order')::smallint, 1);

    if v_link_url is null then
      continue;
    end if;

    if v_link_type not in (
      'overleaf', 'dataverse', 'github', 'preprint',
      'doi', 'publication', 'other'
    ) then
      raise exception 'Invalid link type';
    end if;

    if v_link_url !~* '^https?://' then
      raise exception 'Invalid link URL';
    end if;

    insert into public.paper_links (
      paper_id, link_type, label, url, sort_order
    )
    values (
      p_paper_id, v_link_type, v_link_label,
      v_link_url, v_link_sort_order
    );
  end loop;

  return p_paper_id;
end;
$$;

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

  if p_title is null or char_length(btrim(p_title)) = 0 then
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
  set author_order = (author_order + 1000)::smallint
  where paper_id = p_paper_id;

  for v_author in
    select value
    from jsonb_array_elements(coalesce(p_authors, '[]'::jsonb))
  loop
    v_author_name := btrim(v_author ->> 'full_name');

    if v_author_name is null or char_length(v_author_name) = 0 then
      continue;
    end if;

    v_author_id := private.resolve_author_for_paper(
      p_paper_id,
      v_author_name
    );

    if v_author_id = any(v_desired_author_ids) then
      continue;
    end if;

    v_author_order := v_author_order + 1;

    if exists (
      select 1
      from public.paper_authors pa
      where pa.paper_id = p_paper_id
        and pa.author_id = v_author_id
    ) then
      update public.paper_authors
      set author_order = v_author_order
      where paper_id = p_paper_id
        and author_id = v_author_id;
    else
      insert into public.paper_authors (
        paper_id, author_id, author_order
      )
      values (
        p_paper_id, v_author_id, v_author_order
      );
    end if;

    v_desired_author_ids := array_append(
      v_desired_author_ids,
      v_author_id
    );
  end loop;

  if array_length(v_desired_author_ids, 1) is null then
    raise exception 'At least one author is required'
      using errcode = '22023';
  end if;

  delete from public.paper_authors
  where paper_id = p_paper_id
    and not (author_id = any(v_desired_author_ids));

  delete from public.paper_links
  where paper_id = p_paper_id;

  for v_link in
    select value
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    v_link_type := nullif(btrim(v_link ->> 'link_type'), '');
    v_link_label := nullif(btrim(v_link ->> 'label'), '');
    v_link_url := nullif(btrim(v_link ->> 'url'), '');
    v_link_sort_order := coalesce((v_link ->> 'sort_order')::smallint, 1);

    if v_link_url is null then
      continue;
    end if;

    if v_link_type not in (
      'overleaf', 'dataverse', 'github', 'preprint',
      'doi', 'publication', 'other'
    ) then
      raise exception 'Invalid link type'
        using errcode = '22023';
    end if;

    if v_link_url !~* '^https?://' then
      raise exception 'Invalid link URL'
        using errcode = '22023';
    end if;

    insert into public.paper_links (
      paper_id, link_type, label, url, sort_order
    )
    values (
      p_paper_id, v_link_type, v_link_label,
      v_link_url, v_link_sort_order
    );
  end loop;

  return p_paper_id;
end;
$$;