export type PlanningSourceType =
  | 'conference'
  | 'teaching'
  | 'blocked_event'

export type PlanningBlockedEventType =
  | 'winter_holiday'
  | 'summer_holiday'
  | 'administrative'
  | 'sick'

export type PlanningSourceState = {
  source_type: PlanningSourceType
  source_id: string
  period_start: string
  flowsavvy_added: boolean
  flowsavvy_added_at: string | null
}

export type ConferencePlanningSource = {
  id: string
  event_name: string
  event_short_name: string
  start_date: string
  end_date: string
  personal_attendance: boolean
  involves_trip: boolean
}

export type TeachingPlanningSource = {
  id: string
  name: string
  start_year: number
  end_year: number | null
  is_current: boolean
  planning_months: number[]
  committed_days_per_week: number
}

export type BlockedEventPlanningSource = {
  id: string
  event_type: PlanningBlockedEventType
  start_date: string
  end_date: string
  notes: string | null
}

export type DerivedPlanningAllocation = {
  id: string
  period_start: string
  allocation_type: 'blocked'
  source:
    | 'conference'
    | 'teaching'
    | 'blocked_event'
  source_type: PlanningSourceType
  source_id: string
  blocked_type:
    | 'conference'
    | 'teaching'
    | PlanningBlockedEventType
  label: string
  subtitle: string
  committed_days: number
  flowsavvy_added: boolean
  flowsavvy_added_at: string | null
  flowsavvy_count: number
  flowsavvy_total: number
  notes: string | null
  source_href: string
  range_start: string | null
  range_end: string | null
  dated_days: string[]
}

export type PlanningOverlap = {
  date: string
  allocations: {
    id: string
    label: string
  }[]
}

const MS_PER_DAY = 86400000

function parseDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .slice(0, 10)
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

function formatDate(
  value: Date
) {
  return value
    .toISOString()
    .slice(0, 10)
}

function addDays(
  value: string,
  days: number
) {
  const date =
    parseDate(value)

  return formatDate(
    new Date(
      date.getTime() +
        days * MS_PER_DAY
    )
  )
}

function datesBetweenInclusive(
  startDate: string,
  endDate: string
) {
  const start =
    parseDate(startDate)

  const end =
    parseDate(endDate)

  const dates: string[] = []

  for (
    let cursor = start.getTime();
    cursor <= end.getTime();
    cursor += MS_PER_DAY
  ) {
    dates.push(
      formatDate(
        new Date(cursor)
      )
    )
  }

  return dates
}

export function getPlanningPeriodStartForDate(
  value: string
) {
  const day =
    Number(
      value.slice(8, 10)
    )

  return `${value.slice(0, 8)}${
    day <= 15 ? '01' : '16'
  }`
}

function stateKey(
  sourceType: PlanningSourceType,
  sourceId: string,
  periodStart: string
) {
  return `${sourceType}:${sourceId}:${periodStart}`
}

function stateMap(
  states: PlanningSourceState[]
) {
  return new Map(
    states.map((state) => [
      stateKey(
        state.source_type,
        state.source_id,
        state.period_start
      ),
      state,
    ])
  )
}

function blockedEventLabel(
  type: PlanningBlockedEventType
) {
  switch (type) {
    case 'winter_holiday':
      return 'Winter holiday'
    case 'summer_holiday':
      return 'Summer holiday'
    case 'administrative':
      return 'Administrative'
    case 'sick':
      return 'Sick'
  }
}

function withState(
  allocation: Omit<
    DerivedPlanningAllocation,
    | 'flowsavvy_added'
    | 'flowsavvy_added_at'
    | 'flowsavvy_count'
    | 'flowsavvy_total'
  >,
  states: Map<
    string,
    PlanningSourceState
  >
): DerivedPlanningAllocation {
  const state =
    states.get(
      stateKey(
        allocation.source_type,
        allocation.source_id,
        allocation.period_start
      )
    )

  const added =
    state?.flowsavvy_added ??
    false

  return {
    ...allocation,
    flowsavvy_added: added,
    flowsavvy_added_at:
      state?.flowsavvy_added_at ??
      null,
    flowsavvy_count:
      added ? 1 : 0,
    flowsavvy_total: 1,
  }
}

function allocationsFromDatedSource({
  sourceType,
  sourceId,
  blockedType,
  label,
  subtitle,
  startDate,
  endDate,
  notes,
  sourceHref,
  year,
  states,
}: {
  sourceType:
    | 'conference'
    | 'blocked_event'
  sourceId: string
  blockedType:
    | 'conference'
    | PlanningBlockedEventType
  label: string
  subtitle: string
  startDate: string
  endDate: string
  notes: string | null
  sourceHref: string
  year: number
  states: Map<
    string,
    PlanningSourceState
  >
}) {
  const dates =
    datesBetweenInclusive(
      startDate,
      endDate
    ).filter(
      (date) =>
        Number(
          date.slice(0, 4)
        ) === year
    )

  const byPeriod =
    new Map<
      string,
      string[]
    >()

  for (const date of dates) {
    const periodStart =
      getPlanningPeriodStartForDate(
        date
      )

    const periodDates =
      byPeriod.get(
        periodStart
      ) ?? []

    periodDates.push(date)

    byPeriod.set(
      periodStart,
      periodDates
    )
  }

  return [
    ...byPeriod.entries(),
  ].map(
    ([
      periodStart,
      periodDates,
    ]) =>
      withState(
        {
          id:
            `source:${sourceType}:${sourceId}:${periodStart}`,
          period_start:
            periodStart,
          allocation_type:
            'blocked',
          source:
            sourceType,
          source_type:
            sourceType,
          source_id:
            sourceId,
          blocked_type:
            blockedType,
          label,
          subtitle,
          committed_days:
            periodDates.length,
          notes,
          source_href:
            sourceHref,
          range_start:
            periodDates[0] ??
            null,
          range_end:
            periodDates[
              periodDates.length -
                1
            ] ?? null,
          dated_days:
            periodDates,
        },
        states
      )
  )
}

