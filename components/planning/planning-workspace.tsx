'use client'

import Link from 'next/link'

import {
  createPlanningAllocation,
  deletePlanningAllocation,
} from '@/app/(protected)/planning/actions'
import { updatePlanningAllocationWithPeriod } from '@/app/(protected)/planning/update-allocation-action'
import { setMilestoneFlowSavvy } from '@/app/(protected)/papers/milestone-actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

type AllocationType =
  | 'paper'
  | 'blocked'

type AllocationSource =
  | 'milestone'
  | 'blocked'
  | 'legacy'

type BlockedType =
  | 'teaching'
  | 'conference'
  | 'holiday'
  | 'administrative'

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
}

type PlanningWorkspaceProps = {
  periodStart: string
  periodEnd: string
  allocations: PlanningAllocation[]
  error?: string
}

const blockedOptions: {
  value: BlockedType
  label: string
}[] = [
  {
    value: 'teaching',
    label: 'Teaching',
  },
  {
    value: 'conference',
    label: 'Conference',
  },
  {
    value: 'holiday',
    label: 'Holiday',
  },
  {
    value: 'administrative',
    label: 'Administrative',
  },
]

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
  const [year, month, day] =
    value
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

function getBlockedLabel(
  value: BlockedType | null
) {
  return (
    blockedOptions.find(
      (option) =>
        option.value === value
    )?.label ?? 'Blocked time'
  )
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
  const [year, month, day] =
    periodStart
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

  const startDay = Number(
    periodStart.slice(8, 10)
  )

  const endDay = Number(
    periodEnd.slice(8, 10)
  )

  const [year, month] =
    periodStart
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

  return `${startDay}–${endDay} ${monthLabel}`
}

function getPeriodOptions(
  periodStart: string
) {
  const selectedYear = Number(
    periodStart.slice(0, 4)
  )

  const options: {
    value: string
    label: string
  }[] = []

  for (
    let year = selectedYear - 1;
    year <= selectedYear + 1;
    year += 1
  ) {
    for (
      let month = 1;
      month <= 12;
      month += 1
    ) {
      const monthString = String(
        month
      ).padStart(2, '0')

      for (const day of [1, 16]) {
        const dayString = String(
          day
        ).padStart(2, '0')

        const value =
          `${year}-${monthString}-${dayString}`

        options.push({
          value,
          label:
            formatPeriodOption(value),
        })
      }
    }
  }

  return options
}

function getFlowSavvyLabel(
  allocation: PlanningAllocation
) {
  if (
    allocation.flowsavvy_total <= 1
  ) {
    return allocation.flowsavvy_added
      ? 'Added'
      : 'Not added'
  }

  if (
    allocation.flowsavvy_count ===
    allocation.flowsavvy_total
  ) {
    return 'Added'
  }

  if (
    allocation.flowsavvy_count === 0
  ) {
    return 'Not added'
  }

  return 'Partial'
}

