# Research Dashboard

**v1.0.0-rc.2 "Rustic Peak"**

A personal research-management dashboard for papers, projects, conferences, teaching, software, working hours, planning, collaboration, and cross-module analytics. It is also the canonical administrative source for selected academic metadata used by public downstream applications.

**Production:** [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com)  
**Academic API:** [dashboard.bgonzalezbustamante.com/api](https://dashboard.bgonzalezbustamante.com/api)

## Core capabilities

- **Research records** — paper workflows, milestones, revision history, citations, projects, conferences, teaching, and linked research resources.
- **Work and planning** — manual work logs, yearly analytics, and source-backed biweekly Planning from Paper Milestones, conference attendance and trips, recurring Teaching schedules, and dated blocked events.
- **Collaboration and access** — Dashboard-wide Viewer access, paper-scoped Coauthor permissions, and Owner-only administrative controls.
- **Software and operations** — a Software Ecosystem registry plus protected backup health and manual workflow dispatch for Research Dashboard, Supervision Portal, and Household Finances.
- **Public data** — curated anonymous-safe academic, software, work-analytics, Teaching-season, and availability data for approved downstream consumers.
- **Cross-module analytics** — workload, research activity, planning, Google Scholar citation snapshots, and citation-yield indicators.

## Public data interface

Research Dashboard is the administrative system of record. Public consumers use the curated Supabase RPC layer rather than querying Dashboard tables directly.

The human-readable contract is documented on the [Academic API](https://dashboard.bgonzalezbustamante.com/api) page. Public RPC v1 currently contains eleven curated operations; canonical fields, parameters, notes, and controlled vocabularies are maintained in `lib/academic-api-contract.json`.

A portable TypeScript reference client and strict runtime validators live in `packages/academic-api-client/`. For the public/private boundary, validation model, and versioning rules, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Stack

Next.js · TypeScript · Tailwind CSS · Supabase · Netlify

## Development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Normal validation:

```bash
npm run lint
npm run check:public-api
npm run check:academic-api-client
npm run check:backups
npm run build
```

Before a release or a public-contract change, also validate the live anonymous boundary:

```bash
npm run check:public-api:live
```

Backup operations require the server-only `APPS_BACKUPS_GITHUB_TOKEN`: a fine-grained GitHub token restricted to `bgonzalezbustamante/apps-backups` with **Actions: read and write** and **Contents: read**. Never expose it through a `NEXT_PUBLIC_*` variable.

Local environment values and private application data must not be committed. Public consumers must use a Supabase publishable key, never a secret/service-role credential.

For release security checks:

```bash
npm audit --omit=dev
gitleaks git .
```

For rc.2, the production dependency audit reported zero vulnerabilities and the final full-history Gitleaks scan covered 655 commits (approximately 2.64 MB) with no leaks found. See [NOTICE](NOTICE) for the licensing boundary around third-party logos, trademarks, and institutional branding.
