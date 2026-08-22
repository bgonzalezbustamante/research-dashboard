import Link from 'next/link'

import Card from '@/components/ui/card'

type AllocationType =
  | 'paper'
  | 'blocked'

type BlockedType =
  | 'teaching'
  | 'conference'
  | 'holiday'
  | 'administrative'

type AnalyticsAllocation = {
  id: string
  allocation_type:
    AllocationType
  blocked_type:
    BlockedType | null
  committed_days: number
  flowsavvy_added: boolean
  paper_id: string | null
  paper_short_title:
    string | null
}

type AnalyticsPeriod = {
  id: string
  period_start: string
  period_end: string
  allocations:
    AnalyticsAllocation[]
}

type ActualPaperHours = {
  paper_id: string
  short_title: string
  minutes: number
}

type PlanningAnalyticsSectionProps = {
  selectedPeriodStart: string
  selectedPeriodEnd: string
  periods: AnalyticsPeriod[]
  actualPaperHours:
    ActualPaperHours[]
}

type PeriodStats = {
  totalDays: number
  paperDays: number
  blockedDays: number
  allocationCount: number
  flowsavvyCount: number
}

const MINUTES_PER_PLANNED_DAY =
  8 * 60

function formatDateValue(
  date: Date
) {
  return date
    .toISOString()
    .slice(0, 10)
}

function getMonthEnd(
  year: number,
  month: number
) {
  return formatDateValue(
    new Date(
      Date.UTC(
        year,
        month,
        0
      )
    )
  )
}

function getBlockedLabel(
  value: BlockedType | null
) {
  switch (value) {
    case 'teaching':
      return 'Teaching'

    case 'conference':
      return 'Conference'

    case 'holiday':
      return 'Holiday'
    
    case 'administrative':
      return 'Administrative'

    default:
      return 'Blocked time'
  }
}

