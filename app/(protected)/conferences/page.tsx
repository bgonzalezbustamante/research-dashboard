import Link from 'next/link'

import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import {
  requireDashboardAccess,
} from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import {
  createConferencePresentation,
  deleteConferencePresentation,
  updateConferencePresentation,
} from './actions'

type ConferencesPageProps = {
  searchParams: Promise<{
    error?: string
    created?: string
    saved?: string
    deleted?: string
  }>
}

type ConferencePresentation = {
  id: string
  paper_id: string | null
  event_name: string
  location: string | null
  presentation_date: string | null
  presentation_title: string | null
  authors: string[]
  presentation_type: string | null
  url: string | null
  notes: string | null
}

type PaperRow = {
  id: string
  short_title: string
  title: string
  status: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function formatDate(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const [
    year,
    month,
    day,
  ] = value
    .slice(0, 10)
    .split('-')
    .map(Number)

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )
  )
}

function getToday() {
  const parts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(
      new Date()
    )

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    )

  return `${values.year}-${values.month}-${values.day}`
}

function sortPresentations(
  presentations: ConferencePresentation[],
  today: string
) {
  return [
    ...presentations,
  ].sort((a, b) => {
    const aUpcoming =
      a.presentation_date !==
        null &&
      a.presentation_date >=
        today

    const bUpcoming =
      b.presentation_date !==
        null &&
      b.presentation_date >=
        today

    if (
      aUpcoming &&
      !bUpcoming
    ) {
      return -1
    }

    if (
      !aUpcoming &&
      bUpcoming
    ) {
      return 1
    }

    if (
      a.presentation_date &&
      b.presentation_date
    ) {
      if (
        aUpcoming &&
        bUpcoming
      ) {
        return a.presentation_date.localeCompare(
          b.presentation_date
        )
      }

      return b.presentation_date.localeCompare(
        a.presentation_date
      )
    }

    if (
      a.presentation_date
    ) {
      return -1
    }

    if (
      b.presentation_date
    ) {
      return 1
    }

    return a.event_name.localeCompare(
      b.event_name
    )
  })
}

