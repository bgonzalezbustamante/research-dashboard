type AllocationType =
  | 'paper'
  | 'blocked'

type PlanningAllocation = {
  allocation_type: AllocationType
  committed_days: number
  flowsavvy_added: boolean
}

type PlanningPeriodLoadProps = {
  allocations: PlanningAllocation[]
}

function getLoadPresentation(
  totalDays: number
) {
  if (totalDays === 0) {
    return {
      label: 'Open',
      container:
        'border-green-200 bg-green-50',
      text: 'text-green-900',
      secondary:
        'text-green-800',
      bar: 'bg-green-500',
    }
  }

  if (totalDays <= 5) {
    return {
      label: 'Light commitment',
      container:
        'border-green-200 bg-green-50',
      text: 'text-green-900',
      secondary:
        'text-green-800',
      bar: 'bg-green-500',
    }
  }

  if (totalDays <= 10) {
    return {
      label: 'Moderate commitment',
      container:
        'border-yellow-200 bg-yellow-50',
      text: 'text-yellow-900',
      secondary:
        'text-yellow-800',
      bar: 'bg-yellow-500',
    }
  }

  if (totalDays <= 15) {
    return {
      label: 'Full commitment',
      container:
        'border-orange-200 bg-orange-50',
      text: 'text-orange-900',
      secondary:
        'text-orange-800',
      bar: 'bg-orange-500',
    }
  }

  return {
    label: 'Overcommitted',
    container:
      'border-orange-300 bg-orange-100',
    text: 'text-orange-950',
    secondary:
      'text-orange-900',
    bar: 'bg-orange-700',
  }
}

export default function PlanningPeriodLoad({
  allocations,
}: PlanningPeriodLoadProps) {
  const totalDays =
    allocations.reduce(
      (total, allocation) =>
        total +
        allocation.committed_days,
      0
    )

  const paperCount =
    allocations.filter(
      (allocation) =>
        allocation.allocation_type ===
        'paper'
    ).length

  const blockedCount =
    allocations.filter(
      (allocation) =>
        allocation.allocation_type ===
        'blocked'
    ).length

  const calendarCount =
    allocations.filter(
      (allocation) =>
        allocation.flowsavvy_added
    ).length

  const load =
    getLoadPresentation(totalDays)

  const loadPercentage =
    Math.min(
      100,
      (totalDays / 15) * 100
    )

  return (
    <section
      aria-label="Period load"
      className={`h-full rounded-lg border p-4 ${load.container}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div
            className={`text-xs font-medium uppercase tracking-wide ${load.secondary}`}
          >
            Period load
          </div>

          <div
            className={`mt-1 font-serif text-2xl font-semibold ${load.text}`}
          >
            {totalDays}{' '}
            committed{' '}
            {totalDays === 1
              ? 'day'
              : 'days'}
          </div>

          <p
            className={`mt-1 text-sm ${load.secondary}`}
          >
            {paperCount}{' '}
            {paperCount === 1
              ? 'paper'
              : 'papers'}{' '}
            · {blockedCount}{' '}
            blocked{' '}
            {blockedCount === 1
              ? 'allocation'
              : 'allocations'}{' '}
            · {load.label}
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <div
              className={`text-xs uppercase tracking-wide ${load.secondary}`}
            >
              FlowSavvy/Calendar
            </div>

            <div
              className={`mt-1 font-medium ${load.text}`}
            >
              {calendarCount}/
              {allocations.length}{' '}
              added
            </div>
          </div>

          {totalDays > 15 && (
            <div>
              <div
                className={`text-xs uppercase tracking-wide ${load.secondary}`}
              >
                Above reference
              </div>

              <div
                className={`mt-1 font-medium ${load.text}`}
              >
                +{totalDays - 15}{' '}
                days
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full rounded-full ${load.bar}`}
          style={{
            width: `${loadPercentage}%`,
          }}
        />
      </div>

      <p
        className={`mt-2 text-xs ${load.secondary}`}
      >
        Paper allocations and blocked
        time both count towards the
        15-day planning reference.
      </p>
    </section>
  )
}
