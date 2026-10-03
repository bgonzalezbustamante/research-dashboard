# Academic API reference client

This directory contains the portable consumer-side reference implementation for **Academic API — Public RPC v1**.

It is intentionally developed inside Research Dashboard for now. It is not published as an npm package and authenticated Dashboard pages must not use it to access their own database.

## Responsibilities

The package provides:

- canonical TypeScript resource types;
- strict runtime validators with field-level diagnostics;
- a transport-agnostic client for the nine Public RPC v1 operations;
- generated contract metadata derived from `lib/academic-api-contract.json`.

The public transport remains the Supabase Data API / RPC layer. The reference client sits above that transport and validates responses before returning typed values.

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

Teaching settings validate the singleton owner-level `teaching_season_active` boolean without exposing the settings table.\n\nPublic availability uses the same fail-closed philosophy: ranges must be real dates within the requested year, use a controlled type, have a valid start/end order, avoid duplicate identical ranges, and preserve the privacy rule that Sick records are exposed only as generic `unavailable` periods.

## Portability

The package has no runtime dependency on Supabase. `createAcademicApiClient()` accepts a minimal object with an `rpc()` method, so a normal public Supabase client can be passed in by a downstream application.

That boundary keeps extraction into a standalone package possible later without coupling the implementation to Research Dashboard's authenticated application code.
