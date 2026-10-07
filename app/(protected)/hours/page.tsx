import Link from 'next/link'

import ActivityLabelsSection from '@/components/hours/activity-labels-section'
import DailyLogSection from '@/components/hours/daily-log-section'
import HoursAnalyticsSection from '@/components/hours/hours-analytics-section'
import WorkSessionsSection from '@/components/hours/work-sessions-section'
import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import { requireDashboardAccess } from '@/lib/auth/dashboard-access'
import { resolveHoursPenguin } from '@/lib/hours/penguin-state'
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
    activityPage?: string
    locationPage?: string
    mergeError?: string
    mergeMessage?: string
  }>
}

const analyticsPeriods:
  AnalyticsPeriod[] = [
    'day',
    'week',
    'month',
    'year',
  ]

const SESSION_PAGE_SIZE =
  1000

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

function getSessionMinutes(
  startTime: string,
  endTime: string
) {
  const toMinutes = (
    value: string
  ) => {
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

  return Math.max(
    0,
    toMinutes(endTime) -
      toMinutes(startTime)
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

  const access =
    await requireDashboardAccess()

  const supabase =
    await createClient()

  const [
    dailyLogsResult,
    labelsResult,
    papersResult,
    conferencesResult,
    blockedEventsResult,
    teachingSettingsResult,
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
        is_active,
        major_activity,
        merged_into_id,
        merged_at
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

    supabase
      .from(
        'conference_presentations'
      )
      .select(`
        event_short_name,
        start_date,
        end_date,
        personal_attendance,
        involves_trip
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .lte(
        'start_date',
        nextDate
      )
      .gte(
        'end_date',
        previousDate
      ),

    supabase
      .from(
        'planning_blocked_events'
      )
      .select(`
        event_type,
        start_date,
        end_date
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .lte(
        'start_date',
        selectedDate
      )
      .gte(
        'end_date',
        selectedDate
      ),

    supabase
      .from(
        'teaching_settings'
      )
      .select(
        'teaching_season_active'
      )
      .eq(
        'owner_id',
        access.ownerId
      )
      .maybeSingle(),
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

  for (const [
    label,
    result,
  ] of [
    [
      'conference data',
      conferencesResult,
    ],
    [
      'availability data',
      blockedEventsResult,
    ],
    [
      'Teaching settings',
      teachingSettingsResult,
    ],
  ] as const) {
    if (result.error) {
      throw new Error(
        `Could not load Penguin Timeline ${label}: ${result.error.message}`
      )
    }
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

  const allSessionRows:
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
            major_activity: string | null
          }
        | {
            name: string
            is_break: boolean
            is_active: boolean
            major_activity: string | null
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
    let from = 0

    while (true) {
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
            is_active,
            major_activity
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
          `Could not load work sessions: ${error.message}`
        )
      }

      const rows =
        data ?? []

      allSessionRows.push(
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
      label_major_activity:
        activityLabel?.major_activity ??
        null,
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

  const selectedNetMinutes =
    selectedSessions
      .filter(
        (session) =>
          !session.label_is_break
      )
      .reduce(
        (
          total,
          session
        ) =>
          total +
          getSessionMinutes(
            session.start_time,
            session.end_time
          ),
        0
      )

  const selectedPenguin =
    resolveHoursPenguin({
      date:
        selectedDate,
      today,
      netMinutes:
        selectedNetMinutes,
      coffeeCount:
        selectedDailyLog
          ?.coffee_count ??
        0,
      teachingSeasonActive:
        teachingSettingsResult
          .data
          ?.teaching_season_active ??
        false,
      conferences:
        conferencesResult.data ??
        [],
      blockedEvents:
        blockedEventsResult.data ??
        [],
    })

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
              label_major_activity:
                session.label_major_activity,
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
          className="relative h-full rounded-lg border border-oxford-stone bg-white p-4"
        >
          <div
            className="absolute bottom-2 right-2 flex w-[188px] flex-col items-center gap-0.5 text-center"
          >
            <span
              role="img"
              aria-label={
                selectedPenguin.label
              }
              className="block aspect-square w-[188px] bg-contain bg-center bg-no-repeat drop-shadow-[0_6px_7px_rgba(0,33,71,0.08)]"
              style={{
                backgroundImage:
                  `url("${selectedPenguin.src}")`,
              }}
            />

            <a
              href="https://timeline.bgonzalezbustamante.com"
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap text-[9px] font-medium leading-3 text-oxford-peach underline decoration-oxford-peach/50 underline-offset-2 hover:text-oxford-blue"
            >
              timeline.bgonzalezbustamante.com
            </a>
          </div>

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
        locationPage={
          Number.parseInt(
            params.locationPage ??
              '1',
            10
          )
        }
        mergeError={
          params.mergeError
        }
        mergeMessage={
          params.mergeMessage
        }
        period={
          selectedPeriod
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
        period={
          selectedPeriod
        }
        page={
          Number.parseInt(
            params.activityPage ??
              '1',
            10
          )
        }
      />
    </div>
  )
}
