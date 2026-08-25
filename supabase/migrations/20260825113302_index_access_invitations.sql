create index access_invitation_papers_paper_idx
  on public.access_invitation_papers (paper_id);

create index access_invitations_invited_by_idx
  on public.access_invitations (invited_by);
