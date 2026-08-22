# CHANGELOG

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

### Notes

- This release is a single-owner beta intended for active use and testing.
- Collaboration and paper-level coauthor permissions are deferred to Phase F.
- Application data are stored in Supabase and are not committed to this repository.
- Citation counts remain source-specific.
- Citation yield uses Google Scholar only and is a descriptive cumulative indicator, not a causal measure of research productivity.
- The web application remains authenticated even if the source-code repository is public.
- Institutional branding assets remain subject to their respective rights and are not covered by any repository licence.

---
