import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { verifyOrigin } from '@/lib/documents/manifest'
import { createClient } from '@/lib/supabase/server'

import {
  importLegacyDocuments,
  registerSignedDocument,
  removeSignedDocument,
  revokeSignedDocument,
} from './actions'

type DocumentsPageProps = {
  searchParams: Promise<{
    error?: string
    registered?: string
    revoked?: string
    removed?: string
    imported?: string
  }>
}

type SignedDocumentRow = {
  code: string
  title: string
  issued_at: string
  sha256: string
  status: 'registered' | 'revoked'
  registered_at: string
  revoked_at: string | null
  revocation_note: string | null
}

type LegacyDocumentRow = {
  slug: string
  title: string
  issued_at: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

const fileClass =
  'block w-full text-sm text-oxford-charcoal file:mr-3 file:rounded-md file:border file:border-oxford-blue file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-oxford-blue'

function formatUtc(
  value: string
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }
  ).format(
    new Date(value)
  ) + ' UTC'
}

function successMessage(
  params: Awaited<DocumentsPageProps['searchParams']>
) {
  if (params.registered) {
    return `Document ${params.registered} registered. It is live on the verification site now.`
  }

  if (params.revoked) {
    return `Document ${params.revoked} revoked. The verification site now shows it as revoked.`
  }

  if (params.removed) {
    return `Test document ${params.removed} removed. Its code now answers "not found".`
  }

  if (params.imported) {
    return `${params.imported} historical records imported.`
  }

  return null
}

