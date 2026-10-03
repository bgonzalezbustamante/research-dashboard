import Link from 'next/link'

import PlanningAnalyticsSection from '@/components/planning/planning-analytics-section'
import PlanningPeriodLoad from '@/components/planning/planning-period-load'
import PlanningWorkspace from '@/components/planning/planning-workspace'
import StandbyPapersCard from '@/components/planning/standby-papers-card'
import PageHeader from '@/components/page-header'
import ButtonLink from '@/components/ui/button-link'
import {
  aggregateMilestonesByPaperAndPeriod,
  getPlanningPeriodEnd,
  getPlanningPeriodStartsForYear,
  type PlanningMilestone,
} from '@/lib/planning/milestone-planning'
import {
  deriveSourceBackedPlanning,
  findPlanningOverlaps,
  type BlockedEventPlanningSource,
  type ConferencePlanningSource,
  type PlanningSourceState,
  type PlanningSourceType,
  type TeachingPlanningSource,
} from '@/lib/planning/source-backed-planning'
import { createClient } from '@/lib/supabase/server'

type PlanningPageProps = {
  searchParams: Promise<{
    period?: string
    error?: string
  }>
}

type PaperOption = {
  id: string
  short_title: string
  title: string
  status: string
  archived_at: string | null
}

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

type BlockedType =
  | 'teaching'
  | 'conference'
  | 'holiday'
  | 'winter_holiday'
  | 'summer_holiday'
  | 'administrative'
  | 'sick'

type StoredPlanningPeriodRow = {
  id: string
  period_start: string
  period_end: string
}

