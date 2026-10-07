-- rc.3: align Location consolidation with Activity consolidation by
-- moving historical work-session locations to the new canonical name.

create or replace function public.consolidate_location_labels(
  p_source_a_id uuid,
  p_source_b_id uuid,
  p_target_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_a public.location_labels%rowtype;
  v_b public.location_labels%rowtype;
  v_target_id uuid := gen_random_uuid();
  v_target_name text := btrim(p_target_name);
  v_target_description text;
  v_target_default boolean;
  v_merged_at timestamptz := now();
begin
  if p_source_a_id is null
     or p_source_b_id is null
     or p_source_a_id = p_source_b_id then
    raise exception
      'Choose two different location labels'
      using errcode = '22023';
  end if;

  if v_target_name = '' then
    raise exception
      'The new location-label name is required'
      using errcode = '22023';
  end if;

  select *
  into v_a
  from public.location_labels
  where id = p_source_a_id
  for update;

  if not found then
    raise exception
      'The first location label was not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_b
  from public.location_labels
  where id = p_source_b_id
  for update;

  if not found then
    raise exception
      'The second location label was not found'
      using errcode = 'P0002';
  end if;

  if v_a.owner_id <> v_b.owner_id then
    raise exception
      'Location labels must belong to the same dashboard'
      using errcode = '23514';
  end if;

  if not private.is_dashboard_owner(v_a.owner_id) then
    raise exception
      'Dashboard Owner access is required'
      using errcode = '42501';
  end if;

  if not v_a.is_active
     or not v_b.is_active
     or v_a.merged_into_id is not null
     or v_b.merged_into_id is not null then
    raise exception
      'Only active, unmerged location labels can be consolidated'
      using errcode = '23514';
  end if;

  if lower(v_target_name) =
       lower(btrim(v_a.name)) then
    v_target_description :=
      v_a.description;
  elsif lower(v_target_name) =
          lower(btrim(v_b.name)) then
    v_target_description :=
      v_b.description;
  elsif v_a.description is not distinct from
        v_b.description then
    v_target_description :=
      v_a.description;
  else
    v_target_description := null;
  end if;

  v_target_default :=
    v_a.is_default
    or v_b.is_default;

  update public.location_labels
  set
    is_active = false,
    is_default = false,
    merged_into_id =
      v_target_id,
    merged_at =
      v_merged_at
  where id in (
    v_a.id,
    v_b.id
  );

  insert into public.location_labels (
    id,
    owner_id,
    name,
    description,
    is_active,
    is_default
  )
  values (
    v_target_id,
    v_a.owner_id,
    v_target_name,
    v_target_description,
    true,
    false
  );

  update public.work_sessions ws
  set place =
    v_target_name
  from public.daily_logs dl
  where ws.daily_log_id =
      dl.id
    and dl.owner_id =
      v_a.owner_id
    and (
      lower(btrim(ws.place)) =
        lower(btrim(v_a.name))
      or
      lower(btrim(ws.place)) =
        lower(btrim(v_b.name))
    )
    and ws.place is distinct from
      v_target_name;

  if v_target_default then
    update public.location_labels
    set is_default = true
    where id =
      v_target_id;
  end if;

  return v_target_id;
end;
$$;

comment on function public.consolidate_location_labels(uuid, uuid, text) is
  'Atomically consolidates two active managed locations into a new canonical location, rewrites matching owner work-session place values to the canonical name, and retains both source labels as immutable provenance records.';

revoke all
  on function public.consolidate_location_labels(uuid, uuid, text)
  from public, anon;

grant execute
  on function public.consolidate_location_labels(uuid, uuid, text)
  to authenticated, service_role;

-- Repair location consolidations completed before this behaviour changed.
-- Because work_sessions stores location as text rather than a label ID,
-- abort rather than guess if one historical source name maps to more than
-- one final canonical location for the same owner.
do $$
declare
  v_ambiguous_sources integer;
begin
  with recursive location_chain as (
    select
      s.id as source_id,
      s.owner_id,
      lower(btrim(s.name)) as source_key,
      s.merged_into_id as next_id
    from public.location_labels s
    where s.merged_into_id is not null

    union all

    select
      c.source_id,
      c.owner_id,
      c.source_key,
      n.merged_into_id
    from location_chain c
    join public.location_labels n
      on n.id = c.next_id
    where n.merged_into_id is not null
  ),
  final_map as (
    select distinct
      c.owner_id,
      c.source_key,
      final.name as final_name
    from location_chain c
    join public.location_labels final
      on final.id = c.next_id
     and final.merged_into_id is null
  )
  select count(*)
  into v_ambiguous_sources
  from (
    select
      owner_id,
      source_key
    from final_map
    group by
      owner_id,
      source_key
    having count(distinct final_name) > 1
  ) ambiguous;

  if v_ambiguous_sources > 0 then
    raise exception
      'Cannot safely rewrite consolidated location history because at least one historical place name maps to multiple canonical locations'
      using errcode = '23514';
  end if;
end;
$$;

with recursive location_chain as (
  select
    s.id as source_id,
    s.owner_id,
    lower(btrim(s.name)) as source_key,
    s.merged_into_id as next_id
  from public.location_labels s
  where s.merged_into_id is not null

  union all

  select
    c.source_id,
    c.owner_id,
    c.source_key,
    n.merged_into_id
  from location_chain c
  join public.location_labels n
    on n.id = c.next_id
  where n.merged_into_id is not null
),
final_map as (
  select distinct
    c.owner_id,
    c.source_key,
    final.name as final_name
  from location_chain c
  join public.location_labels final
    on final.id = c.next_id
   and final.merged_into_id is null
),
canonical_map as (
  select
    owner_id,
    source_key,
    min(final_name) as final_name
  from final_map
  group by
    owner_id,
    source_key
)
update public.work_sessions ws
set place =
  canonical_map.final_name
from
  public.daily_logs dl,
  canonical_map
where ws.daily_log_id =
    dl.id
  and dl.owner_id =
    canonical_map.owner_id
  and lower(btrim(ws.place)) =
    canonical_map.source_key
  and ws.place is distinct from
    canonical_map.final_name;
