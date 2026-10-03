# Research Dashboard

**v1.0.0-rc.2 "Rustic Peak" — in development**

A personal research-management dashboard for papers, projects, conferences, teaching, working hours, research planning, collaboration, and cross-module analytics. Research Dashboard is also the canonical administrative source for selected academic metadata used by public downstream applications.

**Production:** [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com)  
**Academic API:** [dashboard.bgonzalezbustamante.com/api](https://dashboard.bgonzalezbustamante.com/api)

## Features

- Paper workflow, milestones, revision history, citations, research links, and paper-scoped coauthor access
- Structured Projects, Conferences, and Teaching Portfolio modules
- Manual working-hour logging with yearly research and workload analytics
- Source-backed biweekly Planning from Paper Milestones, conference attendance/trips, recurring Teaching schedules, and exact dated blocked events, with a load-coloured 12-month calendar for fortnight navigation
- Dashboard-wide read-only Viewer access and paper-specific collaboration permissions
- Google Scholar citation snapshots and citation-yield indicators
- Curated read-only public academic metadata, Teaching season state, work analytics, and availability ranges for the Academic Website, Academic CV Studio, Weekly Penguin Timeline, and other approved consumers
- Public **Academic API — Public RPC v1** documentation at `/api`

## Public data interface

Research Dashboard remains the administrative system of record. Public consumers do not query Dashboard tables directly; they use the curated anonymous-safe Supabase RPC layer with a publishable key.

The human-readable contract is documented at [Academic API](https://dashboard.bgonzalezbustamante.com/api). Public RPC v1 currently contains nine curated operations. The exact public field lists, operation notes, consumer mappings, and controlled vocabularies are maintained in `lib/academic-api-contract.json`.

A portable TypeScript reference client and strict runtime validators live in `packages/academic-api-client/`. Generated client metadata is derived from the canonical manifest rather than maintained independently.

For the technical public/private boundary, validation layers, versioning rules, and integration model, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Stack

Next.js · TypeScript · Tailwind CSS · Supabase · Netlify

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Normal validation:

```bash
npm run lint
npm run check:public-api
npm run check:academic-api-client
npm run build
```

The producer-side public API check is network-free and validates the contract manifest against the current Supabase migration definitions. The reference-client check verifies generated contract metadata, TypeScript compatibility, and strict runtime-validation tests. Before releases or public-contract changes, run the live boundary check as well; it reads the normal local Supabase values from `.env.local` and validates real RPC responses through the same reference-client validators:

```bash
npm run check:public-api:live
```

Local environment values and private application data must not be committed to the repository. Never use a Supabase secret/service-role credential in a public consumer.

For an additional repository-history secret scan, run:

```bash
gitleaks git .
```

The full repository history was scanned before the rc.1 public pre-release with no leaks detected. See [NOTICE](NOTICE) for the licensing boundary around third-party logos, trademarks, and institutional branding.
