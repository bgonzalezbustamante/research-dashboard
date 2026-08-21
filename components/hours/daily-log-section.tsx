import {
  saveDailyLog,
} from '@/app/(protected)/hours/actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

type DailyLog = {
  id: string
  coffee_count: number
} | null

type DailyLogSectionProps = {
  date: string
  log: DailyLog
  error?: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function formatDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
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

export default function DailyLogSection({
  date,
  log,
  error,
}: DailyLogSectionProps) {
  return (
    <section
      id="daily-log"
      className="scroll-mt-6"
    >
      <div className="mb-4">
        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
          Daily log
        </h2>

        <p className="mt-1 text-sm text-oxford-ash">
          Record the daily context
          for {formatDate(date)}.
          Locations will be recorded
          separately for each work
          session.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-serif text-xl font-semibold text-oxford-blue">
              Daily context
            </h3>

            <p className="mt-1 text-sm leading-6 text-oxford-ash">
              Coffee count applies
              to the whole working
              day. Work location is
              recorded at session
              level so one day can
              include several places.
            </p>
          </div>

          <span
            className={
              log
                ? 'inline-flex w-fit rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                : 'inline-flex w-fit rounded-full border border-oxford-stone bg-oxford-shell px-2.5 py-1 text-xs font-medium text-oxford-ash'
            }
          >
            {log
              ? 'Saved'
              : 'Not saved'}
          </span>
        </div>

        <form
          action={saveDailyLog}
          className="mt-6"
        >
          <input
            type="hidden"
            name="log_date"
            value={date}
          />

          <div className="max-w-xs">
            <label
              htmlFor="coffee-count"
              className={labelClass}
            >
              Coffees
            </label>

            <input
              id="coffee-count"
              name="coffee_count"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={
                log?.coffee_count ??
                0
              }
              className={inputClass}
            />

            <p className="mt-1 text-xs text-oxford-ash">
              Total number of coffees
              consumed during the day.
            </p>
          </div>

          <div className="mt-5">
            <Button
              type="submit"
              variant="primary"
            >
              {log
                ? 'Save changes'
                : 'Create daily log'}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}