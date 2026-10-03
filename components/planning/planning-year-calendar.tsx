'use client'

import Link from 'next/link'
import { useState } from 'react'

const WEEKDAYS = [
  'M',
  'T',
  'W',
  'T',
  'F',
  'S',
  'S',
] as const

type PlanningYearCalendarProps = {
  year: number
  selectedPeriodStart: string
}

function monthName(
  year: number,
  month: number
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      month: 'long',
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

function daysInMonth(
  year: number,
  month: number
) {
  return new Date(
    Date.UTC(
      year,
      month,
      0
    )
  ).getUTCDate()
}

function mondayIndex(
  year: number,
  month: number
) {
  const sundayBased =
    new Date(
      Date.UTC(
        year,
        month - 1,
        1
      )
    ).getUTCDay()

  return (
    sundayBased + 6
  ) % 7
}

function periodStartForDay(
  year: number,
  month: number,
  day: number
) {
  const monthText =
    String(month).padStart(
      2,
      '0'
    )

  return `${year}-${monthText}-${day <= 15 ? '01' : '16'}`
}

function periodLabel(
  year: number,
  month: number,
  day: number
) {
  const end =
    day <= 15
      ? 15
      : daysInMonth(
          year,
          month
        )

  return `${day <= 15 ? 1 : 16}–${end} ${monthName(
    year,
    month
  )} ${year}`
}

export default function PlanningYearCalendar({
  year,
  selectedPeriodStart,
}: PlanningYearCalendarProps) {
  const [
    hoveredPeriod,
    setHoveredPeriod,
  ] = useState<
    string | null
  >(null)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from(
        {
          length: 12,
        },
        (
          _,
          monthIndex
        ) => {
          const month =
            monthIndex + 1
          const firstOffset =
            mondayIndex(
              year,
              month
            )
          const totalDays =
            daysInMonth(
              year,
              month
            )

          const cells: (
            | number
            | null
          )[] = [
            ...Array.from(
              {
                length:
                  firstOffset,
              },
              () => null
            ),
            ...Array.from(
              {
                length:
                  totalDays,
              },
              (
                __,
                index
              ) =>
                index + 1
            ),
          ]

          while (
            cells.length <
            42
          ) {
            cells.push(
              null
            )
          }

          return (
            <section
              key={month}
              className="rounded-lg border border-oxford-stone bg-white p-3"
              onMouseLeave={() =>
                setHoveredPeriod(
                  null
                )
              }
            >
              <h4 className="font-serif text-base font-semibold text-oxford-blue">
                {monthName(
                  year,
                  month
                )}
              </h4>

              <div className="mt-3 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-oxford-ash">
                {WEEKDAYS.map(
                  (
                    weekday,
                    index
                  ) => (
                    <span
                      key={
                        weekday +
                        index
                      }
                    >
                      {weekday}
                    </span>
                  )
                )}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-0.5">
                {cells.map(
                  (
                    day,
                    index
                  ) => {
                    if (
                      day ===
                      null
                    ) {
                      return (
                        <span
                          key={
                            `blank-${index}`
                          }
                          aria-hidden="true"
                          className="aspect-square"
                        />
                      )
                    }

                    const period =
                      periodStartForDay(
                        year,
                        month,
                        day
                      )
                    const selected =
                      period ===
                      selectedPeriodStart
                    const hovered =
                      period ===
                      hoveredPeriod

                    return (
                      <Link
                        key={
                          day
                        }
                        href={`/planning?period=${period}#allocations`}
                        title={`Open ${periodLabel(
                          year,
                          month,
                          day
                        )}`}
                        aria-label={`${day} ${monthName(
                          year,
                          month
                        )} ${year}; open Planning period ${periodLabel(
                          year,
                          month,
                          day
                        )}`}
                        onMouseEnter={() =>
                          setHoveredPeriod(
                            period
                          )
                        }
                        onFocus={() =>
                          setHoveredPeriod(
                            period
                          )
                        }
                        onBlur={() =>
                          setHoveredPeriod(
                            null
                          )
                        }
                        className={
                          'flex aspect-square items-center justify-center rounded text-xs transition focus:outline-none focus:ring-2 focus:ring-oxford-blue focus:ring-offset-1 ' +
                          (
                            selected
                              ? 'bg-oxford-cool-grey font-semibold text-oxford-blue ring-1 ring-inset ring-oxford-blue'
                              : hovered
                                ? 'bg-oxford-shell font-medium text-oxford-blue'
                                : 'text-oxford-charcoal hover:bg-oxford-shell hover:text-oxford-blue'
                          )
                        }
                      >
                        {day}
                      </Link>
                    )
                  }
                )}
              </div>
            </section>
          )
        }
      )}
    </div>
  )
}
