alter table public.profiles
  drop constraint profiles_id_fkey;

comment on column public.profiles.deactivated_at is
  'Timestamp when dashboard login/access was deactivated; the profile is retained for attribution and system-owned records.';
