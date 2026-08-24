import Link from 'next/link'

import Card from '@/components/ui/card'

import {
  type AnalyticsPeriod,
  type HoursAnalyticsDailyLog,
  formatDuration,
  formatPeriodLabel,
  getActivityTotals,
  getLocationTotals,
  getPaperTotals,
  getPeriodBounds,
  summarisePeriod,
} from '@/lib/hours/analytics'

type HoursAnalyticsSectionProps = {
  selectedDate: string
  selectedPeriod: AnalyticsPeriod
  logs:
    HoursAnalyticsDailyLog[]
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
          (
            value /
            maximum
          ) *
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
          ({
            key,
            label,
          }) => {
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