type PlanningAllocationView = {
  id: string
  period_start: string
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

type WorkSessionRow = {
  paper_id: string | null
  start_time: string
  end_time: string
}

function isValidDateString(
  value: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false
  }

  const [year, month, day] =
    value.split('-').map(Number)

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidPeriodStart(
  value: string
) {
  if (!isValidDateString(value)) {
    return false
  }

  const day = Number(
    value.slice(8, 10)
  )

  return day === 1 || day === 16
}

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

function getCurrentPeriodStart() {
  const today =
    getAmsterdamDate()

  const day = Number(
    today.slice(8, 10)
  )

  return `${today.slice(
    0,
    8
  )}${day <= 15 ? '01' : '16'}`
}

function getPreviousPeriod(
  periodStart: string
) {
  const [year, month, day] =
    periodStart
      .split('-')
      .map(Number)

  if (day === 16) {
    return `${periodStart.slice(
      0,
      8
    )}01`
  }

  return new Date(
    Date.UTC(
      year,
      month - 2,
      16
    )
  )
    .toISOString()
    .slice(0, 10)
}

function getNextPeriod(
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
    )}16`
  }

  return new Date(
    Date.UTC(
      year,
      month,
      1
    )
  )
    .toISOString()
    .slice(0, 10)
}

function formatPeriodLabel(
  periodStart: string,
  periodEnd: string
) {
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

function timeToMinutes(
  value: string
) {
  const [hours, minutes] =
    value
      .slice(0, 5)
      .split(':')
      .map(Number)

  return hours * 60 + minutes
}

function getSessionDuration(
  startTime: string,
  endTime: string
) {
  return Math.max(
    0,
    timeToMinutes(endTime) -
      timeToMinutes(startTime)
  )
}

export default async function PlanningPage({
  searchParams,
}: PlanningPageProps) {
  const params =
    await searchParams

  const currentPeriodStart =
    getCurrentPeriodStart()

  const selectedPeriodStart =
    params.period &&
    isValidPeriodStart(
      params.period
    )
      ? params.period
      : currentPeriodStart

  const selectedPeriodEnd =
    getPlanningPeriodEnd(
      selectedPeriodStart
    )

  const previousPeriod =
    getPreviousPeriod(
      selectedPeriodStart
    )

  const nextPeriod =
    getNextPeriod(
      selectedPeriodStart
    )

  const selectedYear =
    Number(
      selectedPeriodStart.slice(
        0,
        4
      )
    )

  const yearStart =
    `${selectedYear}-01-01`

  const yearEnd =
    `${selectedYear}-12-31`

  const supabase =
    await createClient()

  const [
    periodsResult,
    papersResult,
    dailyLogsResult,
    milestonesResult,
  ] = await Promise.all([
    supabase
      .from('planning_periods')
      .select(`
        id,
        period_start,
        period_end
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
      .from('papers')
      .select(`
        id,
        short_title,
        title,
        status,
        archived_at
      `)
      .order(
        'short_title',
        {
          ascending: true,
        }
      ),

    supabase
      .from('daily_logs')
      .select(`
        id,
        log_date
      `)
      .gte(
        'log_date',
        selectedPeriodStart
      )
      .lte(
        'log_date',
        selectedPeriodEnd
      )
      .order(
        'log_date',
        {
          ascending: true,
        }
      ),

    supabase
      .from('paper_milestones')
      .select(`
        id,
        paper_id,
        title,
        target_date,
        committed_days,
        flowsavvy_added,
        flowsavvy_added_at,
        papers (
          short_title,
          title,
          archived_at
        )
      `)
      .eq(
        'status',
        'planned'
      )
      .not(
        'committed_days',
        'is',
        null
      )
      .not(
        'target_date',
        'is',
        null
      )
      .gte(
        'target_date',
        yearStart
      )
      .lte(
        'target_date',
        yearEnd
      ),
  ])

  if (periodsResult.error) {
    throw new Error(
      `Could not load planning periods: ${periodsResult.error.message}`
    )
  }

  if (papersResult.error) {
    throw new Error(
      `Could not load papers: ${papersResult.error.message}`
    )
  }

  if (dailyLogsResult.error) {
    throw new Error(
      `Could not load working-hour dates: ${dailyLogsResult.error.message}`
    )
  }

  if (milestonesResult.error) {
    throw new Error(
      `Could not load milestone-backed planning: ${milestonesResult.error.message}`
    )
  }

  const storedPeriods =
    (periodsResult.data ??
      []) as StoredPlanningPeriodRow[]

  const papers =
    (papersResult.data ??
      []) as PaperOption[]

  const storedPeriodByStart =
    new Map(
      storedPeriods.map(
        (period) => [
          period.period_start,
          period,
        ]
      )
    )

  const periodStartById =
    new Map(
      storedPeriods.map(
        (period) => [
          period.id,
          period.period_start,
        ]
      )
    )

  const periods =
    getPlanningPeriodStartsForYear(
      selectedYear
    ).map(
      (periodStart) => {
        const stored =
          storedPeriodByStart.get(
            periodStart
          )

        return {
          id:
            stored?.id ??
            `virtual:${periodStart}`,
          period_start:
            periodStart,
          period_end:
            stored?.period_end ??
            getPlanningPeriodEnd(
              periodStart
            ),
        }
      }
    )

  const storedPeriodIds =
    storedPeriods.map(
      (period) => period.id
    )

  const dailyLogIds =
    (
      dailyLogsResult.data ?? []
    ).map((log) => log.id)

  let manualAllocations:
    PlanningAllocationView[] = []

  if (
    storedPeriodIds.length >
    0
  ) {
    const { data, error } =
      await supabase
        .from(
          'planning_allocations'
        )
        .select(`
          id,
          planning_period_id,
          allocation_type,
          blocked_type,
          paper_id,
          committed_days,
          flowsavvy_added,
          flowsavvy_added_at,
          notes,
          sort_order,
          created_at,
          papers (
            short_title,
            title,
            archived_at
          )
        `)
        .in(
          'planning_period_id',
          storedPeriodIds
        )
        .order(
          'sort_order',
          { ascending: true }
        )
        .order(
          'created_at',
          { ascending: true }
        )

    if (error) {
      throw new Error(
        `Could not load planning allocations: ${error.message}`
      )
    }

    manualAllocations =
      (data ?? []).flatMap(
        (allocation) => {
          const periodStart =
            periodStartById.get(
              allocation.planning_period_id
            )

          if (!periodStart) {
            return []
          }

          const paper =
            Array.isArray(
              allocation.papers
            )
              ? allocation.papers[0]
              : allocation.papers

          return [{
            id: allocation.id,
            period_start:
              periodStart,
            allocation_type:
              allocation.allocation_type as AllocationType,
            source:
              allocation.allocation_type ===
                'paper'
                ? 'legacy'
                : 'blocked',
            blocked_type:
              allocation.blocked_type as BlockedType | null,
            committed_days:
              allocation.committed_days,
            flowsavvy_added:
              allocation.flowsavvy_added,
            flowsavvy_added_at:
              allocation.flowsavvy_added_at,
            flowsavvy_count:
              allocation.flowsavvy_added
                ? 1
                : 0,
            flowsavvy_total: 1,
            notes: allocation.notes,
            paper_id:
              allocation.paper_id,
            paper_short_title:
              paper?.short_title ?? null,
            paper_title:
              paper?.title ?? null,
            paper_archived:
              Boolean(
                paper?.archived_at
              ),
            milestones: [],
          }]
        }
      )
  }

  const milestoneRows:
    PlanningMilestone[] =
    (milestonesResult.data ??
      []).flatMap(
      (milestone) => {
        const paper =
          Array.isArray(
            milestone.papers
          )
            ? milestone.papers[0]
            : milestone.papers

        if (
          !milestone.target_date ||
          !milestone.committed_days ||
          !paper
        ) {
          return []
        }

        return [{
          id: milestone.id,
          paper_id:
            milestone.paper_id,
          title:
            milestone.title,
          target_date:
            milestone.target_date,
          committed_days:
            milestone.committed_days,
          flowsavvy_added:
            milestone.flowsavvy_added,
          flowsavvy_added_at:
            milestone.flowsavvy_added_at,
          paper_short_title:
            paper.short_title,
          paper_title:
            paper.title,
          paper_archived:
            Boolean(
              paper.archived_at
            ),
        }]
      }
    )

  const milestoneAllocations =
    aggregateMilestonesByPaperAndPeriod(
      milestoneRows
    )

  const milestoneKeys =
    new Set(
      milestoneAllocations.map(
        (allocation) =>
          `${allocation.period_start}:${allocation.paper_id}`
      )
    )

  const effectiveManualAllocations =
    manualAllocations.filter(
      (allocation) =>
        !(
          allocation.source ===
            'legacy' &&
          allocation.paper_id &&
          milestoneKeys.has(
            `${allocation.period_start}:${allocation.paper_id}`
          )
        )
    )

  const combinedAllocations:
    PlanningAllocationView[] = [
      ...effectiveManualAllocations,
      ...milestoneAllocations,
    ]

  let workSessions:
    WorkSessionRow[] = []

  if (dailyLogIds.length > 0) {
    const { data, error } =
      await supabase
        .from('work_sessions')
        .select(`
          paper_id,
          start_time,
          end_time
        `)
        .in(
          'daily_log_id',
          dailyLogIds
        )

    if (error) {
      throw new Error(
        `Could not load actual working hours: ${error.message}`
      )
    }

    workSessions =
      (data ?? []) as WorkSessionRow[]
  }

  const allocationsByPeriod =
    new Map<
      string,
      PlanningAllocationView[]
    >()

  for (const allocation of
    combinedAllocations) {
    const existing =
      allocationsByPeriod.get(
        allocation.period_start
      ) ?? []

    existing.push(allocation)

    allocationsByPeriod.set(
      allocation.period_start,
      existing
    )
  }

  for (const allocations of
    allocationsByPeriod.values()) {
    allocations.sort(
      (a, b) => {
        if (
          a.allocation_type !==
          b.allocation_type
        ) {
          return a.allocation_type ===
            'paper'
            ? -1
            : 1
        }

        return (
          (
            a.paper_short_title ??
            a.blocked_type ??
            ''
          ).localeCompare(
            b.paper_short_title ??
            b.blocked_type ??
            ''
          )
        )
      }
    )
  }

  const analyticsPeriods =
    periods.map((period) => ({
      id: period.id,
      period_start:
        period.period_start,
      period_end:
        period.period_end,
      allocations:
        (
          allocationsByPeriod.get(
            period.period_start
          ) ?? []
        ).map((allocation) => ({
          id: allocation.id,
          allocation_type:
            allocation.allocation_type,
          blocked_type:
            allocation.blocked_type,
          committed_days:
            allocation.committed_days,
          flowsavvy_added:
            allocation.flowsavvy_added,
          flowsavvy_count:
            allocation.flowsavvy_count,
          flowsavvy_total:
            allocation.flowsavvy_total,
          paper_id:
            allocation.paper_id,
          paper_short_title:
            allocation.paper_short_title,
        })),
    }))

  const selectedAllocations =
    allocationsByPeriod.get(
      selectedPeriodStart
    ) ?? []

  const standbyPapers =
    papers
      .filter(
        (paper) =>
          paper.archived_at === null &&
          paper.status === 'standby'
      )
      .map((paper) => ({
        id: paper.id,
        short_title:
          paper.short_title,
      }))

  const minutesByPaper =
    new Map<string, number>()

  for (const session of
    workSessions) {
    if (!session.paper_id) {
      continue
    }

    const duration =
      getSessionDuration(
        session.start_time,
        session.end_time
      )

    minutesByPaper.set(
      session.paper_id,
      (
        minutesByPaper.get(
          session.paper_id
        ) ?? 0
      ) + duration
    )
  }

  const paperById =
    new Map(
      papers.map((paper) => [
        paper.id,
        paper,
      ])
    )

  const actualPaperHours =
    [...minutesByPaper.entries()]
      .map(
        ([paperId, minutes]) => ({
          paper_id: paperId,
          short_title:
            paperById.get(paperId)
              ?.short_title ??
            'Unknown paper',
          minutes,
        })
      )
      .sort(
        (a, b) =>
          a.short_title.localeCompare(
            b.short_title
          )
      )

  const periodLabel =
    formatPeriodLabel(
      selectedPeriodStart,
      selectedPeriodEnd
    )

  const isCurrentPeriod =
    selectedPeriodStart ===
    currentPeriodStart

  return (
    <div>
      <PageHeader
        title="Biweekly Planning"
        description="Research capacity is derived from capacity-bearing Paper Milestones; add Blocked Time manually for other commitments."
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <section
          aria-label="Planning period selection"
          className="h-full rounded-lg border border-oxford-stone bg-white p-4"
        >
          <div className="flex h-full flex-col gap-4 lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                  Selected period
                </div>

                {isCurrentPeriod && (
                  <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                    Current
                  </span>
                )}
              </div>

              <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                {periodLabel}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/planning?period=${previousPeriod}`}
                className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
              >
                ← Previous
              </Link>

              <ButtonLink
                href={`/planning?period=${currentPeriodStart}`}
                variant="secondary"
              >
                Current period
              </ButtonLink>

              <Link
                href={`/planning?period=${nextPeriod}`}
                className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
              >
                Next →
              </Link>
            </div>
          </div>
        </section>

        <PlanningPeriodLoad
          allocations={
            selectedAllocations
          }
        />
      </div>

      <StandbyPapersCard
        papers={standbyPapers}
      />

      <PlanningWorkspace
        periodStart={
          selectedPeriodStart
        }
        periodEnd={
          selectedPeriodEnd
        }
        allocations={
          selectedAllocations
        }
        error={params.error}
      />

      <PlanningAnalyticsSection
        selectedPeriodStart={
          selectedPeriodStart
        }
        selectedPeriodEnd={
          selectedPeriodEnd
        }
        periods={analyticsPeriods}
        actualPaperHours={
          actualPaperHours
        }
      />
    </div>
  )
}