function formatDuration(
  minutes: number
) {
  if (minutes === 0) {
    return '0h'
  }

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

function formatSignedDuration(
  minutes: number
) {
  if (minutes === 0) {
    return '0h'
  }

  const sign =
    minutes > 0
      ? '+'
      : '−'

  return `${sign}${formatDuration(
    Math.abs(minutes)
  )}`
}

function formatMonth(
  year: number,
  month: number
) {
  return new Intl.DateTimeFormat(
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
}

function formatMonthShort(
  year: number,
  month: number
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      month: 'short',
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
}

function getPeriodStats(
  period:
    AnalyticsPeriod | undefined
): PeriodStats {
  const allocations =
    period?.allocations ??
    []

  const paperDays =
    allocations
      .filter(
        (allocation) =>
          allocation.allocation_type ===
          'paper'
      )
      .reduce(
        (
          total,
          allocation
        ) =>
          total +
          allocation.committed_days,
        0
      )

  const blockedDays =
    allocations
      .filter(
        (allocation) =>
          allocation.allocation_type ===
          'blocked'
      )
      .reduce(
        (
          total,
          allocation
        ) =>
          total +
          allocation.committed_days,
        0
      )

  return {
    totalDays:
      paperDays +
      blockedDays,

    paperDays,

    blockedDays,

    allocationCount:
      allocations.length,

    flowsavvyCount:
      allocations.filter(
        (allocation) =>
          allocation.flowsavvy_added
      ).length,
  }
}

function getPeriodTone(
  totalDays: number,
  selected = false
) {
  const ring =
    selected
      ? ' ring-2 ring-oxford-blue ring-offset-1'
      : ''

  if (totalDays === 0) {
    return (
      'border-oxford-stone bg-white' +
      ring
    )
  }

  if (totalDays <= 5) {
    return (
      'border-green-200 bg-green-50' +
      ring
    )
  }

  if (totalDays <= 10) {
    return (
      'border-yellow-200 bg-yellow-50' +
      ring
    )
  }

  return (
    'border-orange-200 bg-orange-50' +
    ring
  )
}

function getGapPresentation(
  plannedMinutes: number,
  actualMinutes: number,
  planned: boolean
) {
  if (!planned) {
    return {
      label: 'Unplanned',
      className:
        'border-amber-200 bg-amber-50 text-amber-800',
    }
  }

  const gap =
    actualMinutes -
    plannedMinutes

  const tolerance =
    plannedMinutes *
    0.1

  if (
    Math.abs(gap) <=
    tolerance
  ) {
    return {
      label: 'On plan',
      className:
        'border-green-200 bg-green-50 text-green-800',
    }
  }

  if (gap < 0) {
    return {
      label: 'Below plan',
      className:
        'border-sky-200 bg-sky-50 text-sky-900',
    }
  }

  return {
    label: 'Above plan',
    className:
      'border-orange-200 bg-orange-50 text-orange-800',
  }
}

export default function PlanningAnalyticsSection({
  selectedPeriodStart,
  selectedPeriodEnd,
  periods,
  actualPaperHours,
}: PlanningAnalyticsSectionProps) {
  const [
    selectedYear,
    selectedMonth,
  ] = selectedPeriodStart
    .split('-')
    .map(Number)

  const periodByStart =
    new Map(
      periods.map(
        (period) => [
          period.period_start,
          period,
        ]
      )
    )

  const firstHalfStart =
    `${selectedPeriodStart.slice(
      0,
      7
    )}-01`

  const firstHalfEnd =
    `${selectedPeriodStart.slice(
      0,
      7
    )}-15`

  const secondHalfStart =
    `${selectedPeriodStart.slice(
      0,
      7
    )}-16`

  const secondHalfEnd =
    getMonthEnd(
      selectedYear,
      selectedMonth
    )

  const monthlyPeriods = [
    {
      label: '1–15',
      start:
        firstHalfStart,
      end:
        firstHalfEnd,
    },
    {
      label: `16–${Number(
        secondHalfEnd.slice(
          8,
          10
        )
      )}`,
      start:
        secondHalfStart,
      end:
        secondHalfEnd,
    },
  ]

  const selectedPeriod =
    periodByStart.get(
      selectedPeriodStart
    )

  const selectedAllocations =
    selectedPeriod?.allocations ??
    []

  const selectedStats =
    getPeriodStats(
      selectedPeriod
    )

  const blockedAllocations =
    selectedAllocations.filter(
      (allocation) =>
        allocation.allocation_type ===
        'blocked'
    )

  const plannedPaperHours =
    new Map<
      string,
      {
        minutes: number
        shortTitle: string
      }
    >()

  for (const allocation of
    selectedAllocations) {
    if (
      allocation.allocation_type !==
        'paper' ||
      !allocation.paper_id
    ) {
      continue
    }

    plannedPaperHours.set(
      allocation.paper_id,
      {
        minutes:
          allocation.committed_days *
          MINUTES_PER_PLANNED_DAY,

        shortTitle:
          allocation.paper_short_title ??
          'Unknown paper',
      }
    )
  }

  const actualByPaper =
    new Map(
      actualPaperHours.map(
        (item) => [
          item.paper_id,
          item,
        ]
      )
    )

  const comparisonPaperIds =
    new Set<string>([
      ...plannedPaperHours.keys(),
      ...actualByPaper.keys(),
    ])

  const comparisonRows = [
    ...comparisonPaperIds,
  ]
    .map(
      (paperId) => {
        const planned =
          plannedPaperHours.get(
            paperId
          )

        const actual =
          actualByPaper.get(
            paperId
          )

        const plannedMinutes =
          planned?.minutes ??
          0

        const actualMinutes =
          actual?.minutes ??
          0

        return {
          paperId,

          shortTitle:
            planned?.shortTitle ??
            actual?.short_title ??
            'Unknown paper',

          plannedMinutes,

          actualMinutes,

          gapMinutes:
            actualMinutes -
            plannedMinutes,

          planned:
            Boolean(planned),
        }
      }
    )
    .sort((a, b) => {
      if (
        a.planned !==
        b.planned
      ) {
        return a.planned
          ? -1
          : 1
      }

      return a.shortTitle.localeCompare(
        b.shortTitle
      )
    })

  const totalActualMinutes =
    actualPaperHours.reduce(
      (
        total,
        paper
      ) =>
        total +
        paper.minutes,
      0
    )

  const plannedResearchMinutes =
    selectedStats.paperDays *
    MINUTES_PER_PLANNED_DAY

  const plannedBlockedMinutes =
    selectedStats.blockedDays *
    MINUTES_PER_PLANNED_DAY

  return (
    <section
      id="planning-analytics"
      className="mt-10 scroll-mt-6"
    >
      <div className="mb-5">
        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Planning views
        </h2>

        <p className="mt-1 text-sm text-oxford-ash">
          Review monthly capacity,
          annual planning patterns,
          and recorded paper effort.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <div>
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Monthly overview
            </h3>

            <p className="mt-1 text-sm text-oxford-ash">
              {formatMonth(
                selectedYear,
                selectedMonth
              )}
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {monthlyPeriods.map(
              (slot) => {
                const period =
                  periodByStart.get(
                    slot.start
                  )

                const stats =
                  getPeriodStats(
                    period
                  )

                const allocations =
                  period?.allocations ??
                  []

                const isSelected =
                  slot.start ===
                  selectedPeriodStart

                return (
                  <Link
                    key={
                      slot.start
                    }
                    href={`/planning?period=${slot.start}#allocations`}
                    className={`rounded-lg border p-4 transition hover:border-oxford-blue ${getPeriodTone(
                      stats.totalDays,
                      isSelected
                    )}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                          {
                            slot.label
                          }
                        </div>

                        <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                          {
                            stats.totalDays
                          }{' '}
                          planned days
                        </div>
                      </div>

                      {isSelected && (
                        <span className="rounded-full border border-oxford-blue/20 bg-white px-2 py-0.5 text-xs font-medium text-oxford-blue">
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-oxford-charcoal">
                      <span>
                        Research{' '}
                        <strong>
                          {
                            stats.paperDays
                          }
                          d
                        </strong>
                      </span>

                      <span>
                        Blocked{' '}
                        <strong>
                          {
                            stats.blockedDays
                          }
                          d
                        </strong>
                      </span>

                      <span>
                        FlowSavvy{' '}
                        <strong>
                          {
                            stats.flowsavvyCount
                          }
                          /
                          {
                            stats.allocationCount
                          }
                        </strong>
                      </span>
                    </div>

                    {allocations.length >
                    0 ? (
                      <div className="mt-4 space-y-1.5 border-t border-black/10 pt-3 text-xs text-oxford-charcoal">
                        {allocations.map(
                          (
                            allocation
                          ) => (
                            <div
                              key={
                                allocation.id
                              }
                              className="flex justify-between gap-3"
                            >
                              <span className="truncate">
                                {allocation.allocation_type ===
                                'paper'
                                  ? allocation.paper_short_title ??
                                    'Unknown paper'
                                  : getBlockedLabel(
                                      allocation.blocked_type
                                    )}
                              </span>

                              <span className="shrink-0 font-medium">
                                {
                                  allocation.committed_days
                                }
                                d
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 border-t border-black/10 pt-3 text-xs text-oxford-ash">
                        No allocations
                        for this
                        half-month.
                      </p>
                    )}
                  </Link>
                )
              }
            )}
          </div>
        </Card>

        <Card>
          <div>
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Annual timeline
            </h3>

            <p className="mt-1 text-sm text-oxford-ash">
              Twenty-four
              half-month planning
              periods for{' '}
              {selectedYear}.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[720px] space-y-2">
              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-oxford-ash">
                <div>
                  Month
                </div>

                <div>
                  1–15
                </div>

                <div>
                  16–end
                </div>
              </div>

              {Array.from(
                {
                  length: 12,
                },
                (
                  _,
                  index
                ) => {
                  const month =
                    index + 1

                  const monthText =
                    String(
                      month
                    ).padStart(
                      2,
                      '0'
                    )

                  const starts = [
                    `${selectedYear}-${monthText}-01`,
                    `${selectedYear}-${monthText}-16`,
                  ]

                  return (
                    <div
                      key={
                        month
                      }
                      className="grid grid-cols-[80px_1fr_1fr] items-stretch gap-2"
                    >
                      <div className="flex items-center px-1 text-sm font-medium text-oxford-charcoal">
                        {formatMonthShort(
                          selectedYear,
                          month
                        )}
                      </div>

                      {starts.map(
                        (
                          start
                        ) => {
                          const period =
                            periodByStart.get(
                              start
                            )

                          const stats =
                            getPeriodStats(
                              period
                            )

                          const selected =
                            start ===
                            selectedPeriodStart

                          return (
                            <Link
                              key={
                                start
                              }
                              href={`/planning?period=${start}#allocations`}
                              className={`rounded-md border px-3 py-2 transition hover:border-oxford-blue ${getPeriodTone(
                                stats.totalDays,
                                selected
                              )}`}
                            >
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="font-medium text-oxford-charcoal">
                                  {
                                    stats.totalDays
                                  }
                                  d
                                </span>

                                <span className="text-xs text-oxford-ash">
                                  R{' '}
                                  {
                                    stats.paperDays
                                  }
                                  {' · '}
                                  B{' '}
                                  {
                                    stats.blockedDays
                                  }
                                </span>
                              </div>
                            </Link>
                          )
                        }
                      )}
                    </div>
                  )
                }
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-oxford-stone pt-3 text-xs text-oxford-ash">
            <span>
              R = research
            </span>

            <span>
              B = blocked time
            </span>

            <span>
              Green ≤ 5 days
            </span>

            <span>
              Yellow 6–10 days
            </span>

            <span>
              Orange 11+ days
            </span>
          </div>
        </Card>

        <Card>
          <div>
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Planned vs actual
            </h3>

            <p className="mt-1 text-sm text-oxford-ash">
              Planned capacity is
              converted using 1 day =
              8 hours and compared
              with recorded paper
              work for{' '}
              {selectedPeriodStart} to{' '}
              {selectedPeriodEnd}.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Research planned
              </div>

              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {formatDuration(
                  plannedResearchMinutes
                )}
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Blocked planned
              </div>

              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {formatDuration(
                  plannedBlockedMinutes
                )}
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Paper hours recorded
              </div>

              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {formatDuration(
                  totalActualMinutes
                )}
              </div>
            </div>
          </div>

          {blockedAllocations.length >
            0 && (
            <div className="mt-5 rounded-lg border border-oxford-stone bg-white p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Blocked plan
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {blockedAllocations.map(
                  (
                    allocation
                  ) => (
                    <span
                      key={
                        allocation.id
                      }
                      className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                    >
                      {getBlockedLabel(
                        allocation.blocked_type
                      )}{' '}
                      ·{' '}
                      {formatDuration(
                        allocation.committed_days *
                          MINUTES_PER_PLANNED_DAY
                      )}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {comparisonRows.length ===
          0 ? (
            <div className="mt-5 rounded-lg border border-oxford-stone bg-white px-6 py-8 text-center">
              <p className="text-sm text-oxford-ash">
                No planned papers
                or paper-linked work
                sessions in this
                period.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-oxford-stone">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-oxford-stone bg-oxford-shell">
                  <tr>
                    <th className="px-4 py-3 font-medium text-oxford-charcoal">
                      Paper
                    </th>

                    <th className="px-4 py-3 font-medium text-oxford-charcoal">
                      Planned
                    </th>

                    <th className="px-4 py-3 font-medium text-oxford-charcoal">
                      Actual
                    </th>

                    <th className="px-4 py-3 font-medium text-oxford-charcoal">
                      Gap
                    </th>

                    <th className="px-4 py-3 font-medium text-oxford-charcoal">
                      Indicator
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {comparisonRows.map(
                    (row) => {
                      const gap =
                        getGapPresentation(
                          row.plannedMinutes,
                          row.actualMinutes,
                          row.planned
                        )

                      return (
                        <tr
                          key={
                            row.paperId
                          }
                          className="border-b border-oxford-stone last:border-b-0"
                        >
                          <td className="px-4 py-3 font-medium text-oxford-blue">
                            {
                              row.shortTitle
                            }
                          </td>

                          <td className="px-4 py-3 text-oxford-charcoal">
                            {row.planned
                              ? formatDuration(
                                  row.plannedMinutes
                                )
                              : '—'}
                          </td>

                          <td className="px-4 py-3 text-oxford-charcoal">
                            {formatDuration(
                              row.actualMinutes
                            )}
                          </td>

                          <td className="px-4 py-3 font-medium text-oxford-charcoal">
                            {row.planned
                              ? formatSignedDuration(
                                  row.gapMinutes
                                )
                              : formatSignedDuration(
                                  row.actualMinutes
                                )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${gap.className}`}
                            >
                              {
                                gap.label
                              }
                            </span>
                          </td>
                        </tr>
                      )
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs leading-5 text-oxford-ash">
            Gap = actual recorded
            hours minus planned
            hours. Planned capacity
            uses 8 hours per day.
            For planned papers,
            differences within ±10%
            of planned hours are
            classified as On plan.
            Paper-linked work with no
            allocation is classified
            as Unplanned.
          </p>
        </Card>
      </div>
    </section>
  )
}