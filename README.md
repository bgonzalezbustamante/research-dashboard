# Research Dashboard

**v0.1.0-beta.5 "Red Raven"**

A personal research-management dashboard for tracking papers, projects, conferences, teaching, working hours, biweekly capacity planning, collaborative paper workflows, and cross-module research analytics. Administrative data are authenticated; selected public metadata are exposed through curated read-only Supabase RPCs.

**Production:** [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com)  
**Academic API:** [dashboard.bgonzalezbustamante.com/api](https://dashboard.bgonzalezbustamante.com/api)

## Features

- Paper workflow, milestones, revision history, notes, citations, and paper-scoped coauthor access
- Dashboard-level Projects, Conferences, and Teaching Portfolio modules
- Curated anonymous-safe public academic-data contracts for downstream applications
- Public **Academic API — Public RPC v1** documentation at `/api`
- Dashboard-wide read-only Viewer access for administrative or support users
- Collaborative paper editing with owner-controlled permissions
- Owner-visible audit history for invitations and access changes
- Markdown and LaTeX-style math notation in long-form research text
- Manual working-hour logging with annual activity analytics
- Biweekly milestone-backed research and blocked-time capacity planning
- Planned-versus-actual research effort
- Executive and annual cross-module analytics
- Google Scholar citation snapshots and citation-yield indicators

## Academic API

Research Dashboard is the canonical administrative source for the structured academic metadata exposed to public consumers.

The current architecture is:

```text
Research Dashboard / Supabase
          │
          │ curated anonymous-safe RPCs
          ▼
Downstream public consumers
```

The machine interface remains the Supabase RPC layer; `/api` is the human-readable documentation surface. Anonymous consumers use a publishable key and have no direct table access.

Public RPC v1 currently documents:

- `list_public_papers()`
- `get_public_paper(text)`
- `list_public_projects()`
- `get_public_project(text)`
- `list_public_conference_presentations()`
- `list_public_teaching()`
- `get_public_work_analytics(year)`

Known consumers are the [Academic Website](https://github.com/bgonzalezbustamante/academic-website) and [Academic CV Studio](https://github.com/bgonzalezbustamante/academic-cv-studio). Neither is a dependency of Research Dashboard.

Prospective consumers should contact [Dr. Bastián González-Bustamante](https://bgonzalezbustamante.com/) before integrating the Academic API into another application or research workflow.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the public/private boundary and versioning model.

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

The API contract check is network-free by default: it verifies the Academic API manifest against the latest Supabase migration definitions and controlled-value constraints. With the public Supabase environment variables exported, production payloads can also be checked explicitly:

```bash
npm run check:public-api -- --live
```

Local environment values and private application data must not be committed to the repository. Never use a Supabase secret/service-role credential in a public consumer.

Institutional branding assets remain subject to their respective rights.
