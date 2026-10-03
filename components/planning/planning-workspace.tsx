'use client'

import Link from 'next/link'

import {
  deletePlanningAllocation,
  setPlanningAllocationFlowSavvy,
} from '@/app/(protected)/planning/actions'
import {
  createPlanningBlockedEvent,
  deletePlanningBlockedEvent,
  updatePlanningBlockedEvent,
} from '@/app/(protected)/planning/blocked-event-actions'
import { setPlanningSourceFlowSavvy } from '@/app/(protected)/planning/source-flow-actions'
import { updatePlanningAllocationWithPeriod } from '@/app/(protected)/planning/update-allocation-action'
import { setMilestoneFlowSavvy } from '@/app/(protected)/papers/milestone-actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

type AllocationType =
  | 'paper'
  | 'blocked'

type AllocationSource =
  | 'milestone'
  | 'legacy'
  | 'legacy_blocked'
  | 'conference'
  | 'teaching'
  | 'blocked_event'

type PlanningSourceType =
  | 'conference'
  | 'teaching'
  | 'blocked_event'

type BlockedType =
  | 'teaching'
  | 'conference'
  | 'holiday'
  | 'winter_holiday'
  | 'summer_holiday'
  | 'administrative'
  | 'sick'

type PlanningMilestone = {
  id: string
  paper_id: string
  title: string
  target_date: string
  committed_days: number
  flowsavvy_added: boolean
  flowsavvy_added_at: string | null
}

type PlanningAllocation = {
  id: string
  allocation_type: AllocationType
  source: AllocationSource
  blocked_type: BlockedType | null
  committed_days: number
  flowsavvy_added: boolean
  flowsavvy_added_at: string | null
  flowsavvy_count: number
  flowsavvy_total: number
  notes: string | null
  paper_id: string | null
  paper_short_title: string | null
  paper_title: string | null
  paper_archived: boolean
  milestones: PlanningMilestone[]
  source_type: PlanningSourceType | null
  source_id: string | null
  label: string | null
  subtitle: string | null
  source_href: string | null
  range_start: string | null
  range_end: string | null
  dated_days: string[]
}

type PlanningOverlap = {
  date: string
  allocations: {
    id: string
    label: string
  }[]
}

type PlanningWorkspaceProps = {
  periodStart: string
  periodEnd: string
  allocations: PlanningAllocation[]
  overlaps: PlanningOverlap[]
  error?: string
}

const blockedEventOptions = [
  {
    value: 'winter_holiday',
    label: 'Winter holiday',
  },
  {
    value: 'summer_holiday',
    label: 'Summer holiday',
  },
  {
    value: 'administrative',
    label: 'Administrative',
  },
  {
    value: 'sick',
    label: 'Sick',
  },
] as const

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function formatTimestamp(
  value: string
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      timeZone:
        'Europe/Amsterdam',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(new Date(value))
}

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
      day: 'numeric',
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

