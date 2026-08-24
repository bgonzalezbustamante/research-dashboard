'use client'

import Link from 'next/link'
import { useState } from 'react'

import {
  createPlanningAllocation,
  deletePlanningAllocation,
  updatePlanningAllocation,
} from '@/app/(protected)/planning/actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

type AllocationType =
  | 'paper'
  | 'blocked'

type BlockedType =
  | 'teaching'
  | 'conference'
  | 'holiday'
  | 'administrative'

type PaperOption = {
  id: string
  short_title: string
  title: string
  archived_at: string | null
}

type PlanningAllocation = {
  id: string
  allocation_type: AllocationType
  blocked_type: BlockedType | null
  committed_days: number
  flowsavvy_added: boolean
  flowsavvy_added_at: string | null
  notes: string | null
  paper_id: string | null
  paper_short_title: string | null
  paper_title: string | null
  paper_archived: boolean
}

type PlanningWorkspaceProps = {
  periodStart: string
  periodEnd: string
  allocations: PlanningAllocation[]
  availablePapers: PaperOption[]
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
  if (days === 5) {
    return 'border-green-200 bg-green-50 text-green-800'
  }

  if (days === 10) {
    return 'border-yellow-200 bg-yellow-50 text-yellow-800'
  }

  return 'border-orange-200 bg-orange-50 text-orange-800'
}

export default function PlanningWorkspace({
  periodStart,
  periodEnd,
  allocations,
  availablePapers,
  error,
}: PlanningWorkspaceProps) {
  const usedBlockedTypes =
    new Set(
      allocations
        .filter(
          (allocation) =>
            allocation.allocation_type ===
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

  const defaultType: AllocationType =
    availablePapers.length > 0
      ? 'paper'
      : 'blocked'

  const [
    allocationType,
    setAllocationType,
  ] = useState<AllocationType>(
    defaultType
  )

  const effectiveType:
    AllocationType =
    allocationType === 'paper' &&
    availablePapers.length === 0
      ? 'blocked'
      : allocationType ===
            'blocked' &&
          availableBlockedOptions.length ===
            0
        ? 'paper'
        : allocationType

  const canAdd =
    availablePapers.length > 0 ||
    availableBlockedOptions.length > 0

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
            Add allocation
          </h2>

          <p className="mt-1 text-sm leading-5 text-oxford-ash">
            Allocate capacity to a
            paper or block time for
            another commitment.
          </p>

          {!canAdd ? (
            <div className="mt-4 rounded-md border border-oxford-stone bg-oxford-shell px-3 py-3 text-sm leading-6 text-oxford-ash">
              All available papers
              and blocked-time
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
                  htmlFor="allocation-type"
                  className={labelClass}
                >
                  Allocation type
                </label>

                <select
                  id="allocation-type"
                  name="allocation_type"
                  value={effectiveType}
                  onChange={(event) =>
                    setAllocationType(
                      event.target
                        .value as AllocationType
                    )
                  }
                  className={inputClass}
                >
                  {availablePapers.length >
                    0 && (
                    <option value="paper">
                      Paper
                    </option>
                  )}

                  {availableBlockedOptions.length >
                    0 && (
                    <option value="blocked">
                      Blocked time
                    </option>
                  )}
                </select>
              </div>

              {effectiveType ===
              'paper' ? (
                <div>
                  <label
                    htmlFor="planning-paper"
                    className={labelClass}
                  >
                    Paper
                  </label>

                  <select
                    id="planning-paper"
                    name="paper_id"
                    required
                    defaultValue=""
                    className={inputClass}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select paper
                    </option>

                    {availablePapers.map(
                      (paper) => (
                        <option
                          key={paper.id}
                          value={paper.id}
                        >
                          {paper.short_title}
                        </option>
                      )
                    )}
                  </select>
                </div>
              ) : (
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
              )}

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
                  placeholder={
                    effectiveType ===
                    'paper'
                      ? 'Optional planning note'
                      : 'e.g. APSA Annual Meeting'
                  }
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
                Add allocation
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
                    No allocations yet
                  </h2>

                  <p className="mt-1 text-sm text-oxford-ash">
                    Add a paper or
                    blocked time to
                    start planning
                    this half-month.
                  </p>
                </div>
              </Card>
            </div>
          ) : (
            allocations.map(
              (allocation) => {
                const isBlocked =
                  allocation.allocation_type ===
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
                                : 'rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900'
                            }
                          >
                            {isBlocked
                              ? 'Blocked'
                              : 'Paper'}
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

                    <div className="mt-3">
                      {allocation.flowsavvy_added ? (
                        <div className="text-sm text-green-800">
                          <div className="font-medium">
                            ☑ Added to
                            FlowSavvy/Calendar
                          </div>

                          {allocation.flowsavvy_added_at && (
                            <div className="mt-0.5 text-xs text-oxford-ash">
                              {formatTimestamp(
                                allocation.flowsavvy_added_at
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-oxford-ash">
                          ☐ Not added to
                          FlowSavvy/Calendar
                        </div>
                      )}
                    </div>

                    {allocation.notes && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-5 text-oxford-charcoal">
                        {allocation.notes}
                      </p>
                    )}

                    <div className="mt-3 border-t border-oxford-stone pt-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                            Edit
                          </summary>

                          <form
                            action={
                              updatePlanningAllocation
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
                              value={allocation.id}
                            />

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
                                value={allocation.id}
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
                  </Card>
                )
              }
            )
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-oxford-ash">
        Planning period: {periodStart}{' '}
        to {periodEnd}. Paper work and
        blocked commitments both
        consume planning capacity.
        Detailed scheduling remains in
        FlowSavvy/Calendar.
      </p>
    </section>
  )
}
