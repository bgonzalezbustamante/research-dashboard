-- Extend the controlled Conference presentation types for Guest lectures.

alter table public.conference_presentations
  drop constraint conference_presentations_type_check;

alter table public.conference_presentations
  add constraint conference_presentations_type_check
  check (presentation_type in (
    'Conference paper',
    'Keynote',
    'Workshop',
    'Guest lecture'
  ));
