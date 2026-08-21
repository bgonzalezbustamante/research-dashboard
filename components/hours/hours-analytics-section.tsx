import Link from 'next/link'

import Card from '@/components/ui/card'

type AnalyticsPeriod =
  | 'day'
  | 'week'
  | 'month'
  | 'year'

type AnalyticsSession = {
  id: string
  start_time: string
  end_time: string
  place: string
  paper_id: string | null
  label_name: string
  label_is_break: boolean
  paper_short_title: string | null
}

type AnalyticsDailyLog = {
  id: string
  log_date: string
  coffee_count: number
  sessions: AnalyticsSession[]
}

type HoursAnalyticsSectionProps = {
  selectedDate: string
  selectedPeriod: AnalyticsPeriod
  logs: AnalyticsDailyLog[]
}

type PeriodSummary = {
  grossMinutes: number
  breakMinutes: number
  netMinutes: number
  coffeeCount: number
  workingDays: number
}

type LocationSummary = {
  grossMinutes: number
  breakMinutes: number
  netMinutes: number
}

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

function parseDate(
  value: string
) {
  const [year, month, day] =
    value
      .split('-')
      .map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )
}

function formatDateValue(
  date: Date
) {
  return date
    .toISOString()
    .slice(0, 10)
}

function shiftDate(
  value: string,
  days: number
) {
  const date =
    parseDate(value)

  date.setUTCDate(
    date.getUTCDate() +
      days
  )

  return formatDateValue(
    date
  )
}

function getWeekStart(
  value: string
) {
  const date =
    parseDate(value)

  const weekday =
    date.getUTCDay()

  const difference =
    weekday === 0
      ? -6
      : 1 - weekday

  return shiftDate(
    value,
    difference
  )
}

function getWeekEnd(
  value: string
) {
  return shiftDate(
    getWeekStart(value),
    6
  )
}

function getMonthStart(
  value: string
) {
  return `${value.slice(0, 7)}-01`
}

function getMonthEnd(
  value: string
) {
  const [year, month] =
    value
      .split('-')
      .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month,
        0
      )
    )

  return formatDateValue(
    date
  )
}

function getYearStart(
  value: string
) {
  return `${value.slice(0, 4)}-01-01`
}

function getYearEnd(
  value: string
) {
  return `${value.slice(0, 4)}-12-31`
}

function getPeriodBounds(
  date: string,
  period: AnalyticsPeriod
) {
  switch (period) {
    case 'day':
      return {
        start: date,
        end: date,
      }

    case 'week':
      return {
        start:
          getWeekStart(date),
        end:
          getWeekEnd(date),
      }

    case 'year':
      return {
        start:
          getYearStart(date),
        end:
          getYearEnd(date),
      }

    case 'month':
    default:
      return {
        start:
          getMonthStart(date),
        end:
          getMonthEnd(date),
      }
  }
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

function formatPeriodLabel(
  date: string,
  period: AnalyticsPeriod
) {
  const parsed =
    parseDate(date)

  if (
    period === 'day'
  ) {
    return new Intl.DateTimeFormat(
      'en-GB',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    ).format(parsed)
  }

  if (
    period === 'week'
  ) {
    const start =
      parseDate(
        getWeekStart(date)
      )

    const end =
      parseDate(
        getWeekEnd(date)
      )

    const startLabel =
      new Intl.DateTimeFormat(
        'en-GB',
        {
          day: 'numeric',
          month: 'short',
        }
      ).format(start)

    const endLabel =
      new Intl.DateTimeFormat(
        'en-GB',
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }
      ).format(end)

    return `${startLabel} – ${endLabel}`
  }

  if (
    period === 'year'
  ) {
    return date.slice(
      0,
      4
    )
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      month: 'long',
      year: 'numeric',
    }
  ).format(parsed)
}

function isWithinPeriod(
  date: string,
  start: string,
  end: string
) {
  return (
    date >= start &&
    date <= end
  )
}

function summarisePeriod(
  logs: AnalyticsDailyLog[],
  start: string,
  end: string
): PeriodSummary {
  let grossMinutes = 0
  let breakMinutes = 0
  let coffeeCount = 0
  let workingDays = 0

  for (const log of logs) {
    if (
      !isWithinPeriod(
        log.log_date,
        start,
        end
      )
    ) {
      continue
    }

    coffeeCount +=
      log.coffee_count

    if (
      log.sessions.length > 0
    ) {
      workingDays += 1
    }

    for (const session of
      log.sessions) {
      const duration =
        getDurationMinutes(
          session.start_time,
          session.end_time
        )

      grossMinutes +=
        duration

      if (
        session.label_is_break
      ) {
        breakMinutes +=
          duration
      }
    }
  }

  return {
    grossMinutes,
    breakMinutes,
    netMinutes:
      grossMinutes -
      breakMinutes,
    coffeeCount,
    workingDays,
  }
}

