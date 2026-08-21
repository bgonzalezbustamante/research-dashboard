import {
  createWorkSession,
  deleteWorkSession,
  updateWorkSession,
} from '@/app/(protected)/hours/actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

type ActivityLabel = {
  id: string
  name: string
  is_system: boolean
  is_break: boolean
  is_active: boolean
}

type PaperOption = {
  id: string
  short_title: string
  archived_at: string | null
}

type WorkSession = {
  id: string
  start_time: string
  end_time: string
  place: string
  activity_label_id: string
  paper_id: string | null
  label_name: string
  label_is_break: boolean
  label_is_active: boolean
  paper_short_title: string | null
  paper_archived: boolean
}

type WorkSessionsSectionProps = {
  date: string
  dailyLogExists: boolean
  sessions: WorkSession[]
  labels: ActivityLabel[]
  papers: PaperOption[]
  error?: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function normaliseTime(
  value: string
) {
  return value.slice(0, 5)
}

function timeToMinutes(
  value: string
) {
  const [hours, minutes] =
    normaliseTime(value)
      .split(':')
      .map(Number)

  return hours * 60 + minutes
}

function getDurationMinutes(
  startTime: string,
  endTime: string
) {
  return (
    timeToMinutes(endTime) -
    timeToMinutes(startTime)
  )
}

function formatDuration(
  minutes: number
) {
  const hours =
    Math.floor(
      minutes / 60
    )

  const remainder =
    minutes % 60

  if (
    hours > 0 &&
    remainder > 0
  ) {
    return `${hours}h ${remainder}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${remainder}m`
}

function formatClockTime(
  value: string
) {
  return normaliseTime(
    value
  )
}

export default function WorkSessionsSection({
  date,
  dailyLogExists,
  sessions,
  labels,
  papers,
  error,
}: WorkSessionsSectionProps) {
  const sortedSessions =
    [...sessions].sort(
      (a, b) =>
        a.start_time.localeCompare(
          b.start_time
        )
    )

  const selectableLabels =
    labels
      .filter(
        (label) =>
          label.is_active
      )
      .sort((a, b) => {
        if (
          a.is_break !==
          b.is_break
        ) {
          return a.is_break
            ? 1
            : -1
        }

        return a.name.localeCompare(
          b.name
        )
      })

  const sortedPapers =
    [...papers].sort(
      (a, b) =>
        a.short_title.localeCompare(
          b.short_title
        )
    )

  const grossMinutes =
    sortedSessions.reduce(
      (total, session) =>
        total +
        getDurationMinutes(
          session.start_time,
          session.end_time
        ),
      0
    )

  const breakMinutes =
    sortedSessions
      .filter(
        (session) =>
          session.label_is_break
      )
      .reduce(
        (total, session) =>
          total +
          getDurationMinutes(
            session.start_time,
            session.end_time
          ),
        0
      )

  const netMinutes =
    grossMinutes -
    breakMinutes

  return (
    <section
      id="work-sessions"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Work sessions
          </h2>

          <p className="mt-1 text-sm leading-6 text-oxford-ash">
            Record manual intervals
            with an activity, work
            location, and optional
            paper.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="min-w-24 rounded-lg border border-oxford-stone bg-white px-3 py-2">
            <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
              Gross
            </div>

            <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
              {formatDuration(
                grossMinutes
              )}
            </div>
          </div>

          <div className="min-w-24 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs font-medium uppercase tracking-wide text-amber-800">
              Break
            </div>

            <div className="mt-1 font-serif text-lg font-semibold text-amber-900">
              {formatDuration(
                breakMinutes
              )}
            </div>
          </div>

          <div className="min-w-24 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <div className="text-xs font-medium uppercase tracking-wide text-green-800">
              Net
            </div>

            <div className="mt-1 font-serif text-lg font-semibold text-green-900">
              {formatDuration(
                netMinutes
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(285px,0.7fr)_minmax(0,2fr)]">
        <Card>
          <h3 className="font-serif text-lg font-semibold text-oxford-blue">
            Add work session
          </h3>

          <p className="mt-1 text-sm leading-5 text-oxford-ash">
            Sessions must remain
            within one calendar day
            and cannot overlap.
          </p>

          {!dailyLogExists && (
            <div className="mt-4 rounded-md border border-oxford-stone bg-oxford-shell px-3 py-2 text-xs leading-5 text-oxford-ash">
              Adding the first
              session creates this
              day&apos;s log with
              zero coffees.
            </div>
          )}

          {selectableLabels.length ===
          0 ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No active activity
              labels are available.
            </div>
          ) : (
            <form
              action={
                createWorkSession
              }
              className="mt-4 space-y-4"
            >
              <input
                type="hidden"
                name="log_date"
                value={date}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="session-start"
                    className={
                      labelClass
                    }
                  >
                    Start
                  </label>

                  <input
                    id="session-start"
                    name="start_time"
                    type="time"
                    required
                    className={
                      inputClass
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="session-end"
                    className={
                      labelClass
                    }
                  >
                    End
                  </label>

                  <input
                    id="session-end"
                    name="end_time"
                    type="time"
                    required
                    className={
                      inputClass
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="session-label"
                  className={
                    labelClass
                  }
                >
                  Activity
                </label>

                <select
                  id="session-label"
                  name="activity_label_id"
                  required
                  className={
                    inputClass
                  }
                >
                  {selectableLabels.map(
                    (label) => (
                      <option
                        key={
                          label.id
                        }
                        value={
                          label.id
                        }
                      >
                        {label.name}
                        {label.is_break
                          ? ' — no paper'
                          : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="session-place"
                  className={
                    labelClass
                  }
                >
                  Place
                </label>

                <input
                  id="session-place"
                  name="place"
                  type="text"
                  list="session-places"
                  required
                  placeholder="e.g. Home"
                  className={
                    inputClass
                  }
                />

                <datalist id="session-places">
                  <option value="Home" />
                  <option value="Leiden University" />
                  <option value="The Hague" />
                  <option value="Oxford" />
                  <option value="Library" />
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="session-paper"
                  className={
                    labelClass
                  }
                >
                  Paper
                </label>

                <select
                  id="session-paper"
                  name="paper_id"
                  defaultValue=""
                  className={
                    inputClass
                  }
                >
                  <option value="">
                    — No paper —
                  </option>

                  {sortedPapers.map(
                    (paper) => (
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
                        {paper.archived_at
                          ? ' (archived)'
                          : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
              >
                Add session
              </Button>
            </form>
          )}
        </Card>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          {sortedSessions.length ===
          0 ? (
            <div className="sm:col-span-2">
              <Card>
                <div className="py-6 text-center">
                  <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                    No work sessions
                    yet
                  </h3>

                  <p className="mt-1 text-sm text-oxford-ash">
                    Add the first
                    interval for this
                    day.
                  </p>
                </div>
              </Card>
            </div>
          ) : (
            sortedSessions.map(
              (session) => {
                const duration =
                  getDurationMinutes(
                    session.start_time,
                    session.end_time
                  )

                return (
                  <Card
                    key={
                      session.id
                    }
                    className={[
                      'h-fit',
                      session.label_is_break
                        ? 'border-amber-200 bg-amber-50/40'
                        : '',
                    ]
                      .filter(
                        Boolean
                      )
                      .join(' ')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-serif text-lg font-semibold text-oxford-blue">
                            {formatClockTime(
                              session.start_time
                            )}
                            {'–'}
                            {formatClockTime(
                              session.end_time
                            )}
                          </span>

                          <span className="text-xs text-oxford-ash">
                            {formatDuration(
                              duration
                            )}
                          </span>
                        </div>
                      </div>

                      <span
                        className={
                          session.label_is_break
                            ? 'rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800'
                            : 'rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900'
                        }
                      >
                        {
                          session.label_name
                        }
                      </span>
                    </div>

                    {!session.label_is_active &&
                      !session.label_is_break && (
                        <span className="mt-2 inline-flex rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Inactive label
                        </span>
                      )}

                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex gap-2">
                        <span className="font-medium text-oxford-charcoal">
                          Place
                        </span>

                        <span className="min-w-0 truncate text-oxford-ash">
                          {
                            session.place
                          }
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <span className="font-medium text-oxford-charcoal">
                          Paper
                        </span>

                        <span className="min-w-0 truncate text-oxford-ash">
                          {session.paper_short_title ??
                            '—'}

                          {session.paper_archived &&
                            ' (archived)'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-oxford-stone pt-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                            Edit
                          </summary>

                          <form
                            action={
                              updateWorkSession
                            }
                            className="mt-3 grid gap-3"
                          >
                            <input
                              type="hidden"
                              name="log_date"
                              value={
                                date
                              }
                            />

                            <input
                              type="hidden"
                              name="session_id"
                              value={
                                session.id
                              }
                            />

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label
                                  htmlFor={`session-start-${session.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  Start
                                </label>

                                <input
                                  id={`session-start-${session.id}`}
                                  name="start_time"
                                  type="time"
                                  required
                                  defaultValue={normaliseTime(
                                    session.start_time
                                  )}
                                  className={
                                    inputClass
                                  }
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`session-end-${session.id}`}
                                  className={
                                    labelClass
                                  }
                                >
                                  End
                                </label>

                                <input
                                  id={`session-end-${session.id}`}
                                  name="end_time"
                                  type="time"
                                  required
                                  defaultValue={normaliseTime(
                                    session.end_time
                                  )}
                                  className={
                                    inputClass
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <label
                                htmlFor={`session-label-${session.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Activity
                              </label>

                              <select
                                id={`session-label-${session.id}`}
                                name="activity_label_id"
                                required
                                defaultValue={
                                  session.activity_label_id
                                }
                                className={
                                  inputClass
                                }
                              >
                                {labels.map(
                                  (
                                    label
                                  ) => (
                                    <option
                                      key={
                                        label.id
                                      }
                                      value={
                                        label.id
                                      }
                                    >
                                      {
                                        label.name
                                      }
                                      {!label.is_active
                                        ? ' (inactive)'
                                        : ''}
                                      {label.is_break
                                        ? ' — no paper'
                                        : ''}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`session-place-${session.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Place
                              </label>

                              <input
                                id={`session-place-${session.id}`}
                                name="place"
                                type="text"
                                list="session-places"
                                required
                                defaultValue={
                                  session.place
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`session-paper-${session.id}`}
                                className={
                                  labelClass
                                }
                              >
                                Paper
                              </label>

                              <select
                                id={`session-paper-${session.id}`}
                                name="paper_id"
                                defaultValue={
                                  session.paper_id ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              >
                                <option value="">
                                  — No paper —
                                </option>

                                {sortedPapers.map(
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
                                      {paper.archived_at
                                        ? ' (archived)'
                                        : ''}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <Button
                              type="submit"
                              variant="primary"
                            >
                              Save
                            </Button>
                          </form>
                        </details>

                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                            Delete
                          </summary>

                          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
                            <p className="text-xs leading-5 text-red-800">
                              Permanently
                              remove this
                              work
                              interval.
                            </p>

                            <form
                              action={
                                deleteWorkSession
                              }
                              className="mt-3"
                            >
                              <input
                                type="hidden"
                                name="log_date"
                                value={
                                  date
                                }
                              />

                              <input
                                type="hidden"
                                name="session_id"
                                value={
                                  session.id
                                }
                              />

                              <Button
                                type="submit"
                                variant="danger"
                              >
                                Confirm
                                delete
                              </Button>
                            </form>
                          </div>
                        </details>
                      </div>
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