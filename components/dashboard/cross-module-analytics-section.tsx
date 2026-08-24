import Link from 'next/link'

import Card from '@/components/ui/card'
import ButtonLink from '@/components/ui/button-link'
import { createClient } from '@/lib/supabase/server'

import {
  type MonthlySummary,
  type TimeAnalyticsDailyLog,
  formatDuration,
  getDurationMinutes,
  summariseMonths,
} from '@/lib/hours/analytics'

type DailyLogRow = {
  id: string
  log_date: string
  coffee_count: number
}

type WorkSessionRow = {
  daily_log_id: string
  paper_id: string | null
  start_time: string
  end_time: string
  activity_labels:
    | {
        is_break: boolean
      }
    | {
        is_break: boolean
      }[]
    | null
}

type CumulativeWorkSessionRow = {
  paper_id: string | null
  start_time: string
  end_time: string
  activity_labels:
    | {
        is_break: boolean
      }
    | {
        is_break: boolean
      }[]
    | null
}

type PlanningPeriodRow = {
  id: string
  period_start: string
}

type PlanningAllocationRow = {
  planning_period_id: string
  allocation_type:
    | 'paper'
    | 'blocked'
  committed_days: number
}

type CitationSnapshotRow = {
  paper_id: string
  source: string
  citation_count: number
  captured_on: string
  created_at: string
}

type CrossModuleAnalyticsSectionProps = {
  year: number
}

type MonthlyStats =
  MonthlySummary & {
    researchDays: number
    blockedDays: number
  }

const MINUTES_PER_PLANNED_DAY =
  8 * 60

function getAmsterdamDate() {
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
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    )

  return `${values.year}-${values.month}-${values.day}`
}

function getIsBreak(
  activityLabels:
    | {
        is_break: boolean
      }
    | {
        is_break: boolean
      }[]
    | null
) {
  const label =
    Array.isArray(
      activityLabels
    )
      ? activityLabels[0]
      : activityLabels

  return (
    label?.is_break ??
    false
  )
}

