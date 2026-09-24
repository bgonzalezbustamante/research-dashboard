-- Distant Forge: preserve conference records when an optional linked paper is deleted.

alter table public.conference_presentations
  drop constraint paper_presentations_paper_id_fkey;

alter table public.conference_presentations
  add constraint conference_presentations_paper_id_fkey
  foreign key (paper_id)
  references public.papers(id)
  on delete set null;
