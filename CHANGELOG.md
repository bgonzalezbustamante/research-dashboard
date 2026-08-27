# CHANGELOG

## v0.1.0-beta.4 (in development)

### Summary

- Beta.4 development has started and remains open for additional changes before release.
- Corrected local Supabase Auth redirect configuration for HTTP localhost and 127.0.0.1 development URLs.
- Added release-date tags to the in-app Release Notes.
- Added pagination to the Papers module with 10 papers per page while preserving search, status, archive, and sort selections.
- Simplified authenticated navigation by showing the signed-in profile name directly on the Account button instead of as a separate navbar label.

### Code changes

`development and configuration`

- Updated `supabase/config.toml` so local Auth redirect URLs use HTTP consistently for both `localhost` and `127.0.0.1`.
- Kept the package version and footer identity on `v0.1.0-beta.3 "Misty Delta"` while beta.4 remains in development.

`release notes`

- Added release-date metadata to each release entry and displayed it as a compact tag alongside release status.
- Added an in-development beta.4 entry so ongoing changes can be documented before the release is finalised.

`papers`

- Added pagination to the Papers list with 10 papers per page.
- Preserved existing search, status, archive, and sort parameters when navigating between pages.
- Reset pagination naturally to page 1 when filters are reapplied.

`navigation`

- Removed the separate signed-in profile-name label from the authenticated navbar.
- Reused the existing profile name as the `/account` button label, with `Account` retained as a fallback when no profile name is available.

### Release status

- Beta.4 is in development.
- Additional changes may be added before release.
- Release date: TBC.
- The current released beta remains `v0.1.0-beta.3 "Misty Delta"`.

---

## v0.1.0-beta.3 "Misty Delta"

### Summary

- Added Phase F multi-user access with additive **Viewer** and paper-scoped **Coauthor** capabilities.
- Added dashboard-wide read-only Viewer access for administrative/support users, enforced through both UI controls and Supabase RLS.
- Added paper-scoped coauthor access, including collaborative editing of full title, authors, abstract, target/current venue, research links, milestones, presentations, and attributed notes.
- Added Owner-side access management with invitations, onboarding, Viewer permissions, Coauthor assignments, and managed-account lifecycle controls.
- Added personal account management with display-name, email, and password changes, together with password recovery.
- Added an Author Directory for maintaining canonical bibliographic author names across papers.
- Kept short title, workflow status, revision round, dates, submission/publication history, citations, archive state, Hours, and Planning owner-only.
- Added note attribution rules so coauthors can edit/delete only their own notes while the Owner can edit/delete any note without changing its creator.
- Added safe Markdown and LaTeX-style research-text rendering for abstracts, milestone notes, presentation notes, and paper notes.
- Added managed location labels in Hours, including one selectable default location for new work sessions.
- Refined Planning with FlowSavvy/Calendar wording, combined Selected period/Period load presentation, standby-paper shortcuts, and editable allocation periods.
- Added default author prefill for new papers.
- Refined Viewer warnings and read-only controls so mutation controls are hidden immediately while GET navigation/filter forms remain available.
- Restored read-only coffee visibility in Daily context for Viewer accounts.
- Updated release identity and footer for `v0.1.0-beta.3 "Misty Delta"`.
- Completed the Phase F.6 permission audit and hardening checkpoint.
- Added an append-only, Owner-visible access history for invitations, Viewer permissions, Coauthor assignments, and managed-account changes.
- Made archived papers read-only for assigned Coauthors while preserving reference access and Owner restoration.
- Added automatic cleanup of unused onboarding accounts when invitations are cancelled.
- Removed unnecessary `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges from Data API roles.

### Code changes

`permissions and collaboration`

- Added `dashboard_members` support for Owner and Viewer dashboard roles.
- Reused `paper_members` for paper-scoped Coauthor memberships.
- Added combined Viewer + Coauthor behaviour so dashboard-wide access can remain read-only while assigned papers expose collaborative controls.
- Added an Owner-only Access area for invitations, Viewer permissions, Coauthor assignments, and managed-account administration.
- Added invitation and onboarding workflows for new collaborators, including cancellation and unused-account cleanup.
- Added paper-specific RLS helpers and policies for collaborative author, link, milestone, presentation, and note operations.
- Added trigger-level protection so coauthors cannot alter short title or owner-controlled workflow fields even through direct API requests.
- Added an atomic coauthor metadata update path for title, abstract, venues, authors, and research links.
- Added route restrictions so coauthor-only accounts can access only assigned papers rather than Dashboard, Hours, or Planning.
- Hid owner-only paper hours from coauthor-only accounts instead of displaying misleading zero values.

`paper notes and research text`

- Preserved immutable note creator attribution.
- Allowed the Owner to edit or delete collaborator notes while keeping the original creator.
- Limited coauthor note editing/deletion to notes created by the same account.
- Added safe Markdown rendering for headings, emphasis, lists, links, code, blockquotes, and fenced code blocks.
- Added LaTeX-style notation support for `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, common mathematical commands, and selected text-formatting commands.
- Added formatting hints to abstract and research-note textareas.

