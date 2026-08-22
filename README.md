# Research Dashboard

An authenticated personal research-management dashboard for tracking papers, working hours, biweekly capacity planning, and cross-module research analytics.

**Production:** [dashboard.bgonzalezbustamante.com](https://dashboard.bgonzalezbustamante.com)

## Features

- Paper workflow, milestones, revision history, notes, presentations, and citations
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