import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import {
  createSoftware,
  deleteSoftware,
  updateSoftware,
} from './actions'

type SoftwarePageProps = {
  searchParams: Promise<{
    error?: string
    created?: string
    saved?: string
    deleted?: string
    page?: string
  }>
}

type SoftwareStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'

type RepositoryVisibility =
  | 'public'
  | 'private'

type PublicVisibility =
  | 'public'
  | 'private'

type SoftwareRow = {
  id: string
  owner_id: string
  name: string
  short_description: string
  category: string
  current_version: string | null
  development_stage: string
  status: SoftwareStatus
  repository_visibility:
    RepositoryVisibility
  repository_url: string | null
  production_url: string | null
  documentation_url: string | null
  start_year: number | null
  end_year: number | null
  created_at: string
  updated_at: string
}

type SoftwareMetadataRow = {
  software_id: string
  visibility: PublicVisibility
  slug: string
  featured: boolean
}

const SOFTWARE_PER_PAGE = 10

const categories = [
  'Application',
  'Website',
  'Utility',
  'Reusable component',
  'Package/library',
  'API/service',
  'Data product',
  'Template',
  'Other',
] as const

const developmentStages = [
  'Alpha',
  'Beta',
  'Release candidate',
  'Stable',
  'Maintenance',
] as const

const statusOptions = [
  ['active', 'Active'],
  ['paused', 'Paused'],
  ['completed', 'Completed'],
  ['archived', 'Archived'],
] as const

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function statusClass(
  status: SoftwareStatus
) {
  switch (status) {
    case 'active':
      return 'border-green-200 bg-green-50 text-green-800'
    case 'paused':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    case 'completed':
      return 'border-sky-200 bg-sky-50 text-sky-900'
    case 'archived':
      return 'border-gray-300 bg-gray-100 text-gray-700'
  }
}

function statusLabel(
  status: SoftwareStatus
) {
  return (
    statusOptions.find(
      ([value]) =>
        value === status
    )?.[1] ?? status
  )
}

function exposureClass(
  visibility: PublicVisibility
) {
  return visibility === 'public'
    ? 'border-sky-200 bg-sky-50 text-sky-900'
    : 'border-gray-300 bg-gray-100 text-gray-700'
}

function repositoryClass(
  visibility:
    RepositoryVisibility
) {
  return visibility === 'public'
    ? 'border-green-200 bg-green-50 text-green-800'
    : 'border-violet-200 bg-violet-50 text-violet-800'
}

