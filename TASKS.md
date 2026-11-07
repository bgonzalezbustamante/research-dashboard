# TASKS

## v1.0.0-rc.5 "Ancient Glacier"

- [x] **[Claude]** Open `release/v1.0.0-rc.5-ancient-glacier` and the start commit
- [x] **[Claude]** Full-width page text: `PageHeader`, card intros, empty states, and the `/api` and release-notes columns
- [x] **[Claude]** Prepare `@bgonzalezbustamante/academic-api-client` for npm: package build, fetch transport, collection helpers, README, tests
- [x] **[Claude]** Update the manifest consumers (Signature Studio, missing RPCs, planned sites) and the `/api` consumer list
- [x] **[Claude]** Show Public and Private counts on each collection in Other papers
- [x] **[Bastián]** Create the collections `obpex`, `sudakas`, `empiria-lab` and `carla-cisternas` in Papers → Other papers
- [x] **[Claude]** Migration: database URL rules for `paper_links.url`, `conference_presentations.url` and the three Software URLs, with a precheck
- [x] **[Claude]** Migration: cap pending Website Editor suggestions at 20
- [x] **[Claude]** Migration: audit the Owner's own external publication changes and approvals
- [x] **[Bastián]** Run the prechecks, rehearsals and `db push` for the rc.5 migrations, then the access suite
- [x] **[Claude]** Tooling: Next.js and `eslint-config-next` 16.4.5, Supabase CLI 3.0.0 parity check, recheck the `minimatch` advisory
- [x] **[Claude]** After the rc.5 `db push`: switch to Supabase CLI 3 (`enabled` keys in `supabase/config.toml`, `db push --remote`)
- [x] **[Claude]** Handoff briefs for organisation-site-template, empiria-website, sudakas-web, obpex-website-clone and Carla Cisternas' future site
- [x] **[Claude]** Release docs, draft PR (#63) and CI
- [x] **[Bastián]** Publish the client package to npm (`npm publish --tag beta`) and delete the rc.5 SQL files from Documents
- [ ] **[Claude]** Merge with a merge commit, tag `v1.0.0-rc.5` and create the GitHub pre-release ~30m

## v1.0.0-rc.4 "Velvet Torch" leftovers

- [ ] **[Bastián]** Restore Viewer access for `soporte@empirialab.cl` if wanted ~5m
- [ ] **[Bastián]** Tell the former Coauthor (now a Website Editor) about the brief access change ~10m

## Done in rc.4

- [x] **[Claude]** Pre-release audit hotfixes, affiliation logo strip and release-prep docs
- [x] **[Bastián]** Hardening and Coauthor retirement migrations, with prechecks, rehearsal and access suite runs
- [x] **[Bastián]** Delete the filled SQL suite and the Migration C rehearsal from Documents
- [x] **[Claude]** Merge PR #62 with a merge commit, tag `v1.0.0-rc.4` and create the GitHub pre-release
