# Research Dashboard

**v0.1.0-beta.3 "Misty Delta"**

An authenticated personal research-management dashboard for tracking papers, working hours, biweekly capacity planning, collaborative paper workflows, and cross-module research analytics.

**Production:** [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com)

## Features

- Paper workflow, milestones, revision history, notes, presentations, citations, and paper-scoped coauthor access
- Dashboard-wide read-only Viewer access for administrative or support users
- Collaborative paper editing with owner-controlled permissions
- Markdown and LaTeX-style math notation in long-form research text
- Manual working-hour logging and annual activity heatmap
- Biweekly paper and blocked-time capacity planning
- Planned-versus-actual research effort
- Executive and annual cross-module analytics
- Google Scholar citation-yield indicator

## Stack

Next.js · TypeScript · Tailwind CSS · Supabase · Netlify

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Before deployment:

```bash
npm run build
```

The application is authenticated and application data remain in Supabase. Local environment values and private application data must not be committed to the repository.

Institutional branding assets remain subject to their respective rights.
