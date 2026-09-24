import Link from 'next/link'

import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import { updatePublicPaperMetadata } from './actions'

type WebsitePageProps = {
  searchParams: Promise<{
    error?: string
    saved?: string
  }>
}

type PublicVisibility =
  | 'public'
  | 'private'

type PaperRow = {
  id: string
  short_title: string
  title: string
  abstract: string | null
  status: string
  current_venue: string | null
  published_on: string | null
  archived_at: string | null
}

type PublicMetadataRow = {
  paper_id: string
  visibility: PublicVisibility
  slug: string | null
  featured: boolean
  publication_index: string | null
}

type PaperAuthorRow = {
  paper_id: string
  author_order: number
  authors:
    | {
        full_name: string
      }
    | {
        full_name: string
      }[]
    | null
}

type PaperLinkRow = {
  id: string
  paper_id: string
  link_type: string
  url: string
  sort_order: number
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

const visibilityOrder: PublicVisibility[] = [
  'public',
  'private',
]

const visibilityLabels: Record<
  PublicVisibility,
  string
> = {
  public: 'Public',
  private: 'Private',
}

function visibilityClass(
  visibility: PublicVisibility
) {
  return visibility === 'public'
    ? 'border-green-200 bg-green-50 text-green-800'
    : 'border-gray-300 bg-gray-100 text-gray-700'
}

function normalizeAuthorName(
  row: PaperAuthorRow
) {
  const author =
    Array.isArray(row.authors)
      ? row.authors[0]
      : row.authors

  return author?.full_name ?? ''
}

function getLink(
  links: PaperLinkRow[],
  linkType: string
) {
  return (
    links
      .filter(
        (link) =>
          link.link_type ===
          linkType
      )
      .sort((a, b) => {
        if (
          a.sort_order !==
          b.sort_order
        ) {
          return (
            a.sort_order -
            b.sort_order
          )
        }

        return a.id.localeCompare(
          b.id
        )
      })[0]?.url ?? null
  )
}

function compareByPublicationDate(
  a: {
    paper: PaperRow
  },
  b: {
    paper: PaperRow
  }
) {
  if (
    a.paper.published_on &&
    b.paper.published_on
  ) {
    const dateComparison =
      b.paper.published_on.localeCompare(
        a.paper.published_on
      )

    if (dateComparison !== 0) {
      return dateComparison
    }
  } else if (
    a.paper.published_on
  ) {
    return -1
  } else if (
    b.paper.published_on
  ) {
    return 1
  }

  return a.paper.short_title.localeCompare(
    b.paper.short_title
  )
}

export default async function WebsitePage({
  searchParams,
}: WebsitePageProps) {
  const access =
    await requireDashboardOwner()

  const { error, saved } =
    await searchParams

  const supabase =
    await createClient()

  const [
    papersResult,
    metadataResult,
    authorsResult,
    linksResult,
  ] = await Promise.all([
    supabase
      .from('papers')
      .select(`
        id,
        short_title,
        title,
        abstract,
        status,
        current_venue,
        published_on,
        archived_at
      `)
      .eq(
        'owner_id',
        access.ownerId
      ),

    supabase
      .from(
        'paper_public_metadata'
      )
      .select(`
        paper_id,
        visibility,
        slug,
        featured,
        publication_index
      `),

    supabase
      .from('paper_authors')
      .select(`
        paper_id,
        author_order,
        authors (
          full_name
        )
      `)
      .order('paper_id', {
        ascending: true,
      })
      .order('author_order', {
        ascending: true,
      }),

    supabase
      .from('paper_links')
      .select(`
        id,
        paper_id,
        link_type,
        url,
        sort_order
      `)
      .order('sort_order', {
        ascending: true,
      }),
  ])

  if (papersResult.error) {
    throw new Error(
      `Could not load papers: ${papersResult.error.message}`
    )
  }

  if (metadataResult.error) {
    throw new Error(
      `Could not load public metadata: ${metadataResult.error.message}`
    )
  }

  if (authorsResult.error) {
    throw new Error(
      `Could not load paper authors: ${authorsResult.error.message}`
    )
  }

  if (linksResult.error) {
    throw new Error(
      `Could not load paper links: ${linksResult.error.message}`
    )
  }

  const papers =
    (papersResult.data ??
      []) as PaperRow[]

  const metadataRows =
    (metadataResult.data ??
      []) as PublicMetadataRow[]

  const authorRows =
    (authorsResult.data ??
      []) as PaperAuthorRow[]

  const linkRows =
    (linksResult.data ??
      []) as PaperLinkRow[]

  const metadataByPaper =
    new Map(
      metadataRows.map(
        (metadata) => [
          metadata.paper_id,
          metadata,
        ]
      )
    )

  const authorsByPaper =
    new Map<string, string[]>()

  for (const row of authorRows) {
    const name =
      normalizeAuthorName(row)

    if (!name) {
      continue
    }

    const current =
      authorsByPaper.get(
        row.paper_id
      ) ?? []

    current.push(name)

    authorsByPaper.set(
      row.paper_id,
      current
    )
  }

  const linksByPaper =
    new Map<
      string,
      PaperLinkRow[]
    >()

  for (const link of linkRows) {
    const current =
      linksByPaper.get(
        link.paper_id
      ) ?? []

    current.push(link)

    linksByPaper.set(
      link.paper_id,
      current
    )
  }

  const papersWithMetadata =
    papers
      .map((paper) => ({
        paper,
        metadata:
          metadataByPaper.get(
            paper.id
          ) ?? {
            paper_id: paper.id,
            visibility:
              'private' as const,
            slug: null,
            featured: false,
            publication_index:
              null,
          },
      }))
      .sort(
        compareByPublicationDate
      )

  const counts =
    Object.fromEntries(
      visibilityOrder.map(
        (visibility) => [
          visibility,
          papersWithMetadata.filter(
            (item) =>
              item.metadata
                .visibility ===
              visibility
          ).length,
        ]
      )
    ) as Record<
      PublicVisibility,
      number
    >

  return (
    <div>
      <PageHeader
        title="Website"
        description="Curate the papers and aggregate work analytics intended for the future public academic website."
      />

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Public paper settings saved.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {visibilityOrder.map(
          (visibility) => (
            <Card
              key={visibility}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${visibilityClass(
                    visibility
                  )}`}
                >
                  {
                    visibilityLabels[
                      visibility
                    ]
                  }
                </span>

                <span className="font-serif text-2xl font-semibold text-oxford-blue">
                  {counts[visibility]}
                </span>
              </div>

              <p className="mt-3 text-sm text-oxford-ash">
                {visibility ===
                'public'
                  ? 'Included in the future public website listing and retrievable by its stable slug.'
                  : 'Unavailable to anonymous clients and excluded from the future public website.'}
              </p>
            </Card>
          )
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Publication contract
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Website visibility is
            independent of internal
            workflow status. Public
            papers reuse the canonical
            title, authors, abstract,
            current venue, publication
            date and approved research
            links from the normal paper
            workspace.
          </p>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Public publication lists
            are ordered by publication
            date, newest first. Papers
            without a publication date
            follow dated publications.
          </p>
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Public work analytics
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            The future website can
            reproduce the Dashboard
            Activity over time heatmap
            from daily net working
            minutes and display yearly
            average net working time
            per working day together
            with coffees per working
            day.
          </p>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Raw sessions, activities,
            locations, linked papers,
            break records and daily
            coffee counts remain
            private.
          </p>
        </Card>
      </div>

      <div className="mt-8 space-y-10">
        {visibilityOrder.map(
          (visibility) => {
            const items =
              papersWithMetadata.filter(
                (item) =>
                  item.metadata
                    .visibility ===
                  visibility
              )

            if (
              items.length === 0
            ) {
              return null
            }

            return (
              <section
                key={visibility}
              >
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
                    {
                      visibilityLabels[
                        visibility
                      ]
                    }
                  </h2>

                  <span className="text-sm text-oxford-ash">
                    {items.length}{' '}
                    {items.length ===
                    1
                      ? 'paper'
                      : 'papers'}
                  </span>
                </div>

                <div className="space-y-5">
                  {items.map(
                    ({
                      paper,
                      metadata,
                    }) => {
                      const authors =
                        authorsByPaper.get(
                          paper.id
                        ) ?? []

                      const links =
                        linksByPaper.get(
                          paper.id
                        ) ?? []

                      const preview =
                        metadata.visibility ===
                        'public'
                          ? {
                              slug:
                                metadata.slug,
                              title:
                                paper.title,
                              authors,
                              abstract:
                                paper.abstract,
                              venue:
                                paper.current_venue,
                              publication_date:
                                paper.published_on,
                              doi_url:
                                getLink(
                                  links,
                                  'doi'
                                ),
                              publication_url:
                                getLink(
                                  links,
                                  'publication'
                                ),
                              preprint_url:
                                getLink(
                                  links,
                                  'preprint'
                                ),
                              github_url:
                                getLink(
                                  links,
                                  'github'
                                ),
                              dataset_url:
                                getLink(
                                  links,
                                  'dataverse'
                                ),
                              featured:
                                metadata.featured,
                              publication_index:
                                metadata.publication_index,
                            }
                          : null

                      return (
                        <Card
                          key={
                            paper.id
                          }
                          className={
                            saved ===
                            paper.id
                              ? 'ring-2 ring-green-200'
                              : ''
                          }
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-serif text-xl font-semibold text-oxford-blue">
                                  {
                                    paper.short_title
                                  }
                                </h3>

                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${visibilityClass(
                                    metadata.visibility
                                  )}`}
                                >
                                  {
                                    visibilityLabels[
                                      metadata
                                        .visibility
                                    ]
                                  }
                                </span>

                                {metadata.featured && (
                                  <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
                                    Featured
                                  </span>
                                )}

                                {paper.archived_at && (
                                  <span className="inline-flex rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                    Archived
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 max-w-3xl text-sm leading-6 text-oxford-charcoal">
                                {
                                  paper.title
                                }
                              </p>

                              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-oxford-ash">
                                <span>
                                  Internal
                                  status:{' '}
                                  {
                                    paper.status
                                  }
                                </span>

                                <span>
                                  Publication
                                  date:{' '}
                                  {
                                    paper.published_on ??
                                    '—'
                                  }
                                </span>

                                <span>
                                  Current
                                  venue:{' '}
                                  {
                                    paper.current_venue ??
                                    '—'
                                  }
                                </span>
                              </div>
                            </div>

                            <ButtonLink
                              href={`/papers/${paper.id}`}
                              variant="secondary"
                            >
                              Paper
                              workspace
                            </ButtonLink>
                          </div>

                          <form
                            action={
                              updatePublicPaperMetadata
                            }
                            className="mt-6"
                          >
                            <input
                              type="hidden"
                              name="paper_id"
                              value={
                                paper.id
                              }
                            />

                            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <label
                                  htmlFor={`visibility-${paper.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  Visibility
                                </label>

                                <select
                                  id={`visibility-${paper.id}`}
                                  name="visibility"
                                  defaultValue={
                                    metadata.visibility
                                  }
                                  className={
                                    inputClass
                                  }
                                >
                                  <option value="private">
                                    Private
                                  </option>
                                  <option value="public">
                                    Public
                                  </option>
                                </select>
                              </div>

                              <div className="xl:col-span-2">
                                <label
                                  htmlFor={`slug-${paper.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  Public
                                  slug
                                </label>

                                <input
                                  id={`slug-${paper.id}`}
                                  name="slug"
                                  type="text"
                                  defaultValue={
                                    metadata.slug ??
                                    ''
                                  }
                                  placeholder="stable-paper-slug"
                                  className={
                                    inputClass
                                  }
                                />

                                <p className="mt-1 text-xs text-oxford-ash">
                                  Required
                                  when Public.
                                  Lowercase
                                  letters,
                                  numbers and
                                  hyphens.
                                </p>
                              </div>

                              <div className="flex items-start pt-7">
                                <label className="inline-flex items-center gap-2 text-sm font-medium text-oxford-charcoal">
                                  <input
                                    name="featured"
                                    type="checkbox"
                                    defaultChecked={
                                      metadata.featured
                                    }
                                    className="h-4 w-4 rounded border-oxford-stone"
                                  />
                                  Featured
                                </label>
                              </div>

                              <div className="md:col-span-2 xl:col-span-4">
                                <label
                                  htmlFor={`publication-index-${paper.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  Publication
                                  index
                                </label>

                                <input
                                  id={`publication-index-${paper.id}`}
                                  name="publication_index"
                                  type="text"
                                  defaultValue={
                                    metadata.publication_index ??
                                    ''
                                  }
                                  placeholder="Optional public-facing index or classification"
                                  className={
                                    inputClass
                                  }
                                />
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center gap-3">
                              <Button
                                type="submit"
                              >
                                Save
                                public
                                settings
                              </Button>

                              {metadata.slug && (
                                <span className="text-xs text-oxford-ash">
                                  Stable
                                  slug:{' '}
                                  <code>
                                    {
                                      metadata.slug
                                    }
                                  </code>
                                </span>
                              )}
                            </div>
                          </form>

                          <div className="mt-6 border-t border-oxford-stone pt-5">
                            <h4 className="font-serif text-lg font-semibold text-oxford-blue">
                              Public
                              contract
                              preview
                            </h4>

                            {preview ? (
                              <>
                                <p className="mt-2 text-xs leading-5 text-oxford-ash">
                                  This is the
                                  paper record
                                  available to
                                  the future
                                  public
                                  website.
                                  Canonical
                                  paper fields
                                  update from
                                  the Paper
                                  workspace.
                                </p>

                                <pre className="mt-3 overflow-x-auto rounded-md border border-oxford-stone bg-oxford-shell p-4 text-xs leading-5 text-oxford-charcoal">
                                  {JSON.stringify(
                                    preview,
                                    null,
                                    2
                                  )}
                                </pre>
                              </>
                            ) : (
                              <p className="mt-2 text-sm text-oxford-ash">
                                No
                                anonymous
                                paper data is
                                exposed while
                                this record is
                                Private.
                              </p>
                            )}
                          </div>
                        </Card>
                      )
                    }
                  )}
                </div>
              </section>
            )
          }
        )}
      </div>

      <div className="mt-8 text-sm text-oxford-ash">
        <Link
          href="/papers"
          className="font-medium text-oxford-blue hover:underline"
        >
          Return to Papers
        </Link>
      </div>
    </div>
  )
}
