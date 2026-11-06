-- Ancient Glacier rc.5: database URL rules for the older link fields.
--
-- External publications and Projects already constrain their links. Paper
-- links (which feed the public Paper RPCs), conference presentation URLs and
-- Software URLs relied on the forms alone. They now share the external
-- publication rule: an absolute HTTP(S) URL with a host, no whitespace and at
-- most 2,048 characters, mirrored by lib/validation/url.ts.
--
-- Each constraint is added NOT VALID and then validated, so the check of
-- existing rows is explicit; validation fails, and the whole migration rolls
-- back, if any stored value breaks the rule.
--
-- Precheck (read-only; every count must be 0):
--   with rule as (select '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'::text as re)
--   select 'paper_links.url' as column_name, count(*) as bad_rows
--   from public.paper_links, rule
--   where url is not null and (char_length(url) > 2048 or url !~* rule.re)
--   union all
--   select 'conference_presentations.url', count(*)
--   from public.conference_presentations, rule
--   where url is not null and (char_length(url) > 2048 or url !~* rule.re)
--   union all
--   select 'software_items.repository_url', count(*)
--   from public.software_items, rule
--   where repository_url is not null and (char_length(repository_url) > 2048 or repository_url !~* rule.re)
--   union all
--   select 'software_items.production_url', count(*)
--   from public.software_items, rule
--   where production_url is not null and (char_length(production_url) > 2048 or production_url !~* rule.re)
--   union all
--   select 'software_items.documentation_url', count(*)
--   from public.software_items, rule
--   where documentation_url is not null and (char_length(documentation_url) > 2048 or documentation_url !~* rule.re);

alter table public.paper_links
  add constraint paper_links_url_format
  check (
    url is null
    or (
      char_length(url) <= 2048
      and url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    )
  ) not valid;

alter table public.paper_links
  validate constraint paper_links_url_format;

alter table public.conference_presentations
  add constraint conference_presentations_url_format
  check (
    url is null
    or (
      char_length(url) <= 2048
      and url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    )
  ) not valid;

alter table public.conference_presentations
  validate constraint conference_presentations_url_format;

alter table public.software_items
  add constraint software_items_repository_url_format
  check (
    repository_url is null
    or (
      char_length(repository_url) <= 2048
      and repository_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    )
  ) not valid;

alter table public.software_items
  validate constraint software_items_repository_url_format;

alter table public.software_items
  add constraint software_items_production_url_format
  check (
    production_url is null
    or (
      char_length(production_url) <= 2048
      and production_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    )
  ) not valid;

alter table public.software_items
  validate constraint software_items_production_url_format;

alter table public.software_items
  add constraint software_items_documentation_url_format
  check (
    documentation_url is null
    or (
      char_length(documentation_url) <= 2048
      and documentation_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    )
  ) not valid;

alter table public.software_items
  validate constraint software_items_documentation_url_format;
