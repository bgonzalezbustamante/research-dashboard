# CHANGELOG

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
- Application data are stored in Supabase and are not committed to this repository.
- Citation counts remain source-specific.
- Citation yield uses Google Scholar only and is a descriptive cumulative indicator, not a causal measure of research productivity.
- The web application remains authenticated even if the source-code repository is public.
- Institutional branding assets remain subject to their respective rights and are not covered by any repository licence.

### Roadmap

- Add reproducible Supabase schema migrations and local project configuration.
- Add Phase F collaboration, coauthor access, and paper-level permissions.

---