export function deriveSourceBackedPlanning({
  year,
  conferences,
  teaching,
  blockedEvents,
  states,
}: {
  year: number
  conferences: ConferencePlanningSource[]
  teaching: TeachingPlanningSource[]
  blockedEvents: BlockedEventPlanningSource[]
  states: PlanningSourceState[]
}) {
  const statesBySource =
    stateMap(states)

  const allocations:
    DerivedPlanningAllocation[] = []

  for (const conference of
    conferences) {
    if (
      !conference.personal_attendance
    ) {
      continue
    }

    const startDate =
      conference.involves_trip
        ? addDays(
            conference.start_date,
            -1
          )
        : conference.start_date

    const endDate =
      conference.involves_trip
        ? addDays(
            conference.end_date,
            1
          )
        : conference.end_date

    allocations.push(
      ...allocationsFromDatedSource(
        {
          sourceType:
            'conference',
          sourceId:
            conference.id,
          blockedType:
            'conference',
          label:
            conference.event_short_name,
          subtitle:
            conference.involves_trip
              ? 'Conference attendance + trip'
              : 'Conference attendance',
          startDate,
          endDate,
          notes: null,
          sourceHref:
            '/conferences',
          year,
          states:
            statesBySource,
        }
      )
    )
  }

  for (const item of
    teaching) {
    if (
      item.committed_days_per_week <=
      0
    ) {
      continue
    }

    if (year < item.start_year) {
      continue
    }

    if (
      !item.is_current &&
      item.end_year !== null &&
      year > item.end_year
    ) {
      continue
    }

    const committedDays =
      item.committed_days_per_week *
      2

    for (const month of
      item.planning_months) {
      const monthText =
        String(
          month
        ).padStart(
          2,
          '0'
        )

      for (const day of [
        '01',
        '16',
      ]) {
        const periodStart =
          `${year}-${monthText}-${day}`

        allocations.push(
          withState(
            {
              id:
                `source:teaching:${item.id}:${periodStart}`,
              period_start:
                periodStart,
              allocation_type:
                'blocked',
              source:
                'teaching',
              source_type:
                'teaching',
              source_id:
                item.id,
              blocked_type:
                'teaching',
              label:
                item.name,
              subtitle:
                `Teaching · ${item.committed_days_per_week} day${
                  item.committed_days_per_week ===
                  1
                    ? ''
                    : 's'
                }/week`,
              committed_days:
                committedDays,
              notes: null,
              source_href:
                '/teaching',
              range_start: null,
              range_end: null,
              dated_days: [],
            },
            statesBySource
          )
        )
      }
    }
  }

  for (const event of
    blockedEvents) {
    allocations.push(
      ...allocationsFromDatedSource(
        {
          sourceType:
            'blocked_event',
          sourceId:
            event.id,
          blockedType:
            event.event_type,
          label:
            blockedEventLabel(
              event.event_type
            ),
          subtitle:
            'Dated blocked time',
          startDate:
            event.start_date,
          endDate:
            event.end_date,
          notes:
            event.notes,
          sourceHref:
            '/planning',
          year,
          states:
            statesBySource,
        }
      )
    )
  }

  return allocations.sort(
    (a, b) =>
      a.period_start.localeCompare(
        b.period_start
      ) ||
      a.label.localeCompare(
        b.label
      )
  )
}

export function findPlanningOverlaps(
  allocations:
    DerivedPlanningAllocation[],
  periodStart?: string
): PlanningOverlap[] {
  const dated =
    periodStart
      ? allocations.filter(
          (allocation) =>
            allocation.period_start ===
            periodStart
        )
      : allocations

  const byDate =
    new Map<
      string,
      Map<
        string,
        {
          id: string
          label: string
        }
      >
    >()

  for (const allocation of dated) {
    for (const date of
      allocation.dated_days) {
      const entries =
        byDate.get(date) ??
        new Map()

      entries.set(
        allocation.id,
        {
          id:
            allocation.id,
          label:
            allocation.label,
        }
      )

      byDate.set(
        date,
        entries
      )
    }
  }

  return [
    ...byDate.entries(),
  ]
    .filter(
      ([, entries]) =>
        entries.size > 1
    )
    .map(
      ([date, entries]) => ({
        date,
        allocations: [
          ...entries.values(),
        ],
      })
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    )
}
