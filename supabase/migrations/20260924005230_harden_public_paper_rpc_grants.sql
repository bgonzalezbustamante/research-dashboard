-- Phase 2 hardening: signed-in Dashboard users do not need the anonymous website RPCs.

revoke execute
  on function public.list_public_papers()
  from authenticated;

revoke execute
  on function public.get_public_paper(text)
  from authenticated;