function SoftwareFields({
  prefix,
  item,
  metadata,
}: {
  prefix: string
  item?: SoftwareRow
  metadata?: SoftwareMetadataRow
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label
          htmlFor={prefix + '-name'}
          className={labelClass}
        >
          Name
        </label>

        <input
          id={prefix + '-name'}
          name="name"
          required
          maxLength={200}
          defaultValue={
            item?.name ?? ''
          }
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={prefix + '-slug'}
          className={labelClass}
        >
          Slug
        </label>

        <input
          id={prefix + '-slug'}
          name="slug"
          required
          maxLength={120}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="research-dashboard"
          defaultValue={
            metadata?.slug ?? ''
          }
          className={inputClass}
        />

        <p className="mt-1 text-xs text-oxford-ash">
          Required even when the
          public profile is disabled.
        </p>
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor={
            prefix +
            '-short-description'
          }
          className={labelClass}
        >
          Short description
        </label>

        <textarea
          id={
            prefix +
            '-short-description'
          }
          name="short_description"
          rows={3}
          required
          maxLength={500}
          defaultValue={
            item?.short_description ??
            ''
          }
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={prefix + '-category'}
          className={labelClass}
        >
          Category/type
        </label>

        <select
          id={prefix + '-category'}
          name="category"
          defaultValue={
            item?.category ??
            'Application'
          }
          className={inputClass}
        >
          {categories.map(
            (category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            )
          )}
        </select>
      </div>

      <div>
        <label
          htmlFor={
            prefix +
            '-current-version'
          }
          className={labelClass}
        >
          Current version
        </label>

        <input
          id={
            prefix +
            '-current-version'
          }
          name="current_version"
          maxLength={100}
          placeholder="v1.0.0-rc.2"
          defaultValue={
            item?.current_version ??
            ''
          }
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={
            prefix +
            '-development-stage'
          }
          className={labelClass}
        >
          Development stage
        </label>

        <select
          id={
            prefix +
            '-development-stage'
          }
          name="development_stage"
          defaultValue={
            item
              ?.development_stage ??
            'Alpha'
          }
          className={inputClass}
        >
          {developmentStages.map(
            (stage) => (
              <option
                key={stage}
                value={stage}
              >
                {stage}
              </option>
            )
          )}
        </select>
      </div>

      <div>
        <label
          htmlFor={prefix + '-status'}
          className={labelClass}
        >
          Status
        </label>

        <select
          id={prefix + '-status'}
          name="status"
          defaultValue={
            item?.status ??
            'active'
          }
          className={inputClass}
        >
          {statusOptions.map(
            ([
              value,
              label,
            ]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            )
          )}
        </select>
      </div>

      <div>
        <label
          htmlFor={
            prefix +
            '-repository-visibility'
          }
          className={labelClass}
        >
          Repository visibility
        </label>

        <select
          id={
            prefix +
            '-repository-visibility'
          }
          name="repository_visibility"
          defaultValue={
            item
              ?.repository_visibility ??
            'private'
          }
          className={inputClass}
        >
          <option value="private">
            Private
          </option>
          <option value="public">
            Public
          </option>
        </select>
      </div>

      <div>
        <label
          htmlFor={
            prefix +
            '-public-visibility'
          }
          className={labelClass}
        >
          Public exposure
        </label>

        <select
          id={
            prefix +
            '-public-visibility'
          }
          name="public_visibility"
          defaultValue={
            metadata?.visibility ??
            'private'
          }
          className={inputClass}
        >
          <option value="private">
            Private
          </option>
          <option value="public">
            Public
          </option>
        </select>

        <p className="mt-1 text-xs text-oxford-ash">
          Independent from repository
          visibility.
        </p>
      </div>

      <div>
        <label
          htmlFor={
            prefix +
            '-start-year'
          }
          className={labelClass}
        >
          Start year
        </label>

        <input
          id={
            prefix +
            '-start-year'
          }
          name="start_year"
          type="number"
          min={1000}
          max={9999}
          placeholder="2026"
          defaultValue={
            item?.start_year ?? ''
          }
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={
            prefix +
            '-end-year'
          }
          className={labelClass}
        >
          End year
        </label>

        <input
          id={
            prefix +
            '-end-year'
          }
          name="end_year"
          type="number"
          min={1000}
          max={9999}
          placeholder="Leave blank if ongoing"
          defaultValue={
            item?.end_year ?? ''
          }
          className={inputClass}
        />

        <p className="mt-1 text-xs text-oxford-ash">
          Optional. Use when
          development or maintenance
          has definitively ended.
        </p>
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor={
            prefix +
            '-repository-url'
          }
          className={labelClass}
        >
          Repository URL
        </label>

        <input
          id={
            prefix +
            '-repository-url'
          }
          name="repository_url"
          type="url"
          placeholder="https://github.com/..."
          defaultValue={
            item?.repository_url ??
            ''
          }
          className={inputClass}
        />

        <p className="mt-1 text-xs text-oxford-ash">
          Stored privately for all
          items. Public RPCs expose it
          only when repository
          visibility is Public.
        </p>
      </div>

      <div>
        <label
          htmlFor={
            prefix +
            '-production-url'
          }
          className={labelClass}
        >
          Production/demo URL
        </label>

        <input
          id={
            prefix +
            '-production-url'
          }
          name="production_url"
          type="url"
          placeholder="https://..."
          defaultValue={
            item?.production_url ??
            ''
          }
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={
            prefix +
            '-documentation-url'
          }
          className={labelClass}
        >
          Documentation URL
        </label>

        <input
          id={
            prefix +
            '-documentation-url'
          }
          name="documentation_url"
          type="url"
          placeholder="https://..."
          defaultValue={
            item
              ?.documentation_url ??
            ''
          }
          className={inputClass}
        />
      </div>

      <label className="md:col-span-2 flex items-center gap-2 text-sm text-oxford-charcoal">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={
            metadata?.featured ??
            false
          }
        />
        Featured software
      </label>
    </div>
  )
}

