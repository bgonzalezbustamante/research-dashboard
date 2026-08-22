import Link from 'next/link'

import CrossModuleAnalyticsSection from '@/components/dashboard/cross-module-analytics-section'
import PageHeader from '@/components/page-header'
import ButtonLink from '@/components/ui/button-link'
import StatusBadge from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/server'

type PaperStatus =
  | 'writing'
  | 'under-review'
  | 'revise-round'
  | 'published'
  | 'standby'
  | 'deprecated'

type PaperRow = {
  id: string
  short_title: string
  title: string
  status: PaperStatus
  revision_round: number | null
  archived_at: string | null
  updated_at: string
}

type MilestoneRow = {
  paper_id: string
  title: string
  target_date: string | null
}

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

type PlanningPeriodRow = {
  id: string
  period_start: string
  period_end: string
}

type PlanningAllocationRow = {
  allocation_type:
    | 'paper'
    | 'blocked'
  committed_days: number
  flowsavvy_added: boolean
  paper_id: string | null
}

type DashboardPageProps = {
  searchParams: Promise<{
    year?: string
  }>
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

function parseDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
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
  return `${value.slice(
    0,
    7
  )}-01`
}

function getMonthEnd(
  value: string
) {
  const [
    year,
    month,
  ] = value
    .split('-')
    .map(Number)

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

function getPlanningPeriodStart(
  value: string
) {
  const day =
    Number(
      value.slice(
        8,
        10
      )
    )

  return `${value.slice(
    0,
    8
  )}${day <= 15 ? '01' : '16'}`
}

function getPlanningPeriodEnd(
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

function timeToMinutes(
  value: string
) {
  const [
    hours,
    minutes,
  ] = value
    .slice(0, 5)
    .split(':')
    .map(Number)

  return (
    hours * 60 +
    minutes
  )
}

function getDurationMinutes(
  startTime: string,
  endTime: string
) {
  return Math.max(
    0,
    timeToMinutes(
      endTime
    ) -
      timeToMinutes(
        startTime
      )
  )
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

function formatDate(
  value: string | null
) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  ).format(
    parseDate(value)
  )
}

function formatPlanningPeriod(
  start: string,
  end: string
) {
  const startDay =
    Number(
      start.slice(
        8,
        10
      )
    )

  const endDay =
    Number(
      end.slice(
        8,
        10
      )
    )

  const [
    year,
    month,
  ] = start
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

function getGapPresentation(
  plannedMinutes: number,
  actualMinutes: number
) {
  if (
    plannedMinutes === 0 &&
    actualMinutes === 0
  ) {
    return {
      label:
        'No research allocation',
      className:
        'border-oxford-stone bg-oxford-shell text-oxford-ash',
    }
  }

  if (
    plannedMinutes === 0
  ) {
    return {
      label:
        'Unplanned research',
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
      label:
        'On plan',
      className:
        'border-green-200 bg-green-50 text-green-800',
    }
  }

  if (gap < 0) {
    return {
      label:
        'Below plan',
      className:
        'border-sky-200 bg-sky-50 text-sky-900',
    }
  }

  return {
    label:
      'Above plan',
    className:
      'border-orange-200 bg-orange-50 text-orange-800',
  }
}

function getPlanningTone(
  totalDays: number
) {
  if (totalDays === 0) {
    return {
      label: 'Open',
      className:
        'border-oxford-stone bg-oxford-shell text-oxford-ash',
    }
  }

  if (totalDays <= 5) {
    return {
      label:
        'Light commitment',
      className:
        'border-green-200 bg-green-50 text-green-800',
    }
  }

  if (totalDays <= 10) {
    return {
      label:
        'Moderate commitment',
      className:
        'border-yellow-200 bg-yellow-50 text-yellow-800',
    }
  }

  if (totalDays <= 15) {
    return {
      label:
        'Full commitment',
      className:
        'border-orange-200 bg-orange-50 text-orange-800',
    }
  }

  return {
    label:
      'Overcommitted',
    className:
      'border-orange-300 bg-orange-100 text-orange-900',
  }
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params =
    await searchParams

  const today =
    getAmsterdamDate()

  const currentYear =
    Number(
      today.slice(
        0,
        4
      )
    )

  const requestedYear =
    Number.parseInt(
      params.year ?? '',
      10
    )

  const analyticsYear =
    Number.isInteger(
      requestedYear
    ) &&
    requestedYear >= 2000 &&
    requestedYear <= 2100
      ? requestedYear
      : currentYear

  const weekStart =
    getWeekStart(
      today
    )

  const weekEnd =
    getWeekEnd(
      today
    )

  const monthStart =
    getMonthStart(
      today
    )

  const monthEnd =
    getMonthEnd(
      today
    )

  const planningPeriodStart =
    getPlanningPeriodStart(
      today
    )

  const planningPeriodEnd =
    getPlanningPeriodEnd(
      planningPeriodStart
    )

  const dataStart =
    [
      weekStart,
      monthStart,
      planningPeriodStart,
    ].sort()[0]

  const dataEnd =
    [
      weekEnd,
      monthEnd,
      planningPeriodEnd,
    ].sort()[2]

  const supabase =
    await createClient()

  const [
    papersResult,
    dailyLogsResult,
    planningPeriodResult,
  ] = await Promise.all([
    supabase
      .from('papers')
      .select(`
        id,
        short_title,
        title,
        status,
        revision_round,
        archived_at,
        updated_at
      `)
      .order(
        'updated_at',
        {
          ascending: false,
        }
      ),

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
        dataStart
      )
      .lte(
        'log_date',
        dataEnd
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
        period_start,
        period_end
      `)
      .eq(
        'period_start',
        planningPeriodStart
      )
      .maybeSingle(),
  ])

  if (
    papersResult.error
  ) {
    throw new Error(
      `Could not load dashboard papers: ${papersResult.error.message}`
    )
  }

  if (
    dailyLogsResult.error
  ) {
    throw new Error(
      `Could not load dashboard working hours: ${dailyLogsResult.error.message}`
    )
  }

  if (
    planningPeriodResult.error
  ) {
    throw new Error(
      `Could not load dashboard planning period: ${planningPeriodResult.error.message}`
    )
  }

  const papers =
    (papersResult.data ??
      []) as PaperRow[]

  const activePapers =
    papers.filter(
      (paper) =>
        paper.archived_at ===
        null
    )

  const activePaperIds =
    activePapers.map(
      (paper) =>
        paper.id
    )

  const dailyLogs =
    (dailyLogsResult.data ??
      []) as DailyLogRow[]

  const dailyLogIds =
    dailyLogs.map(
      (log) =>
        log.id
    )

  let workSessions:
    WorkSessionRow[] = []

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
        `Could not load dashboard work sessions: ${error.message}`
      )
    }

    workSessions =
      (data ??
        []) as WorkSessionRow[]
  }

  let milestones:
    MilestoneRow[] = []

  if (
    activePaperIds.length >
    0
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'paper_milestones'
      )
      .select(`
        paper_id,
        title,
        target_date
      `)
      .in(
        'paper_id',
        activePaperIds
      )
      .eq(
        'status',
        'planned'
      )

    if (error) {
      throw new Error(
        `Could not load dashboard milestones: ${error.message}`
      )
    }

    milestones =
      (data ??
        []) as MilestoneRow[]
  }

  const planningPeriod =
    planningPeriodResult.data as
      | PlanningPeriodRow
      | null

  let planningAllocations:
    PlanningAllocationRow[] =
      []

  if (planningPeriod) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'planning_allocations'
      )
      .select(`
        allocation_type,
        committed_days,
        flowsavvy_added,
        paper_id
      `)
      .eq(
        'planning_period_id',
        planningPeriod.id
      )

    if (error) {
      throw new Error(
        `Could not load dashboard planning allocations: ${error.message}`
      )
    }

    planningAllocations =
      (data ??
        []) as PlanningAllocationRow[]
  }

  const logDateById =
    new Map(
      dailyLogs.map(
        (log) => [
          log.id,
          log.log_date,
        ]
      )
    )

  let weekGrossMinutes = 0
  let weekBreakMinutes = 0
  let monthGrossMinutes = 0
  let monthBreakMinutes = 0
  let periodPaperMinutes = 0

  const weekWorkingDates =
    new Set<string>()

  for (const session of
    workSessions) {
    const date =
      logDateById.get(
        session.daily_log_id
      )

    if (!date) {
      continue
    }

    const duration =
      getDurationMinutes(
        session.start_time,
        session.end_time
      )

    const label =
      Array.isArray(
        session.activity_labels
      )
        ? session
            .activity_labels[0]
        : session.activity_labels

    const isBreak =
      label?.is_break ??
      false

    if (
      date >= weekStart &&
      date <= weekEnd
    ) {
      weekGrossMinutes +=
        duration

      if (isBreak) {
        weekBreakMinutes +=
          duration
      }

      weekWorkingDates.add(
        date
      )
    }

    if (
      date >= monthStart &&
      date <= monthEnd
    ) {
      monthGrossMinutes +=
        duration

      if (isBreak) {
        monthBreakMinutes +=
          duration
      }
    }

    if (
      date >=
        planningPeriodStart &&
      date <=
        planningPeriodEnd &&
      session.paper_id
    ) {
      periodPaperMinutes +=
        duration
    }
  }

  const weekNetMinutes =
    weekGrossMinutes -
    weekBreakMinutes

  const monthNetMinutes =
    monthGrossMinutes -
    monthBreakMinutes

  const weekCoffees =
    dailyLogs
      .filter(
        (log) =>
          log.log_date >=
            weekStart &&
          log.log_date <=
            weekEnd
      )
      .reduce(
        (
          total,
          log
        ) =>
          total +
          log.coffee_count,
        0
      )

  const researchDays =
    planningAllocations
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
    planningAllocations
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

  const totalPlannedDays =
    researchDays +
    blockedDays

  const flowsavvyCount =
    planningAllocations.filter(
      (allocation) =>
        allocation.flowsavvy_added
    ).length

  const plannedResearchMinutes =
    researchDays *
    MINUTES_PER_PLANNED_DAY

  const researchGapMinutes =
    periodPaperMinutes -
    plannedResearchMinutes

  const gapPresentation =
    getGapPresentation(
      plannedResearchMinutes,
      periodPaperMinutes
    )

  const planningTone =
    getPlanningTone(
      totalPlannedDays
    )

  const reviewRevisionCount =
    activePapers.filter(
      (paper) =>
        paper.status ===
          'under-review' ||
        paper.status ===
          'revise-round'
    ).length

  const nextMilestoneByPaper =
    new Map<
      string,
      MilestoneRow
    >()

  const sortedMilestones =
    [...milestones].sort(
      (a, b) => {
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
    )

  for (const milestone of
    sortedMilestones) {
    if (
      !nextMilestoneByPaper.has(
        milestone.paper_id
      )
    ) {
      nextMilestoneByPaper.set(
        milestone.paper_id,
        milestone
      )
    }
  }

  const papersForAttention =
    [...activePapers]
      .sort((a, b) => {
        const aMilestone =
          nextMilestoneByPaper.get(
            a.id
          )

        const bMilestone =
          nextMilestoneByPaper.get(
            b.id
          )

        if (
          aMilestone?.target_date &&
          bMilestone?.target_date
        ) {
          return aMilestone.target_date.localeCompare(
            bMilestone.target_date
          )
        }

        if (
          aMilestone?.target_date
        ) {
          return -1
        }

        if (
          bMilestone?.target_date
        ) {
          return 1
        }

        const aPriority =
          a.status ===
            'revise-round'
            ? 0
            : a.status ===
                'under-review'
              ? 1
              : a.status ===
                  'writing'
                ? 2
                : 3

        const bPriority =
          b.status ===
            'revise-round'
            ? 0
            : b.status ===
                'under-review'
              ? 1
              : b.status ===
                  'writing'
                ? 2
                : 3

        if (
          aPriority !==
          bPriority
        ) {
          return (
            aPriority -
            bPriority
          )
        }

        return b.updated_at.localeCompare(
          a.updated_at
        )
      })
      .slice(
        0,
        5
      )

  const planningPeriodLabel =
    formatPlanningPeriod(
      planningPeriodStart,
      planningPeriodEnd
    )

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Dashboard"
          description="A current overview of papers, working hours, planning capacity, and research priorities."
        />

        <div className="flex flex-wrap gap-2">
          <ButtonLink
            href="/hours"
            variant="secondary"
          >
            Log work
          </ButtonLink>

          <ButtonLink
            href="/planning"
            variant="primary"
          >
            Review planning
          </ButtonLink>
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Active papers
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {
              activePapers.length
            }
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            {
              reviewRevisionCount
            }{' '}
            in review / revision
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Net this week
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {formatDuration(
              weekNetMinutes
            )}
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            {
              weekWorkingDates.size
            }{' '}
            working{' '}
            {weekWorkingDates.size ===
            1
              ? 'day'
              : 'days'}{' '}
            · {weekCoffees}{' '}
            coffees
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Net this month
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {formatDuration(
              monthNetMinutes
            )}
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            {formatDuration(
              monthBreakMinutes
            )}{' '}
            break recorded
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Current plan
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {
              totalPlannedDays
            }
            d
          </div>

          <div className="mt-1 text-xs text-oxford-ash">
            Research{' '}
            {researchDays}d ·
            Blocked{' '}
            {blockedDays}d
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-oxford-stone bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Current planning
                period
              </div>

              <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {
                  planningPeriodLabel
                }
              </h2>
            </div>

            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${planningTone.className}`}
            >
              {
                planningTone.label
              }
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-oxford-ash">
                Research
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                {
                  researchDays
                }
                d
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-oxford-ash">
                Blocked
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                {
                  blockedDays
                }
                d
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-oxford-ash">
                FlowSavvy
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                {
                  flowsavvyCount
                }
                /
                {
                  planningAllocations.length
                }
              </div>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-oxford-shell">
            <div
              className="h-full rounded-full bg-oxford-blue"
              style={{
                width: `${Math.min(
                  100,
                  (
                    totalPlannedDays /
                    15
                  ) *
                    100
                )}%`,
              }}
            />
          </div>

          <div className="mt-4">
            <ButtonLink
              href={`/planning?period=${planningPeriodStart}`}
              variant="secondary"
            >
              Open planning
            </ButtonLink>
          </div>
        </section>

        <section className="rounded-lg border border-oxford-stone bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Planned vs actual
              </div>

              <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                Current research
                allocation
              </h2>
            </div>

            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${gapPresentation.className}`}
            >
              {
                gapPresentation.label
              }
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-oxford-ash">
                Planned
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                {formatDuration(
                  plannedResearchMinutes
                )}
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-oxford-ash">
                Recorded
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                {formatDuration(
                  periodPaperMinutes
                )}
              </div>
            </div>

            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-oxford-ash">
                Gap
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                {formatSignedDuration(
                  researchGapMinutes
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-oxford-ash">
            Planned research uses
            8 hours per committed
            day. Recorded effort
            includes only work
            sessions explicitly
            linked to papers in the
            current half-month.
          </p>

          <div className="mt-4">
            <ButtonLink
              href={`/planning?period=${planningPeriodStart}#planning-analytics`}
              variant="secondary"
            >
              View comparison
            </ButtonLink>
          </div>
        </section>

        <section className="rounded-lg border border-oxford-stone bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Working hours
              </div>

              <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                This week
              </h2>
            </div>

            <span className="text-xs text-oxford-ash">
              {formatDate(
                weekStart
              )}{' '}
              –{' '}
              {formatDate(
                weekEnd
              )}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-oxford-stone bg-oxford-shell px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-oxford-ash">
                Gross
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                {formatDuration(
                  weekGrossMinutes
                )}
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-amber-800">
                Break
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-amber-900">
                {formatDuration(
                  weekBreakMinutes
                )}
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-green-800">
                Net
              </div>

              <div className="mt-1 font-serif text-lg font-semibold text-green-900">
                {formatDuration(
                  weekNetMinutes
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-oxford-ash">
            <span>
              {
                weekWorkingDates.size
              }{' '}
              working{' '}
              {weekWorkingDates.size ===
              1
                ? 'day'
                : 'days'}
            </span>

            <span>
              {weekCoffees}{' '}
              coffees
            </span>
          </div>

          <div className="mt-4">
            <ButtonLink
              href={`/hours?date=${today}&period=week`}
              variant="secondary"
            >
              Open working hours
            </ButtonLink>
          </div>
        </section>

        <section className="rounded-lg border border-oxford-stone bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                Research pipeline
              </div>

              <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                Papers requiring
                attention
              </h2>
            </div>

            <ButtonLink
              href="/papers"
              variant="secondary"
            >
              All papers
            </ButtonLink>
          </div>

          {papersForAttention.length ===
          0 ? (
            <p className="mt-5 text-sm text-oxford-ash">
              No active papers to
              display.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-oxford-stone">
              {papersForAttention.map(
                (paper) => {
                  const milestone =
                    nextMilestoneByPaper.get(
                      paper.id
                    )

                  return (
                    <Link
                      key={
                        paper.id
                      }
                      href={`/papers/${paper.id}`}
                      className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:text-oxford-blue"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-oxford-blue">
                          {
                            paper.short_title
                          }
                        </div>

                        {milestone ? (
                          <div className="mt-1 text-xs text-oxford-ash">
                            {
                              milestone.title
                            }
                            {' · '}
                            {formatDate(
                              milestone.target_date
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-oxford-ash">
                            No planned
                            milestone
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        <StatusBadge
                          status={
                            paper.status
                          }
                        />

                        {paper.status ===
                          'revise-round' &&
                          paper.revision_round && (
                            <div className="mt-1 text-right text-xs text-oxford-ash">
                              Round{' '}
                              {
                                paper.revision_round
                              }
                            </div>
                          )}
                      </div>
                    </Link>
                  )
                }
              )}
            </div>
          )}
        </section>
      </div>

      <CrossModuleAnalyticsSection
        year={
          analyticsYear
        }
      />
    </div>
  )
}