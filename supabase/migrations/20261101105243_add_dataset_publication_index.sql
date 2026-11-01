-- Allow Dataset as a controlled Paper publication-index category.
-- Preserve existing values and null for unclassified manuscripts.

alter table public.paper_public_metadata
  drop constraint paper_public_metadata_publication_index_check;

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
      'Preprint',
      'Dataset'
    )
  );
