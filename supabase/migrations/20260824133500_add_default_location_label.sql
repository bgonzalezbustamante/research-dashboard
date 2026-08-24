alter table public.location_labels
  add column is_default boolean not null default false;

create unique index location_labels_owner_default_unique
  on public.location_labels (owner_id)
  where is_default;

create or replace function public.normalise_location_label_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.is_active then
    new.is_default := false;
  end if;

  return new;
end;
$$;

create trigger normalise_location_label_default
before insert or update of is_active, is_default
on public.location_labels
for each row
execute function public.normalise_location_label_default();

create or replace function public.set_default_location_label(
  p_label_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.location_labels
    where id = p_label_id
      and owner_id = v_owner_id
  ) then
    raise exception 'Location label not found';
  end if;

  update public.location_labels
  set is_default = false
  where owner_id = v_owner_id
    and is_default;

  update public.location_labels
  set
    is_active = true,
    is_default = true
  where id = p_label_id
    and owner_id = v_owner_id;
end;
$$;

grant execute
  on function public.set_default_location_label(uuid)
  to authenticated;