`working hours`

- Added managed location labels alongside activity labels.
- Backfilled distinct historical session-place values into location labels while retaining `work_sessions.place` as the historical snapshot.
- Added active/inactive location labels and protected deletion when historical sessions use a label.
- Added one default location per owner and preselected it for new work sessions while retaining the complete location dropdown.
- Moved Location labels to the bottom of the Hours module after Activity labels.
- Refined location-label validation messages so errors appear within the Location labels section.
- Restored read-only display of recorded coffee counts for Viewer accounts.

`planning`

- Renamed FlowSavvy references to **FlowSavvy/Calendar**.
- Placed Selected period and Period load in one responsive row.
- Added a standby-paper card with direct links to paper workspaces.
- Added period reassignment to existing planning-allocation edit controls.
- Added duplicate-allocation protection when moving an allocation between periods.

`papers`

- Added `Bastián González-Bustamante` as the default author prefill on the new-paper form.
- Added an Author Directory for maintaining canonical author names and reusing them across paper records.
- Added collaborative paper-detail editing without exposing the short title to coauthors.
- Kept archive/restore and the full owner edit route owner-only.

`viewer experience`

- Added a visible Viewer badge and read-only access notice.
- Hid mutation controls before hydration to avoid transient clickable edit controls.
- Kept GET forms such as date navigation, search, sorting, and filters available.
- Improved blocked-mutation fallbacks so they return accurate section-specific messages rather than generic page-load errors.

`release and development`

- Updated the application version to `0.1.0-beta.3` and codename to `Misty Delta`.
- Updated README release identity and collaboration features.
- Updated the site footer to show the release version/codename and author/developer links.
- Extended reproducible Supabase migrations through the Phase F Viewer/Coauthor permission model.
- Added the final Phase F.6 migration for access auditing, active-account enforcement, archived-paper collaboration rules, and direct-API privilege hardening.

### Notes

- Viewer and Coauthor capabilities are additive rather than mutually exclusive.
- A Viewer can read Dashboard, Hours, Planning, and all accessible Papers but cannot mutate dashboard data.
- A Coauthor-only account can access assigned papers and the permitted collaborative fields only.
- A Viewer + Coauthor can read the complete dashboard and edit only the permitted fields on assigned papers.
- Markdown/LaTeX support stores plain text; unsupported TeX commands remain visible rather than being executed as raw HTML.
- Application data remain stored in Supabase and are not committed to the repository.
- The web application remains authenticated even if the source-code repository is public.
- Institutional branding assets remain subject to their respective rights and are not covered by any repository licence.

### Release status

- Phase F is complete through F.6.
- Misty Delta is ready for final verification and release tagging.

---

## v0.1.0-beta.2 "Ember Orchard"

### Summary

- Unified working-time aggregation across the Hours module and Dashboard analytics.
- Added weekly workload and coffee signals to the Dashboard.
- Changed Dashboard planning indicators to display hours using 1 planned day = 8 hours.
- Added direct links from Planning allocations to their corresponding paper workspaces.
- Changed the authenticated navigation identity from email to the profile full name.
- Refined the Working Hours layout so Selected day and Daily log appear side by side above Work sessions.
- Added local Supabase CLI configuration through `supabase/config.toml`.

### Code changes

`working hours`

- Centralised day, week, month, and year aggregation logic in shared analytics utilities.
- Kept Gross, Break, Net, paper-linked, unassigned, coffee, and working-day definitions consistent across modules.
- Reorganised the top of the Hours page so Selected day and Daily log share one responsive row.
- Simplified the Daily log presentation by keeping daily-context information within its card.

`dashboard and analytics`

- Reused the shared Hours aggregation logic for monthly workload and period summaries.
- Added Monday–Sunday gross-workload traffic-light indicators:
  - below 30 hours: orange
  - 30–39 hours: yellow
  - 40–59 hours: green
  - 60–89 hours: yellow
  - 90 hours or more: orange
- Added a weekly coffee signal based on the number of logged days exceeding six coffees:
  - zero to two days: green
  - three or more days: orange
