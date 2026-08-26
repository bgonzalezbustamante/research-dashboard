create or replace function private.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set
      email = new.email,
      updated_at = now()
    where id = new.id
      and deactivated_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.sync_profile_email_from_auth();

revoke all on function private.sync_profile_email_from_auth() from public, anon, authenticated;

revoke update on table public.profiles from authenticated;
grant update (full_name, timezone) on public.profiles to authenticated;
