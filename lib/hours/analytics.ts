export type AnalyticsPeriod =
  | 'day'
  | 'week'
  | 'month'
  | 'year'

export type TimeAnalyticsSession = {
  start_time: string
  end_time: string
  paper_id: string | null
  label_is_break: boolean
}

export type TimeAnalyticsDailyLog = {
  id: string
  log_date: string
  coffee_count: number
  sessions: TimeAnalyticsSession[]
}

export type HoursAnalyticsSession =
  TimeAnalyticsSession & {
    id: string
    place: string
    label_name: string
    paper_short_title:
      | string
      | null
  }

export type HoursAnalyticsDailyLog =
  Omit<
    TimeAnalyticsDailyLog,
    'sessions'
  > & {
    sessions:
      HoursAnalyticsSession[]
  }

export type PeriodSummary = {
  grossMinutes: number
  breakMinutes: number
  netMinutes: number
  paperMinutes: number
  unassignedMinutes: number
  coffeeCount: number
  workingDays: number
}

export type MonthlySummary =
  PeriodSummary & {
    month: number
  }

export type LocationSummary = {
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
  const [
    hours,
    minutes,
  ] = normaliseTime(value)
    .split(':')
    .map(Number)

  return (
    hours * 60 +
    minutes
  )
}

export function getDurationMinutes(
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

export function parseDate(
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

export function shiftDate(
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

export function getWeekStart(
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

export function getWeekEnd(
  value: string
) {
  return shiftDate(
    getWeekStart(value),
    6
  )
}

export function getMonthStart(
  value: string
) {
  return `${value.slice(
    0,
    7
  )}-01`
}

export function getMonthEnd(
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

export function getYearStart(
  value: string
) {
  return `${value.slice(
    0,
    4
  )}-01-01`
}

export function getYearEnd(
  value: string
) {
  return `${value.slice(
    0,
    4
  )}-12-31`
}

export function getPeriodBounds(
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

export function formatDuration(
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

export function formatPeriodLabel(
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

export function summarisePeriod(
  logs:
    TimeAnalyticsDailyLog[],
  start: string,
  end: string
): PeriodSummary {
  let grossMinutes = 0
  let breakMinutes = 0
  let paperMinutes = 0
  let unassignedMinutes = 0
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

        continue
      }

      if (session.paper_id) {
        paperMinutes +=
          duration
      } else {
        unassignedMinutes +=
          duration
      }
    }
  }

  const netMinutes =
    grossMinutes -
    breakMinutes

  return {
    grossMinutes,
    breakMinutes,
    netMinutes,
    paperMinutes,
    unassignedMinutes,
    coffeeCount,
    workingDays,
  }
}

export function summariseMonths(
  logs:
    TimeAnalyticsDailyLog[],
  year: number
): MonthlySummary[] {
  return Array.from(
    {
      length: 12,
    },
    (
      _,
      index
    ) => {
      const month =
        index + 1

      const monthString =
        String(
          month
        ).padStart(
          2,
          '0'
        )

      const anchor =
        `${year}-${monthString}-01`

      const summary =
        summarisePeriod(
          logs,
          getMonthStart(
            anchor
          ),
          getMonthEnd(
            anchor
          )
        )

      return {
        month,
        ...summary,
      }
    }
  )
}

export function getActivityTotals(
  logs:
    HoursAnalyticsDailyLog[],
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
        (
          totals.get(
            session.label_name
          ) ?? 0
        ) +
          duration
      )
    }
  }

  return [
    ...totals.entries(),
  ]
    .map(
      ([
        name,
        minutes,
      ]) => ({
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

export function getPaperTotals(
  logs:
    HoursAnalyticsDailyLog[],
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
        (
          totals.get(
            name
          ) ?? 0
        ) +
          duration
      )
    }
  }

  return [
    ...totals.entries(),
  ]
    .map(
      ([
        name,
        minutes,
      ]) => ({
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

export function getLocationTotals(
  logs:
    HoursAnalyticsDailyLog[],
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

  return [
    ...totals.entries(),
  ]
    .map(
      ([
        name,
        summary,
      ]) => ({
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