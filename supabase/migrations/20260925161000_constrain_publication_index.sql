alter table public.paper_public_metadata
  drop constraint if exists paper_public_metadata_publication_index_nonempty;

alter table public.paper_public_metadata
  add constraint paper_public_metadata_publication_index_check
  check (
    publication_index is null
    or publication_index in (
      'WoS-SSCI',
      'Scopus',
      'WoS-ESCI',
      'Book chapter',
      'SciELO/Latindex',
      'Working paper',
      'Preprint'
    )
  );
