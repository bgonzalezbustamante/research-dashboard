import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import {
  cancelMilestone,
  completeMilestone,
  createMilestone,
  deleteMilestone,
  reopenMilestone,
  updateMilestone,
} from '@/app/(protected)/papers/milestone-actions'

type Milestone = {
  id: string
  title: string
  target_date: string | null
  completed_on: string | null
  status: string
  notes: string | null
}

type MilestonesSectionProps = {
  paperId: string
  milestones: Milestone[]
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

function getStatusLabel(
  status: string
) {
  switch (status) {
    case 'completed':
      return 'Completed'

    case 'cancelled':
      return 'Cancelled'

    case 'planned':
    default:
      return 'Planned'
  }
}

function getStatusClasses(
  status: string
) {
  switch (status) {
    case 'completed':
      return 'border-green-200 bg-green-50 text-green-800'

    case 'cancelled':
      return 'border-gray-300 bg-gray-100 text-gray-700'

    case 'planned':
    default:
      return 'border-sky-200 bg-sky-50 text-sky-900'
  }
}

function sortMilestones(
  milestones: Milestone[]
) {
  const rank: Record<
    string,
    number
  > = {
    planned: 0,
    completed: 1,
    cancelled: 2,
  }

  return [...milestones].sort(
    (a, b) => {
      const statusDifference =
        (rank[a.status] ?? 9) -
        (rank[b.status] ?? 9)

      if (statusDifference !== 0) {
        return statusDifference
      }

      if (
        a.status === 'planned'
      ) {
        if (
          a.target_date &&
          b.target_date
        ) {
          return a.target_date.localeCompare(
            b.target_date
          )
        }

        if (a.target_date) {
          return -1
        }

        if (b.target_date) {
          return 1
        }

        return a.title.localeCompare(
          b.title
        )
      }

      const aDate =
        a.completed_on ??
        a.target_date ??
        ''

      const bDate =
        b.completed_on ??
        b.target_date ??
        ''

      return bDate.localeCompare(
        aDate
      )
    }
  )
}

export default function MilestonesSection({
  paperId,
  milestones,
  error,
}: MilestonesSectionProps) {
  const sortedMilestones =
    sortMilestones(milestones)

  const today = getToday()

  const plannedCount =
    milestones.filter(
      (milestone) =>
        milestone.status ===
        'planned'
    ).length

  const completedCount =
    milestones.filter(
      (milestone) =>
        milestone.status ===
        'completed'
    ).length

  return (
    <section
      id="milestones"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Milestones
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Track planned and
            completed steps in the
            paper&apos;s development.
          </p>
        </div>

        <div className="flex gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {plannedCount}
            </strong>{' '}
            planned
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {completedCount}
            </strong>{' '}
            completed
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
            Add milestone
          </h3>

          <form
            action={
              createMilestone
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
                htmlFor="milestone_title"
                className={
                  labelClass
                }
              >
                Title
              </label>

              <input
                id="milestone_title"
                name="title"
                type="text"
                required
                placeholder="Submit manuscript"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="milestone_target_date"
                className={
                  labelClass
                }
              >
                Target date
              </label>

              <input
                id="milestone_target_date"
                name="target_date"
                type="date"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="milestone_status"
                className={
                  labelClass
                }
              >
                Status
              </label>

              <select
                id="milestone_status"
                name="status"
                defaultValue="planned"
                className={
                  inputClass
                }
              >
                <option value="planned">
                  Planned
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="milestone_completed_on"
                className={
                  labelClass
                }
              >
                Completed date
              </label>

              <input
                id="milestone_completed_on"
                name="completed_on"
                type="date"
                className={
                  inputClass
                }
              />

              <p className="mt-1 text-xs text-oxford-ash">
                Used only for a
                completed milestone.
                If blank, today is
                used.
              </p>
            </div>

            <div>
              <label
                htmlFor="milestone_notes"
                className={
                  labelClass
                }
              >
                Notes
              </label>

              <textarea
                id="milestone_notes"
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
              Add milestone
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          {sortedMilestones.length ===
          0 ? (
            <Card>
              <div className="py-6 text-center">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  No milestones yet
                </h3>

                <p className="mt-2 text-sm text-oxford-ash">
                  Add a milestone to
                  start tracking the
                  paper&apos;s
                  development.
                </p>
              </div>
            </Card>
          ) : (
            sortedMilestones.map(
              (milestone) => {
                const overdue =
                  milestone.status ===
                    'planned' &&
                  milestone.target_date !==
                    null &&
                  milestone.target_date <
                    today

                return (
                  <Card
                    key={
                      milestone.id
                    }
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-oxford-charcoal">
                            {
                              milestone.title
                            }
                          </h3>

                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClasses(
                              milestone.status
                            )}`}
                          >
                            {getStatusLabel(
                              milestone.status
                            )}
                          </span>

                          {overdue && (
                            <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                              Overdue
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-oxford-ash">
                          <span>
                            Target:{' '}
                            {formatDate(
                              milestone.target_date
                            )}
                          </span>

                          {milestone.status ===
                            'completed' && (
                            <span>
                              Completed:{' '}
                              {formatDate(
                                milestone.completed_on
                              )}
                            </span>
                          )}
                        </div>

                        {milestone.notes && (
                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-oxford-charcoal">
                            {
                              milestone.notes
                            }
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {milestone.status ===
                          'planned' && (
                          <>
                            <form
                              action={
                                completeMilestone
                              }
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
                                name="milestone_id"
                                value={
                                  milestone.id
                                }
                              />

                              <Button
                                type="submit"
                                variant="secondary"
                              >
                                Complete
                              </Button>
                            </form>

                            <form
                              action={
                                cancelMilestone
                              }
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
                                name="milestone_id"
                                value={
                                  milestone.id
                                }
                              />

                              <Button
                                type="submit"
                                variant="ghost"
                              >
                                Cancel
                              </Button>
                            </form>
                          </>
                        )}

                        {milestone.status !==
                          'planned' && (
                          <form
                            action={
                              reopenMilestone
                            }
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
                              name="milestone_id"
                              value={
                                milestone.id
                              }
                            />

                            <Button
                              type="submit"
                              variant="secondary"
                            >
                              Reopen
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-oxford-stone pt-4">
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                          Edit milestone
                        </summary>

                        <form
                          action={
                            updateMilestone
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
                            name="milestone_id"
                            value={
                              milestone.id
                            }
                          />

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`milestone-title-${milestone.id}`}
                              className={
                                labelClass
                              }
                            >
                              Title
                            </label>

                            <input
                              id={`milestone-title-${milestone.id}`}
                              name="title"
                              type="text"
                              required
                              defaultValue={
                                milestone.title
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`milestone-target-${milestone.id}`}
                              className={
                                labelClass
                              }
                            >
                              Target date
                            </label>

                            <input
                              id={`milestone-target-${milestone.id}`}
                              name="target_date"
                              type="date"
                              defaultValue={
                                milestone.target_date ??
                                ''
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`milestone-status-${milestone.id}`}
                              className={
                                labelClass
                              }
                            >
                              Status
                            </label>

                            <select
                              id={`milestone-status-${milestone.id}`}
                              name="status"
                              defaultValue={
                                milestone.status
                              }
                              className={
                                inputClass
                              }
                            >
                              <option value="planned">
                                Planned
                              </option>

                              <option value="completed">
                                Completed
                              </option>

                              <option value="cancelled">
                                Cancelled
                              </option>
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor={`milestone-completed-${milestone.id}`}
                              className={
                                labelClass
                              }
                            >
                              Completed date
                            </label>

                            <input
                              id={`milestone-completed-${milestone.id}`}
                              name="completed_on"
                              type="date"
                              defaultValue={
                                milestone.completed_on ??
                                ''
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`milestone-notes-${milestone.id}`}
                              className={
                                labelClass
                              }
                            >
                              Notes
                            </label>

                            <textarea
                              id={`milestone-notes-${milestone.id}`}
                              name="notes"
                              rows={4}
                              defaultValue={
                                milestone.notes ??
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
                              Save milestone
                            </Button>
                          </div>
                        </form>
                      </details>

                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                          Delete milestone
                        </summary>

                        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
                          <p className="text-sm text-red-800">
                            This permanently
                            removes this
                            milestone. This
                            action is intended
                            for erroneous
                            milestone records.
                          </p>

                          <form
                            action={
                              deleteMilestone
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
                              name="milestone_id"
                              value={
                                milestone.id
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