export default async function SoftwarePage({
  searchParams,
}: SoftwarePageProps) {
  await requireDashboardOwner()

  const params =
    await searchParams

  const requestedPage =
    Number.parseInt(
      params.page ?? '1',
      10
    )

  const supabase =
    await createClient()

  const [
    itemsResult,
    metadataResult,
  ] = await Promise.all([
    supabase
      .from('software_items')
      .select(
        'id, owner_id, name, short_description, category, current_version, development_stage, status, repository_visibility, repository_url, production_url, documentation_url, start_year, end_year, created_at, updated_at'
      ),

    supabase
      .from(
        'software_public_metadata'
      )
      .select(
        'software_id, visibility, slug, featured'
      ),
  ])

  for (const [
    label,
    result,
  ] of [
    [
      'Software items',
      itemsResult,
    ],
    [
      'Software public metadata',
      metadataResult,
    ],
  ] as const) {
    if (result.error) {
      throw new Error(
        `${label} could not be loaded: ${result.error.message}`
      )
    }
  }

  const items =
    (itemsResult.data ??
      []) as SoftwareRow[]

  const metadata =
    (metadataResult.data ??
      []) as SoftwareMetadataRow[]

  const metadataBySoftware =
    new Map(
      metadata.map(
        (row) => [
          row.software_id,
          row,
        ]
      )
    )

  const statusPriority =
    new Map([
      ['active', 0],
      ['paused', 1],
      ['completed', 2],
      ['archived', 3],
    ])

  const sortedItems = [
    ...items,
  ].sort((a, b) => {
    const statusDiff =
      (
        statusPriority.get(
          a.status
        ) ?? 99
      ) -
      (
        statusPriority.get(
          b.status
        ) ?? 99
      )

    if (statusDiff !== 0) {
      return statusDiff
    }

    return a.name.localeCompare(
      b.name
    )
  })

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedItems.length /
          SOFTWARE_PER_PAGE
      )
    )

  const validRequestedPage =
    Number.isFinite(
      requestedPage
    ) &&
    requestedPage > 0
      ? requestedPage
      : 1

  const currentPage =
    Math.min(
      validRequestedPage,
      totalPages
    )

  const pageStart =
    (currentPage - 1) *
    SOFTWARE_PER_PAGE

  const paginatedItems =
    sortedItems.slice(
      pageStart,
      pageStart +
        SOFTWARE_PER_PAGE
    )

  const visibleStart =
    sortedItems.length === 0
      ? 0
      : pageStart + 1

  const visibleEnd =
    Math.min(
      pageStart +
        SOFTWARE_PER_PAGE,
      sortedItems.length
    )

  const getPageHref = (
    pageNumber: number
  ) =>
    pageNumber > 1
      ? `/software?page=${pageNumber}`
      : '/software'

  return (
    <div>
      <PageHeader
        title="Software Ecosystem"
        description="Maintain the canonical registry of software, applications and reusable tools, including development state, repository metadata and curated public profiles."
      />

      {params.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {params.error}
        </div>
      )}

      {(params.created ||
        params.saved ||
        params.deleted) && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {params.created
            ? 'Software item created.'
            : params.saved
              ? 'Software item saved.'
              : 'Software item deleted.'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Public software contract
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Public exposure is
            independent from repository
            visibility. A private
            repository can have a Public
            software profile; its private
            repository URL will remain
            hidden while production and
            documentation URLs can still
            be exposed.
          </p>
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Academic API
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Explicitly Public software
            profiles are exposed through{' '}
            <code>
              list_public_software()
            </code>{' '}
            and{' '}
            <code>
              get_public_software(slug)
            </code>
            .
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Add software
        </h2>

        <form
          action={createSoftware}
          className="mt-5"
        >
          <SoftwareFields
            prefix="new-software"
          />

          <div className="mt-5">
            <Button type="submit">
              Create software item
            </Button>
          </div>
        </form>
      </Card>

      {sortedItems.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 rounded-lg border border-oxford-stone bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-oxford-ash">
            Showing{' '}
            <strong className="font-medium text-oxford-charcoal">
              {visibleStart ===
              visibleEnd
                ? visibleStart
                : `${visibleStart}–${visibleEnd}`}
            </strong>{' '}
            of{' '}
            <strong className="font-medium text-oxford-charcoal">
              {sortedItems.length}
            </strong>{' '}
            software items
          </span>

          <span className="text-sm text-oxford-ash">
            Page {currentPage} of{' '}
            {totalPages}
          </span>
        </div>
      )}

      <div className="mt-5 space-y-6">
        {sortedItems.length === 0 ? (
          <Card>
            <p className="text-sm text-oxford-ash">
              No software items have
              been created yet.
            </p>
          </Card>
        ) : (
          paginatedItems.map(
            (item) => {
              const itemMetadata =
                metadataBySoftware.get(
                  item.id
                ) ?? {
                  software_id:
                    item.id,
                  visibility:
                    'private' as const,
                  slug: '',
                  featured: false,
                }

              return (
                <Card
                  key={item.id}
                  className={
                    params.saved ===
                      item.id ||
                    params.created ===
                      item.id
                      ? 'ring-2 ring-green-200'
                      : ''
                  }
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
                          {item.name}
                        </h2>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                            item.status
                          )}`}
                        >
                          {statusLabel(
                            item.status
                          )}
                        </span>

                        <span className="rounded-full border border-oxford-stone bg-oxford-off-white px-2.5 py-1 text-xs font-medium text-oxford-charcoal">
                          {
                            item.development_stage
                          }
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${repositoryClass(
                            item.repository_visibility
                          )}`}
                        >
                          Repository:{' '}
                          {item.repository_visibility ===
                          'public'
                            ? 'Public'
                            : 'Private'}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${exposureClass(
                            itemMetadata.visibility
                          )}`}
                        >
                          Profile:{' '}
                          {itemMetadata.visibility ===
                          'public'
                            ? 'Public'
                            : 'Private'}
                        </span>

                        {itemMetadata.featured && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                            Featured
                          </span>
                        )}
                      </div>

                      <p className="mt-2 max-w-3xl text-sm leading-6 text-oxford-charcoal">
                        {
                          item.short_description
                        }
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-oxford-ash">
                        <span>
                          {item.category}
                        </span>

                        {item.current_version && (
                          <span>
                            Version:{' '}
                            <span className="font-medium text-oxford-charcoal">
                              {
                                item.current_version
                              }
                            </span>
                          </span>
                        )}

                        {(item.start_year ||
                          item.end_year) && (
                          <span>
                            Period:{' '}
                            <span className="font-medium text-oxford-charcoal">
                              {item.start_year
                                ? `${item.start_year}–${item.end_year ?? 'present'}`
                                : `Through ${item.end_year}`}
                            </span>
                          </span>
                        )}

                        <span>
                          Slug:{' '}
                          <code className="text-oxford-charcoal">
                            {
                              itemMetadata.slug
                            }
                          </code>
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3 text-sm">
                        {item.repository_url && (
                          <a
                            href={
                              item.repository_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-oxford-blue underline-offset-4 hover:underline"
                          >
                            Repository
                          </a>
                        )}

                        {item.production_url && (
                          <a
                            href={
                              item.production_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-oxford-blue underline-offset-4 hover:underline"
                          >
                            Production/demo
                          </a>
                        )}

                        {item.documentation_url && (
                          <a
                            href={
                              item.documentation_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-oxford-blue underline-offset-4 hover:underline"
                          >
                            Documentation
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <details className="mt-5 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                    <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                      Edit software
                    </summary>

                    <form
                      action={updateSoftware}
                      className="mt-5"
                    >
                      <input
                        type="hidden"
                        name="software_id"
                        value={item.id}
                      />

                      <SoftwareFields
                        prefix={
                          'software-' +
                          item.id
                        }
                        item={item}
                        metadata={
                          itemMetadata
                        }
                      />

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Button type="submit">
                          Save software
                        </Button>
                      </div>
                    </form>

                    <form
                      action={deleteSoftware}
                      className="mt-4 border-t border-oxford-stone pt-4"
                    >
                      <input
                        type="hidden"
                        name="software_id"
                        value={item.id}
                      />

                      <Button
                        type="submit"
                        variant="danger"
                      >
                        Delete software
                      </Button>
                    </form>
                  </details>
                </Card>
              )
            }
          )
        )}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Software pagination"
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          <ButtonLink
            href={getPageHref(1)}
            variant="secondary"
            aria-disabled={
              currentPage === 1
            }
          >
            First
          </ButtonLink>

          <ButtonLink
            href={getPageHref(
              Math.max(
                1,
                currentPage - 1
              )
            )}
            variant="secondary"
            aria-disabled={
              currentPage === 1
            }
          >
            Previous
          </ButtonLink>

          <span className="px-2 text-sm text-oxford-ash">
            Page {currentPage} of{' '}
            {totalPages}
          </span>

          <ButtonLink
            href={getPageHref(
              Math.min(
                totalPages,
                currentPage + 1
              )
            )}
            variant="secondary"
            aria-disabled={
              currentPage ===
              totalPages
            }
          >
            Next
          </ButtonLink>

          <ButtonLink
            href={getPageHref(
              totalPages
            )}
            variant="secondary"
            aria-disabled={
              currentPage ===
              totalPages
            }
          >
            Last
          </ButtonLink>
        </nav>
      )}

      <p className="mt-6 text-xs leading-5 text-oxford-ash">
        Software Ecosystem is an
        Owner-only administrative
        registry. Public consumers can
        access only explicitly exposed
        profiles through the curated
        Academic API.
      </p>
    </div>
  )
}
