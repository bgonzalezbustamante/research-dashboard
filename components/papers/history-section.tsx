import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import {
  createHistoryEvent,
  deleteHistoryEvent,
  updateHistoryEvent,
} from '@/app/(protected)/papers/history-actions'

type HistoryEvent = {
  id: string
  event_date: string
  event_type: string
  venue: string | null
  round_number: number | null
  decision: string | null
  notes: string | null
  created_at: string
}

type HistorySectionProps = {
  paperId: string
  events: HistoryEvent[]
  error?: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function formatDate(
  value: string
) {
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
    ).formatToParts(new Date())

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    )

  return `${values.year}-${values.month}-${values.day}`
}

function getEventLabel(
  type: string
) {
  switch (type) {
    case 'submitted':
      return 'Submitted'

    case 'decision':
      return 'Decision'

    case 'revision-submitted':
      return 'Revision submitted'

    case 'accepted':
      return 'Accepted'

    case 'rejected':
      return 'Rejected'

    case 'withdrawn':
      return 'Withdrawn'

    case 'published':
      return 'Published'

    default:
      return 'Other'
  }
}

function getEventClasses(
  type: string
) {
  switch (type) {
    case 'accepted':
    case 'published':
      return 'border-green-200 bg-green-50 text-green-800'

    case 'rejected':
    case 'withdrawn':
      return 'border-red-200 bg-red-50 text-red-800'

    case 'decision':
      return 'border-amber-200 bg-amber-50 text-amber-800'

    case 'revision-submitted':
      return 'border-sky-200 bg-sky-50 text-sky-900'

    default:
      return 'border-oxford-stone bg-oxford-shell text-oxford-charcoal'
  }
}

function sortEvents(
  events: HistoryEvent[]
) {
  return [...events].sort(
    (a, b) => {
      const dateDifference =
        a.event_date.localeCompare(
          b.event_date
        )

      if (dateDifference !== 0) {
        return dateDifference
      }

      return a.created_at.localeCompare(
        b.created_at
      )
    }
  )
}

