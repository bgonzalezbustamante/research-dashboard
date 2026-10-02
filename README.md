# Research Dashboard

**v1.0.0-rc.2 "Steady Passage" — in development**

A personal research-management dashboard for papers, projects, conferences, teaching, working hours, research planning, collaboration, and cross-module analytics. Research Dashboard is also the canonical administrative source for selected academic metadata used by public downstream applications.

**Production:** [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com)  
**Academic API:** [dashboard.bgonzalezbustamante.com/api](https://dashboard.bgonzalezbustamante.com/api)

## Features

- Paper workflow, milestones, revision history, citations, research links, and paper-scoped coauthor access
- Structured Projects, Conferences, and Teaching Portfolio modules
- Manual working-hour logging with yearly research and workload analytics
- Milestone-backed biweekly research-capacity planning and blocked-time planning
- Dashboard-wide read-only Viewer access and paper-specific collaboration permissions
- Google Scholar citation snapshots and citation-yield indicators
- Curated read-only public academic metadata for the Academic Website, Academic CV Studio, and other approved consumers
- Public **Academic API — Public RPC v1** documentation at `/api`

## Public data interface

Research Dashboard remains the administrative system of record. Public consumers do not query Dashboard tables directly; they use the curated anonymous-safe Supabase RPC layer with a publishable key.

The human-readable contract is documented at [Academic API](https://dashboard.bgonzalezbustamante.com/api). The exact public field lists and controlled vocabularies are maintained in `lib/academic-api-contract.json`.

For the technical public/private boundary, versioning rules, and integration model, see [ARCHITECTURE.md](ARCHITECTURE.md).

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
npm run build
```

The public API check is network-free by default and validates the contract manifest against the current Supabase migration definitions. Before releases or public-contract changes, run the live boundary check as well; it reads the normal local Supabase values from `.env.local`:

```bash
npm run check:public-api:live
```

Local environment values and private application data must not be committed to the repository. Never use a Supabase secret/service-role credential in a public consumer.

For an additional repository-history secret scan, run:

```bash
gitleaks git .
```

The full repository history was scanned before the rc.1 public pre-release with no leaks detected. See [NOTICE](NOTICE) for the licensing boundary around third-party logos, trademarks, and institutional branding.