export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  await requireDashboardOwner()

  const params =
    await searchParams

  const supabase =
    await createClient()

  const [
    signedResult,
    legacyResult,
  ] = await Promise.all([
    supabase
      .from('signed_documents')
      .select(
        'code, title, issued_at, sha256, status, registered_at, revoked_at, revocation_note'
      )
      .order(
        'registered_at',
        {
          ascending: false,
        }
      ),

    supabase
      .from('legacy_documents')
      .select(
        'slug, title, issued_at'
      )
      .order(
        'slug',
        {
          ascending: true,
        }
      ),
  ])

  for (const [
    label,
    result,
  ] of [
    [
      'Signed documents',
      signedResult,
    ],
    [
      'Historical records',
      legacyResult,
    ],
  ] as const) {
    if (result.error) {
      throw new Error(
        `${label} could not be loaded: ${result.error.message}`
      )
    }
  }

  const signed =
    (signedResult.data ??
      []) as SignedDocumentRow[]

  const legacy =
    (legacyResult.data ??
      []) as LegacyDocumentRow[]

  const success =
    successMessage(params)

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Register documents signed with the signing tool, revoke them when needed, and keep the historical validation records that the verification site answers."
      />

      {params.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {params.error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Register a signed document
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Use the{' '}
            <code>
              .manifest.json
            </code>{' '}
            file that the signing tool saved with the PDF. The record is
            live on{' '}
            <a
              href={verifyOrigin}
              className="text-oxford-blue underline"
            >
              the verification site
            </a>{' '}
            as soon as it is registered: its title, issue time and SHA-256
            become visible to anyone who has the document&apos;s code.
          </p>

          <form
            action={registerSignedDocument}
            className="mt-5 grid gap-4"
          >
            <div>
              <label
                htmlFor="manifest-file"
                className={labelClass}
              >
                Manifest file
              </label>

              <input
                id="manifest-file"
                name="manifest_file"
                type="file"
                accept=".json,application/json"
                className={fileClass}
              />
            </div>

            <div>
              <label
                htmlFor="manifest-text"
                className={labelClass}
              >
                Or paste the manifest
              </label>

              <textarea
                id="manifest-text"
                name="manifest"
                rows={6}
                spellCheck={false}
                className={`${inputClass} font-mono text-xs`}
              />
            </div>

            <div>
              <Button type="submit">
                Register document
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Academic API
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            The verification site reads one record at a time through{' '}
            <code>
              get_public_signed_document(code)
            </code>{' '}
            and{' '}
            <code>
              get_public_legacy_document(slug)
            </code>
            . There is no listing: a record is visible only to someone
            who already has its code or slug. These tables are visible to
            the Owner only, and every change is recorded in the Access
            audit log.
          </p>

          <p className="mt-3 text-sm leading-6 text-oxford-ash">
            Revoke a document that was issued but should no longer be
            relied on; its record stays, with the revocation date and
            note. Remove only test documents that were never issued.
          </p>
        </Card>
      </div>

      <h2 className="mt-10 font-serif text-2xl font-semibold text-oxford-blue">
        Signed documents
      </h2>

      {signed.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-oxford-ash">
            No signed documents are registered yet.
          </p>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4">
          {signed.map(
            (document) => (
              <Card
                key={document.code}
                className={
                  params.registered ===
                    document.code ||
                  params.revoked ===
                    document.code
                    ? 'ring-2 ring-green-200'
                    : ''
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-xl font-semibold text-oxford-blue">
                    {document.title}
                  </h3>

                  <span
                    className={
                      document.status ===
                      'revoked'
                        ? 'rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800'
                        : 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                    }
                  >
                    {document.status ===
                    'revoked'
                      ? 'Revoked'
                      : 'Registered'}
                  </span>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-oxford-charcoal sm:grid-cols-[max-content_1fr]">
                  <dt className="text-oxford-ash">
                    Code
                  </dt>
                  <dd className="break-all font-mono text-xs">
                    <a
                      href={`${verifyOrigin}/?id=${document.code}`}
                      className="text-oxford-blue underline"
                    >
                      {document.code}
                    </a>
                  </dd>

                  <dt className="text-oxford-ash">
                    Issued
                  </dt>
                  <dd>
                    {formatUtc(
                      document.issued_at
                    )}
                  </dd>

                  <dt className="text-oxford-ash">
                    Registered
                  </dt>
                  <dd>
                    {formatUtc(
                      document.registered_at
                    )}
                  </dd>

                  <dt className="text-oxford-ash">
                    SHA-256
                  </dt>
                  <dd className="break-all font-mono text-xs">
                    {document.sha256}
                  </dd>

                  {document.revoked_at && (
                    <>
                      <dt className="text-oxford-ash">
                        Revoked
                      </dt>
                      <dd>
                        {formatUtc(
                          document.revoked_at
                        )}
                        {document.revocation_note
                          ? `: ${document.revocation_note}`
                          : ''}
                      </dd>
                    </>
                  )}
                </dl>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {document.status ===
                    'registered' && (
                    <form
                      action={revokeSignedDocument}
                      className="grid gap-2"
                    >
                      <input
                        type="hidden"
                        name="code"
                        value={document.code}
                      />

                      <label
                        htmlFor={`note-${document.code}`}
                        className={labelClass}
                      >
                        Revocation note (public)
                      </label>

                      <input
                        id={`note-${document.code}`}
                        name="note"
                        type="text"
                        maxLength={1000}
                        placeholder="Superseded by a corrected version"
                        className={inputClass}
                      />

                      <div>
                        <Button
                          type="submit"
                          variant="warning"
                          size="compact"
                        >
                          Revoke document
                        </Button>
                      </div>
                    </form>
                  )}

                  <form
                    action={removeSignedDocument}
                    className="grid gap-2 self-end"
                  >
                    <input
                      type="hidden"
                      name="code"
                      value={document.code}
                    />

                    <label className="flex items-start gap-2 text-sm text-oxford-charcoal">
                      <input
                        type="checkbox"
                        name="confirm_test"
                        value="yes"
                        required
                        className="mt-1"
                      />
                      This was a test document that was never issued.
                    </label>

                    <div>
                      <Button
                        type="submit"
                        variant="danger"
                        size="compact"
                      >
                        Remove test record
                      </Button>
                    </div>
                  </form>
                </div>
              </Card>
            )
          )}
        </div>
      )}

      <h2 className="mt-10 font-serif text-2xl font-semibold text-oxford-blue">
        Historical records
      </h2>

      <Card className="mt-4">
        <p className="text-sm leading-6 text-oxford-ash">
          {legacy.length} historical records from the earlier validation
          pages. The old addresses redirect to the verification site,
          which shows each record&apos;s title, original issue time and
          32-character fingerprint.
        </p>

        {legacy.length > 0 && (
          <ul className="mt-4 grid gap-1 text-sm text-oxford-charcoal">
            {legacy.map(
              (record) => (
                <li key={record.slug}>
                  <a
                    href={`${verifyOrigin}/legacy/${record.slug}`}
                    className="font-mono text-xs text-oxford-blue underline"
                  >
                    {record.slug}
                  </a>{' '}
                  {record.title}
                </li>
              )
            )}
          </ul>
        )}

        <details
          className="mt-5"
          open={legacy.length === 0}
        >
          <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
            Import historical records
          </summary>

          <form
            action={importLegacyDocuments}
            className="mt-4 grid gap-4"
          >
            <p className="text-sm leading-6 text-oxford-ash">
              Use the signing tool&apos;s legacy records file or the
              verification site&apos;s former registry file. Only the title,
              issue time, fingerprint and original address are kept; a record
              with an address already imported is updated in place.
            </p>

            <div>
              <label
                htmlFor="legacy-file"
                className={labelClass}
              >
                Records file
              </label>

              <input
                id="legacy-file"
                name="legacy_file"
                type="file"
                accept=".json,application/json"
                className={fileClass}
              />
            </div>

            <div>
              <label
                htmlFor="legacy-text"
                className={labelClass}
              >
                Or paste the records
              </label>

              <textarea
                id="legacy-text"
                name="legacy"
                rows={6}
                spellCheck={false}
                className={`${inputClass} font-mono text-xs`}
              />
            </div>

            <div>
              <Button
                type="submit"
                variant="secondary"
              >
                Import historical records
              </Button>
            </div>
          </form>
        </details>
      </Card>
    </div>
  )
}
