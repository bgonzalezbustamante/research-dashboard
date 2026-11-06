import PageHeader from '@/components/page-header'
import ApproveExternalPublicationForm from '@/components/papers/approve-external-publication-form'
import ExternalPublicationForm from '@/components/papers/external-publication-form'
import PapersTabs from '@/components/papers/papers-tabs'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { requireDashboardAccess } from '@/lib/auth/dashboard-access'
import {
  suggestExternalPublicationSlug,
  type ExternalPublicationCollectionRow,
  type ExternalPublicationRow,
} from '@/lib/papers/external-publications'
import { createClient } from '@/lib/supabase/server'

import {
  approveExternalPublication,
  createExternalPublication,
  createExternalPublicationCollection,
  deleteExternalPublication,
  deleteExternalPublicationCollection,
  updateExternalPublication,
  updateExternalPublicationCollection,
} from './actions'

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

type OtherPapersPageProps = {
  searchParams: Promise<{
    error?: string
    created?: string
    saved?: string
    deleted?: string
    approved?: string
    collection?: 'created' | 'saved' | 'deleted'
  }>
}

type ProjectOption = {
  id: string
  short_title: string
  title: string
}

type ProjectLinkRow = {
  project_id: string
  external_publication_id: string
}

type CollectionItemRow = {
  collection_id: string
  external_publication_id: string
}

