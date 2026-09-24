-- Phase 2 hardening: keep the anonymous public API surface limited to the intended website RPCs.

revoke all
  on function public.handle_updated_at()
  from public;

revoke all
  on function public.normalise_location_label_default()
  from public;

revoke all
  on function public.set_default_location_label(uuid)
  from public;

grant execute
  on function public.set_default_location_label(uuid)
  to authenticated;
