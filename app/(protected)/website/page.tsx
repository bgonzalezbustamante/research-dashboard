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
  | 'unlisted'
  | 'private'

type PaperRow = {
  id: string
  short_title: string
  title: string
  abstract: string | null
  status: string
  published_on: string | null
  archived_at: string | null
}

type PublicMetadataRow = {
  paper_id: string
  visibility: PublicVisibility
  slug: string | null
  featured: boolean
  public_category: string | null
  public_summary: string | null
  public_venue: string | null
  display_order: number | null
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
  'unlisted',
  'private',
]

const visibilityLabels: Record<
  PublicVisibility,
  string
> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
}

function visibilityClass(
  visibility: PublicVisibility
) {
  switch (visibility) {
    case 'public':
      return 'border-green-200 bg-green-50 text-green-800'
    case 'unlisted':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    default:
      return 'border-gray-300 bg-gray-100 text-gray-700'
  }
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
        published_on,
        archived_at
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .order('short_title', {
        ascending: true,
      }),

    supabase
      .from(
        'paper_public_metadata'
      )
      .select(`
        paper_id,
        visibility,
        slug,
        featured,
        public_category,
        public_summary,
        public_venue,
        display_order
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
    papers.map((paper) => {
      const metadata =
        metadataByPaper.get(
          paper.id
        ) ?? {
          paper_id: paper.id,
          visibility:
            'private' as const,
          slug: null,
          featured: false,
          public_category: null,
          public_summary: null,
          public_venue: null,
          display_order: null,
        }

      return {
        paper,
        metadata,
      }
    })

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
        description="Curate the research content that may be exposed to the future public academic website."
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

      <div className="grid gap-4 md:grid-cols-3">
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
                  ? 'Included in the anonymous public listing and retrievable by slug.'
                  : visibility ===
                      'unlisted'
                    ? 'Retrievable by a known slug but excluded from the anonymous listing.'
                    : 'Unavailable through the anonymous public data contract.'}
              </p>
            </Card>
          )
        )}
      </div>

      <Card className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Public data boundary
        </h2>

        <p className="mt-2 text-sm leading-6 text-oxford-ash">
          Website visibility is
          independent of the
          paper&apos;s internal
          workflow status. The normal
          paper workspace remains the
          canonical editor for title,
          authors, abstract, dates,
          and research links. This
          area controls only the
          public presentation layer.
        </p>

        <p className="mt-2 text-sm leading-6 text-oxford-ash">
          Anonymous clients can call
          only the curated public
          paper RPCs. Hours, planning,
          milestones, notes, history,
          permissions, invitations,
          audit records, profiles,
          author emails, and other
          private fields are not part
          of that contract.
        </p>
      </Card>

      <div className="mt-8 space-y-10">
        {visibilityOrder.map(
          (visibility) => {
            const items =
              papersWithMetadata
                .filter(
                  (item) =>
                    item.metadata
                      .visibility ===
                    visibility
                )
                .sort((a, b) => {
                  const aOrder =
                    a.metadata
                      .display_order

                  const bOrder =
                    b.metadata
                      .display_order

                  if (
                    aOrder !== null ||
                    bOrder !== null
                  ) {
                    if (
                      aOrder === null
                    ) {
                      return 1
                    }

                    if (
                      bOrder === null
                    ) {
                      return -1
                    }

                    if (
                      aOrder !==
                      bOrder
                    ) {
                      return (
                        aOrder -
                        bOrder
                      )
                    }
                  }

                  return a.paper
                    .short_title
                    .localeCompare(
                      b.paper
                        .short_title
                    )
                })

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
                        'private'
                          ? null
                          : {
                              slug:
                                metadata.slug,
                              visibility:
                                metadata.visibility,
                              title:
                                paper.title,
                              authors,
                              abstract:
                                paper.abstract,
                              summary:
                                metadata.public_summary,
                              venue:
                                metadata.public_venue,
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
                              category:
                                metadata.public_category,
                              display_order:
                                metadata.display_order,
                            }

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

                              <p className="mt-1 text-xs text-oxford-ash">
                                Internal
                                status:{' '}
                                {
                                  paper.status
                                }
                              </p>
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
                                  <option value="unlisted">
                                    Unlisted
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
                                  for Public
                                  or
                                  Unlisted.
                                  Lowercase
                                  letters,
                                  numbers
                                  and
                                  hyphens.
                                </p>
                              </div>

                              <div>
                                <label
                                  htmlFor={`display-order-${paper.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  Display
                                  order
                                </label>

                                <input
                                  id={`display-order-${paper.id}`}
                                  name="display_order"
                                  type="number"
                                  min="0"
                                  defaultValue={
                                    metadata.display_order ??
                                    ''
                                  }
                                  className={
                                    inputClass
                                  }
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`category-${paper.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  Public
                                  category
                                </label>

                                <input
                                  id={`category-${paper.id}`}
                                  name="public_category"
                                  type="text"
                                  defaultValue={
                                    metadata.public_category ??
                                    ''
                                  }
                                  className={
                                    inputClass
                                  }
                                />
                              </div>

                              <div className="md:col-span-1 xl:col-span-2">
                                <label
                                  htmlFor={`venue-${paper.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  Public
                                  venue
                                </label>

                                <input
                                  id={`venue-${paper.id}`}
                                  name="public_venue"
                                  type="text"
                                  defaultValue={
                                    metadata.public_venue ??
                                    ''
                                  }
                                  className={
                                    inputClass
                                  }
                                />

                                <p className="mt-1 text-xs text-oxford-ash">
                                  Separate
                                  from the
                                  internal
                                  current or
                                  target
                                  venue.
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
                                  htmlFor={`summary-${paper.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  Public
                                  summary
                                </label>

                                <textarea
                                  id={`summary-${paper.id}`}
                                  name="public_summary"
                                  rows={4}
                                  defaultValue={
                                    metadata.public_summary ??
                                    ''
                                  }
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
                                  {metadata.visibility ===
                                  'public'
                                    ? 'This record is returned by the public listing and by slug lookup.'
                                    : 'This record is excluded from the public listing but returned by a known slug lookup.'}
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
                                paper data
                                is exposed
                                while this
                                record is
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
