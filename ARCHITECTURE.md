# Research Dashboard Architecture

## Administrative system of record

Research Dashboard is the canonical administrative source for the structured academic records it manages: papers, projects, conference presentations, teaching portfolio data, Software Ecosystem records, owner-level Calendar settings, work logs, planning data, permissions, and related internal workflow metadata.

Authenticated Dashboard modules may read and write the underlying Supabase tables according to the application permission model.

### Source-backed Planning

Biweekly Planning is a derived view rather than the canonical store for new commitments. Its authoritative sources are:

- capacity-bearing planned Paper Milestones for research;
- Conference records marked for personal attendance, with optional trip buffers;
- recurring Teaching Portfolio planning months and committed days per week;
- exact dated blocked events for Winter holiday, Summer holiday, Administrative, and Sick periods.

Conference and dated blocked-event commitments use inclusive calendar dates, including weekends, and split automatically across half-month Planning periods. Multiple presentation records for the same conference event (same event name, short name, start date, and end date) are grouped into one attendance/trip commitment so presenting more than once at one conference does not double-count capacity. Teaching converts 0/1/2 committed days per week to 0/2/4 committed days in every active half-month. Exact dated overlaps between genuinely distinct commitments remain additive and are surfaced as overlapping commitments instead of being silently deduplicated.

Per-period FlowSavvy/Calendar state for Conference, Teaching and dated blocked-event sources is stored separately from the source records. Source scheduling changes reset that state. Historical manual Planning allocations remain available as legacy records for continuity but are no longer the authoring model for new blocked commitments.

The Annual timeline is a derived navigation view over the same half-month periods. Its calendar colours reuse the Period load classification based on total committed days: Open = 0, Light = 1–5, Moderate = 6–10, Full = 11–15, and Overcommitted = 16+. Changing years preserves the selected month and half-month; individual calendar dates navigate to the corresponding fortnight.

## Backup operations

Research Dashboard provides a protected `/backups` operations view for Research Dashboard, Supervision Portal, and Household Finances. The private `bgonzalezbustamante/apps-backups` repository remains the backup system of record and owns backup creation, encrypted release storage, retention, pruning, and recovery procedures.

The Dashboard keeps one typed server-side application registry containing the allow-listed workflow filename, tag prefix, display label, and weekly UTC schedule for each application. GitHub Releases provide the latest successful backup timestamp, encrypted `.tar.gz.age` archive size, and private release link. GitHub Actions workflow runs are queried separately so a newer failed/cancelled attempt is not hidden by an older successful release.

Backup health uses four states:

- **Healthy** — a successful backup exists and is no more than eight days old;
- **Running** — the latest workflow attempt is queued or in progress;
- **Attention** — no successful release exists, or a failed/cancelled attempt is newer than the latest successful release;
- **Stale** — the latest successful backup is more than eight days old.

Manual dispatch is exposed only through the authenticated server-side `POST /api/backups/[app]/run` endpoint. The application key is validated against the registry, the caller must have editable Dashboard access, the request must be same-origin, and dispatch is rejected while that application's workflow already has a queued or in-progress run. The endpoint dispatches only the configured workflow on `main`, polls the private Actions API briefly until the new manual run is discovered and progresses beyond queued where possible, revalidates `/backups`, and returns only a small operational response.

All GitHub API requests execute server-side using `APPS_BACKUPS_GITHUB_TOKEN`. The intended credential is a fine-grained token restricted to `bgonzalezbustamante/apps-backups` with Actions read/write and Contents read permissions. The token, source Supabase credentials, age private key, and backup archive bytes never pass to the browser.

The first integration is deliberately status/operations-only. Research Dashboard does not download, decrypt, restore, delete, or prune backups. Retention remains 12 recent releases plus 12 monthly anchors, with protected milestone tags retained by `apps-backups`.

## Public Academic API

The public machine interface is intentionally narrower than the administrative data model.

```text
Research Dashboard / Supabase
          │
          │ curated anonymous-safe RPCs
          ▼
Academic Website / Academic CV Studio / other approved public consumers
```

The human-readable documentation surface is:

```text
https://dashboard.bgonzalezbustamante.com/api
```

It is branded **Academic API** and currently documents **Public RPC v1**.

The `/api` page does not introduce a parallel REST service. Public consumers continue to call the curated Supabase RPC functions directly through the Data API with a publishable key.

## Public RPC v1

The current anonymous-safe function surface is:

- `list_public_papers()`
- `get_public_paper(text)`
- `list_public_projects()`
- `get_public_project(text)`
- `list_public_conference_presentations()`
- `list_public_teaching()`
- `get_public_teaching_settings()`
- `get_public_calendar_settings()`
- `list_public_software()`
- `get_public_software(text)`
- `get_public_work_analytics(year)`
- `list_public_availability(year)`

