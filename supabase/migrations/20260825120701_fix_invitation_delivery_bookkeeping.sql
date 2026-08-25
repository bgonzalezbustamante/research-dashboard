create function private.mark_access_invitation_sent(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.access_invitations%rowtype;
  v_profile_email text;
begin
  select *
  into v_invitation
  from public.access_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if not private.is_dashboard_owner(v_invitation.owner_id) then
    raise exception 'Dashboard owner access required';
  end if;

  if v_invitation.status not in ('pending', 'failed', 'sent') then
    raise exception 'Invitation cannot be marked as sent from status %', v_invitation.status;
  end if;

  select email
  into v_profile_email
  from public.profiles
  where id = p_auth_user_id;

  if v_profile_email is null
     or lower(btrim(v_profile_email)) <> lower(btrim(v_invitation.email)) then
    raise exception 'Invited account does not match invitation email';
  end if;

  update public.access_invitations
  set status = 'sent',
      auth_user_id = p_auth_user_id,
      sent_at = now(),
      last_error = null,
      updated_at = now()
  where id = p_invitation_id;
end;
$$;

create function private.mark_access_invitation_failed(
  p_invitation_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.access_invitations%rowtype;
begin
  select *
  into v_invitation
  from public.access_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if not private.is_dashboard_owner(v_invitation.owner_id) then
    raise exception 'Dashboard owner access required';
  end if;

  if v_invitation.status not in ('pending', 'failed') then
    raise exception 'Invitation cannot be marked as failed from status %', v_invitation.status;
  end if;

  update public.access_invitations
  set status = 'failed',
      last_error = left(coalesce(nullif(btrim(p_error), ''), 'Invitation email could not be sent.'), 500),
      updated_at = now()
  where id = p_invitation_id;
end;
$$;

revoke all on function private.mark_access_invitation_sent(uuid, uuid) from public;
revoke all on function private.mark_access_invitation_failed(uuid, text) from public;
grant execute on function private.mark_access_invitation_sent(uuid, uuid) to authenticated;
grant execute on function private.mark_access_invitation_failed(uuid, text) to authenticated;

create function public.mark_access_invitation_sent(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.mark_access_invitation_sent(p_invitation_id, p_auth_user_id);
$$;

create function public.mark_access_invitation_failed(
  p_invitation_id uuid,
  p_error text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.mark_access_invitation_failed(p_invitation_id, p_error);
$$;

revoke all on function public.mark_access_invitation_sent(uuid, uuid) from public;
revoke all on function public.mark_access_invitation_failed(uuid, text) from public;
grant execute on function public.mark_access_invitation_sent(uuid, uuid) to authenticated;
grant execute on function public.mark_access_invitation_failed(uuid, text) to authenticated;