function getActivityTotals(
  logs: AnalyticsDailyLog[],
  start: string,
  end: string
) {
  const totals =
    new Map<
      string,
      number
    >()

  for (const log of logs) {
    if (
      !isWithinPeriod(
        log.log_date,
        start,
        end
      )
    ) {
      continue
    }

    for (const session of
      log.sessions) {
      const duration =
        getDurationMinutes(
          session.start_time,
          session.end_time
        )

      totals.set(
        session.label_name,
        (totals.get(
          session.label_name
        ) ?? 0) +
          duration
      )
    }
  }

  return [...totals.entries()]
    .map(
      ([name, minutes]) => ({
        name,
        minutes,
      })
    )
    .sort(
      (a, b) =>
        b.minutes -
        a.minutes
    )
}

function getPaperTotals(
  logs: AnalyticsDailyLog[],
  start: string,
  end: string
) {
  const totals =
    new Map<
      string,
      number
    >()

  for (const log of logs) {
    if (
      !isWithinPeriod(
        log.log_date,
        start,
        end
      )
    ) {
      continue
    }

    for (const session of
      log.sessions) {
      if (
        session.label_is_break
      ) {
        continue
      }

      const duration =
        getDurationMinutes(
          session.start_time,
          session.end_time
        )

      const name =
        session.paper_short_title ??
        'Unassigned'

      totals.set(
        name,
        (totals.get(
          name
        ) ?? 0) +
          duration
      )
    }
  }

  return [...totals.entries()]
    .map(
      ([name, minutes]) => ({
        name,
        minutes,
      })
    )
    .sort(
      (a, b) =>
        b.minutes -
        a.minutes
    )
}

function getLocationTotals(
  logs: AnalyticsDailyLog[],
  start: string,
  end: string
) {
  const totals =
    new Map<
      string,
      LocationSummary
    >()

  for (const log of logs) {
    if (
      !isWithinPeriod(
        log.log_date,
        start,
        end
      )
    ) {
      continue
    }

    for (const session of
      log.sessions) {
      const duration =
        getDurationMinutes(
          session.start_time,
          session.end_time
        )

      const existing =
        totals.get(
          session.place
        ) ?? {
          grossMinutes: 0,
          breakMinutes: 0,
          netMinutes: 0,
        }

      existing.grossMinutes +=
        duration

      if (
        session.label_is_break
      ) {
        existing.breakMinutes +=
          duration
      }

      existing.netMinutes =
        existing.grossMinutes -
        existing.breakMinutes

      totals.set(
        session.place,
        existing
      )
    }
  }

  return [...totals.entries()]
    .map(
      ([name, summary]) => ({
        name,
        ...summary,
      })
    )
    .sort(
      (a, b) =>
        b.netMinutes -
        a.netMinutes
    )
}

function BreakdownBar({
  value,
  maximum,
}: {
  value: number
  maximum: number
}) {
  const percentage =
    maximum > 0
      ? Math.max(
          2,
          (value /
            maximum) *
            100
        )
      : 0

  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-oxford-shell">
      <div
        className="h-full rounded-full bg-oxford-blue"
        style={{
          width: `${percentage}%`,
        }}
      />
    </div>
  )
}

