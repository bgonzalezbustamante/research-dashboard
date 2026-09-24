-- Distant Forge hardening: authenticated project RPCs should run under caller RLS rather than elevated privileges.

alter function public.create_project_with_details(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
)
security invoker;

alter function public.update_project_with_details(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
)
security invoker;

alter function public.get_project_hours()
security invoker;