function formatMonth(
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

export default async function CrossModuleAnalyticsSection({
  year,
}: CrossModuleAnalyticsSectionProps) {
  const today =
    getAmsterdamDate()

  const currentYear =
    Number(
      today.slice(
        0,
        4
      )
    )

  const yearStart =
    `${year}-01-01`

  const yearEnd =
    `${year}-12-31`

  const supabase =
    await createClient()

  const [
    dailyLogsResult,
    planningPeriodsResult,
    citationSnapshotsResult,
    cumulativeSessionsResult,
  ] = await Promise.all([
    supabase
      .from(
        'daily_logs'
      )
      .select(`
        id,
        log_date,
        coffee_count
      `)
      .gte(
        'log_date',
        yearStart
      )
      .lte(
        'log_date',
        yearEnd
      )
      .order(
        'log_date',
        {
          ascending: true,
        }
      ),

    supabase
      .from(
        'planning_periods'
      )
      .select(`
        id,
        period_start
      `)
      .gte(
        'period_start',
        yearStart
      )
      .lte(
        'period_start',
        yearEnd
      )
      .order(
        'period_start',
        {
          ascending: true,
        }
      ),

    supabase
      .from(
        'citation_snapshots'
      )
      .select(`
        paper_id,
        source,
        citation_count,
        captured_on,
        created_at
      `)
      .eq(
        'source',
        'Google Scholar'
      )
      .order(
        'captured_on',
        {
          ascending: false,
        }
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      ),

    supabase
      .from(
        'work_sessions'
      )
      .select(`
        paper_id,
        start_time,
        end_time,
        activity_labels (
          is_break
        )
      `)
      .not(
        'paper_id',
        'is',
        null
      ),
  ])

  if (
    dailyLogsResult.error
  ) {
    throw new Error(
      `Could not load analytics daily logs: ${dailyLogsResult.error.message}`
    )
  }

  if (
    planningPeriodsResult.error
  ) {
    throw new Error(
      `Could not load analytics planning periods: ${planningPeriodsResult.error.message}`
    )
  }

  if (
    citationSnapshotsResult.error
  ) {
    throw new Error(
      `Could not load citation snapshots: ${citationSnapshotsResult.error.message}`
    )
  }

  if (
    cumulativeSessionsResult.error
  ) {
    throw new Error(
      `Could not load cumulative paper hours: ${cumulativeSessionsResult.error.message}`
    )
  }

  const dailyLogs =
    (dailyLogsResult.data ??
      []) as DailyLogRow[]

  const planningPeriods =
    (planningPeriodsResult.data ??
      []) as PlanningPeriodRow[]

  const citationSnapshots =
    (citationSnapshotsResult.data ??
      []) as CitationSnapshotRow[]

  const cumulativeSessions =
    (cumulativeSessionsResult.data ??
      []) as CumulativeWorkSessionRow[]

  const dailyLogIds =
    dailyLogs.map(
      (log) =>
        log.id
    )

  const planningPeriodIds =
    planningPeriods.map(
      (period) =>
        period.id
    )

  let workSessions:
    WorkSessionRow[] = []

  let planningAllocations:
    PlanningAllocationRow[] =
      []

  if (
    dailyLogIds.length > 0
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'work_sessions'
      )
      .select(`
        daily_log_id,
        paper_id,
        start_time,
        end_time,
        activity_labels (
          is_break
        )
      `)
      .in(
        'daily_log_id',
        dailyLogIds
      )

    if (error) {
      throw new Error(
        `Could not load analytics work sessions: ${error.message}`
      )
    }

    workSessions =
      (data ??
        []) as WorkSessionRow[]
  }

  if (
    planningPeriodIds.length >
    0
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'planning_allocations'
      )
      .select(`
        planning_period_id,
        allocation_type,
        committed_days
      `)
      .in(
        'planning_period_id',
        planningPeriodIds
      )

    if (error) {
      throw new Error(
        `Could not load analytics planning allocations: ${error.message}`
      )
    }

    planningAllocations =
      (data ??
        []) as PlanningAllocationRow[]
  }

  const periodStartById =
    new Map(
      planningPeriods.map(
        (period) => [
          period.id,
          period.period_start,
        ]
      )
    )

  const sessionsByLog =
    new Map<
      string,
      TimeAnalyticsDailyLog['sessions']
    >()

  for (const session of
    workSessions) {
    const existing =
      sessionsByLog.get(
        session.daily_log_id
      ) ?? []

    existing.push({
      start_time:
        session.start_time,
      end_time:
        session.end_time,
      paper_id:
        session.paper_id,
      label_is_break:
        getIsBreak(
          session.activity_labels
        ),
    })

    sessionsByLog.set(
      session.daily_log_id,
      existing
    )
  }

  const analyticsLogs:
    TimeAnalyticsDailyLog[] =
    dailyLogs.map(
      (log) => ({
        id:
          log.id,
        log_date:
          log.log_date,
        coffee_count:
          log.coffee_count,
        sessions:
          sessionsByLog.get(
            log.id
          ) ?? [],
      })
    )

  const monthlyStats:
    MonthlyStats[] =
    summariseMonths(
      analyticsLogs,
      year
    ).map(
      (month) => ({
        ...month,
        researchDays: 0,
        blockedDays: 0,
      })
    )

  for (const allocation of
    planningAllocations) {
    const periodStart =
      periodStartById.get(
        allocation.planning_period_id
      )

    if (!periodStart) {
      continue
    }

    const month =
      Number(
        periodStart.slice(
          5,
          7
        )
      )

    const stats =
      monthlyStats[
        month - 1
      ]

    if (!stats) {
      continue
    }

    if (
      allocation.allocation_type ===
      'paper'
    ) {
      stats.researchDays +=
        allocation.committed_days
    } else {
      stats.blockedDays +=
        allocation.committed_days
    }
  }

  const annualNetMinutes =
    monthlyStats.reduce(
      (
        total,
        month
      ) =>
        total +
        month.netMinutes,
      0
    )

  const annualPaperMinutes =
    monthlyStats.reduce(
      (
        total,
        month
      ) =>
        total +
        month.paperMinutes,
      0
    )

  const annualUnassignedMinutes =
    monthlyStats.reduce(
      (
        total,
        month
      ) =>
        total +
        month.unassignedMinutes,
      0
    )

  const annualResearchDays =
    monthlyStats.reduce(
      (
        total,
        month
      ) =>
        total +
        month.researchDays,
      0
    )

  const annualBlockedDays =
    monthlyStats.reduce(
      (
        total,
        month
      ) =>
        total +
        month.blockedDays,
      0
    )

  const annualWorkingDays =
    monthlyStats.reduce(
      (
        total,
        month
      ) =>
        total +
        month.workingDays,
      0
    )

  const averageNetPerWorkingDay =
    annualWorkingDays > 0
      ? Math.round(
          annualNetMinutes /
            annualWorkingDays
        )
      : 0

  const maxMonthlyNetMinutes =
    Math.max(
      1,
      ...monthlyStats.map(
        (month) =>
          month.netMinutes
      )
    )

  /*
   * Citation yield
   *
   * citationSnapshots is already sorted:
   * captured_on DESC, created_at DESC.
   *
   * Therefore, the first Google Scholar
   * row encountered for each paper is
   * its latest stored snapshot.
   */
  const latestGoogleScholarByPaper =
    new Map<
      string,
      CitationSnapshotRow
    >()

  for (const snapshot of
    citationSnapshots) {
    if (
      !latestGoogleScholarByPaper.has(
        snapshot.paper_id
      )
    ) {
      latestGoogleScholarByPaper.set(
        snapshot.paper_id,
        snapshot
      )
    }
  }

  const cumulativeMinutesByPaper =
    new Map<
      string,
      number
    >()

  for (const session of
    cumulativeSessions) {
    if (
      !session.paper_id
    ) {
      continue
    }

    if (
      getIsBreak(
        session.activity_labels
      )
    ) {
      continue
    }

    const duration =
      getDurationMinutes(
        session.start_time,
        session.end_time
      )

    cumulativeMinutesByPaper.set(
      session.paper_id,
      (
        cumulativeMinutesByPaper.get(
          session.paper_id
        ) ?? 0
      ) +
        duration
    )
  }

  /*
   * Coverage requires BOTH:
   * - a latest Google Scholar snapshot
   * - at least some tracked paper-linked time
   *
   * This ensures numerator and denominator
   * refer to the same set of papers.
   */
  const matchedPaperIds =
    [
      ...latestGoogleScholarByPaper.keys(),
    ].filter(
      (paperId) =>
        (
          cumulativeMinutesByPaper.get(
            paperId
          ) ?? 0
        ) > 0
    )

  const matchedCitationCount =
    matchedPaperIds.reduce(
      (
        total,
        paperId
      ) =>
        total +
        (
          latestGoogleScholarByPaper.get(
            paperId
          )?.citation_count ??
          0
        ),
      0
    )

  const matchedTrackedMinutes =
    matchedPaperIds.reduce(
      (
        total,
        paperId
      ) =>
        total +
        (
          cumulativeMinutesByPaper.get(
            paperId
          ) ?? 0
        ),
      0
    )

  const matchedTrackedHours =
    matchedTrackedMinutes /
    60

  const citationYield =
    matchedTrackedHours > 0
      ? (
          matchedCitationCount /
          matchedTrackedHours
        ) *
        100
      : null

  const googleScholarPaperCount =
    latestGoogleScholarByPaper.size

  return (
    <section
      id="cross-module-analytics"
      className="mt-10 scroll-mt-6"
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Cross-module analytics
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Longitudinal working
            and planning patterns
            across {year}, with a
            cumulative citation-yield
            indicator.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard?year=${year - 1}#cross-module-analytics`}
            className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
          >
            ← {year - 1}
          </Link>

          <ButtonLink
            href={`/dashboard?year=${currentYear}#cross-module-analytics`}
            variant="secondary"
          >
            Current year
          </ButtonLink>

          <Link
            href={`/dashboard?year=${year + 1}#cross-module-analytics`}
            className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
          >
            {year + 1} →
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Net work
          </div>

          <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
            {formatDuration(
              annualNetMinutes
            )}
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            {annualWorkingDays}{' '}
            working days ·{' '}
            {formatDuration(
              averageNetPerWorkingDay
            )}{' '}
            average
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Paper-linked
          </div>

          <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
            {formatDuration(
              annualPaperMinutes
            )}
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            Explicitly linked to
            papers
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Unassigned
          </div>

          <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
            {formatDuration(
              annualUnassignedMinutes
            )}
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            Non-break work without
            paper
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Research planned
          </div>

          <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
            {formatDuration(
              annualResearchDays *
                MINUTES_PER_PLANNED_DAY
            )}
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            {annualResearchDays}{' '}
            planned days
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Blocked planned
          </div>

          <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
            {formatDuration(
              annualBlockedDays *
                MINUTES_PER_PLANNED_DAY
            )}
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            {annualBlockedDays}{' '}
            blocked days
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <div>
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Monthly workload
            </h3>

            <p className="mt-1 text-sm text-oxford-ash">
              Net recorded working
              hours by calendar
              month.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {monthlyStats.map(
              (month) => {
                const width =
                  (
                    month.netMinutes /
                    maxMonthlyNetMinutes
                  ) *
                  100

                return (
                  <div
                    key={
                      month.month
                    }
                    className="grid grid-cols-[44px_72px_minmax(0,1fr)_60px] items-center gap-3"
                  >
                    <div className="text-sm font-medium text-oxford-charcoal">
                      {formatMonth(
                        year,
                        month.month
                      )}
                    </div>

                    <div className="text-right text-sm font-medium text-oxford-blue">
                      {formatDuration(
                        month.netMinutes
                      )}
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-oxford-shell">
                      <div
                        className="h-full rounded-full bg-oxford-blue"
                        style={{
                          width: `${width}%`,
                        }}
                      />
                    </div>

                    <div className="text-right text-xs text-oxford-ash">
                      {
                        month.workingDays
                      }{' '}
                      days
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div>
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Citation yield
            </h3>

            <p className="mt-1 text-sm text-oxford-ash">
              Cumulative Google
              Scholar citations
              relative to tracked
              paper-linked working
              hours.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                GS citations
              </div>

              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {
                  matchedCitationCount
                }
              </div>

              <div className="mt-1 text-xs text-oxford-ash">
                Latest snapshot per
                matched paper
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Tracked hours
              </div>

              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {formatDuration(
                  matchedTrackedMinutes
                )}
              </div>

              <div className="mt-1 text-xs text-oxford-ash">
                Same papers as
                citation count
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-green-800">
                Citations / 100h
              </div>

              <div className="mt-1 font-serif text-xl font-semibold text-green-900">
                {citationYield ===
                null
                  ? '—'
                  : citationYield.toFixed(
                      1
                    )}
              </div>

              <div className="mt-1 text-xs text-green-800">
                Cumulative citation
                yield
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Coverage
              </div>

              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {
                  matchedPaperIds.length
                }
                /
                {
                  googleScholarPaperCount
                }
              </div>

              <div className="mt-1 text-xs text-oxford-ash">
                GS papers with
                tracked hours
              </div>
            </div>
          </div>

          {matchedPaperIds.length ===
          0 ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Citation yield cannot
              yet be calculated
              because no paper has
              both a Google Scholar
              citation snapshot and
              tracked paper-linked
              working hours.
            </div>
          ) : null}

          <p className="mt-4 text-xs leading-5 text-oxford-ash">
            Citation yield uses the
            latest stored Google
            Scholar snapshot for
            each paper and cumulative
            tracked hours for the
            same set of papers.
            Scopus and Web of Science
            are excluded so citation
            databases are not mixed.
            This is a descriptive
            indicator rather than a
            measure of causal research
            productivity, because
            citations are lagged and
            tracked working hours may
            begin well after a paper
            was first developed.
          </p>
        </Card>
      </div>
    </section>
  )
}