export default async function ConferencesPage({
  searchParams,
}: ConferencesPageProps) {
  const access =
    await requireDashboardAccess()

  const params =
    await searchParams

  const supabase =
    await createClient()

  const [
    presentationsResult,
    papersResult,
  ] = await Promise.all([
    supabase
      .from(
        'conference_presentations'
      )
      .select(`
        id,
        paper_id,
        event_name,
        location,
        presentation_date,
        presentation_title,
        authors,
        presentation_type,
        url,
        notes
      `)
      .eq(
        'owner_id',
        access.ownerId
      ),

    supabase
      .from('papers')
      .select(`
        id,
        short_title,
        title,
        status
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .order(
        'short_title',
        {
          ascending: true,
        }
      ),
  ])

  if (
    presentationsResult.error
  ) {
    throw new Error(
      `Could not load conference presentations: ${presentationsResult.error.message}`
    )
  }

  if (papersResult.error) {
    throw new Error(
      `Could not load papers: ${papersResult.error.message}`
    )
  }

  const presentations =
    (presentationsResult.data ??
      []) as ConferencePresentation[]

  const papers =
    (papersResult.data ??
      []) as PaperRow[]

  const paperById =
    new Map(
      papers.map(
        (paper) => [
          paper.id,
          paper,
        ]
      )
    )

  const today = getToday()

  const sortedPresentations =
    sortPresentations(
      presentations,
      today
    )

  const upcomingCount =
    presentations.filter(
      (presentation) =>
        presentation.presentation_date !==
          null &&
        presentation.presentation_date >=
          today
    ).length

  const isOwner =
    access.canEdit

  return (
    <div id="conferences">
      <PageHeader
        title="Conferences"
        description="Manage conference, workshop, seminar, and other academic presentations independently from paper workspaces."
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
            ? 'Conference presentation created.'
            : params.saved
              ? 'Conference presentation saved.'
              : 'Conference presentation deleted.'}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Presentations
          </div>
          <div className="mt-2 font-serif text-3xl font-semibold text-oxford-blue">
            {presentations.length}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Upcoming
          </div>
          <div className="mt-2 font-serif text-3xl font-semibold text-oxford-blue">
            {upcomingCount}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Public contract
          </div>
          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Conference metadata and
            ordered presentation
            authors are public.
            Notes and the optional
            linked paper remain
            Dashboard-only.
          </p>
        </Card>
      </div>

      {isOwner && (
        <Card className="mt-6">
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Add presentation
          </h2>

          <form
            action={
              createConferencePresentation
            }
            className="mt-5"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="new-conference-event"
                  className={labelClass}
                >
                  Conference or event
                </label>

                <input
                  id="new-conference-event"
                  name="event_name"
                  required
                  placeholder="ECPR General Conference"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-conference-date"
                  className={labelClass}
                >
                  Date
                </label>

                <input
                  id="new-conference-date"
                  name="presentation_date"
                  type="date"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-conference-location"
                  className={labelClass}
                >
                  Location
                </label>

                <input
                  id="new-conference-location"
                  name="location"
                  placeholder="Bologna, Italy"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-conference-paper"
                  className={labelClass}
                >
                  Linked paper
                </label>

                <select
                  id="new-conference-paper"
                  name="paper_id"
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="">
                    No linked paper
                  </option>

                  {papers.map(
                    (paper) => (
                      <option
                        key={paper.id}
                        value={paper.id}
                      >
                        {
                          paper.short_title
                        }
                      </option>
                    )
                  )}
                </select>

                <p className="mt-1 text-xs text-oxford-ash">
                  Internal only; this
                  relationship is not
                  exposed to the public
                  website.
                </p>
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-conference-title"
                  className={labelClass}
                >
                  Presentation title
                </label>

                <input
                  id="new-conference-title"
                  name="presentation_title"
                  placeholder="Optional presentation title"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-conference-authors"
                  className={labelClass}
                >
                  Authors
                </label>

                <textarea
                  id="new-conference-authors"
                  name="authors"
                  rows={3}
                  placeholder="One author per line, in presentation order"
                  className={inputClass}
                />

                <p className="mt-1 text-xs text-oxford-ash">
                  Enter one author per
                  line, in presentation
                  order.
                </p>
              </div>

              <div>
                <label
                  htmlFor="new-conference-type"
                  className={labelClass}
                >
                  Presentation type
                </label>

                <input
                  id="new-conference-type"
                  name="presentation_type"
                  placeholder="Conference paper, workshop, keynote..."
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-conference-url"
                  className={labelClass}
                >
                  URL
                </label>

                <input
                  id="new-conference-url"
                  name="url"
                  type="url"
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-conference-notes"
                  className={labelClass}
                >
                  Notes
                </label>

                <textarea
                  id="new-conference-notes"
                  name="notes"
                  rows={4}
                  className={inputClass}
                />

                <p className="mt-1 text-xs text-oxford-ash">
                  Dashboard-only;
                  notes are not exposed
                  through the public
                  academic-website
                  contract.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <Button type="submit">
                Add presentation
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-8 space-y-5">
        {sortedPresentations.length ===
        0 ? (
          <Card>
            <p className="text-sm text-oxford-ash">
              No conference
              presentations yet.
            </p>
          </Card>
        ) : (
          sortedPresentations.map(
            (presentation) => {
              const upcoming =
                presentation.presentation_date !==
                  null &&
                presentation.presentation_date >=
                  today

              const linkedPaper =
                presentation.paper_id
                  ? paperById.get(
                      presentation.paper_id
                    )
                  : null

              return (
                <Card
                  key={
                    presentation.id
                  }
                  className={
                    params.saved ===
                      presentation.id ||
                    params.created ===
                      presentation.id
                      ? 'ring-2 ring-green-200'
                      : ''
                  }
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
                          {
                            presentation.event_name
                          }
                        </h2>

                        {upcoming && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
                            Upcoming
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-oxford-ash">
                        <span>
                          {formatDate(
                            presentation.presentation_date
                          )}
                        </span>

                        {presentation.location && (
                          <span>
                            {
                              presentation.location
                            }
                          </span>
                        )}

                        {presentation.presentation_type && (
                          <span>
                            {
                              presentation.presentation_type
                            }
                          </span>
                        )}
                      </div>

                      {presentation.presentation_title && (
                        <p className="mt-3 font-medium text-oxford-charcoal">
                          {
                            presentation.presentation_title
                          }
                        </p>
                      )}

                      {presentation.authors.length > 0 && (
                        <p className="mt-2 text-sm text-oxford-ash">
                          {presentation.authors.join(', ')}
                        </p>
                      )}

                      {linkedPaper && (
                        <p className="mt-2 text-sm text-oxford-ash">
                          Linked paper:{' '}
                          <Link
                            href={`/papers/${linkedPaper.id}`}
                            className="font-medium text-oxford-blue hover:underline"
                          >
                            {
                              linkedPaper.short_title
                            }
                          </Link>
                          <span className="ml-2 text-xs">
                            (Dashboard only)
                          </span>
                        </p>
                      )}

                      {presentation.notes && (
                        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-oxford-charcoal">
                          {
                            presentation.notes
                          }
                        </p>
                      )}

                      {presentation.url && (
                        <a
                          href={
                            presentation.url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block text-sm font-medium text-oxford-blue hover:underline"
                        >
                          Presentation link
                        </a>
                      )}
                    </div>
                  </div>

                  {isOwner && (
                    <>
                      <details className="mt-5 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                        <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                          Edit presentation
                        </summary>

                        <form
                          action={
                            updateConferencePresentation
                          }
                          className="mt-4"
                        >
                          <input
                            type="hidden"
                            name="presentation_id"
                            value={
                              presentation.id
                            }
                          />

                          <div className="grid gap-5 md:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`event-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Conference
                                or event
                              </label>

                              <input
                                id={`event-${presentation.id}`}
                                name="event_name"
                                required
                                defaultValue={
                                  presentation.event_name
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`date-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Date
                              </label>

                              <input
                                id={`date-${presentation.id}`}
                                name="presentation_date"
                                type="date"
                                defaultValue={
                                  presentation.presentation_date ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`location-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Location
                              </label>

                              <input
                                id={`location-${presentation.id}`}
                                name="location"
                                defaultValue={
                                  presentation.location ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`paper-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Linked paper
                              </label>

                              <select
                                id={`paper-${presentation.id}`}
                                name="paper_id"
                                defaultValue={
                                  presentation.paper_id ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              >
                                <option value="">
                                  No linked
                                  paper
                                </option>

                                {papers.map(
                                  (
                                    paper
                                  ) => (
                                    <option
                                      key={
                                        paper.id
                                      }
                                      value={
                                        paper.id
                                      }
                                    >
                                      {
                                        paper.short_title
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label
                                htmlFor={`presentation-title-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Presentation
                                title
                              </label>

                              <input
                                id={`presentation-title-${presentation.id}`}
                                name="presentation_title"
                                defaultValue={
                                  presentation.presentation_title ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label
                                htmlFor={`authors-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Authors
                              </label>

                              <textarea
                                id={`authors-${presentation.id}`}
                                name="authors"
                                rows={3}
                                defaultValue={
                                  presentation.authors.join(
                                    '\n'
                                  )
                                }
                                className={
                                  inputClass
                                }
                              />

                              <p className="mt-1 text-xs text-oxford-ash">
                                Enter one
                                author per
                                line, in
                                presentation
                                order.
                              </p>
                            </div>

                            <div>
                              <label
                                htmlFor={`type-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Presentation
                                type
                              </label>

                              <input
                                id={`type-${presentation.id}`}
                                name="presentation_type"
                                defaultValue={
                                  presentation.presentation_type ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`url-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                URL
                              </label>

                              <input
                                id={`url-${presentation.id}`}
                                name="url"
                                type="url"
                                defaultValue={
                                  presentation.url ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label
                                htmlFor={`notes-${presentation.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Notes
                              </label>

                              <textarea
                                id={`notes-${presentation.id}`}
                                name="notes"
                                rows={4}
                                defaultValue={
                                  presentation.notes ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />

                              <p className="mt-1 text-xs text-oxford-ash">
                                Dashboard-only;
                                notes are
                                private.
                              </p>
                            </div>
                          </div>

                          <div className="mt-5">
                            <Button type="submit">
                              Save
                              presentation
                            </Button>
                          </div>
                        </form>
                      </details>

                      <form
                        action={
                          deleteConferencePresentation
                        }
                        className="mt-4"
                      >
                        <input
                          type="hidden"
                          name="presentation_id"
                          value={
                            presentation.id
                          }
                        />

                        <Button
                          type="submit"
                          variant="danger"
                        >
                          Delete
                          presentation
                        </Button>
                      </form>
                    </>
                  )}
                </Card>
              )
            }
          )
        )}
      </div>
    </div>
  )
}
