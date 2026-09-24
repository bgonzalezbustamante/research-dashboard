-- Distant Forge: accept common static-asset extensions case-insensitively.

alter table public.paper_public_metadata
  drop constraint paper_public_metadata_highlight_image_filename_format;

alter table public.paper_public_metadata
  add constraint paper_public_metadata_highlight_image_filename_format
  check (
    highlight_image_filename is null
    or (
      char_length(highlight_image_filename) between 1 and 180
      and highlight_image_filename ~*
        '^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$'
    )
  );

alter table public.project_public_metadata
  drop constraint project_public_metadata_project_image_format,
  drop constraint project_public_metadata_funder_image_format;

alter table public.project_public_metadata
  add constraint project_public_metadata_project_image_format
  check (
    project_image_filename is null
    or (
      char_length(
        project_image_filename
      ) between 1 and 180
      and project_image_filename ~*
        '^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$'
    )
  ),
  add constraint project_public_metadata_funder_image_format
  check (
    funder_image_filename is null
    or (
      char_length(
        funder_image_filename
      ) between 1 and 180
      and funder_image_filename ~*
        '^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$'
    )
  );
