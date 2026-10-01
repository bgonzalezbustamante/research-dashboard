# Research Dashboard Architecture

## Administrative system of record

Research Dashboard is the canonical administrative source for the structured academic records it manages: papers, projects, conference presentations, teaching portfolio data, work logs, planning data, permissions, and related internal workflow metadata.

Authenticated Dashboard modules may read and write the underlying Supabase tables according to the application permission model.

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

The canonical field lists and controlled vocabularies used by the documentation live in:

```text
lib/academic-api-contract.json
```

The repository check:

```bash
npm run check:public-api
```

compares that manifest against the latest function and constraint definitions in `supabase/migrations`. This is intended to make contract changes explicit and reduce drift between the Dashboard and downstream consumers.

An optional live check is available when the public Supabase environment variables are exported:

```bash
npm run check:public-api -- --live
```

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

The current conference RPC has no per-record visibility flag: it returns the curated public presentation shape for every stored conference presentation. Private notes, internal owner IDs, presentation IDs, and the optional internal paper relationship are excluded.

### Teaching Portfolio

Only teaching portfolio items marked public are returned. Public portfolio fields include the controlled Teaching Role, academic levels, period/current state, cumulative teaching/student counts, and optional image filename. Activity labels, tracked hours, session counts, owner metadata, and internal IDs remain private.

### Work analytics

The public analytics RPC returns only yearly aggregate measures and daily net working minutes. Raw sessions, session start/end times, activity labels, locations, paper relationships, daily coffee counts, owner metadata, and internal identifiers remain private.

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

The exact values are maintained in the database constraints and mirrored in `lib/academic-api-contract.json`; `npm run check:public-api` fails if they drift.

## Consumers

Current downstream consumers include:

- [Academic Website](https://github.com/bgonzalezbustamante/academic-website)
- [Academic CV Studio](https://github.com/bgonzalezbustamante/academic-cv-studio)

These repositories consume the public interface but are not runtime dependencies of Research Dashboard.


## Documentation responsibilities

To reduce documentation drift:

- `/api` and `lib/academic-api-contract.json` define the public data contract and controlled values;
- this file documents architecture, privacy boundaries, and versioning;
- `CHANGELOG.md` records detailed implementation history;
- Release Notes provide a short, non-technical summary of each release;
- `README.md` provides project orientation and development commands.

## Versioning

Public RPC v1 is a lightweight compatibility label, not a separate deployment or URL namespace.

A change that adds, removes, renames, or changes the meaning of a public RPC field or controlled value should:

1. update the Supabase migration/function definition;
2. update `lib/academic-api-contract.json`;
3. pass `npm run check:public-api`;
4. update `/api` automatically through the shared manifest;
5. be recorded in `CHANGELOG.md` and the appropriate release notes;
6. be propagated deliberately to downstream consumers.

A conventional REST façade or URL-versioned API may be introduced later if there is a concrete need. It is not part of Public RPC v1.