- Changed current planning indicators from committed days to hours using an 8-hour planned working day.
- Retained monthly workload as net recorded working hours.

`planning`

- Added direct navigation from paper allocations to the associated paper workspace.
- Kept blocked-time allocations as non-linked planning entries.

`authentication and navigation`

- Changed the signed-in user identifier in the navigation from email address to `profiles.full_name`.

`development and database`

- Added `supabase/config.toml` for local Supabase CLI configuration.
- Kept secrets outside version control through environment-variable references.
- Retained reproducible schema migrations and full local-database reconstruction as future work.

### Notes

- This release remains a single-owner beta.
- Phase F collaboration, coauthor access, and paper-level permissions remain deferred.
- Application data remain stored in Supabase and are not committed to the repository.
- The web application remains authenticated even if the source-code repository is public.
- Institutional branding assets remain subject to their respective rights and are not covered by any repository licence.

### Roadmap

- Add reproducible Supabase schema migrations and local development workflow.
- Add Phase F collaboration, coauthor access, and paper-level permissions.

---

## v0.1.0-beta.1 "Ember Willow"

### Summary

- Added the first production-ready beta of the Research Dashboard.
- Added invitation-only authentication and protected application routes through Supabase Auth.
- Added paper management with statuses, milestones, revision/submission history, presentations, notes, links, citations, and archiving.
- Added manual working-hour logging with activities, breaks, locations, coffee counts, optional paper links, period summaries, and an annual activity heatmap.
- Added biweekly capacity planning for 1–15 and 16–end-of-month periods.
- Added paper allocations and blocked-time allocations for Teaching, Conference, Holiday, and Administrative commitments.
- Added FlowSavvy tracking, monthly and annual planning views, and planned-versus-actual research comparisons using 1 planned day = 8 hours.
- Added an executive dashboard with current paper, workload, planning, and research-priority indicators.
- Added cross-module annual analytics, monthly workload summaries, and cumulative Google Scholar citation yield relative to matched tracked paper hours.
- Added Supabase Row Level Security with owner-only access for the current beta.
- Added production deployment through Netlify with the custom domain [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com).
- Adopted release codenames generated with the [OCPSG Benchmarking LLMs Release Name Generator](https://ocpsg-benchmarking-llms.github.io/release-name-generator/).

### Code changes

`papers`

- Added paper workspaces, milestones, history, presentations, notes, links, and citation snapshots.
- Added workflow statuses and revision-round tracking.
- Added paper-hour totals derived from linked work sessions.
- Added archiving rather than deletion.

`working hours`

- Added daily logs with coffee counts.
- Added manual work sessions with activity labels, locations, optional paper links, and protected Break handling.
- Added overlap validation and same-day session constraints.
- Added day, week, month, and year analytics.
- Added annual GitHub-style working-hours heatmap.

`biweekly planning`

- Added half-month planning periods.
- Added 5-, 10-, and 15-day paper allocations.
- Added blocked-time allocations for Teaching, Conference, Holiday, and Administrative commitments.
- Added FlowSavvy state and timestamps.
- Added monthly and annual planning views.
- Added planned-versus-actual research comparisons using an 8-hour planned working day.

`dashboard and analytics`

- Added executive indicators for active papers, working hours, current planning, and research priorities.
- Added annual cross-module summaries and monthly workload visualisation.
- Added cumulative citation yield using the latest Google Scholar snapshot for papers with matched tracked hours.
- Kept citation databases source-specific rather than combining Google Scholar, Scopus, and Web of Science counts.

`authentication, database, and production`

- Added Supabase Auth and protected routes.
- Added Row Level Security policies and authenticated CRUD permissions.
- Added automatic timestamps and validation triggers.
- Added `.env.example` while keeping local environment values outside version control.
- Added production deployment through Netlify and the custom domain:
  - [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com)
- Fixed the production logout redirect so signed-out users return to the canonical custom domain rather than the Netlify branch-deploy URL.

### Notes

- This release is a single-owner beta intended for active use and testing.
- Collaboration and paper-level coauthor permissions are deferred to Phase F.
- Application data are stored in Supabase and are not committed to the repository.
- Citation counts remain source-specific.
- Citation yield uses Google Scholar only and is a descriptive cumulative indicator, not a causal measure of research productivity.
- The web application remains authenticated even if the source-code repository is public.
- Institutional branding assets remain subject to their respective rights and are not covered by any repository licence.

### Roadmap

- Add reproducible Supabase schema migrations and local project configuration.
- Add Phase F collaboration, coauthor access, and paper-level permissions.

---