export default async function OtherPapersPage({
  searchParams,
}: OtherPapersPageProps) {
  const access =
    await requireDashboardAccess()

  const params =
    await searchParams

  const supabase =
    await createClient()

  const [
    publicationsResult,
    projectsResult,
    linksResult,
    collectionsResult,
    collectionItemsResult,
  ] = await Promise.all([
    supabase
      .from('external_publications')
      .select(
        'id, title, authors, venue, publication_year, published_on, doi_url, publication_url, language, visibility, slug, created_by'
      )
      .eq('owner_id', access.ownerId)
      .order('publication_year', {
        ascending: false,
      })
      .order('title', {
        ascending: true,
      }),

    supabase
      .from('projects')
      .select('id, short_title, title')
      .eq('owner_id', access.ownerId)
      .order('short_title', {
        ascending: true,
      }),

    supabase
      .from('project_external_publications')
      .select(
        'project_id, external_publication_id'
      ),

    supabase
      .from(
        'external_publication_collections'
      )
      .select(
        'id, slug, name, description'
      )
      .eq('owner_id', access.ownerId)
      .order('name', {
        ascending: true,
      }),

    supabase
      .from(
        'external_publication_collection_items'
      )
      .select(
        'collection_id, external_publication_id'
      ),
  ])

  if (publicationsResult.error) {
    throw new Error(
      `Could not load external publications: ${publicationsResult.error.message}`
    )
  }

  if (projectsResult.error) {
    throw new Error(
      `Could not load projects: ${projectsResult.error.message}`
    )
  }

  if (linksResult.error) {
    throw new Error(
      `Could not load project links: ${linksResult.error.message}`
    )
  }

  if (collectionsResult.error) {
    throw new Error(
      `Could not load collections: ${collectionsResult.error.message}`
    )
  }

  if (collectionItemsResult.error) {
    throw new Error(
      `Could not load collection items: ${collectionItemsResult.error.message}`
    )
  }

  const collections =
    (collectionsResult.data ??
      []) as ExternalPublicationCollectionRow[]

  const collectionById =
    new Map(
      collections.map(
        (collection) => [
          collection.id,
          collection,
        ] as const
      )
    )

  const collectionIdsByPublication =
    new Map<string, string[]>()

  for (const item of (collectionItemsResult.data ??
    []) as CollectionItemRow[]) {
    const existing =
      collectionIdsByPublication.get(
        item.external_publication_id
      ) ?? []

    existing.push(item.collection_id)

    collectionIdsByPublication.set(
      item.external_publication_id,
      existing
    )
  }

  const isAwaitingReview = (
    publication: ExternalPublicationRow
  ) =>
    publication.visibility ===
      'private' &&
    Boolean(
      publication.created_by
    ) &&
    publication.created_by !==
      access.ownerId

  // Editor submissions awaiting review come first; order is otherwise kept.
  const publications =
    [
      ...((publicationsResult.data ??
        []) as ExternalPublicationRow[]),
    ].sort(
      (left, right) =>
        Number(
          isAwaitingReview(right)
        ) -
        Number(
          isAwaitingReview(left)
        )
    )

  const contributorIds = [
    ...new Set(
      publications
        .map(
          (publication) =>
            publication.created_by
        )
        .filter(
          (id): id is string =>
            Boolean(id) &&
            id !== access.ownerId
        )
    ),
  ]

  const contributorsResult =
    contributorIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', contributorIds)
      : {
          data: [],
          error: null,
        }

  if (contributorsResult.error) {
    throw new Error(
      `Could not load contributors: ${contributorsResult.error.message}`
    )
  }

  const contributorNameById =
    new Map(
      (
        (contributorsResult.data ??
          []) as {
          id: string
          full_name: string | null
          email: string | null
        }[]
      ).map(
        (profile) => [
          profile.id,
          profile.full_name?.trim() ||
            profile.email?.trim() ||
            'Former Website Editor',
        ] as const
      )
    )

  const projects =
    (projectsResult.data ?? []) as ProjectOption[]

  const projectById =
    new Map(
      projects.map(
        (project) => [
          project.id,
          project,
        ] as const
      )
    )

  const projectIdsByPublication =
    new Map<string, string[]>()

  for (const link of (linksResult.data ?? []) as ProjectLinkRow[]) {
    const existing =
      projectIdsByPublication.get(
        link.external_publication_id
      ) ?? []

    existing.push(link.project_id)

    projectIdsByPublication.set(
      link.external_publication_id,
      existing
    )
  }

  const notice =
    params.approved
      ? 'External publication approved and published.'
      : params.created
      ? 'External publication created.'
      : params.saved
        ? 'External publication saved.'
        : params.deleted
          ? 'External publication deleted.'
          : params.collection
            ? `Collection ${params.collection}.`
            : null

  return (
    <div>
      <PageHeader
        title="Papers"
        description="Other people's papers: a curated library of publications by other authors for the Academic Website and related sites. They never appear among your own papers, Planning or analytics. Public ones need a stable slug and are listed by the Academic API, where sites filter them by collection and, optionally, by related project."
        wide
      />

      <PapersTabs active="/papers/others" />

      {params.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {params.error}
        </div>
      )}

      {notice && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      {access.canEdit && (
        <Card className="mb-8">
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Add external publication
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            New external publications
            are Private until you make
            them Public.
          </p>

          <ExternalPublicationForm
            action={
              createExternalPublication
            }
            projects={projects}
            collections={collections}
            submitLabel="Add external publication"
          />
        </Card>
      )}

      {publications.length === 0 ? (
        <Card>
          <p className="text-sm text-oxford-ash">
            No external publications
            yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {publications.map(
            (publication) => {
              const linkedProjectIds =
                projectIdsByPublication.get(
                  publication.id
                ) ?? []

              return (
                <Card
                  key={publication.id}
                >
                  <div
                    id={`external-publication-${publication.id}`}
                    className="flex scroll-mt-6 flex-wrap items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <h2 className="font-serif text-lg font-semibold text-oxford-blue">
                        {publication.title}
                      </h2>

                      <p className="mt-1 text-sm text-oxford-ash">
                        {publication.authors.join(
                          ', '
                        )}{' '}
                        ·{' '}
                        {publication.publication_year}
                        {publication.venue
                          ? ` · ${publication.venue}`
                          : ''}
                      </p>

                      {publication.created_by &&
                        publication.created_by !==
                          access.ownerId && (
                          <p className="mt-2 text-xs text-oxford-ash">
                            Added by{' '}
                            {contributorNameById.get(
                              publication.created_by
                            ) ??
                              'Former Website Editor'}
                          </p>
                        )}

                      <p className="mt-2 text-xs text-oxford-ash">
                        Slug:{' '}
                        {publication.slug ? (
                          <code>
                            {publication.slug}
                          </code>
                        ) : (
                          'none'
                        )}
                        {' · '}Collections:{' '}
                        {(
                          collectionIdsByPublication.get(
                            publication.id
                          ) ?? []
                        )
                          .map(
                            (id) =>
                              collectionById.get(
                                id
                              )?.name ??
                              'Unknown collection'
                          )
                          .join(', ') ||
                          'none'}
                      </p>

                      <p className="mt-2 text-xs text-oxford-ash">
                        Related projects:{' '}
                        {linkedProjectIds.length >
                        0
                          ? linkedProjectIds
                              .map(
                                (id) =>
                                  projectById.get(
                                    id
                                  )
                                    ?.short_title ??
                                  'Unknown project'
                              )
                              .join(', ')
                          : 'none'}
                      </p>
                    </div>

                    <span
                      className={
                        publication.visibility ===
                        'public'
                          ? 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                          : isAwaitingReview(
                                publication
                              )
                            ? 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900'
                            : 'rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700'
                      }
                    >
                      {publication.visibility ===
                      'public'
                        ? 'Public'
                        : isAwaitingReview(
                              publication
                            )
                          ? 'Awaiting review'
                          : 'Private'}
                    </span>
                  </div>

                  {access.canEdit &&
                    isAwaitingReview(
                      publication
                    ) && (
                      <ApproveExternalPublicationForm
                        action={
                          approveExternalPublication
                        }
                        publicationId={
                          publication.id
                        }
                        suggestedSlug={suggestExternalPublicationSlug(
                          publication.title,
                          publication.publication_year
                        )}
                        collections={
                          collections
                        }
                        projects={projects}
                      />
                    )}

                  {access.canEdit && (
                    <details className="mt-5 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                      <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                        Edit external
                        publication
                      </summary>

                      <ExternalPublicationForm
                        action={
                          updateExternalPublication
                        }
                        projects={projects}
                        publication={
                          publication
                        }
                        linkedProjectIds={
                          linkedProjectIds
                        }
                        collections={
                          collections
                        }
                        linkedCollectionIds={
                          collectionIdsByPublication.get(
                            publication.id
                          ) ?? []
                        }
                        submitLabel="Save external publication"
                      />

                      <form
                        action={
                          deleteExternalPublication
                        }
                        className="mt-5 border-t border-oxford-stone pt-4"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={
                            publication.id
                          }
                        />

                        <Button
                          type="submit"
                          variant="secondary"
                        >
                          Delete external
                          publication
                        </Button>
                      </form>
                    </details>
                  )}
                </Card>
              )
            }
          )}
        </div>
      )}

      {access.canEdit && (
        <section className="mt-10 border-t border-oxford-stone pt-8">
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Collections
          </h2>

          <p className="mt-1 text-sm leading-6 text-oxford-ash">
            Group external publications
            for the sites that use the
            Academic API. Sites filter
            the external publications
            feed by collection slug;
            names and descriptions stay
            private.
          </p>

          <Card className="mt-5">
            <h3 className="font-serif text-lg font-semibold text-oxford-blue">
              Add collection
            </h3>

            <form
              action={
                createExternalPublicationCollection
              }
              className="mt-4 grid gap-4 md:grid-cols-2"
            >
              <div>
                <label
                  htmlFor="new-collection-name"
                  className={labelClass}
                >
                  Name
                </label>

                <input
                  id="new-collection-name"
                  name="name"
                  type="text"
                  required
                  maxLength={200}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-collection-slug"
                  className={labelClass}
                >
                  Slug
                </label>

                <input
                  id="new-collection-slug"
                  name="slug"
                  type="text"
                  required
                  maxLength={100}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="lab-website"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-collection-description"
                  className={labelClass}
                >
                  Description (private)
                </label>

                <input
                  id="new-collection-description"
                  name="description"
                  type="text"
                  maxLength={1000}
                  className={inputClass}
                />
              </div>

              <div>
                <Button type="submit">
                  Add collection
                </Button>
              </div>
            </form>
          </Card>

          {collections.length > 0 && (
            <div className="mt-5 space-y-4">
              {collections.map(
                (collection) => (
                  <Card
                    key={collection.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-oxford-charcoal">
                          {collection.name}
                        </h3>

                        <p className="mt-1 text-xs text-oxford-ash">
                          <code>
                            {collection.slug}
                          </code>
                          {collection.description
                            ? ` · ${collection.description}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <details className="mt-4 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                      <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                        Edit collection
                      </summary>

                      <form
                        action={
                          updateExternalPublicationCollection
                        }
                        className="mt-4 grid gap-4 md:grid-cols-2"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={
                            collection.id
                          }
                        />

                        <div>
                          <label
                            htmlFor={`${collection.id}-name`}
                            className={labelClass}
                          >
                            Name
                          </label>

                          <input
                            id={`${collection.id}-name`}
                            name="name"
                            type="text"
                            required
                            maxLength={200}
                            defaultValue={
                              collection.name
                            }
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`${collection.id}-slug`}
                            className={labelClass}
                          >
                            Slug
                          </label>

                          <input
                            id={`${collection.id}-slug`}
                            name="slug"
                            type="text"
                            required
                            maxLength={100}
                            autoCapitalize="none"
                            spellCheck={false}
                            defaultValue={
                              collection.slug
                            }
                            className={inputClass}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label
                            htmlFor={`${collection.id}-description`}
                            className={labelClass}
                          >
                            Description (private)
                          </label>

                          <input
                            id={`${collection.id}-description`}
                            name="description"
                            type="text"
                            maxLength={1000}
                            defaultValue={
                              collection.description ??
                              ''
                            }
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <Button type="submit">
                            Save collection
                          </Button>
                        </div>
                      </form>

                      <form
                        action={
                          deleteExternalPublicationCollection
                        }
                        className="mt-5 border-t border-oxford-stone pt-4"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={
                            collection.id
                          }
                        />

                        <Button
                          type="submit"
                          variant="secondary"
                        >
                          Delete collection
                        </Button>

                        <p className="mt-2 text-xs text-oxford-ash">
                          Publications stay in
                          the library; only
                          their membership in
                          this collection is
                          removed.
                        </p>
                      </form>
                    </details>
                  </Card>
                )
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
