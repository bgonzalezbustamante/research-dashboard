# @bgonzalezbustamante/academic-api-client

Typed client, dependency-free fetch transport and strict runtime validators for the **Research Dashboard Academic API (Public RPC v1)**: the curated, anonymous Supabase RPCs documented at [dashboard.bgonzalezbustamante.com/api](https://dashboard.bgonzalezbustamante.com/api).

The package is developed inside Research Dashboard (`packages/academic-api-client/`) and published to npm for downstream sites. Authenticated Dashboard pages must not use it to access their own database.

## Install

```bash
npm install @bgonzalezbustamante/academic-api-client@beta
```

Node.js 22 or later, or any runtime with `fetch`. The package has no runtime dependencies.

## Quick start

```ts
import {
  createAcademicApiClient,
  createFetchTransport,
} from '@bgonzalezbustamante/academic-api-client'

const academicApi = createAcademicApiClient(
  createFetchTransport({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  })
)

const papers = await academicApi.listPublicPapers()
```

Use the Research Dashboard project URL and its **publishable** key, never a secret or service-role key. Anonymous callers can only execute the sixteen Public RPC v1 functions.

`createFetchTransport` POSTs to `<url>/rest/v1/rpc/<name>` with the publishable key, so a site does not need `@supabase/supabase-js`. A supabase-js client also works as a transport, because it exposes the same `rpc()` method:

```ts
const academicApi = createAcademicApiClient(supabase)
```

## Next.js with ISR on Netlify

Pass Next's fetch cache options through `init`, so each Academic API response is cached and refreshed in the background:

```ts
// lib/academic-api.ts
import {
  createAcademicApiClient,
  createFetchTransport,
} from '@bgonzalezbustamante/academic-api-client'

export const academicApi = createAcademicApiClient(
  createFetchTransport({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    init: { next: { revalidate: 3600 } },
  })
)
```

```ts
// app/publications/page.tsx
export const revalidate = 3600
```

A change in the Dashboard then appears on the site within the revalidation window, without a rebuild. On Netlify this uses the Next.js runtime's server functions. Every response is validated before it is returned, and a validation error throws `AcademicApiValidationError`. Catch it where the section is rendered, and either hide the section or show the last good data: never render an unvalidated payload.

## Collections and Project publications

`list_public_external_publications()` returns every Public external publication, the papers by other authors that the Dashboard Owner curates. Each site keeps its own selection through a **collection** slug:

```ts
import {
  filterExternalPublicationsByCollection,
  sortPublicationsByDate,
} from '@bgonzalezbustamante/academic-api-client'

const rows = await academicApi.listPublicExternalPublications()
const publications = sortPublicationsByDate(
  filterExternalPublicationsByCollection(rows, 'obpex')
)
```

For a Project page, `list_public_project_publications()` lists the Owner's own Public Papers (`authorship = 'own'`) and the Public external publications linked to each public Project (`authorship = 'external'`):

```ts
import { filterProjectPublications } from '@bgonzalezbustamante/academic-api-client'

const rows = await academicApi.listPublicProjectPublications()
const external = filterProjectPublications(rows, 'project-slug', 'external')
```

Collection slugs become public once a collection holds a Public publication; collection names and descriptions stay private, so each site labels its own section.

## Versioning

The package version is independent of the Dashboard's. While Public RPC v1 is the contract, releases are `0.x` on the `beta` tag. A new field or controlled value is a minor release. A breaking contract change is a new Public RPC version and a new major release. `PUBLIC_RPC_VERSION` exports the contract version the package validates against.

## Responsibilities

The package provides:

- canonical TypeScript resource types;
- strict runtime validators with field-level diagnostics;
- a transport-agnostic client for the sixteen Public RPC v1 operations, plus a dependency-free fetch transport;
- pure helpers for filtering by collection or Project and sorting by date;
- generated contract metadata derived from `lib/academic-api-contract.json`.

## Contract ownership

`lib/academic-api-contract.json` remains authoritative for:

- RPC names;
- top-level public field names;
- parameter names;
- controlled vocabularies.

Run:

```bash
npm run generate:academic-api-client
```

after deliberately changing the manifest. The generated `src/contract.generated.ts` file must be committed.

`npm run check:academic-api-client` verifies that generated metadata is current, compiles the TypeScript client, and runs runtime-validation regression tests.

## Validation philosophy

Payloads are validated without coercion. Unexpected keys, wrong primitive types, malformed dates, invalid URLs, unknown controlled values and resource-specific invariant violations fail explicitly.

Work analytics intentionally follows the strict approach first proven in `weekly-penguin-timeline`: the requested year must match, dates must be real and unique, daily metrics must be non-negative integers, and the response must contain the complete 365/366-day calendar year.

Teaching settings validate the singleton owner-level `teaching_season_active` boolean without exposing the settings table.

Software validation enforces controlled metadata values, valid start/end lifecycle years, and the privacy invariant that `repository_url` must be null when `repository_visibility` is `private`, even when the software profile itself is public.

Public availability uses the same fail-closed philosophy: ranges must be real dates within the requested year, use a controlled type, have a valid start/end order, avoid duplicate identical ranges, and preserve the privacy rule that Sick records are exposed only as generic `unavailable` periods.

External and project publication validation requires lowercase hyphenated slugs, unique Project and collection slugs per row, a publication date in the publication year, HTTP(S) URLs, and the controlled language and `publication-authorship` (`own`, `external`) values. External publication slugs must also be unique within the `list_public_external_publications()` response, and each project publication row must carry a valid `publication_slug`; the live producer check cross-checks those rows against the Paper and external publication feeds.

## Portability

The package has no runtime dependency on Supabase. `createAcademicApiClient()` accepts a minimal object with an `rpc()` method: the bundled `createFetchTransport()` or a normal public Supabase client.

That boundary keeps extraction into a standalone package possible later without coupling the implementation to Research Dashboard's authenticated application code.
