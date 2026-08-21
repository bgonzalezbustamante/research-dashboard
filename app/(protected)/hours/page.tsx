import Link from 'next/link'

import ActivityLabelsSection from '@/components/hours/activity-labels-section'
import DailyLogSection from '@/components/hours/daily-log-section'
import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import { createClient } from '@/lib/supabase/server'

type HoursPageProps = {
  searchParams: Promise<{
    date?: string
    dailyError?: string
    labelError?: string
  }>
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

  const supabase =
    await createClient()

  const [
    dailyLogResult,
    labelsResult,
  ] = await Promise.all([
    supabase
      .from('daily_logs')
      .select(`
        id,
        coffee_count
      `)
      .eq(
        'log_date',
        selectedDate
      )
      .maybeSingle(),

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
  ])

  if (
    dailyLogResult.error
  ) {
    throw new Error(
      `Could not load daily log: ${dailyLogResult.error.message}`
    )
  }

  if (
    labelsResult.error
  ) {
    throw new Error(
      `Could not load activity labels: ${labelsResult.error.message}`
    )
  }

  const dailyLog =
    dailyLogResult.data

  const labels =
    labelsResult.data ?? []

  return (
    <div>
      <PageHeader
        title="Working Hours"
        description="Record daily work, breaks, activities, locations, papers, and coffee."
      />

      <section
        aria-label="Date selection"
        className="mb-8 rounded-lg border border-oxford-stone bg-white p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/hours?date=${previousDate}`}
              className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
            >
              ← Previous
            </Link>

            <ButtonLink
              href={`/hours?date=${today}`}
              variant="secondary"
            >
              Today
            </ButtonLink>

            <Link
              href={`/hours?date=${nextDate}`}
              className="rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue"
            >
              Next →
            </Link>
          </div>
        </div>

        <form
          method="get"
          className="mt-4 flex flex-col gap-3 border-t border-oxford-stone pt-4 sm:flex-row sm:items-end"
        >
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
        date={
          selectedDate
        }
        log={
          dailyLog
        }
        error={
          params.dailyError
        }
      />

      <ActivityLabelsSection
        labels={
          labels
        }
        error={
          params.labelError
        }
        returnDate={
          selectedDate
        }
      />
    </div>
  )
}