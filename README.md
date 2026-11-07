# Research Dashboard

**v1.0.0-rc.5 "Ancient Glacier"**

A personal research-management dashboard for papers, projects, conferences, teaching, software, working hours, planning, collaboration, and cross-module analytics. It is also the canonical administrative source for selected academic metadata used by public downstream applications.

**Production:** [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com)  
**Academic API:** [dashboard.bgonzalezbustamante.com/api](https://dashboard.bgonzalezbustamante.com/api)

## Core capabilities

- **Research records** — Paper workflows, milestones, revision history and citations, with publication-index filtering (including Dataset), Google Scholar citation sorting, and milestone-first Paper workspaces; an Other papers library of curated external publications with stable public slugs and collections for downstream sites; searchable Projects, Conferences and Teaching Portfolio with dedicated filters and consistent top/bottom pagination.
- **Work and planning** — manual work logs with a locally resolved and locally served Penguin Timeline state for the selected day, day/week/month/year analytics including major-activity breakdowns, a read-only Activity relationships map for Project/Teaching assignments and observed Paper usage, paginated activity/location label management with provenance-preserving consolidation, and source-backed biweekly Planning from Paper Milestones, conference attendance and trips, recurring Teaching schedules, and dated blocked events.
- **Collaboration and access** — Dashboard-wide Viewer access, a restricted paper-scoped Website Editor role (citation and publication index of assigned Papers, plus external publication suggestions that stay private until the Owner approves and publishes them), and Owner-only administrative controls.
- **Software and operations** — a Software Ecosystem registry plus protected backup health and manual workflow dispatch for Research Dashboard, Supervision Portal, and Household Finances.
- **Public data** — curated public academic, software, analytics, Calendar and availability RPCs for downstream consumers, including project publication and external publication feeds, with explicitly documented publication of full Paper titles in the milestone feed.
- **Cross-module analytics** — workload, research activity, planning, Google Scholar citation snapshots, and citation-yield indicators.

## Public data interface

Research Dashboard is the administrative system of record. Public consumers use the curated Supabase RPC layer rather than querying Dashboard tables directly.

The human-readable contract is documented on the [Academic API](https://dashboard.bgonzalezbustamante.com/api) page. Public RPC v1 now documents sixteen curated operations in `lib/academic-api-contract.json`, including `list_public_paper_milestones()`, `list_public_planning_allocations()`, and, since rc.4, `list_public_external_publications()` and `list_public_project_publications()`. External publications are returned only once the Owner publishes them, never appear in the Paper RPCs, and expose slugs rather than internal IDs or contributor identities. Milestone records deliberately disclose the milestone title and full associated Paper title even for private Papers; private Paper slugs, IDs and notes remain hidden. FlowSavvy state and timestamp are provided for milestones. The allocation endpoint returns historical/manual records, not the complete derived Planning view. Both are supported by the reference client and strict validation checks.

A portable TypeScript reference client, a dependency-free fetch transport and strict runtime validators live in `packages/academic-api-client/`, prepared for npm as [`@bgonzalezbustamante/academic-api-client`](packages/academic-api-client/README.md). New downstream sites use it with incremental static regeneration and select their publications by collection; the consumer list, including the planned OBPEX, SUDAKAS, Empiria Lab and Carla Cisternas websites, is part of the manifest. For the public/private boundary, validation model, and versioning rules, see [ARCHITECTURE.md](ARCHITECTURE.md).

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

Dependabot alerts and security updates, secret scanning and push protection watch the repository; `.github/dependabot.yml` groups weekly npm and monthly GitHub Actions updates, and the Verify workflow gates on `npm audit --omit=dev --audit-level=high`. For rc.5, the production dependency audit reported zero vulnerabilities on Next.js 16.4.5, and the full-history Gitleaks scan covered 820 commits (approximately 3.36 MB) with no leaks found. See [NOTICE](NOTICE) for the licensing boundary around third-party logos, trademarks, and institutional branding.
