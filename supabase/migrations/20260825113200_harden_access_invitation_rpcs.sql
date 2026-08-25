alter function public.create_access_invitation(text, boolean, uuid[])
  set schema private;
alter function public.cancel_access_invitation(uuid)
  set schema private;
alter function public.get_my_pending_access_invitation()
  set schema private;
alter function public.accept_access_invitation()
  set schema private;

revoke all on function private.create_access_invitation(text, boolean, uuid[]) from public;
revoke all on function private.cancel_access_invitation(uuid) from public;
revoke all on function private.get_my_pending_access_invitation() from public;
revoke all on function private.accept_access_invitation() from public;

grant execute on function private.create_access_invitation(text, boolean, uuid[]) to authenticated;
grant execute on function private.cancel_access_invitation(uuid) to authenticated;
grant execute on function private.get_my_pending_access_invitation() to authenticated;
grant execute on function private.accept_access_invitation() to authenticated;

create function public.create_access_invitation(
  p_email text,
  p_viewer_enabled boolean default false,
  p_paper_ids uuid[] default array[]::uuid[]
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_access_invitation(
    p_email,
    p_viewer_enabled,
    p_paper_ids
  );
$$;

create function public.cancel_access_invitation(
  p_invitation_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_access_invitation(
    p_invitation_id
  );
$$;

create function public.get_my_pending_access_invitation()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_my_pending_access_invitation();
$$;

create function public.accept_access_invitation()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.accept_access_invitation();
$$;

revoke all on function public.create_access_invitation(text, boolean, uuid[]) from public;
revoke all on function public.cancel_access_invitation(uuid) from public;
revoke all on function public.get_my_pending_access_invitation() from public;
revoke all on function public.accept_access_invitation() from public;

grant execute on function public.create_access_invitation(text, boolean, uuid[]) to authenticated;
grant execute on function public.cancel_access_invitation(uuid) to authenticated;
grant execute on function public.get_my_pending_access_invitation() to authenticated;
grant execute on function public.accept_access_invitation() to authenticated;
