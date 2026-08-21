import Card from '@/components/ui/card'

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

type HoursVisualisationsSectionProps = {
  selectedDate: string
  logs: AnalyticsDailyLog[]
}

type DailyHours = {
  date: string
  netMinutes: number
}

type HeatmapDay = DailyHours & {
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

function timeToMinutes(
  value: string
) {
  const [hours, minutes] =
    value
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
  return (
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
  logs: AnalyticsDailyLog[]
) {
  const result =
    new Map<
      string,
      number
    >()

  for (const log of logs) {
    let grossMinutes = 0
    let breakMinutes = 0

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

    result.set(
      log.log_date,
      grossMinutes -
        breakMinutes
    )
  }

  return result
}

function getDateRange(
  start: string,
  end: string
) {
  const dates: string[] = []

  let current =
    parseDate(start)

  const endDate =
    parseDate(end)

  while (
    current.getTime() <=
    endDate.getTime()
  ) {
    dates.push(
      formatDateValue(
        current
      )
    )

    current =
      new Date(
        current.getTime() +
          DAY_MS
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
  selectedDate: string,
  dailyMinutes: Map<
    string,
    number
  >
) {
  const year =
    selectedDate.slice(
      0,
      4
    )

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
  selectedDate: string,
  heatmapStart: string
): MonthMarker[] {
  const year =
    Number(
      selectedDate.slice(
        0,
        4
      )
    )

  const markers:
    MonthMarker[] = []

  for (
    let month = 0;
    month < 12;
    month += 1
  ) {
    const monthDate =
      new Date(
        Date.UTC(
          year,
          month,
          1
        )
      )

    const monthValue =
      formatDateValue(
        monthDate
      )

    const differenceDays =
      Math.floor(
        (
          parseDate(
            monthValue
          ).getTime() -
          parseDate(
            heatmapStart
          ).getTime()
        ) / DAY_MS
      )

    const weekIndex =
      Math.floor(
        differenceDays / 7
      )

    markers.push({
      label:
        new Intl.DateTimeFormat(
          'en-GB',
          {
            month: 'short',
          }
        ).format(
          monthDate
        ),
      weekIndex,
    })
  }

  return markers
}

export default function HoursVisualisationsSection({
  selectedDate,
  logs,
}: HoursVisualisationsSectionProps) {
  const dailyMinutes =
    getDailyNetMinutes(
      logs
    )

  const {
    weeks,
    heatmapStart,
  } = getHeatmapWeeks(
    selectedDate,
    dailyMinutes
  )

  const monthMarkers =
    getMonthMarkers(
      selectedDate,
      heatmapStart
    )

  const selectedYear =
    selectedDate.slice(
      0,
      4
    )

  return (
    <section
      id="hours-visualisations"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4">
        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Activity over time
        </h2>

        <p className="mt-1 text-sm text-oxford-ash">
          Daily net working-hour
          intensity across the
          selected calendar year.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Working-hours
              heatmap
            </h3>

            <p className="mt-1 text-sm text-oxford-ash">
              Daily net working
              hours during{' '}
              {selectedYear}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-oxford-ash">
            <span>
              Less
            </span>

            <span className="h-3 w-3 rounded-sm bg-oxford-shell" />
            <span className="h-3 w-3 rounded-sm bg-sky-100" />
            <span className="h-3 w-3 rounded-sm bg-sky-300" />
            <span className="h-3 w-3 rounded-sm bg-sky-500" />
            <span className="h-3 w-3 rounded-sm bg-sky-700" />
            <span className="h-3 w-3 rounded-sm bg-oxford-blue" />

            <span>
              More
            </span>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="min-w-[820px]">
            <div className="ml-9 grid grid-cols-[repeat(53,minmax(0,1fr))] gap-1">
              {monthMarkers.map(
                (marker) => (
                  <span
                    key={
                      marker.label
                    }
                    className="text-xs text-oxford-ash"
                    style={{
                      gridColumnStart:
                        marker.weekIndex +
                        1,
                    }}
                  >
                    {
                      marker.label
                    }
                  </span>
                )
              )}
            </div>

            <div className="mt-2 flex gap-2">
              <div className="grid w-7 shrink-0 grid-rows-7 gap-1 text-[10px] text-oxford-ash">
                <span />

                <span className="flex items-center">
                  Tue
                </span>

                <span />

                <span className="flex items-center">
                  Thu
                </span>

                <span />

                <span className="flex items-center">
                  Sat
                </span>

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
                      key={
                        weekIndex
                      }
                      className="grid grid-rows-7 gap-1"
                    >
                      {week.days.map(
                        (day) => {
                          const selected =
                            day.date ===
                            selectedDate

                          return (
                            <div
                              key={
                                day.date
                              }
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
                                selected
                                  ? 'ring-2 ring-oxford-blue ring-offset-1'
                                  : '',
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  ' '
                                )}
                            />
                          )
                        }
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-oxford-stone pt-3 text-xs text-oxford-ash">
          <span>
            0h
          </span>

          <span>
            &lt;2h
          </span>

          <span>
            2–4h
          </span>

          <span>
            4–6h
          </span>

          <span>
            6–8h
          </span>

          <span>
            8h+
          </span>
        </div>
      </Card>
    </section>
  )
}