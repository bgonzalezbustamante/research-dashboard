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
       or new.abstract is distinct from old.abstract
       or new.status is distinct from old.status
       or new.revision_round is distinct from old.revision_round
       or new.target_venue is distinct from old.target_venue
       or new.current_venue is distinct from old.current_venue
       or new.started_on is distinct from old.started_on
       or new.published_on is distinct from old.published_on
       or new.archived_at is distinct from old.archived_at
       or new.created_at is distinct from old.created_at
       or new.updated_at is distinct from old.updated_at then
      raise exception 'Coauthors may update only the full paper title'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