function formatDateRange(
  startDate: string,
  endDate: string
) {
  return startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(
        startDate
      )} – ${formatDate(
        endDate
      )}`
}

function getBlockedLabel(
  value: BlockedType | null
) {
  switch (value) {
    case 'teaching':
      return 'Teaching'
    case 'conference':
      return 'Conference'
    case 'winter_holiday':
      return 'Winter holiday'
    case 'summer_holiday':
      return 'Summer holiday'
    case 'administrative':
      return 'Administrative'
    case 'sick':
      return 'Sick'
    case 'holiday':
      return 'Holiday'
    default:
      return 'Blocked time'
  }
}

function getAllocationPresentation(
  days: number
) {
  if (days <= 5) {
    return 'border-green-200 bg-green-50 text-green-800'
  }

  if (days <= 10) {
    return 'border-yellow-200 bg-yellow-50 text-yellow-800'
  }

  return 'border-orange-200 bg-orange-50 text-orange-800'
}

function getPeriodEnd(
  periodStart: string
) {
  const [
    year,
    month,
    day,
  ] = periodStart
    .split('-')
    .map(Number)

  if (day === 1) {
    return `${periodStart.slice(
      0,
      8
    )}15`
  }

  return new Date(
    Date.UTC(
      year,
      month,
      0
    )
  )
    .toISOString()
    .slice(0, 10)
}

function formatPeriodOption(
  periodStart: string
) {
  const periodEnd =
    getPeriodEnd(periodStart)

  const [
    year,
    month,
  ] = periodStart
    .split('-')
    .map(Number)

  const monthLabel =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        month: 'long',
        year: 'numeric',
      }
    ).format(
      new Date(
        Date.UTC(
          year,
          month - 1,
          1
        )
      )
    )

  return `${Number(
    periodStart.slice(8, 10)
  )}–${Number(
    periodEnd.slice(8, 10)
  )} ${monthLabel}`
}

function getPeriodOptions(
  periodStart: string
) {
  const selectedYear =
    Number(
      periodStart.slice(
        0,
        4
      )
    )

  const options: {
    value: string
    label: string
  }[] = []

  for (
    let year =
      selectedYear - 1;
    year <= selectedYear + 1;
    year += 1
  ) {
    for (
      let month = 1;
      month <= 12;
      month += 1
    ) {
      const monthText =
        String(
          month
        ).padStart(
          2,
          '0'
        )

      for (const day of [
        '01',
        '16',
      ]) {
        const value =
          `${year}-${monthText}-${day}`

        options.push({
          value,
          label:
            formatPeriodOption(
              value
            ),
        })
      }
    }
  }

  return options
}

function flowPresentation(
  allocation: PlanningAllocation
) {
  if (
    allocation.flowsavvy_count ===
    allocation.flowsavvy_total
  ) {
    return {
      icon: '☑',
      label: 'Added to FlowSavvy/Calendar',
      className:
        'font-medium text-green-800',
    }
  }

  if (
    allocation.flowsavvy_count >
    0
  ) {
    return {
      icon: '◐',
      label: 'Partially added to FlowSavvy/Calendar',
      className:
        'font-medium text-amber-800',
    }
  }

  return {
    icon: '☐',
    label: 'Not added to FlowSavvy/Calendar',
    className:
      'text-oxford-ash',
  }
}

function sourceBadge(
  source: AllocationSource
) {
  switch (source) {
    case 'milestone':
      return {
        label: 'Milestone-backed',
        className:
          'border-sky-200 bg-sky-50 text-sky-900',
      }
    case 'conference':
      return {
        label: 'Conference-backed',
        className:
          'border-violet-200 bg-violet-50 text-violet-800',
      }
    case 'teaching':
      return {
        label: 'Teaching-backed',
        className:
          'border-indigo-200 bg-indigo-50 text-indigo-800',
      }
    case 'blocked_event':
      return {
        label: 'Dated blocked time',
        className:
          'border-gray-300 bg-gray-100 text-gray-700',
      }
    default:
      return {
        label: 'Legacy manual',
        className:
          'border-amber-200 bg-amber-50 text-amber-800',
      }
  }
}

export default function PlanningWorkspace({
  periodStart,
  periodEnd,
  allocations,
  overlaps,
  error,
}: PlanningWorkspaceProps) {
  const periodOptions =
    getPeriodOptions(
      periodStart
    )

  return (
    <section
      id="allocations"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-5">
        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Planning commitments
        </h2>

        <p className="mt-1 text-sm leading-6 text-oxford-ash">
          Research, conference attendance,
          Teaching schedules, and dated
          blocked events are derived from
          their source records. Legacy
          manual allocations remain
          available for continuity.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {overlaps.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <div className="font-medium">
            Overlapping dated commitments
          </div>

          <p className="mt-1 text-sm leading-6">
            Overlaps remain additive in
            capacity calculations; they are
            flagged here rather than
            silently deduplicated.
          </p>

          <ul className="mt-2 space-y-1 text-sm">
            {overlaps.map(
              (overlap) => (
                <li
                  key={
                    overlap.date
                  }
                >
                  <strong>
                    {formatDate(
                      overlap.date
                    )}
                  </strong>
                  :{' '}
                  {overlap.allocations
                    .map(
                      (item) =>
                        item.label
                    )
                    .join(' + ')}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(250px,0.7fr)_minmax(0,2.3fr)]">
        <Card className="h-fit">
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            Add dated blocked event
          </h3>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Winter and Summer holidays,
            Administrative commitments,
            and Sick periods are stored
            with exact inclusive dates and
            allocated automatically across
            Planning periods.
          </p>

          <form
            action={
              createPlanningBlockedEvent
            }
            className="mt-4 space-y-4"
          >
            <input
              type="hidden"
              name="period_start"
              value={periodStart}
            />

            <div>
              <label
                htmlFor="blocked-event-type"
                className={labelClass}
              >
                Category
              </label>

              <select
                id="blocked-event-type"
                name="event_type"
                required
                defaultValue="winter_holiday"
                className={inputClass}
              >
                {blockedEventOptions.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="grid gap-4">
              <div>
                <label
                  htmlFor="blocked-event-start"
                  className={labelClass}
                >
                  Start date
                </label>

                <input
                  id="blocked-event-start"
                  name="start_date"
                  type="date"
                  required
                  defaultValue={
                    periodStart
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="blocked-event-end"
                  className={labelClass}
                >
                  End date
                </label>

                <input
                  id="blocked-event-end"
                  name="end_date"
                  type="date"
                  required
                  defaultValue={
                    periodEnd
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="blocked-event-notes"
                className={labelClass}
              >
                Notes
              </label>

              <textarea
                id="blocked-event-notes"
                name="notes"
                rows={3}
                className={inputClass}
              />
            </div>

            <Button type="submit">
              Add dated event
            </Button>
          </form>
        </Card>
          <div className="grid content-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {allocations.length === 0 ? (
            <div className="sm:col-span-2 2xl:col-span-3">
              <Card>
                <div className="py-7 text-center">
                  <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                    No commitments in this
                    period
                  </h3>
                  <p className="mt-1 text-sm text-oxford-ash">
                    Add or schedule work in its
                    source module to populate
                    this half-month.
                  </p>
                </div>
              </Card>
            </div>
          ) : (
            allocations.map(
              (allocation) => {
                const isMilestone =
                  allocation.source ===
                  'milestone'
                const isSource =
                  allocation.source_type !==
                  null
                const isLegacy =
                  allocation.source ===
                    'legacy' ||
                  allocation.source ===
                    'legacy_blocked'
                const isBlockedEvent =
                  allocation.source ===
                  'blocked_event'
  
                const title =
                  allocation.label ??
                  (
                    allocation.allocation_type ===
                      'blocked'
                      ? getBlockedLabel(
                          allocation.blocked_type
                        )
                      : allocation.paper_short_title
                  ) ??
                  'Unknown commitment'
  
                const subtitle =
                  allocation.subtitle ??
                  (
                    allocation.allocation_type ===
                      'paper'
                      ? allocation.paper_title
                      : isLegacy
                        ? 'Legacy manual blocked time'
                        : 'Blocked time'
                  ) ??
                  ''
  
                const flow =
                  flowPresentation(
                    allocation
                  )
                const badge =
                  sourceBadge(
                    allocation.source
                  )
  
                return (
                  <Card
                    key={
                      allocation.id
                    }
                    className="h-fit"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {allocation.paper_id ? (
                            <Link
                              href={`/papers/${allocation.paper_id}`}
                              className="font-medium text-oxford-blue hover:underline"
                            >
                              {title}
                            </Link>
                          ) : (
                            <h3 className="font-medium text-oxford-blue">
                              {title}
                            </h3>
                          )}
  
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
  
                        <p className="mt-1 text-xs leading-5 text-oxford-ash">
                          {subtitle}
                        </p>
                      </div>
  
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${getAllocationPresentation(
                          allocation.committed_days
                        )}`}
                      >
                        {
                          allocation.committed_days
                        }{' '}
                        {allocation.committed_days ===
                        1
                          ? 'day'
                          : 'days'}
                      </span>
                    </div>
  
                    {allocation.range_start &&
                      allocation.range_end && (
                      <p className="mt-2 text-sm text-oxford-charcoal">
                        {formatDateRange(
                          allocation.range_start,
                          allocation.range_end
                        )}
                      </p>
                    )}
  
                    {allocation.paper_archived && (
                      <span className="mt-2 inline-flex rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        Archived
                      </span>
                    )}
  
                    <div className="mt-3 text-sm">
                      <div
                        className={
                          flow.className
                        }
                      >
                        <span
                          aria-hidden="true"
                          className="mr-1.5"
                        >
                          {flow.icon}
                        </span>
                        {flow.label}
                        {allocation.flowsavvy_total >
                          1 && (
                          <>
                            {' '}
                            (
                            {
                              allocation.flowsavvy_count
                            }
                            /
                            {
                              allocation.flowsavvy_total
                            }
                            )
                          </>
                        )}
                      </div>
  
                      {allocation.flowsavvy_added_at && (
                        <div className="mt-0.5 text-xs text-oxford-ash">
                          {formatTimestamp(
                            allocation.flowsavvy_added_at
                          )}
                        </div>
                      )}
                    </div>
  
                    {isSource &&
                      allocation.source_type &&
                      allocation.source_id && (
                      <form
                        action={
                          setPlanningSourceFlowSavvy
                        }
                        className="mt-3"
                      >
                        <input
                          type="hidden"
                          name="period_start"
                          value={periodStart}
                        />
                        <input
                          type="hidden"
                          name="source_type"
                          value={
                            allocation.source_type
                          }
                        />
                        <input
                          type="hidden"
                          name="source_id"
                          value={
                            allocation.source_id
                          }
                        />
                        <input
                          type="hidden"
                          name="flowsavvy_added"
                          value={
                            allocation.flowsavvy_added
                              ? 'false'
                              : 'true'
                          }
                        />
  
                        <Button
                          type="submit"
                          size="compact"
                          variant={
                            allocation.flowsavvy_added
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {allocation.flowsavvy_added
                            ? 'Mark not added'
                            : 'Mark added'}
                        </Button>
                      </form>
                    )}
  
                    {isLegacy && (
                      <form
                        action={
                          setPlanningAllocationFlowSavvy
                        }
                        className="mt-3"
                      >
                        <input
                          type="hidden"
                          name="period_start"
                          value={periodStart}
                        />
                        <input
                          type="hidden"
                          name="allocation_id"
                          value={
                            allocation.id
                          }
                        />
                        <input
                          type="hidden"
                          name="flowsavvy_added"
                          value={
                            allocation.flowsavvy_added
                              ? 'false'
                              : 'true'
                          }
                        />
  
                        <Button
                          type="submit"
                          size="compact"
                          variant={
                            allocation.flowsavvy_added
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {allocation.flowsavvy_added
                            ? 'Mark not added'
                            : 'Mark added'}
                        </Button>
                      </form>
                    )}
  
                    {isMilestone && (
                      <div className="mt-4 space-y-3 border-t border-oxford-stone pt-3">
                        {allocation.milestones.map(
                          (milestone) => (
                            <div
                              key={
                                milestone.id
                              }
                              className="rounded-md bg-oxford-shell px-3 py-2.5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-oxford-charcoal">
                                    {
                                      milestone.title
                                    }
                                  </div>
                                  <div className="mt-1 text-xs text-oxford-ash">
                                    {formatDate(
                                      milestone.target_date
                                    )}{' '}
                                    ·{' '}
                                    {
                                      milestone.committed_days
                                    }
                                    d
                                  </div>
                                </div>
  
                                <form
                                  action={
                                    setMilestoneFlowSavvy
                                  }
                                >
                                  <input
                                    type="hidden"
                                    name="paper_id"
                                    value={
                                      milestone.paper_id
                                    }
                                  />
                                  <input
                                    type="hidden"
                                    name="milestone_id"
                                    value={
                                      milestone.id
                                    }
                                  />
                                  <input
                                    type="hidden"
                                    name="period_start"
                                    value={
                                      periodStart
                                    }
                                  />
                                  <input
                                    type="hidden"
                                    name="flowsavvy_added"
                                    value={
                                      milestone.flowsavvy_added
                                        ? 'false'
                                        : 'true'
                                    }
                                  />
  
                                  <Button
                                    type="submit"
                                    size="compact"
                                    variant={
                                      milestone.flowsavvy_added
                                        ? 'warning'
                                        : 'success'
                                    }
                                  >
                                    {milestone.flowsavvy_added
                                      ? 'Mark not added'
                                      : 'Mark added'}
                                  </Button>
                                </form>
                              </div>
                            </div>
                          )
                        )}
  
                        {allocation.paper_id && (
                          <Link
                            href={`/papers/${allocation.paper_id}#milestones`}
                            className="inline-flex text-sm font-medium text-oxford-blue hover:underline"
                          >
                            Edit milestones
                          </Link>
                        )}
                      </div>
                    )}
  
                    {allocation.notes && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-5 text-oxford-charcoal">
                        {allocation.notes}
                      </p>
                    )}
  
                    {isSource &&
                      !isBlockedEvent &&
                      allocation.source_href && (
                      <div className="mt-4 border-t border-oxford-stone pt-3">
                        <Link
                          href={
                            allocation.source_href
                          }
                          className="text-sm font-medium text-oxford-blue hover:underline"
                        >
                          Edit source
                        </Link>
                      </div>
                    )}
  
                    {isBlockedEvent &&
                      allocation.source_id &&
                      allocation.range_start &&
                      allocation.range_end && (
                      <div className="mt-4 border-t border-oxford-stone pt-3">
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                            Edit dated event
                          </summary>
  
                          <form
                            action={
                              updatePlanningBlockedEvent
                            }
                            className="mt-3 space-y-3"
                          >
                            <input
                              type="hidden"
                              name="period_start"
                              value={periodStart}
                            />
                            <input
                              type="hidden"
                              name="event_id"
                              value={
                                allocation.source_id
                              }
                            />
  
                            <select
                              name="event_type"
                              defaultValue={
                                allocation.blocked_type ??
                                'winter_holiday'
                              }
                              className={inputClass}
                            >
                              {blockedEventOptions.map(
                                (option) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                  >
                                    {
                                      option.label
                                    }
                                  </option>
                                )
                              )}
                            </select>
  
                            <div className="grid gap-3 sm:grid-cols-2">
                              <input
                                name="start_date"
                                type="date"
                                required
                                defaultValue={
                                  allocation.range_start
                                }
                                className={inputClass}
                              />
                              <input
                                name="end_date"
                                type="date"
                                required
                                defaultValue={
                                  allocation.range_end
                                }
                                className={inputClass}
                              />
                            </div>
  
                            <textarea
                              name="notes"
                              rows={3}
                              defaultValue={
                                allocation.notes ??
                                ''
                              }
                              className={inputClass}
                            />
  
                            <Button type="submit">
                              Save dated event
                            </Button>
                          </form>
                        </details>
  
                        <form
                          action={
                            deletePlanningBlockedEvent
                          }
                          className="mt-3"
                        >
                          <input
                            type="hidden"
                            name="period_start"
                            value={periodStart}
                          />
                          <input
                            type="hidden"
                            name="event_id"
                            value={
                              allocation.source_id
                            }
                          />
  
                          <Button
                            type="submit"
                            size="compact"
                            variant="danger"
                          >
                            Delete dated event
                          </Button>
                        </form>
                      </div>
                    )}
  
                    {isLegacy && (
                      <div className="mt-4 border-t border-oxford-stone pt-3">
                        <p className="mb-3 text-xs leading-5 text-amber-800">
                          Preserved from the
                          previous manual Planning
                          workflow. New commitments
                          are source-backed.
                        </p>
  
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                            Edit legacy allocation
                          </summary>
  
                          <form
                            action={
                              updatePlanningAllocationWithPeriod
                            }
                            className="mt-3 space-y-3"
                          >
                            <input
                              type="hidden"
                              name="period_start"
                              value={periodStart}
                            />
                            <input
                              type="hidden"
                              name="allocation_id"
                              value={
                                allocation.id
                              }
                            />
  
                            <div>
                              <label
                                className={labelClass}
                              >
                                Period
                              </label>
                              <select
                                name="target_period_start"
                                defaultValue={
                                  periodStart
                                }
                                className={inputClass}
                              >
                                {periodOptions.map(
                                  (option) => (
                                    <option
                                      key={
                                        option.value
                                      }
                                      value={
                                        option.value
                                      }
                                    >
                                      {
                                        option.label
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
  
                            <div>
                              <label
                                className={labelClass}
                              >
                                Committed days
                              </label>
                              <select
                                name="committed_days"
                                defaultValue={String(
                                  allocation.committed_days
                                )}
                                className={inputClass}
                              >
                                {[5, 10, 15].map(
                                  (days) => (
                                    <option
                                      key={
                                        days
                                      }
                                      value={
                                        days
                                      }
                                    >
                                      {days} days
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
  
                            <textarea
                              name="notes"
                              rows={3}
                              defaultValue={
                                allocation.notes ??
                                ''
                              }
                              className={inputClass}
                            />
  
                            <label className="flex items-start gap-3 text-sm text-oxford-charcoal">
                              <input
                                type="checkbox"
                                name="flowsavvy_added"
                                defaultChecked={
                                  allocation.flowsavvy_added
                                }
                                className="mt-0.5 h-4 w-4 rounded border-oxford-stone"
                              />
                              Added to
                              FlowSavvy/Calendar
                            </label>
  
                            <Button type="submit">
                              Save legacy allocation
                            </Button>
                          </form>
                        </details>
  
                        <form
                          action={
                            deletePlanningAllocation
                          }
                          className="mt-3"
                        >
                          <input
                            type="hidden"
                            name="period_start"
                            value={periodStart}
                          />
                          <input
                            type="hidden"
                            name="allocation_id"
                            value={
                              allocation.id
                            }
                          />
  
                          <Button
                            type="submit"
                            size="compact"
                            variant="danger"
                          >
                            Delete legacy allocation
                          </Button>
                        </form>
                      </div>
                    )}
                  </Card>
                )
              }
            )
          )}
        </div>
      </div>

      <Card className="mt-6">
        <h3 className="font-serif text-xl font-semibold text-oxford-blue">
          Automatic sources
        </h3>

        <div className="mt-4 grid gap-4 text-sm leading-6 text-oxford-charcoal md:grid-cols-3">
          <div>
            <Link
              href="/conferences"
              className="font-medium text-oxford-blue hover:underline"
            >
              Conferences
            </Link>
            <p className="text-oxford-ash">
              Personal attendance uses the
              exact event dates. Trips add
              one travel day before and
              after.
            </p>
          </div>

          <div>
            <Link
              href="/teaching"
              className="font-medium text-oxford-blue hover:underline"
            >
              Teaching Portfolio
            </Link>
            <p className="text-oxford-ash">
              Active months recur within
              the portfolio period. One or
              two committed days per week
              become two or four days per
              half-month.
            </p>
          </div>

          <div>
            <Link
              href="/papers"
              className="font-medium text-oxford-blue hover:underline"
            >
              Paper Milestones
            </Link>
            <p className="text-oxford-ash">
              Capacity-bearing planned
              milestones remain the source
              of research commitments.
            </p>
          </div>
        </div>
      </Card>

      <p className="mt-4 text-xs leading-5 text-oxford-ash">
        Selected Planning period:{' '}
        {formatDate(periodStart)} to{' '}
        {formatDate(periodEnd)}. Dated
        commitments use inclusive calendar
        days, including weekends. Overlaps
        are additive.
      </p>
    </section>
  )
}