export default function HistorySection({
  paperId,
  events,
  error,
}: HistorySectionProps) {
  const sortedEvents =
    sortEvents(events)

  const submissionCount =
    events.filter(
      (event) =>
        event.event_type ===
          'submitted' ||
        event.event_type ===
          'revision-submitted'
    ).length

  const latestEvent =
    sortedEvents.length > 0
      ? sortedEvents[
          sortedEvents.length - 1
        ]
      : null

  return (
    <section
      id="history"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Submission and revision history
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Record submissions,
            editorial decisions,
            revisions, acceptance,
            rejection, withdrawal,
            and publication.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {events.length}
            </strong>{' '}
            events
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {submissionCount}
            </strong>{' '}
            submissions
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
            Add history event
          </h3>

          <form
            action={
              createHistoryEvent
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
                htmlFor="history_event_date"
                className={
                  labelClass
                }
              >
                Date
              </label>

              <input
                id="history_event_date"
                name="event_date"
                type="date"
                defaultValue={getToday()}
                required
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="history_event_type"
                className={
                  labelClass
                }
              >
                Event
              </label>

              <select
                id="history_event_type"
                name="event_type"
                defaultValue="submitted"
                className={
                  inputClass
                }
              >
                <option value="submitted">
                  Submitted
                </option>

                <option value="decision">
                  Decision
                </option>

                <option value="revision-submitted">
                  Revision submitted
                </option>

                <option value="accepted">
                  Accepted
                </option>

                <option value="rejected">
                  Rejected
                </option>

                <option value="withdrawn">
                  Withdrawn
                </option>

                <option value="published">
                  Published
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="history_venue"
                className={
                  labelClass
                }
              >
                Journal or venue
              </label>

              <input
                id="history_venue"
                name="venue"
                type="text"
                placeholder="Journal name"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="history_round"
                className={
                  labelClass
                }
              >
                Round
              </label>

              <input
                id="history_round"
                name="round_number"
                type="number"
                min="1"
                placeholder="1"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="history_decision"
                className={
                  labelClass
                }
              >
                Decision
              </label>

              <input
                id="history_decision"
                name="decision"
                type="text"
                placeholder="e.g. Major revision"
                className={
                  inputClass
                }
              />

              <p className="mt-1 text-xs text-oxford-ash">
                Required when Event
                is Decision.
              </p>
            </div>

            <div>
              <label
                htmlFor="history_notes"
                className={
                  labelClass
                }
              >
                Notes
              </label>

              <textarea
                id="history_notes"
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
              Add event
            </Button>
          </form>
        </Card>

        <div>
          {sortedEvents.length ===
          0 ? (
            <Card>
              <div className="py-6 text-center">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  No history yet
                </h3>

                <p className="mt-2 text-sm text-oxford-ash">
                  Add the first
                  submission or other
                  manuscript event.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {latestEvent && (
                <p className="mb-3 text-sm text-oxford-ash">
                  Latest:{' '}
                  <strong className="font-medium text-oxford-charcoal">
                    {getEventLabel(
                      latestEvent.event_type
                    )}
                  </strong>{' '}
                  on{' '}
                  {formatDate(
                    latestEvent.event_date
                  )}
                </p>
              )}

              <div className="space-y-4">
                {sortedEvents.map(
                  (
                    event,
                    index
                  ) => (
                    <Card
                      key={
                        event.id
                      }
                    >
                      <div className="grid gap-4 md:grid-cols-[130px_minmax(0,1fr)]">
                        <div>
                          <div className="text-sm font-medium text-oxford-charcoal">
                            {formatDate(
                              event.event_date
                            )}
                          </div>

                          {event.round_number && (
                            <div className="mt-1 text-xs text-oxford-ash">
                              Round{' '}
                              {
                                event.round_number
                              }
                            </div>
                          )}

                          <div className="mt-2 text-xs text-oxford-ash">
                            {index +
                              1}{' '}
                            of{' '}
                            {
                              sortedEvents.length
                            }
                          </div>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getEventClasses(
                                event.event_type
                              )}`}
                            >
                              {getEventLabel(
                                event.event_type
                              )}
                            </span>

                            {event.decision && (
                              <span className="text-sm font-medium text-oxford-charcoal">
                                {
                                  event.decision
                                }
                              </span>
                            )}
                          </div>

                          {event.venue && (
                            <p className="mt-2 text-sm text-oxford-charcoal">
                              {
                                event.venue
                              }
                            </p>
                          )}

                          {event.notes && (
                            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-oxford-charcoal">
                              {
                                event.notes
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 border-t border-oxford-stone pt-4">
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                            Edit event
                          </summary>

                          <form
                            action={
                              updateHistoryEvent
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
                              name="history_id"
                              value={
                                event.id
                              }
                            />

                            <div>
                              <label
                                htmlFor={`history-date-${event.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Date
                              </label>

                              <input
                                id={`history-date-${event.id}`}
                                name="event_date"
                                type="date"
                                required
                                defaultValue={
                                  event.event_date
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`history-type-${event.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Event
                              </label>

                              <select
                                id={`history-type-${event.id}`}
                                name="event_type"
                                defaultValue={
                                  event.event_type
                                }
                                className={
                                  inputClass
                                }
                              >
                                <option value="submitted">
                                  Submitted
                                </option>

                                <option value="decision">
                                  Decision
                                </option>

                                <option value="revision-submitted">
                                  Revision submitted
                                </option>

                                <option value="accepted">
                                  Accepted
                                </option>

                                <option value="rejected">
                                  Rejected
                                </option>

                                <option value="withdrawn">
                                  Withdrawn
                                </option>

                                <option value="published">
                                  Published
                                </option>

                                <option value="other">
                                  Other
                                </option>
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`history-venue-${event.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Journal or venue
                              </label>

                              <input
                                id={`history-venue-${event.id}`}
                                name="venue"
                                type="text"
                                defaultValue={
                                  event.venue ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`history-round-${event.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Round
                              </label>

                              <input
                                id={`history-round-${event.id}`}
                                name="round_number"
                                type="number"
                                min="1"
                                defaultValue={
                                  event.round_number ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label
                                htmlFor={`history-decision-${event.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Decision
                              </label>

                              <input
                                id={`history-decision-${event.id}`}
                                name="decision"
                                type="text"
                                defaultValue={
                                  event.decision ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label
                                htmlFor={`history-notes-${event.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Notes
                              </label>

                              <textarea
                                id={`history-notes-${event.id}`}
                                name="notes"
                                rows={4}
                                defaultValue={
                                  event.notes ??
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
                                Save event
                              </Button>
                            </div>
                          </form>
                        </details>

                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                            Delete event
                          </summary>

                          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
                            <p className="text-sm text-red-800">
                              This permanently
                              removes this
                              history event. Use
                              this only for an
                              erroneous record.
                            </p>

                            <form
                              action={
                                deleteHistoryEvent
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
                                name="history_id"
                                value={
                                  event.id
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
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}