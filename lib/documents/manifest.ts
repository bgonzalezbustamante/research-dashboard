// Parsing for the Documents page: a signing-tool manifest to register,
// and the historical records to import once. Pure functions, no database access.

export const verifyOrigin =
  'https://verify.bgonzalezbustamante.com'

const legacyOrigin =
  'https://bgonzalezbustamante.com'

const codePattern =
  /^[0-9a-f]{32}$/

const sha256Pattern =
  /^[0-9a-f]{64}$/

const legacyFingerprintPattern =
  /^[0-9a-f]{32}$/

const legacySlugPattern =
  /^\d{4}-\d{2}-\d{2}-document$/

const isoTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

const legacyIssuedAtPattern =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/

export type ParseResult<TValue> =
  | {
      ok: true
      value: TValue
    }
  | {
      ok: false
      error: string
    }

export type SignedDocumentInput = {
  code: string
  title: string
  issuedAt: string
  sha256: string
}

export type LegacyDocumentInput = {
  slug: string
  title: string
  issued_at: string
  fingerprint: string
  original_url: string
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function readJson(
  text: string
): ParseResult<unknown> {
  try {
    return {
      ok: true,
      value: JSON.parse(
        text
      ),
    }
  } catch {
    return {
      ok: false,
      error: 'The text is not valid JSON.',
    }
  }
}

function trimmed(
  value: unknown
) {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

/**
 * A signing-tool manifest for a signed document: schemaVersion 1, origin "native", state
 * "pending-registration", and a QR address on the verification site.
 */
export function parseSignerManifest(
  text: string
): ParseResult<SignedDocumentInput> {
  const json =
    readJson(text)

  if (!json.ok) {
    return json
  }

  const manifest =
    json.value

  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== 1 ||
    manifest.origin !== 'native' ||
    manifest.hashProvenance !== 'calculated-final-pdf' ||
    manifest.state !== 'pending-registration'
  ) {
    return {
      ok: false,
      error: 'This is not a signing-tool manifest for a signed document.',
    }
  }

  const code =
    trimmed(manifest.code).toLowerCase()

  const title =
    trimmed(manifest.title)

  const issuedAt =
    trimmed(manifest.issuedAt)

  const sha256 =
    trimmed(manifest.sha256).toLowerCase()

  if (!codePattern.test(code)) {
    return {
      ok: false,
      error: 'The manifest code must be 32 hexadecimal characters.',
    }
  }

  if (
    !title ||
    title.length > 500
  ) {
    return {
      ok: false,
      error: 'The manifest title must have 1 to 500 characters.',
    }
  }

  if (
    !isoTimestampPattern.test(issuedAt) ||
    !Number.isFinite(
      Date.parse(issuedAt)
    )
  ) {
    return {
      ok: false,
      error: 'The manifest issue time is not a valid timestamp.',
    }
  }

  if (!sha256Pattern.test(sha256)) {
    return {
      ok: false,
      error: 'The manifest SHA-256 must be 64 hexadecimal characters.',
    }
  }

  let url: URL

  try {
    url = new URL(
      trimmed(manifest.verificationUrl)
    )
  } catch {
    return {
      ok: false,
      error: 'The manifest verification address is not a valid URL.',
    }
  }

  if (
    url.origin !== verifyOrigin ||
    url.pathname !== '/' ||
    url.searchParams.get('id') !== code ||
    url.searchParams.size !== 1
  ) {
    return {
      ok: false,
      error: `The manifest QR code must point to ${verifyOrigin}/?id=${code}.`,
    }
  }

  return {
    ok: true,
    value: {
      code,
      title,
      issuedAt,
      sha256,
    },
  }
}

const registrationFragmentPattern =
  /^#?register=([A-Za-z0-9_-]+)$/

const maxRegistrationPayload =
  8000

export type RegistrationFragment = {
  text: string
  value: SignedDocumentInput
}

/**
 * The signing tool's "Register on the Dashboard" link opens
 * /documents#register=<payload>, where the payload is the manifest as
 * UTF-8 JSON in base64url. Browsers never send the fragment to the server,
 * so it is read on the page and the manifest text is then submitted to
 * registerSignedDocument, which validates it again. Returns null when the
 * address has no registration fragment.
 */
export function readRegistrationFragment(
  hash: string
): ParseResult<RegistrationFragment> | null {
  if (
    !hash.replace(/^#/, '').startsWith(
      'register='
    )
  ) {
    return null
  }

  const match =
    hash.match(
      registrationFragmentPattern
    )

  if (
    !match ||
    match[1].length >
      maxRegistrationPayload
  ) {
    return {
      ok: false,
      error: 'The registration link is incomplete or damaged. Open it again from the signing tool.',
    }
  }

  let text: string

  try {
    const base64 =
      match[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    const binary =
      atob(
        base64.padEnd(
          Math.ceil(
            base64.length / 4
          ) * 4,
          '='
        )
      )

    text =
      new TextDecoder(
        'utf-8',
        {
          fatal: true,
        }
      ).decode(
        Uint8Array.from(
          binary,
          (character) =>
            character.charCodeAt(0)
        )
      )
  } catch {
    return {
      ok: false,
      error: 'The registration link is incomplete or damaged. Open it again from the signing tool.',
    }
  }

  const manifest =
    parseSignerManifest(text)

  return manifest.ok
    ? {
        ok: true,
        value: {
          text,
          value: manifest.value,
        },
      }
    : manifest
}

function legacySlugFromUrl(
  value: string
) {
  try {
    const url =
      new URL(value)

    if (
      url.hostname.replace(/^www\./, '') !==
      'bgonzalezbustamante.com'
    ) {
      return null
    }

    const match =
      url.pathname.match(
        /^\/validation\/docs\/([^/]+)\/?$/
      )

    return match &&
      legacySlugPattern.test(match[1])
      ? match[1]
      : null
  } catch {
    return null
  }
}

/**
 * Historical records, as the signing tool's legacy input (an array of
 * { title, fingerprint, issuedAt, originalUrl }) or as the verifier's former
 * data/registry.json ({ records: [...] }, legacy records only). Only the schema
 * fields are kept, so anything else, such as an email address, is dropped.
 */
export function parseLegacyImport(
  text: string
): ParseResult<LegacyDocumentInput[]> {
  const json =
    readJson(text)

  if (!json.ok) {
    return json
  }

  const rows =
    Array.isArray(json.value)
      ? json.value
      : isRecord(json.value) &&
          Array.isArray(json.value.records)
        ? json.value.records.filter(
            (row) =>
              !isRecord(row) ||
              row.kind === undefined ||
              row.kind === 'legacy'
          )
        : null

  if (
    !rows ||
    rows.length === 0 ||
    rows.length > 100
  ) {
    return {
      ok: false,
      error: 'Paste an array of 1 to 100 historical records.',
    }
  }

  const records: LegacyDocumentInput[] = []
  const seen =
    new Set<string>()

  for (const [
    index,
    row,
  ] of rows.entries()) {
    const label =
      `Record ${index + 1}`

    if (!isRecord(row)) {
      return {
        ok: false,
        error: `${label} is not an object.`,
      }
    }

    const slug =
      legacySlugFromUrl(
        trimmed(row.originalUrl)
      )

    const title =
      trimmed(row.title)

    const issuedAt =
      trimmed(row.issuedAt)

    const fingerprint =
      trimmed(row.fingerprint).toLowerCase()

    if (!slug) {
      return {
        ok: false,
        error: `${label}: the original address must look like ${legacyOrigin}/validation/docs/YYYY-MM-DD-document/.`,
      }
    }

    if (seen.has(slug)) {
      return {
        ok: false,
        error: `${label}: ${slug} appears twice.`,
      }
    }

    if (
      !title ||
      title.length > 500
    ) {
      return {
        ok: false,
        error: `${label}: the title must have 1 to 500 characters.`,
      }
    }

    if (!legacyIssuedAtPattern.test(issuedAt)) {
      return {
        ok: false,
        error: `${label}: the issue date must be YYYY-MM-DD or an ISO timestamp with its offset.`,
      }
    }

    if (!legacyFingerprintPattern.test(fingerprint)) {
      return {
        ok: false,
        error: `${label}: the fingerprint must be 32 hexadecimal characters.`,
      }
    }

    seen.add(slug)
    records.push({
      slug,
      title,
      issued_at: issuedAt,
      fingerprint,
      original_url: `${legacyOrigin}/validation/docs/${slug}/`,
    })
  }

  return {
    ok: true,
    value: records,
  }
}
