import Card from '@/components/ui/card'

import {
  type TimeAnalyticsDailyLog,
  formatDuration,
  getDurationMinutes,
  getWeekEnd,
  getWeekStart,
  parseDate,
} from '@/lib/hours/analytics'

type ActivityOverTimeCardProps = {
  year: number
  logs: TimeAnalyticsDailyLog[]
}

type HeatmapDay = {
  date: string
  netMinutes: number
  inSelectedYear: boolean
}

type HeatmapWeek = {
  days: HeatmapDay[]
}

type MonthMarker = {
  label: string
  weekIndex: number
}

const DAY_MS =
  24 * 60 * 60 * 1000

function formatDateValue(
  date: Date
) {
  return date
    .toISOString()
    .slice(0, 10)
}

function formatFullDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  ).format(
    parseDate(value)
  )
}

function getDailyNetMinutes(
  logs: TimeAnalyticsDailyLog[]
) {
  return new Map(
    logs.map((log) => {
      const grossMinutes =
        log.sessions.reduce(
          (total, session) =>
            total +
            getDurationMinutes(
              session.start_time,
              session.end_time
            ),
          0
        )

      const breakMinutes =
        log.sessions.reduce(
          (total, session) =>
            total +
            (session.label_is_break
              ? getDurationMinutes(
                  session.start_time,
                  session.end_time
                )
              : 0),
          0
        )

      return [
        log.log_date,
        grossMinutes -
          breakMinutes,
      ] as const
    })
  )
}

function getDateRange(
  start: string,
  end: string
) {
  const dates: string[] = []
  const endTime =
    parseDate(end).getTime()

  for (
    let time =
      parseDate(start).getTime();
    time <= endTime;
    time += DAY_MS
  ) {
    dates.push(
      formatDateValue(
        new Date(time)
      )
    )
  }

  return dates
}

function getHeatmapClass(
  minutes: number
) {
  if (minutes <= 0) {
    return 'bg-oxford-shell'
  }

  if (minutes < 120) {
    return 'bg-sky-100'
  }

  if (minutes < 240) {
    return 'bg-sky-300'
  }

  if (minutes < 360) {
    return 'bg-sky-500'
  }

  if (minutes < 480) {
    return 'bg-sky-700'
  }

  return 'bg-oxford-blue'
}

function getHeatmapWeeks(
  year: number,
  dailyMinutes: Map<
    string,
    number
  >
) {
  const yearStart =
    `${year}-01-01`

  const yearEnd =
    `${year}-12-31`

  const heatmapStart =
    getWeekStart(
      yearStart
    )

  const heatmapEnd =
    getWeekEnd(
      yearEnd
    )

  const allDates =
    getDateRange(
      heatmapStart,
      heatmapEnd
    )

  const weeks:
    HeatmapWeek[] = []

  for (
    let index = 0;
    index <
    allDates.length;
    index += 7
  ) {
    weeks.push({
      days:
        allDates
          .slice(
            index,
            index + 7
          )
          .map(
            (date) => ({
              date,
              netMinutes:
                dailyMinutes.get(
                  date
                ) ?? 0,
              inSelectedYear:
                date >=
                  yearStart &&
                date <=
                  yearEnd,
            })
          ),
    })
  }

  return {
    weeks,
    heatmapStart,
  }
}

function getMonthMarkers(
  year: number,
  heatmapStart: string
): MonthMarker[] {
  return Array.from(
    { length: 12 },
    (_, month) => {
      const monthDate =
        new Date(
          Date.UTC(
            year,
            month,
            1
          )
        )

      const differenceDays =
        Math.floor(
          (
            monthDate.getTime() -
            parseDate(
              heatmapStart
            ).getTime()
          ) / DAY_MS
        )

      return {
        label:
          new Intl.DateTimeFormat(
            'en-GB',
            {
              month: 'short',
            }
          ).format(
            monthDate
          ),
        weekIndex:
          Math.floor(
            differenceDays / 7
          ),
      }
    }
  )
}

export default function ActivityOverTimeCard({
  year,
  logs,
}: ActivityOverTimeCardProps) {
  const dailyMinutes =
    getDailyNetMinutes(
      logs
    )

  const {
    weeks,
    heatmapStart,
  } = getHeatmapWeeks(
    year,
    dailyMinutes
  )

  const monthMarkers =
    getMonthMarkers(
      year,
      heatmapStart
    )

  return (
    <div className="mt-6">
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Activity over time
            </h3>

            <p className="mt-1 text-sm text-oxford-ash">
              Daily net working-hour intensity during {year}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-oxford-ash">
            <span>Less</span>
            <span className="h-3 w-3 rounded-sm bg-oxford-shell" />
            <span className="h-3 w-3 rounded-sm bg-sky-100" />
            <span className="h-3 w-3 rounded-sm bg-sky-300" />
            <span className="h-3 w-3 rounded-sm bg-sky-500" />
            <span className="h-3 w-3 rounded-sm bg-sky-700" />
            <span className="h-3 w-3 rounded-sm bg-oxford-blue" />
            <span>More</span>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="min-w-[820px]">
            <div className="ml-9 grid grid-cols-[repeat(53,minmax(0,1fr))] gap-1">
              {monthMarkers.map(
                (marker) => (
                  <span
                    key={marker.label}
                    className="text-xs text-oxford-ash"
                    style={{
                      gridColumnStart:
                        marker.weekIndex +
                        1,
                    }}
                  >
                    {marker.label}
                  </span>
                )
              )}
            </div>

            <div className="mt-2 flex gap-2">
              <div className="grid w-7 shrink-0 grid-rows-7 gap-1 text-[10px] text-oxford-ash">
                <span />
                <span className="flex items-center">Tue</span>
                <span />
                <span className="flex items-center">Thu</span>
                <span />
                <span className="flex items-center">Sat</span>
                <span />
              </div>

              <div
                className="grid flex-1 gap-1"
                style={{
                  gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                }}
              >
                {weeks.map(
                  (
                    week,
                    weekIndex
                  ) => (
                    <div
                      key={weekIndex}
                      className="grid grid-rows-7 gap-1"
                    >
                      {week.days.map(
                        (day) => (
                          <div
                            key={day.date}
                            title={
                              day.inSelectedYear
                                ? `${formatFullDate(
                                    day.date
                                  )}: ${formatDuration(
                                    day.netMinutes
                                  )} net`
                                : undefined
                            }
                            aria-label={
                              day.inSelectedYear
                                ? `${formatFullDate(
                                    day.date
                                  )}, ${formatDuration(
                                    day.netMinutes
                                  )} net working time`
                                : undefined
                            }
                            className={[
                              'aspect-square min-h-2.5 rounded-[2px]',
                              day.inSelectedYear
                                ? getHeatmapClass(
                                    day.netMinutes
                                  )
                                : 'bg-transparent',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          />
                        )
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-oxford-stone pt-3 text-xs text-oxford-ash">
          <span>0h</span>
          <span>&lt;2h</span>
          <span>2–4h</span>
          <span>4–6h</span>
          <span>6–8h</span>
          <span>8h+</span>
        </div>
      </Card>
    </div>
  )
}