The canonical field lists and controlled vocabularies used by the documentation live in:

```text
lib/academic-api-contract.json
```

The producer-side repository check:

```bash
npm run check:public-api
```

compares that manifest against the latest function and constraint definitions in `supabase/migrations`. This remains the authoritative static producer check.

## Reference client and validation layers

A portable consumer-side reference implementation lives in:

```text
packages/academic-api-client/
```

It is deliberately isolated from authenticated Dashboard data access. Dashboard pages continue to use the internal Supabase/admin access paths; the reference client represents an external anonymous consumer.

The client has no runtime dependency on Supabase. It accepts a minimal transport exposing `rpc()`, so a normal public Supabase client can be supplied by a downstream application.

Contract metadata for RPC names, fields, parameters, and controlled vocabularies is generated from `lib/academic-api-contract.json`. The handwritten client code adds semantic rules that the manifest does not currently encode, such as nullability, valid dates, HTTP(S) URLs, numeric bounds, date-range relationships, controlled-value membership, array uniqueness, and complete calendar-year work analytics.

The architecture therefore has three complementary checks:

1. **Static producer contract — `npm run check:public-api`**  
   Verifies the manifest against migration/function definitions, controlled database vocabularies, and forbidden-field boundaries.

2. **Client/schema compatibility — `npm run check:academic-api-client`**  
   Verifies generated client metadata against the manifest, compiles the canonical TypeScript types/reference client, and runs strict runtime-validator regression tests.

3. **Live response validation — `npm run check:public-api:live`**  
   Calls the real anonymous-safe RPCs with the publishable key, validates responses through the same reference-client parsers available to downstream consumers, and separately confirms that anonymous direct table access remains blocked.

Work-analytics validation follows the strict rules first exercised in `weekly-penguin-timeline`: requested-year equality, real ISO calendar dates, unique daily rows, non-negative integer daily metrics, and complete 365/366-day coverage.

Software validation enforces the controlled category, development-stage, status, and repository-visibility vocabularies, valid HTTP(S) URLs, valid lifecycle years with `end_year >= start_year` when both exist, and the privacy invariant that a Private repository cannot return a public `repository_url`. Availability validation is also strict: the requested year is bounded, ranges must use real ISO dates clipped to that year, `start_date <= end_date`, types must match the controlled public vocabulary, duplicate identical ranges are rejected, and generic unavailable ranges may not disclose an underlying sickness label.

These layers complement one another. The reference client does not replace `lib/academic-api-contract.json`, the producer-side migration checks, or the Supabase RPC transport.

## Privacy and access model

The public API follows a least-privilege boundary:

- anonymous consumers have `EXECUTE` access only to the deliberate Public RPC surface;
- anonymous consumers do not receive direct `SELECT` access to the underlying Dashboard tables;
- public clients use a Supabase publishable key;
- secret/service-role credentials are never part of the public interface;
- anonymous access is read-only;
- private workflow, ownership, access-control, planning, raw activity, notes, internal identifiers, and other Dashboard-only metadata are excluded unless a field is explicitly admitted to a Public RPC.

Resource-specific boundaries are documented on `/api` and encoded in the API contract manifest.

### Publications

Only papers explicitly marked public with a public slug appear in the list/detail contracts. Public bibliographic and selected research-resource metadata may be exposed. Internal workflow state, milestones, revision/submission history, notes, Overleaf links, raw citation history, internal IDs, and private author metadata remain unavailable.

Only the latest stored Google Scholar citation snapshot is exposed, as a count and capture date. Snapshot IDs, historical snapshots, citation source metadata, and other citation sources remain private.

### Projects

Only explicitly public projects appear in the project list/detail contracts. Associated publications are represented only by slugs of papers that are themselves public. Activity-label relationships, tracked project hours, owner/internal IDs, and private paper associations remain unavailable.

### Conference presentations

The current conference RPC has no per-record visibility flag: it returns the curated public presentation shape for every stored conference presentation. Public fields now include `personal_attendance` and `involves_trip`, allowing consumers to distinguish records personally attended by the profile owner from presentations delivered only by collaborators. A trip may be true only when personal attendance is true.

Private notes, internal owner IDs, presentation IDs, and the optional internal paper relationship are excluded.

### Teaching Portfolio

Only teaching portfolio items marked public are returned. Public portfolio fields include the controlled Teaching Role, academic levels, period/current state, cumulative teaching/student counts, and optional image filename. Activity labels, tracked hours, session counts, owner metadata, and internal IDs remain private.

