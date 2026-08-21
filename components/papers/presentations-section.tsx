import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

import {
  createPresentation,
  deletePresentation,
  updatePresentation,
} from '@/app/(protected)/papers/presentation-actions'

type Presentation = {
  id: string
  event_name: string
  location: string | null
  presentation_date: string | null
  presentation_title: string | null
  presentation_type: string | null
  url: string | null
  notes: string | null
}

type PresentationsSectionProps = {
  paperId: string
  presentations: Presentation[]
  error?: string
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
  presentations: Presentation[],
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

export default function PresentationsSection({
  paperId,
  presentations,
  error,
}: PresentationsSectionProps) {
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

  return (
    <section
      id="presentations"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Conference presentations
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Record conference,
            workshop, seminar, and
            other presentations of
            this paper.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {
                presentations.length
              }
            </strong>{' '}
            presentations
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {upcomingCount}
            </strong>{' '}
            upcoming
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)]">
        <Card>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            Add presentation
          </h3>

          <form
            action={
              createPresentation
            }
            className="mt-5 space-y-4"
          >
            <input
              type="hidden"
              name="paper_id"
              value={paperId}
            />

            <div>
              <label
                htmlFor="presentation_event_name"
                className={
                  labelClass
                }
              >
                Conference or event
              </label>

              <input
                id="presentation_event_name"
                name="event_name"
                type="text"
                required
                placeholder="ECPR General Conference"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="presentation_date"
                className={
                  labelClass
                }
              >
                Date
              </label>

              <input
                id="presentation_date"
                name="presentation_date"
                type="date"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="presentation_location"
                className={
                  labelClass
                }
              >
                Location
              </label>

              <input
                id="presentation_location"
                name="location"
                type="text"
                placeholder="Bologna, Italy"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="presentation_title"
                className={
                  labelClass
                }
              >
                Presentation title
              </label>

              <input
                id="presentation_title"
                name="presentation_title"
                type="text"
                placeholder="Leave blank if identical to paper title"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="presentation_type"
                className={
                  labelClass
                }
              >
                Presentation type
              </label>

              <input
                id="presentation_type"
                name="presentation_type"
                type="text"
                placeholder="Conference paper, workshop, keynote..."
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="presentation_url"
                className={
                  labelClass
                }
              >
                URL
              </label>

              <input
                id="presentation_url"
                name="url"
                type="url"
                placeholder="https://..."
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="presentation_notes"
                className={
                  labelClass
                }
              >
                Notes
              </label>

              <textarea
                id="presentation_notes"
                name="notes"
                rows={4}
                className={
                  inputClass
                }
              />
            </div>

            <Button
              type="submit"
              variant="primary"
            >
              Add presentation
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          {sortedPresentations.length ===
          0 ? (
            <Card>
              <div className="py-6 text-center">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  No presentations yet
                </h3>

                <p className="mt-2 text-sm text-oxford-ash">
                  Add a conference
                  or other
                  presentation of
                  this paper.
                </p>
              </div>
            </Card>
          ) : (
            sortedPresentations.map(
              (presentation) => {
                const upcoming =
                  presentation.presentation_date !==
                    null &&
                  presentation.presentation_date >=
                    today

                return (
                  <Card
                    key={
                      presentation.id
                    }
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-oxford-charcoal">
                            {
                              presentation.event_name
                            }
                          </h3>

                          {upcoming && (
                            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
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
                        </div>

                        {presentation.presentation_title && (
                          <p className="mt-3 font-medium text-oxford-charcoal">
                            {
                              presentation.presentation_title
                            }
                          </p>
                        )}

                        {presentation.presentation_type && (
                          <p className="mt-1 text-sm text-oxford-ash">
                            {
                              presentation.presentation_type
                            }
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

                    <div className="mt-5 border-t border-oxford-stone pt-4">
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                          Edit presentation
                        </summary>

                        <form
                          action={
                            updatePresentation
                          }
                          className="mt-4 grid gap-4 md:grid-cols-2"
                        >
                          <input
                            type="hidden"
                            name="paper_id"
                            value={
                              paperId
                            }
                          />

                          <input
                            type="hidden"
                            name="presentation_id"
                            value={
                              presentation.id
                            }
                          />

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`presentation-event-${presentation.id}`}
                              className={
                                labelClass
                              }
                            >
                              Conference or
                              event
                            </label>

                            <input
                              id={`presentation-event-${presentation.id}`}
                              name="event_name"
                              type="text"
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
                              htmlFor={`presentation-date-${presentation.id}`}
                              className={
                                labelClass
                              }
                            >
                              Date
                            </label>

                            <input
                              id={`presentation-date-${presentation.id}`}
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
                              htmlFor={`presentation-location-${presentation.id}`}
                              className={
                                labelClass
                              }
                            >
                              Location
                            </label>

                            <input
                              id={`presentation-location-${presentation.id}`}
                              name="location"
                              type="text"
                              defaultValue={
                                presentation.location ??
                                ''
                              }
                              className={
                                inputClass
                              }
                            />
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
                              type="text"
                              defaultValue={
                                presentation.presentation_title ??
                                ''
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`presentation-type-${presentation.id}`}
                              className={
                                labelClass
                              }
                            >
                              Presentation
                              type
                            </label>

                            <input
                              id={`presentation-type-${presentation.id}`}
                              name="presentation_type"
                              type="text"
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
                              htmlFor={`presentation-url-${presentation.id}`}
                              className={
                                labelClass
                              }
                            >
                              URL
                            </label>

                            <input
                              id={`presentation-url-${presentation.id}`}
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
                              htmlFor={`presentation-notes-${presentation.id}`}
                              className={
                                labelClass
                              }
                            >
                              Notes
                            </label>

                            <textarea
                              id={`presentation-notes-${presentation.id}`}
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
                          </div>

                          <div className="md:col-span-2">
                            <Button
                              type="submit"
                              variant="primary"
                            >
                              Save presentation
                            </Button>
                          </div>
                        </form>
                      </details>

                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                          Delete presentation
                        </summary>

                        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
                          <p className="text-sm text-red-800">
                            This permanently
                            removes this
                            presentation
                            record. Use this
                            only for an
                            erroneous entry.
                          </p>

                          <form
                            action={
                              deletePresentation
                            }
                            className="mt-3"
                          >
                            <input
                              type="hidden"
                              name="paper_id"
                              value={
                                paperId
                              }
                            />

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
                              Confirm delete
                            </Button>
                          </form>
                        </div>
                      </details>
                    </div>
                  </Card>
                )
              }
            )
          )}
        </div>
      </div>
    </section>
  )
}