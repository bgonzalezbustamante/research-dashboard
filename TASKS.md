# TASKS

## v1.0.0-rc.4 "Velvet Torch" close-out

- [x] **[Claude]** Pre-release audit hotfixes (commit 985d72d)
- [x] **[Bastián]** Run the hardening prechecks and `db push` for `20261106120853_harden_external_publication_inputs.sql`
- [x] **[Bastián]** Re-run the rc.4 access policy suite after the hardening migration
- [x] **[Bastián]** Delete `C:\Users\Admin\Documents\rc4_access_policies_filled.sql`
- [ ] **[Bastián]** Restore Viewer access for `soporte@empirialab.cl` if wanted ~5m
- [x] **[Claude]** Finish the affiliation logo strip (Leiden, UDP, OCPSG, Empiria Lab, OBPEX): build, CHANGELOG and release-notes lines, commit ~30m
- [x] **[Claude]** Release-prep docs: README, ARCHITECTURE, CHANGELOG, `lib/releases.ts`, `/api` page, client README, local CLAUDE.md ~1.5h
- [x] **[Claude]** Open the rc.4 PR as a draft (#62) and wait for CI
- [x] **[Bastián]** Release window: `/backups` run
- [x] **[Bastián]** Release window: Migration C function and policy prechecks, rehearsal and `db push` (`20261106132331_retire_coauthor_access.sql`)
- [x] **[Bastián]** Re-run the rc.4 access policy suite after Migration C
- [ ] **[Bastián]** Delete `C:\Users\Admin\Documents\rc4_access_policies_filled.sql` and `rc4_migration_c_rehearsal.sql` ~5m
- [ ] **[Claude]** Merge with a merge commit, tag `v1.0.0-rc.4` and create the GitHub pre-release mirroring `lib/releases.ts` ~30m
- [ ] **[Bastián]** Tell the former Coauthor (now a Website Editor) about the brief access change ~10m

## v1.0.0-rc.5 follow-ups from the rc.4 audit

- [ ] **[Claude]** Add database URL constraints (`^https?://` with a host, no whitespace) to the legacy link columns: `paper_links.url`, the Paper DOI, preprint, GitHub and dataset URLs, `conference_presentations.url` and the Software URLs; precheck existing rows first ~2h
- [ ] **[Bastián]** Decide whether Website Editors need a cap on pending suggestions ~15m
