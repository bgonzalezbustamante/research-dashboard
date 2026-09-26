export type PlanningMilestone = {
  id: string
  paper_id: string
  title: string
  target_date: string
  committed_days: number
  flowsavvy_added: boolean
  flowsavvy_added_at: string | null
  paper_short_title: string
  paper_title: string
  paper_archived: boolean
}

export type MilestonePlanningAllocation = {
  id: string
  period_start: string
  allocation_type: 'paper'
  source: 'milestone'
  blocked_type: null
  committed_days: number
  flowsavvy_added: boolean
  flowsavvy_added_at: string | null
  flowsavvy_count: number
  flowsavvy_total: number
  notes: null
  paper_id: string
  paper_short_title: string
  paper_title: string
  paper_archived: boolean
  milestones: PlanningMilestone[]
}

export function getPlanningPeriodStartForDate(
  value: string
) {
  const day =
    Number(
      value.slice(8, 10)
    )

  return `${value.slice(
    0,
    8
  )}${day <= 15 ? '01' : '16'}`
}

export function getPlanningPeriodEnd(
  periodStart: string
) {
  const [
    year,
    month,
    day,
  ] = periodStart
    .split('-')
    .map(Number)

  if (day === 1) {
    return `${periodStart.slice(
      0,
      8
    )}15`
  }

  return new Date(
    Date.UTC(
      year,
      month,
      0
    )
  )
    .toISOString()
    .slice(0, 10)
}

export function getPlanningPeriodStartsForYear(
  year: number
) {
  const starts: string[] = []

  for (
    let month = 1;
    month <= 12;
    month += 1
  ) {
    const monthString =
      String(month).padStart(
        2,
        '0'
      )

    starts.push(
      `${year}-${monthString}-01`,
      `${year}-${monthString}-16`
    )
  }

  return starts
}

export function aggregateMilestonesByPaperAndPeriod(
  milestones: PlanningMilestone[]
) {
  const groups =
    new Map<
      string,
      MilestonePlanningAllocation
    >()

  for (const milestone of
    milestones) {
    const periodStart =
      getPlanningPeriodStartForDate(
        milestone.target_date
      )

    const key =
      `${periodStart}:${milestone.paper_id}`

    const existing =
      groups.get(key)

    if (existing) {
      existing.committed_days +=
        milestone.committed_days
      existing.flowsavvy_count +=
        milestone.flowsavvy_added
          ? 1
          : 0
      existing.flowsavvy_total +=
        1
      existing.flowsavvy_added =
        existing.flowsavvy_count ===
        existing.flowsavvy_total
      existing.flowsavvy_added_at =
        existing.flowsavvy_added
          ? milestone.flowsavvy_added_at ??
            existing.flowsavvy_added_at
          : null
      existing.milestones.push(
        milestone
      )
      continue
    }

    groups.set(key, {
      id:
        `milestone:${periodStart}:${milestone.paper_id}`,
      period_start:
        periodStart,
      allocation_type:
        'paper',
      source:
        'milestone',
      blocked_type:
        null,
      committed_days:
        milestone.committed_days,
      flowsavvy_added:
        milestone.flowsavvy_added,
      flowsavvy_added_at:
        milestone.flowsavvy_added
          ? milestone.flowsavvy_added_at
          : null,
      flowsavvy_count:
        milestone.flowsavvy_added
          ? 1
          : 0,
      flowsavvy_total: 1,
      notes: null,
      paper_id:
        milestone.paper_id,
      paper_short_title:
        milestone.paper_short_title,
      paper_title:
        milestone.paper_title,
      paper_archived:
        milestone.paper_archived,
      milestones: [
        milestone,
      ],
    })
  }

  return [...groups.values()].map(
    (allocation) => ({
      ...allocation,
      milestones:
        allocation.milestones.sort(
          (a, b) =>
            a.target_date.localeCompare(
              b.target_date
            ) ||
            a.title.localeCompare(
              b.title
            )
        ),
    })
  )
}