export default function PlanningWorkspace({
  periodStart,
  periodEnd,
  allocations,
  error,
}: PlanningWorkspaceProps) {
  const usedBlockedTypes =
    new Set(
      allocations
        .filter(
          (allocation) =>
            allocation.source ===
            'blocked'
        )
        .map(
          (allocation) =>
            allocation.blocked_type
        )
        .filter(
          (
            value
          ): value is BlockedType =>
            value !== null
        )
    )

  const availableBlockedOptions =
    blockedOptions.filter(
      (option) =>
        !usedBlockedTypes.has(
          option.value
        )
    )

  const periodOptions =
    getPeriodOptions(periodStart)

  return (
    <section
      id="allocations"
      className="scroll-mt-6"
    >
      {error && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,2fr)]">
        <Card>
          <h2 className="font-serif text-lg font-semibold text-oxford-blue">
            Add blocked time
          </h2>

          <p className="mt-1 text-sm leading-5 text-oxford-ash">
            Paper capacity comes from
            planned milestones.
            Add non-research
            commitments here.
          </p>

          {availableBlockedOptions.length ===
          0 ? (
            <div className="mt-4 rounded-md border border-oxford-stone bg-oxford-shell px-3 py-3 text-sm leading-6 text-oxford-ash">
              All blocked-time
              categories are already
              allocated in this
              period.
            </div>
          ) : (
            <form
              action={
                createPlanningAllocation
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
                  htmlFor="blocked-type"
                  className={labelClass}
                >
                  Blocked time
                </label>

                <select
                  id="blocked-type"
                  name="blocked_type"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option
                    value=""
                    disabled
                  >
                    Select category
                  </option>

                  {availableBlockedOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="planning-days"
                  className={labelClass}
                >
                  Committed days
                </label>

                <select
                  id="planning-days"
                  name="committed_days"
                  defaultValue="5"
                  className={inputClass}
                >
                  <option value="5">
                    5 days
                  </option>

                  <option value="10">
                    10 days
                  </option>

                  <option value="15">
                    15 days
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="planning-notes"
                  className={labelClass}
                >
                  Notes
                </label>

                <textarea
                  id="planning-notes"
                  name="notes"
                  rows={3}
                  placeholder="e.g. APSA Annual Meeting"
                  className={inputClass}
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-oxford-charcoal">
                <input
                  type="checkbox"
                  name="flowsavvy_added"
                  className="mt-0.5 h-4 w-4 rounded border-oxford-stone"
                />

                <span>
                  Already added to
                  FlowSavvy/Calendar
                </span>
              </label>

              <Button
                type="submit"
                variant="primary"
              >
                Add blocked time
              </Button>
            </form>
          )}
        </Card>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          {allocations.length === 0 ? (
            <div className="sm:col-span-2">
              <Card>
                <div className="py-7 text-center">
                  <h2 className="font-serif text-lg font-semibold text-oxford-blue">
                    No commitments yet
                  </h2>

                  <p className="mt-1 text-sm text-oxford-ash">
                    Add capacity-bearing
                    milestones in Papers
                    or blocked time here
                    to populate this
                    half-month.
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

                const isLegacy =
                  allocation.source ===
                  'legacy'

                const isBlocked =
                  allocation.source ===
                  'blocked'

                const title =
                  isBlocked
                    ? getBlockedLabel(
                        allocation.blocked_type
                      )
                    : allocation.paper_short_title ??
                      'Unknown paper'

                const subtitle =
                  isBlocked
                    ? 'Blocked time'
                    : allocation.paper_title ??
                      'Paper unavailable'

                return (
                  <Card
                    key={allocation.id}
                    className="h-fit"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {!isBlocked &&
                          allocation.paper_id ? (
                            <Link
                              href={`/papers/${allocation.paper_id}`}
                              className="font-medium text-oxford-blue transition hover:underline"
                            >
                              {title}
                            </Link>
                          ) : (
                            <h2 className="font-medium text-oxford-blue">
                              {title}
                            </h2>
                          )}

                          <span
                            className={
                              isBlocked
                                ? 'rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700'
                                : isMilestone
                                  ? 'rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900'
                                  : 'rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800'
                            }
                          >
                            {isBlocked
                              ? 'Blocked'
                              : isMilestone
                                ? 'Milestone-backed'
                                : 'Legacy manual'}
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-oxford-ash">
                          {subtitle}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${getAllocationPresentation(
                          allocation.committed_days
                        )}`}
                      >
                        {allocation.committed_days}{' '}
                        days
                      </span>
                    </div>

                    {!isBlocked &&
                      allocation.paper_archived && (
                        <span className="mt-2 inline-flex rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Archived
                        </span>
                      )}

                    <div className="mt-3 text-sm">
                      <div
                        className={
                          allocation.flowsavvy_count ===
                          allocation.flowsavvy_total
                            ? 'font-medium text-green-800'
                            : allocation.flowsavvy_count >
                                0
                              ? 'font-medium text-amber-800'
                              : 'text-oxford-ash'
                        }
                      >
                        FlowSavvy/Calendar:{' '}
                        {getFlowSavvyLabel(
                          allocation
                        )}
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

                      {!isMilestone &&
                        allocation.flowsavvy_added_at && (
                          <div className="mt-0.5 text-xs text-oxford-ash">
                            {formatTimestamp(
                              allocation.flowsavvy_added_at
                            )}
                          </div>
                        )}
                    </div>

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
                                <div className="min-w-0">
                                  <div className="font-medium text-sm text-oxford-charcoal">
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
                                    variant="secondary"
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

                        <Link
                          href={`/papers/${allocation.paper_id}#milestones`}
                          className="inline-flex text-sm font-medium text-oxford-blue hover:underline"
                        >
                          Edit milestones
                        </Link>
                      </div>
                    )}

                    {!isMilestone &&
                      allocation.notes && (
                        <p className="mt-3 whitespace-pre-line text-sm leading-5 text-oxford-charcoal">
                          {allocation.notes}
                        </p>
                      )}

                    {!isMilestone && (
                      <div className="mt-3 border-t border-oxford-stone pt-3">
                        {isLegacy && (
                          <p className="mb-3 text-xs leading-5 text-amber-800">
                            Preserved from the
                            previous manual paper
                            planning workflow.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          <details>
                            <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                              Edit
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
                                  htmlFor={`planning-period-${allocation.id}`}
                                  className={labelClass}
                                >
                                  Period
                                </label>

                                <select
                                  id={`planning-period-${allocation.id}`}
                                  name="target_period_start"
                                  defaultValue={periodStart}
                                  className={inputClass}
                                >
                                  {periodOptions.map(
                                    (option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>

                              <div>
                                <label
                                  htmlFor={`planning-days-${allocation.id}`}
                                  className={labelClass}
                                >
                                  Committed days
                                </label>

                                <select
                                  id={`planning-days-${allocation.id}`}
                                  name="committed_days"
                                  defaultValue={String(
                                    allocation.committed_days
                                  )}
                                  className={inputClass}
                                >
                                  <option value="5">
                                    5 days
                                  </option>

                                  <option value="10">
                                    10 days
                                  </option>

                                  <option value="15">
                                    15 days
                                  </option>
                                </select>
                              </div>

                              <div>
                                <label
                                  htmlFor={`planning-notes-${allocation.id}`}
                                  className={labelClass}
                                >
                                  Notes
                                </label>

                                <textarea
                                  id={`planning-notes-${allocation.id}`}
                                  name="notes"
                                  rows={3}
                                  defaultValue={
                                    allocation.notes ?? ''
                                  }
                                  className={inputClass}
                                />
                              </div>

                              <label className="flex items-start gap-3 text-sm text-oxford-charcoal">
                                <input
                                  type="checkbox"
                                  name="flowsavvy_added"
                                  defaultChecked={
                                    allocation.flowsavvy_added
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-oxford-stone"
                                />

                                <span>
                                  Added to
                                  FlowSavvy/Calendar
                                </span>
                              </label>

                              <Button
                                type="submit"
                                variant="primary"
                              >
                                Save allocation
                              </Button>
                            </form>
                          </details>

                          <details>
                            <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                              Delete
                            </summary>

                            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
                              <p className="text-xs leading-5 text-red-800">
                                Remove this
                                allocation from the
                                selected planning
                                period.
                              </p>

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
                                  variant="danger"
                                >
                                  Confirm delete
                                </Button>
                              </form>
                            </div>
                          </details>
                        </div>
                      </div>
                    )}
                  </Card>
                )
              }
            )
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-oxford-ash">
        Planning period: {periodStart}{' '}
        to {periodEnd}. Research
        capacity is derived from
        planned milestones with
        committed days; Blocked Time
        is managed here. Legacy manual
        paper allocations remain
        available for historical
        continuity.
      </p>
    </section>
  )
}
