import Link from 'next/link'

import ActivityLabelsSection from '@/components/hours/activity-labels-section'
import DailyLogSection from '@/components/hours/daily-log-section'
import HoursAnalyticsSection from '@/components/hours/hours-analytics-section'
import WorkSessionsSection from '@/components/hours/work-sessions-section'
import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import { createClient } from '@/lib/supabase/server'

type AnalyticsPeriod =
  | 'day'
  | 'week'
  | 'month'
  | 'year'

type HoursPageProps = {
  searchParams: Promise<{
    date?: string
    period?: string
    dailyError?: string
    labelError?: string
    labelMessage?: string
    locationError?: string
    sessionError?: string
  }>
}

const analyticsPeriods:
  AnalyticsPeriod[] = [
    'day',
    'week',
    'month',
    'year',
  ]

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
    value
      .split('-')
      .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day
  )
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

function shiftDate(
  value: string,
  days: number
) {
  const [year, month, day] =
    value
      .split('-')
      .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  date.setUTCDate(
    date.getUTCDate() +
      days
  )

  return date
    .toISOString()
    .slice(0, 10)
}

function formatDate(
  value: string
) {
  const [year, month, day] =
    value
      .split('-')
      .map(Number)

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
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

export default async function HoursPage({
  searchParams,
}: HoursPageProps) {
  const params =
    await searchParams

  const today =
    getAmsterdamDate()

  const selectedDate =
    params.date &&
    isValidDateString(
      params.date
    )
      ? params.date
      : today

  const selectedPeriod:
    AnalyticsPeriod =
    analyticsPeriods.includes(
      params.period as AnalyticsPeriod
    )
      ? (params.period as AnalyticsPeriod)
      : 'month'

  const previousDate =
    shiftDate(
      selectedDate,
      -1
    )

  const nextDate =
    shiftDate(
      selectedDate,
      1
    )

  const selectedYear =
    selectedDate.slice(
      0,
      4
    )

  const analyticsStart =
    shiftDate(
      `${selectedYear}-01-01`,
      -6
    )

  const analyticsEnd =
    shiftDate(
      `${selectedYear}-12-31`,
      6
    )

  const supabase =
    await createClient()

  const [
    dailyLogsResult,
    labelsResult,
    papersResult,
  ] = await Promise.all([
    supabase
      .from('daily_logs')
      .select(`
        id,
        log_date,
        coffee_count
      `)
      .gte(
        'log_date',
        analyticsStart
      )
      .lte(
        'log_date',
        analyticsEnd
      )
      .order(
        'log_date',
        {
          ascending: true,
        }
      ),

    supabase
      .from(
        'activity_labels'
      )
      .select(`
        id,
        name,
        description,
        is_system,
        is_break,
        is_active
      `)
      .order(
        'is_system',
        {
          ascending: false,
        }
      )
      .order(
        'is_active',
        {
          ascending: false,
        }
      )
      .order(
        'name',
        {
          ascending: true,
        }
      ),

    supabase
      .from('papers')
      .select(`
        id,
        short_title,
        archived_at
      `)
      .order(
        'short_title',
        {
          ascending: true,
        }
      ),
  ])

  if (
    dailyLogsResult.error
  ) {
    throw new Error(
      `Could not load daily logs: ${dailyLogsResult.error.message}`
    )
  }

  if (
    labelsResult.error
  ) {
    throw new Error(
      `Could not load activity labels: ${labelsResult.error.message}`
    )
  }

  if (
    papersResult.error
  ) {
    throw new Error(
      `Could not load papers: ${papersResult.error.message}`
    )
  }

  const dailyLogs =
    dailyLogsResult.data ?? []

  const labels =
    labelsResult.data ?? []

  const papers =
    papersResult.data ?? []

  const dailyLogIds =
    dailyLogs.map(
      (log) =>
        log.id
    )

  let allSessionRows:
    {
      id: string
      daily_log_id: string
      start_time: string
      end_time: string
      place: string
      activity_label_id: string
      paper_id: string | null
      activity_labels:
        | {
            name: string
            is_break: boolean
            is_active: boolean
          }
        | {
            name: string
            is_break: boolean
            is_active: boolean
          }[]
        | null
      papers:
        | {
            short_title: string
            archived_at: string | null
          }
        | {
            short_title: string
            archived_at: string | null
          }[]
        | null
    }[] = []

  if (
    dailyLogIds.length >
    0
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'work_sessions'
      )
      .select(`
        id,
        daily_log_id,
        start_time,
        end_time,
        place,
        activity_label_id,
        paper_id,
        activity_labels (
          name,
          is_break,
          is_active
        ),
        papers (
          short_title,
          archived_at
        )
      `)
      .in(
        'daily_log_id',
        dailyLogIds
      )
      .order(
        'start_time',
        {
          ascending: true,
        }
      )

    if (error) {
      throw new Error(
        `Could not load work sessions: ${error.message}`
      )
    }

    allSessionRows =
      data ?? []
  }

  const sessionsByLog =
    new Map<
      string,
      {
        id: string
        start_time: string
        end_time: string
        place: string
        activity_label_id: string
        paper_id: string | null
        label_name: string
        label_is_break: boolean
        label_is_active: boolean
        paper_short_title: string | null
        paper_archived: boolean
      }[]
    >()

  for (const session of
    allSessionRows) {
    const activityLabel =
      Array.isArray(
        session.activity_labels
      )
        ? session.activity_labels[0]
        : session.activity_labels

    const paper =
      Array.isArray(
        session.papers
      )
        ? session.papers[0]
        : session.papers

    const normalisedSession = {
      id:
        session.id,
      start_time:
        session.start_time,
      end_time:
        session.end_time,
      place:
        session.place,
      activity_label_id:
        session.activity_label_id,
      paper_id:
        session.paper_id,
      label_name:
        activityLabel?.name ??
        'Unknown activity',
      label_is_break:
        activityLabel?.is_break ??
        false,
      label_is_active:
        activityLabel?.is_active ??
        false,
      paper_short_title:
        paper?.short_title ??
        null,
      paper_archived:
        paper?.archived_at !==
          null &&
        paper?.archived_at !==
          undefined,
    }

    const existing =
      sessionsByLog.get(
        session.daily_log_id
      ) ?? []

    existing.push(
      normalisedSession
    )

    sessionsByLog.set(
      session.daily_log_id,
      existing
    )
  }

  const selectedDailyLog =
    dailyLogs.find(
      (log) =>
        log.log_date ===
        selectedDate
    ) ?? null

  const selectedSessions =
    selectedDailyLog
      ? sessionsByLog.get(
          selectedDailyLog.id
        ) ?? []
      : []

  const analyticsLogs =
    dailyLogs.map(
      (log) => ({
        id:
          log.id,
        log_date:
          log.log_date,
        coffee_count:
          log.coffee_count,
        sessions:
          (
            sessionsByLog.get(
              log.id
            ) ?? []
          ).map(
            (session) => ({
              id:
                session.id,
              start_time:
                session.start_time,
              end_time:
                session.end_time,
              place:
                session.place,
              paper_id:
                session.paper_id,
              label_name:
                session.label_name,
              label_is_break:
                session.label_is_break,
              paper_short_title:
                session.paper_short_title,
            })
          ),
      })
    )

  return (
    <div className="flex flex-col [&>#location-labels]:order-last">
      <PageHeader
        title="Working Hours"
        description="Record and analyse daily work, breaks, activities, locations, papers, and coffee."
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <section
          aria-label="Date selection"
          className="h-full rounded-lg border border-oxford-stone bg-white p-4"
        >
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
              Selected day
            </div>

            <div className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
              {formatDate(
                selectedDate
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/hours?date=${previousDate}&period=${selectedPeriod}`}
              className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
            >
              ← Previous
            </Link>

            <ButtonLink
              href={`/hours?date=${today}&period=${selectedPeriod}`}
              variant="secondary"
            >
              Today
            </ButtonLink>

            <Link
              href={`/hours?date=${nextDate}&period=${selectedPeriod}`}
              className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
            >
              Next →
            </Link>
          </div>

          <form
            method="get"
            className="mt-4 flex flex-col gap-3 border-t border-oxford-stone pt-4 sm:flex-row sm:items-end"
          >
            <input
              type="hidden"
              name="period"
              value={
                selectedPeriod
              }
            />

            <div>
              <label
                htmlFor="hours-date"
                className="mb-1 block text-sm font-medium text-oxford-charcoal"
              >
                Go to date
              </label>

              <input
                id="hours-date"
                name="date"
                type="date"
                defaultValue={
                  selectedDate
                }
                className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
              />
            </div>

            <Button
              type="submit"
              variant="secondary"
            >
              Go
            </Button>
          </form>
        </section>

        <DailyLogSection
          key={selectedDate}
          date={
            selectedDate
          }
          log={
            selectedDailyLog
              ? {
                  id:
                    selectedDailyLog.id,
                  coffee_count:
                    selectedDailyLog.coffee_count,
                }
              : null
          }
          error={
            params.dailyError
          }
        />
      </div>

      <WorkSessionsSection
        date={
          selectedDate
        }
        dailyLogExists={
          selectedDailyLog !==
          null
        }
        sessions={
          selectedSessions
        }
        labels={
          labels
        }
        papers={
          papers
        }
        error={
          params.sessionError
        }
        locationError={
          params.locationError
        }
      />

      <HoursAnalyticsSection
        selectedDate={
          selectedDate
        }
        selectedPeriod={
          selectedPeriod
        }
        logs={
          analyticsLogs
        }
      />

      <ActivityLabelsSection
        labels={
          labels
        }
        error={
          params.labelError
        }
        message={
          params.labelMessage
        }
        returnDate={
          selectedDate
        }
      />
    </div>
  )
}
