# Research Dashboard Architecture

## Administrative system of record

Research Dashboard is the canonical administrative source for the structured academic records it manages: papers, projects, conference presentations, teaching portfolio data, work logs, planning data, permissions, and related internal workflow metadata.

Authenticated Dashboard modules may read and write the underlying Supabase tables according to the application permission model.

### Source-backed Planning

Biweekly Planning is a derived view rather than the canonical store for new commitments. Its authoritative sources are:

- capacity-bearing planned Paper Milestones for research;
- Conference records marked for personal attendance, with optional trip buffers;
- recurring Teaching Portfolio planning months and committed days per week;
- exact dated blocked events for Winter holiday, Summer holiday, Administrative, and Sick periods.

Conference and dated blocked-event commitments use inclusive calendar dates, including weekends, and split automatically across half-month Planning periods. Teaching converts 0/1/2 committed days per week to 0/2/4 committed days in every active half-month. Exact dated overlaps remain additive and are surfaced as overlapping commitments instead of being silently deduplicated.

Per-period FlowSavvy/Calendar state for Conference, Teaching and dated blocked-event sources is stored separately from the source records. Source scheduling changes reset that state. Historical manual Planning allocations remain available as legacy records for continuity but are no longer the authoring model for new blocked commitments.

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

Availability validation is also strict: the requested year is bounded, ranges must use real ISO dates clipped to that year, `start_date <= end_date`, types must match the controlled public vocabulary, duplicate identical ranges are rejected, and generic unavailable ranges may not disclose an underlying sickness label.

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

### Work analytics

The public analytics RPC returns yearly aggregate measures plus daily net working minutes and daily coffee counts. Raw sessions, session start/end times, activity labels, locations, paper relationships, owner metadata, and internal identifiers remain private.

### Availability

`list_public_availability(year)` is a narrow public projection for timeline consumers. It exposes only conference trips, Winter holidays, Summer holidays, and generic `unavailable` ranges. Conference trips use the same effective dates as Planning: one day before the conference through one day after it. Sick records are never labelled Sick publicly; they appear only as `unavailable` with the label `Unavailable`. Administrative commitments, notes, source IDs, owner metadata, and per-period Calendar state remain private.

The availability RPC is deliberately separate from work analytics: availability describes scheduled/public-safe date states, while work analytics describes observed work and coffee data.

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