export default function HoursAnalyticsSection({
  selectedDate,
  selectedPeriod,
  logs,
}: HoursAnalyticsSectionProps) {
  const dayBounds =
    getPeriodBounds(
      selectedDate,
      'day'
    )

  const weekBounds =
    getPeriodBounds(
      selectedDate,
      'week'
    )

  const monthBounds =
    getPeriodBounds(
      selectedDate,
      'month'
    )

  const yearBounds =
    getPeriodBounds(
      selectedDate,
      'year'
    )

  const summaries = {
    day: summarisePeriod(
      logs,
      dayBounds.start,
      dayBounds.end
    ),
    week: summarisePeriod(
      logs,
      weekBounds.start,
      weekBounds.end
    ),
    month: summarisePeriod(
      logs,
      monthBounds.start,
      monthBounds.end
    ),
    year: summarisePeriod(
      logs,
      yearBounds.start,
      yearBounds.end
    ),
  }

  const selectedBounds =
    getPeriodBounds(
      selectedDate,
      selectedPeriod
    )

  const selectedSummary =
    summaries[
      selectedPeriod
    ]

  const activities =
    getActivityTotals(
      logs,
      selectedBounds.start,
      selectedBounds.end
    )

  const papers =
    getPaperTotals(
      logs,
      selectedBounds.start,
      selectedBounds.end
    )

  const locations =
    getLocationTotals(
      logs,
      selectedBounds.start,
      selectedBounds.end
    )

  const maxActivity =
    Math.max(
      0,
      ...activities.map(
        (item) =>
          item.minutes
      )
    )

  const maxPaper =
    Math.max(
      0,
      ...papers.map(
        (item) =>
          item.minutes
      )
    )

  const maxLocation =
    Math.max(
      0,
      ...locations.map(
        (item) =>
          item.netMinutes
      )
    )

  const periodCards: {
    key: AnalyticsPeriod
    label: string
  }[] = [
    {
      key: 'day',
      label: 'Day',
    },
    {
      key: 'week',
      label: 'Week',
    },
    {
      key: 'month',
      label: 'Month',
    },
    {
      key: 'year',
      label: 'Year',
    },
  ]

  return (
    <section
      id="analytics"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4">
        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Hours analytics
        </h2>

        <p className="mt-1 text-sm text-oxford-ash">
          Compare recorded time
          across the day, week,
          month, and year containing
          the selected date.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {periodCards.map(
          ({ key, label }) => {
            const summary =
              summaries[key]

            const active =
              selectedPeriod ===
              key

            return (
              <Link
                key={key}
                href={`/hours?date=${selectedDate}&period=${key}#analytics`}
                className={
                  active
                    ? 'rounded-lg border border-oxford-blue bg-white p-4 ring-1 ring-oxford-blue'
                    : 'rounded-lg border border-oxford-stone bg-white p-4 transition hover:border-oxford-blue'
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                    {label}
                  </span>

                  {active && (
                    <span className="text-xs font-medium text-oxford-blue">
                      Selected
                    </span>
                  )}
                </div>

                <div className="mt-2 font-serif text-2xl font-semibold text-oxford-blue">
                  {formatDuration(
                    summary.netMinutes
                  )}
                </div>

                <div className="mt-2 space-y-1 text-xs text-oxford-ash">
                  <div>
                    Gross{' '}
                    {formatDuration(
                      summary.grossMinutes
                    )}
                  </div>

                  <div>
                    Break{' '}
                    {formatDuration(
                      summary.breakMinutes
                    )}
                  </div>
                </div>
              </Link>
            )
          }
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-oxford-stone bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Selected period
          </div>

          <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
            {formatPeriodLabel(
              selectedDate,
              selectedPeriod
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {
                selectedSummary.workingDays
              }
            </strong>{' '}
            working days
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {
                selectedSummary.coffeeCount
              }
            </strong>{' '}
            coffees
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            By activity
          </h3>

          <p className="mt-1 text-sm text-oxford-ash">
            All recorded time,
            including Break.
          </p>

          {activities.length ===
          0 ? (
            <p className="mt-5 text-sm text-oxford-ash">
              No activity data for
              this period.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {activities.map(
                (activity) => (
                  <div
                    key={
                      activity.name
                    }
                  >
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-oxford-charcoal">
                        {
                          activity.name
                        }
                      </span>

                      <span className="shrink-0 text-oxford-ash">
                        {formatDuration(
                          activity.minutes
                        )}
                      </span>
                    </div>

                    <BreakdownBar
                      value={
                        activity.minutes
                      }
                      maximum={
                        maxActivity
                      }
                    />
                  </div>
                )
              )}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            By paper
          </h3>

          <p className="mt-1 text-sm text-oxford-ash">
            Net working time only.
            General work appears as
            Unassigned.
          </p>

          {papers.length ===
          0 ? (
            <p className="mt-5 text-sm text-oxford-ash">
              No paper allocation
              data for this period.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {papers.map(
                (paper) => (
                  <div
                    key={
                      paper.name
                    }
                  >
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-oxford-charcoal">
                        {
                          paper.name
                        }
                      </span>

                      <span className="shrink-0 text-oxford-ash">
                        {formatDuration(
                          paper.minutes
                        )}
                      </span>
                    </div>

                    <BreakdownBar
                      value={
                        paper.minutes
                      }
                      maximum={
                        maxPaper
                      }
                    />
                  </div>
                )
              )}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            By location
          </h3>

          <p className="mt-1 text-sm text-oxford-ash">
            Net time by work
            location, with gross time
            shown for context.
          </p>

          {locations.length ===
          0 ? (
            <p className="mt-5 text-sm text-oxford-ash">
              No location data for
              this period.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {locations.map(
                (location) => (
                  <div
                    key={
                      location.name
                    }
                  >
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-oxford-charcoal">
                        {
                          location.name
                        }
                      </span>

                      <span className="shrink-0 text-oxford-ash">
                        {formatDuration(
                          location.netMinutes
                        )}
                      </span>
                    </div>

                    <BreakdownBar
                      value={
                        location.netMinutes
                      }
                      maximum={
                        maxLocation
                      }
                    />

                    <div className="mt-1 text-xs text-oxford-ash">
                      Gross{' '}
                      {formatDuration(
                        location.grossMinutes
                      )}

                      {location.breakMinutes >
                        0 &&
                        ` · Break ${formatDuration(
                          location.breakMinutes
                        )}`}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>
      </div>
    </section>
  )
}