`get_public_teaching_settings()` separately exposes the single owner-level `teaching_season_active` boolean. The underlying Teaching settings row, owner identifier, and timestamps remain private, and the season flag does not change per-course visibility or Planning months.

### Catholic Calendar settings

The signed-in Dashboard Home resolves the current Europe/Amsterdam civil date through the reusable `@bgonzalezbustamante/catholic-calendar` package and renders the package's fixed two-item composed display. The calendar engine remains external to Research Dashboard; this repository stores only the supporting icon assets used to render the package's semantic icon names.

`get_public_calendar_settings()` exposes only the owner-level `catholic_calendar_active` boolean. The flag is intended for downstream presentation decisions, including Calendar-related features on the Academic Website. It does not control whether the composed Calendar display appears for signed-in Dashboard users.

The underlying `calendar_settings` row, owner identifier, and timestamps remain private and direct anonymous table access is blocked.

### Software Ecosystem

Software Ecosystem is the canonical administrative registry for software, applications and reusable tools maintained through Research Dashboard. Operational metadata includes category, current version, development stage, status, repository visibility and URLs, start/end year, Featured state, and a separate public-exposure control.

`list_public_software()` and `get_public_software(slug)` return only profiles explicitly marked Public. Repository visibility is deliberately independent from profile exposure: a software profile may be Public while its repository remains Private. In that case the public contract reports `repository_visibility = private` but forces `repository_url = null`. Internal software/owner IDs, public-exposure metadata, timestamps, and private repository URLs remain unavailable anonymously.

### Work analytics

The public analytics RPC returns yearly aggregate measures plus daily net working minutes and daily coffee counts. Raw sessions, session start/end times, activity labels, locations, paper relationships, owner metadata, and internal identifiers remain private.

### Availability

`list_public_availability(year)` is a narrow public projection for timeline consumers. It exposes only conference trips, Winter holidays, Summer holidays, and generic `unavailable` ranges. Conference trips use the same effective dates as Planning: one day before the conference through one day after it. Sick records are never labelled Sick publicly; they appear only as `unavailable` with the label `Unavailable`. Administrative commitments, notes, source IDs, owner metadata, and per-period Calendar state remain private.

Repeated presentation records for the same conference event produce one public trip range. If distinct source events nevertheless project to the same public type/date/label range, the public availability response returns that range only once. The availability RPC is deliberately separate from work analytics: availability describes scheduled/public-safe date states, while work analytics describes observed work and coffee data.

## Controlled vocabularies

Controlled public values are part of the API contract. Downstream consumers must use the canonical values rather than extending them independently.

Public RPC v1 currently constrains:

- Publication index
- Paper language
- Project role
- Project status
- Conference presentation type
- Teaching role
- Teaching level
- Software category
- Software development stage
- Software status
- Repository visibility
- Public availability type

The exact values are maintained in the database constraints and mirrored in `lib/academic-api-contract.json`; `npm run check:public-api` fails if they drift.

## Consumers

Current downstream consumers include:

- [Academic Website](https://github.com/bgonzalezbustamante/academic-website)
- [Academic CV Studio](https://github.com/bgonzalezbustamante/academic-cv-studio)
- [Weekly Penguin Timeline](https://github.com/bgonzalezbustamante/weekly-penguin-timeline)

These repositories consume the public interface but are not runtime dependencies of Research Dashboard.


## Documentation responsibilities

To reduce documentation drift:

- `/api` and `lib/academic-api-contract.json` define the public data contract and controlled values;
- `packages/academic-api-client/` provides the portable consumer-side TypeScript types, runtime validators, and reference client;
- this file documents architecture, privacy boundaries, validation layers, and versioning;
- `CHANGELOG.md` records detailed implementation history;
- Release Notes provide a short, non-technical summary of each release;
- `README.md` provides project orientation and development commands.

## Versioning

Public RPC v1 is a lightweight compatibility label, not a separate deployment or URL namespace.

A change that adds, removes, renames, or changes the meaning of a public RPC field or controlled value should:

1. update the Supabase migration/function definition;
2. update `lib/academic-api-contract.json`;
3. regenerate the reference-client contract metadata with `npm run generate:academic-api-client`;
4. pass `npm run check:public-api` and `npm run check:academic-api-client`;
5. pass `npm run check:public-api:live` when the live public environment is available;
6. update `/api` automatically through the shared manifest and any explanatory client documentation as needed;
7. be recorded in `CHANGELOG.md` and the appropriate release notes;
8. be propagated deliberately to downstream consumers.

A conventional REST façade or URL-versioned API may be introduced later if there is a concrete need. It is not part of Public RPC v1.
