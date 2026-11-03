-- Keep the anonymous function surface limited to the curated Public RPC v1.
-- These authenticated RPCs revoked EXECUTE only from PUBLIC. Standard
-- Supabase default privileges grant EXECUTE on new public functions to anon
-- explicitly. Production already denies anon here (42501), so these revokes
-- are idempotent: they make the boundary explicit in migration history
-- rather than relying on project-level defaults. Authenticated and
-- service_role grants are unchanged.

revoke execute on function public.accept_access_invitation() from anon;
revoke execute on function public.cancel_access_invitation(uuid) from anon;
revoke execute on function public.create_access_invitation(text, boolean, uuid[]) from anon;
revoke execute on function public.get_my_pending_access_invitation() from anon;
revoke execute on function public.mark_access_invitation_sent(uuid, uuid) from anon;
revoke execute on function public.mark_access_invitation_failed(uuid, text) from anon;
revoke execute on function public.rename_managed_profile(uuid, text) from anon;
revoke execute on function public.get_managed_account_deletion_plan(uuid) from anon;
revoke execute on function public.finalize_managed_account_deletion(uuid) from anon;
revoke execute on function public.set_coauthor_paper_assignments(uuid, uuid[]) from anon;
revoke execute on function public.update_coauthor_paper_collaboration(uuid, text, text, text, text, jsonb, jsonb) from anon;
revoke execute on function public.create_paper_with_details(text, text, text, text, smallint, text, text, date, date, jsonb, jsonb) from anon;
revoke execute on function public.update_paper_with_details(uuid, text, text, text, text, smallint, text, text, date, date, jsonb, jsonb) from anon;
revoke execute on function public.set_default_location_label(uuid) from anon;
