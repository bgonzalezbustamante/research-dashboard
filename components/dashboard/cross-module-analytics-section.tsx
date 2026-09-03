import Link from 'next/link'

import ActivityOverTimeCard from '@/components/dashboard/activity-over-time-card'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
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
  id: string
  daily_log_id: string
  paper_id: string | null
  start_time: string
  end_time: string
  activity_labels:
    | {
        name: string
        is_break: boolean
        major_activity: string | null
      }
    | {
        name: string
        is_break: boolean
        major_activity: string | null
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

type MajorActivityKey =
  | 'research'
  | 'teaching'
  | 'administration'
  | 'outreach'
  | 'breaks'

const MINUTES_PER_PLANNED_DAY =
  8 * 60

const SESSION_PAGE_SIZE =
  1000

const majorActivities: {
  key: MajorActivityKey
  label: string
  colour: string
}[] = [
  {
    key: 'research',
    label: 'Research',
    colour: '#F28C82',
  },
  {
    key: 'teaching',
    label: 'Teaching',
    colour: '#4F7FA8',
  },
  {
    key: 'administration',
    label: 'Administration',
    colour: '#B89B7A',
  },
  {
    key: 'outreach',
    label: 'Outreach',
    colour: '#E4C27A',
  },
  {
    key: 'breaks',
    label: 'Breaks',
    colour: '#9BB49F',
  },
]

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

function getActivityLabel(
  activityLabels:
    | {
        name?: string
        is_break: boolean
        major_activity?: string | null
      }
    | {
        name?: string
        is_break: boolean
        major_activity?: string | null
      }[]
    | null
) {
  return Array.isArray(
    activityLabels
  )
    ? activityLabels[0] ?? null
    : activityLabels
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
  return (
    getActivityLabel(
      activityLabels
    )?.is_break ?? false
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
      today.slice(0, 4)
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
      .from('daily_logs')
      .select(`
        id,
        log_date,
        coffee_count
      `)
      .gte('log_date', yearStart)
      .lte('log_date', yearEnd)
      .order('log_date', {
        ascending: true,
      }),

    supabase
      .from('planning_periods')
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
      .order('period_start', {
        ascending: true,
      }),

    supabase
      .from('citation_snapshots')
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
      .order('captured_on', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from('work_sessions')
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

  if (dailyLogsResult.error) {
    throw new Error(
      `Could not load analytics daily logs: ${dailyLogsResult.error.message}`
    )
  }

  if (planningPeriodsResult.error) {
    throw new Error(
      `Could not load analytics planning periods: ${planningPeriodsResult.error.message}`
    )
  }

  if (citationSnapshotsResult.error) {
    throw new Error(
      `Could not load citation snapshots: ${citationSnapshotsResult.error.message}`
    )
  }

  if (cumulativeSessionsResult.error) {
    throw new Error(
      `Could not load cumulative paper hours: ${cumulativeSessionsResult.error.message}`
    )
  }

  const dailyLogs =
    (dailyLogsResult.data ?? []) as DailyLogRow[]

  const planningPeriods =
    (planningPeriodsResult.data ?? []) as PlanningPeriodRow[]

  const citationSnapshots =
    (citationSnapshotsResult.data ?? []) as CitationSnapshotRow[]

  const cumulativeSessions =
    (cumulativeSessionsResult.data ?? []) as CumulativeWorkSessionRow[]

  const dailyLogIds =
    dailyLogs.map(
      (log) => log.id
    )

  const planningPeriodIds =
    planningPeriods.map(
      (period) => period.id
    )

  const workSessions:
    WorkSessionRow[] = []

  let planningAllocations:
    PlanningAllocationRow[] = []

  if (dailyLogIds.length > 0) {
    let from = 0

    while (true) {
      const {
        data,
        error,
      } = await supabase
        .from('work_sessions')
        .select(`
          id,
          daily_log_id,
          paper_id,
          start_time,
          end_time,
          activity_labels (
            name,
            is_break,
            major_activity
          )
        `)
        .in(
          'daily_log_id',
          dailyLogIds
        )
        .order(
          'daily_log_id',
          {
            ascending: true,
          }
        )
        .order(
          'start_time',
          {
            ascending: true,
          }
        )
        .order(
          'id',
          {
            ascending: true,
          }
        )
        .range(
          from,
          from +
            SESSION_PAGE_SIZE -
            1
        )

      if (error) {
        throw new Error(
          `Could not load analytics work sessions: ${error.message}`
        )
      }

      const rows =
        (data ?? []) as WorkSessionRow[]

      workSessions.push(
        ...rows
      )

      if (
        rows.length <
        SESSION_PAGE_SIZE
      ) {
        break
      }

      from +=
        SESSION_PAGE_SIZE
    }
  }

  if (
    planningPeriodIds.length >
    0
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('planning_allocations')
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
      (data ?? []) as PlanningAllocationRow[]
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
        id: log.id,
        log_date: log.log_date,
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
        periodStart.slice(5, 7)
      )

    const stats =
      monthlyStats[month - 1]

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
      (total, month) =>
        total +
        month.netMinutes,
      0
    )

  const annualPaperMinutes =
    monthlyStats.reduce(
      (total, month) =>
        total +
        month.paperMinutes,
      0
    )

  const annualUnassignedMinutes =
    monthlyStats.reduce(
      (total, month) =>
        total +
        month.unassignedMinutes,
      0
    )

  const annualResearchDays =
    monthlyStats.reduce(
      (total, month) =>
        total +
        month.researchDays,
      0
    )

  const annualBlockedDays =
    monthlyStats.reduce(
      (total, month) =>
        total +
        month.blockedDays,
      0
    )

  const annualWorkingDays =
    monthlyStats.reduce(
      (total, month) =>
        total +
        month.workingDays,
      0
    )

  const annualCoffeeCount =
    dailyLogs.reduce(
      (total, log) =>
        total + log.coffee_count,
      0
    )

  const averageCoffeesPerWorkingDay =
    annualWorkingDays > 0
      ? annualCoffeeCount /
        annualWorkingDays
      : 0

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

  const majorActivityMinutes =
    new Map<
      MajorActivityKey,
      number
    >(
      majorActivities.map(
        (activity) => [
          activity.key,
          0,
        ]
      )
    )

  const activityMinutesByName =
    new Map<string, number>()

  let unclassifiedMinutes = 0

  for (const session of
    workSessions) {
    const duration =
      getDurationMinutes(
        session.start_time,
        session.end_time
      )

    const label =
      getActivityLabel(
        session.activity_labels
      )

    if (
      label?.name &&
      !label.is_break
    ) {
      activityMinutesByName.set(
        label.name,
        (
          activityMinutesByName.get(
            label.name
          ) ?? 0
        ) + duration
      )
    }

    if (label?.is_break) {
      majorActivityMinutes.set(
        'breaks',
        (
          majorActivityMinutes.get(
            'breaks'
          ) ?? 0
        ) + duration
      )

      continue
    }

    const key =
      label?.major_activity as
        | MajorActivityKey
        | null
        | undefined

    if (
      key &&
      key !== 'breaks' &&
      majorActivityMinutes.has(key)
    ) {
      majorActivityMinutes.set(
        key,
        (
          majorActivityMinutes.get(
            key
          ) ?? 0
        ) + duration
      )
    } else {
      unclassifiedMinutes +=
        duration
    }
  }

  const topActivities =
    [
      ...activityMinutesByName.entries(),
    ]
      .map(
        ([name, minutes]) => ({
          name,
          minutes,
        })
      )
      .sort(
        (a, b) =>
          b.minutes - a.minutes ||
          a.name.localeCompare(
            b.name,
            'en'
          )
      )
      .slice(0, 5)

  const classifiedMinutes =
    [...majorActivityMinutes.values()].reduce(
      (total, minutes) =>
        total + minutes,
      0
    )

  const pieSegments =
    majorActivities.reduce<
      {
        key: MajorActivityKey
        label: string
        colour: string
        minutes: number
        percentage: number
        start: number
        end: number
      }[]
    >(
      (segments, activity) => {
        const minutes =
          majorActivityMinutes.get(
            activity.key
          ) ?? 0

        if (minutes <= 0) {
          return segments
        }

        const percentage =
          classifiedMinutes > 0
            ? (
                minutes /
                classifiedMinutes
              ) * 100
            : 0

        const start =
          segments.at(-1)?.end ?? 0

        const end =
          start + percentage

        return [
          ...segments,
          {
            ...activity,
            minutes,
            percentage,
            start,
            end,
          },
        ]
      },
      []
    )

  const pieBackground =
    pieSegments.length > 0
      ? `conic-gradient(${pieSegments
          .map(
            (activity) =>
              `${activity.colour} ${activity.start}% ${activity.end}%`
          )
          .join(', ')})`
      : '#F1EEE9'

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
    new Map<string, number>()

  for (const session of
    cumulativeSessions) {
    if (
      !session.paper_id ||
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
      ) + duration
    )
  }

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
      (total, paperId) =>
        total +
        (
          latestGoogleScholarByPaper.get(
            paperId
          )?.citation_count ?? 0
        ),
      0
    )

  const matchedTrackedMinutes =
    matchedPaperIds.reduce(
      (total, paperId) =>
        total +
        (
          cumulativeMinutesByPaper.get(
            paperId
          ) ?? 0
        ),
      0
    )

  const matchedTrackedHours =
    matchedTrackedMinutes / 60

  const citationYield =
    matchedTrackedHours > 0
      ? (
          matchedCitationCount /
          matchedTrackedHours
        ) * 100
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
            Longitudinal working and planning patterns across {year}, with annual activity distribution and a cumulative citation-yield indicator.
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
            {annualWorkingDays} working days · {formatDuration(averageNetPerWorkingDay)} average
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
            Explicitly linked to papers
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
            Non-break work without paper
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
            {annualResearchDays} planned days
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
            {annualBlockedDays} blocked days
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            Monthly workload
          </h3>

          <p className="mt-1 text-sm text-oxford-ash">
            Net recorded working hours by calendar month.
          </p>

          <div className="mt-5 space-y-3">
            {monthlyStats.map(
              (month) => {
                const width =
                  (
                    month.netMinutes /
                    maxMonthlyNetMinutes
                  ) * 100

                return (
                  <div
                    key={month.month}
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
                      {month.workingDays} days
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </Card>
      </div>

      <ActivityOverTimeCard
        year={year}
        logs={analyticsLogs}
      />

      <div className="mt-6">
        <Card>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            Major activity distribution
          </h3>

          <p className="mt-1 text-sm text-oxford-ash">
            Gross recorded time in {year}, grouped from Hours activity labels into Research, Teaching, Administration, Outreach, and Breaks.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
            <div className="mx-auto">
              <div
                role="img"
                aria-label={`Pie chart of classified activity time for ${year}`}
                className="h-56 w-56 rounded-full border border-oxford-stone shadow-inner"
                style={{
                  background:
                    pieBackground,
                }}
              />
            </div>

            <div className="space-y-3">
              {majorActivities.map(
                (activity) => {
                  const minutes =
                    majorActivityMinutes.get(
                      activity.key
                    ) ?? 0

                  const percentage =
                    classifiedMinutes > 0
                      ? (
                          minutes /
                          classifiedMinutes
                        ) * 100
                      : 0

                  return (
                    <div
                      key={activity.key}
                      className="grid grid-cols-[14px_minmax(0,1fr)_80px_56px] items-center gap-3 text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            activity.colour,
                        }}
                      />

                      <span className="font-medium text-oxford-charcoal">
                        {activity.label}
                      </span>

                      <span className="text-right text-oxford-blue">
                        {formatDuration(
                          minutes
                        )}
                      </span>

                      <span className="text-right text-xs text-oxford-ash">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  )
                }
              )}

              <div className="border-t border-oxford-stone pt-3 text-xs leading-5 text-oxford-ash">
                Percentages use classified gross time as the denominator. Break sessions are assigned to Breaks automatically.
              </div>

              {unclassifiedMinutes > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {formatDuration(
                    unclassifiedMinutes
                  )} remains unclassified and is not included in the pie. Assign major activities in Hours → Activity labels.
                </div>
              )}

              <div className="rounded-md border border-oxford-stone bg-oxford-shell px-3 py-2 text-xs leading-5 text-oxford-ash">
                Coffee in {year}: {annualCoffeeCount} total · {averageCoffeesPerWorkingDay.toFixed(1)} per working day.
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-oxford-stone pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
              Top activities in {year}
            </div>

            {topActivities.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {topActivities.map(
                  (activity) => (
                    <div
                      key={activity.name}
                      className="rounded-md border border-oxford-stone bg-oxford-shell px-3 py-2"
                    >
                      <div className="text-xs font-medium leading-4 text-oxford-charcoal">
                        {activity.name}
                      </div>
                      <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                        {formatDuration(
                          activity.minutes
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-oxford-ash">
                No non-break activity has been recorded for {year}.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            Citation yield
          </h3>

          <p className="mt-1 text-sm text-oxford-ash">
            Cumulative Google Scholar citations relative to tracked paper-linked working hours.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                GS citations
              </div>
              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {matchedCitationCount}
              </div>
              <div className="mt-1 text-xs text-oxford-ash">
                Latest snapshot per matched paper
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
                Same papers as citation count
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-green-800">
                Citations / 100h
              </div>
              <div className="mt-1 font-serif text-xl font-semibold text-green-900">
                {citationYield === null
                  ? '—'
                  : citationYield.toFixed(1)}
              </div>
              <div className="mt-1 text-xs text-green-800">
                Cumulative citation yield
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Coverage
              </div>
              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {matchedPaperIds.length}/{googleScholarPaperCount}
              </div>
              <div className="mt-1 text-xs text-oxford-ash">
                GS papers with tracked hours
              </div>
            </div>
          </div>

          {matchedPaperIds.length === 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Citation yield cannot yet be calculated because no paper has both a Google Scholar citation snapshot and tracked paper-linked working hours.
            </div>
          )}

          <p className="mt-4 text-xs leading-5 text-oxford-ash">
            Citation yield uses the latest stored Google Scholar snapshot for each paper and cumulative tracked hours for the same set of papers. Scopus and Web of Science are excluded so citation databases are not mixed. This is a descriptive indicator rather than a measure of causal research productivity, because citations are lagged and tracked working hours may begin well after a paper was first developed.
          </p>
        </Card>
      </div>
    </section>
  )
}
