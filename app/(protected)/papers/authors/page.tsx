import Link from 'next/link'

import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import {
  deleteUnusedAuthor,
  renameAuthor,
} from './actions'

type AuthorRow = {
  id: string
  full_name: string
  email: string | null
  affiliation: string | null
  orcid: string | null
  profile_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

type PaperAuthorRow = {
  author_id: string
  paper_id: string
  author_order: number
  papers:
    | {
        id: string
        short_title: string
        archived_at: string | null
      }
    | {
        id: string
        short_title: string
        archived_at: string | null
      }[]
    | null
}

type AuthorDirectoryPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  ).format(new Date(value))
}

export default async function AuthorDirectoryPage({
  searchParams,
}: AuthorDirectoryPageProps) {
  const access =
    await requireDashboardOwner()

  const params =
    await searchParams

  const supabase =
    await createClient()

  const [
    authorsResult,
    paperAuthorsResult,
  ] = await Promise.all([
    supabase
      .from('authors')
      .select(`
        id,
        full_name,
        email,
        affiliation,
        orcid,
        profile_id,
        created_by,
        created_at,
        updated_at
      `)
      .eq('owner_id', access.ownerId)
      .order('full_name', {
        ascending: true,
      }),

    supabase
      .from('paper_authors')
      .select(`
        author_id,
        paper_id,
        author_order,
        papers (
          id,
          short_title,
          archived_at
        )
      `)
      .order('author_order', {
        ascending: true,
      }),
  ])

  if (authorsResult.error) {
    throw new Error(
      `Could not load author directory: ${authorsResult.error.message}`
    )
  }

  if (paperAuthorsResult.error) {
    throw new Error(
      `Could not load author usage: ${paperAuthorsResult.error.message}`
    )
  }

  const authors =
    (authorsResult.data ?? []) as AuthorRow[]

  const usage =
    new Map<
      string,
      {
        id: string
        shortTitle: string
        archived: boolean
      }[]
    >()

  for (
    const row of
      (paperAuthorsResult.data ?? []) as PaperAuthorRow[]
  ) {
    const paper =
      Array.isArray(row.papers)
        ? row.papers[0]
        : row.papers

    if (!paper) {
      continue
    }

    const existing =
      usage.get(row.author_id) ?? []

    existing.push({
      id: paper.id,
      shortTitle:
        paper.short_title,
      archived:
        paper.archived_at !== null,
    })

    usage.set(
      row.author_id,
      existing
    )
  }

  const orderedAuthors = [
    ...authors,
  ].sort((a, b) => {
    const aCount =
      usage.get(a.id)?.length ?? 0
    const bCount =
      usage.get(b.id)?.length ?? 0

    if (
      aCount === 0 &&
      bCount !== 0
    ) {
      return -1
    }

    if (
      aCount !== 0 &&
      bCount === 0
    ) {
      return 1
    }

    return a.full_name.localeCompare(
      b.full_name,
      'en',
      {
        sensitivity: 'base',
      }
    )
  })

  const unusedCount =
    authors.filter(
      (author) =>
        (
          usage.get(author.id)
            ?.length ?? 0
        ) === 0
    ).length

  const linkedAccountCount =
    authors.filter(
      (author) =>
        author.profile_id !== null
    ).length

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Authors"
          description="Manage the canonical bibliographic author directory used across paper workspaces. Author records are separate from dashboard accounts."
        />

        <ButtonLink
          href="/papers"
          variant="secondary"
        >
          Back to papers
        </ButtonLink>
      </div>

      {params.message && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {params.message}
        </div>
      )}

      {params.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {params.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Authors
          </div>
          <div className="mt-2 font-serif text-3xl font-semibold text-oxford-blue">
            {authors.length}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Unused
          </div>
          <div className="mt-2 font-serif text-3xl font-semibold text-oxford-blue">
            {unusedCount}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Linked accounts
          </div>
          <div className="mt-2 font-serif text-3xl font-semibold text-oxford-blue">
            {linkedAccountCount}
          </div>
        </Card>
      </div>

      <Card className="mt-6 border-sky-200 bg-sky-50/40">
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Directory rules
        </h2>

        <p className="mt-2 text-sm leading-6 text-oxford-charcoal">
          Paper authors are bibliographic identities, not permissions. Renaming an author updates the displayed name everywhere that author is used. An author can be deleted only when no paper references the record. New paper and coauthor edits now reuse this dashboard-wide directory automatically.
        </p>
      </Card>

      <section className="mt-8 space-y-4">
        {orderedAuthors.length === 0 ? (
          <Card>
            <p className="text-sm text-oxford-ash">
              No authors have been recorded yet.
            </p>
          </Card>
        ) : (
          orderedAuthors.map(
            (author) => {
              const papers =
                usage.get(author.id) ?? []

              const unused =
                papers.length === 0

              return (
                <Card
                  key={author.id}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
                          {author.full_name}
                        </h2>

                        <span
                          className={
                            unused
                              ? 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800'
                              : 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                          }
                        >
                          {unused
                            ? 'Unused'
                            : `${papers.length} ${papers.length === 1 ? 'paper' : 'papers'}`}
                        </span>

                        {author.profile_id && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                            Account linked
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-oxford-ash">
                        Added {formatDate(author.created_at)}
                      </p>

                      {papers.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {papers.map(
                            (paper) => (
                              <Link
                                key={paper.id}
                                href={`/papers/${paper.id}`}
                                className="rounded-md border border-oxford-stone bg-oxford-shell px-2.5 py-1.5 text-xs font-medium text-oxford-blue transition hover:border-oxford-blue"
                              >
                                {paper.shortTitle}
                                {paper.archived
                                  ? ' · Archived'
                                  : ''}
                              </Link>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-oxford-stone pt-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                        Rename author
                      </summary>

                      <form
                        action={renameAuthor}
                        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                      >
                        <input
                          type="hidden"
                          name="author_id"
                          value={author.id}
                        />

                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={`author-name-${author.id}`}
                            className="mb-1 block text-sm font-medium text-oxford-charcoal"
                          >
                            Canonical name
                          </label>

                          <input
                            id={`author-name-${author.id}`}
                            name="full_name"
                            type="text"
                            required
                            defaultValue={author.full_name}
                            className={inputClass}
                          />
                        </div>

                        <Button
                          type="submit"
                          variant="primary"
                        >
                          Save name
                        </Button>
                      </form>
                    </details>

                    <div className="lg:text-right">
                      {unused ? (
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                            Delete unused author
                          </summary>

                          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4 text-left">
                            <p className="text-sm text-red-800">
                              This permanently removes the unused bibliographic record. It does not affect any dashboard account.
                            </p>

                            <form
                              action={deleteUnusedAuthor}
                              className="mt-3"
                            >
                              <input
                                type="hidden"
                                name="author_id"
                                value={author.id}
                              />

                              <Button
                                type="submit"
                                variant="danger"
                              >
                                Confirm delete
                              </Button>
                            </form>
                          </div>
                        </details>
                      ) : (
                        <p className="text-xs text-oxford-ash">
                          Remove this author from all papers before deleting the directory record.
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )
            }
          )
        )}
      </section>
    </div>
  )
}
