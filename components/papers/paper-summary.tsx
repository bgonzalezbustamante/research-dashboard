type LatestHistory = {
  label: string
  date: string
  detail: string | null
} | null

type CitationSummary = {
  value: string
  detail: string
} | null

type PaperSummaryProps = {
  conferenceCount: number
  latestHistory: LatestHistory
  milestoneCount: number
  plannedMilestoneCount: number
  citationSummary: CitationSummary
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return null
  }

  const [year, month, day] = value
    .slice(0, 10)
    .split('-')
    .map(Number)

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
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

export default function PaperSummary({
  conferenceCount,
  latestHistory,
  milestoneCount,
  plannedMilestoneCount,
  citationSummary,
}: PaperSummaryProps) {
  return (
    <section
      aria-label="Paper summary"
      className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      <a
        href="#conferences"
        className="rounded-lg border border-oxford-stone bg-white p-4 transition hover:border-oxford-blue"
      >
        <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
          Conference presentations
        </div>

        <div className="mt-2 font-serif text-2xl font-semibold text-oxford-blue">
          {conferenceCount}
        </div>

        <div className="mt-1 text-sm text-oxford-ash">
          {conferenceCount === 1
            ? 'Associated presentation'
            : 'Associated presentations'}
        </div>
      </a>

      <a
        href="#history"
        className="rounded-lg border border-oxford-stone bg-white p-4 transition hover:border-oxford-blue"
      >
        <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
          Latest history
        </div>

        {latestHistory ? (
          <>
            <div className="mt-2 font-medium text-oxford-charcoal">
              {latestHistory.label}
            </div>

            <div className="mt-1 text-sm text-oxford-ash">
              {formatDate(
                latestHistory.date
              )}
            </div>

            {latestHistory.detail && (
              <div className="mt-1 truncate text-xs text-oxford-ash">
                {latestHistory.detail}
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 text-sm text-oxford-ash">
            No history yet
          </div>
        )}
      </a>

      <a
        href="#milestones"
        className="rounded-lg border border-oxford-stone bg-white p-4 transition hover:border-oxford-blue"
      >
        <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
          Milestones
        </div>

        <div className="mt-2 font-serif text-2xl font-semibold text-oxford-blue">
          {milestoneCount}
        </div>

        <div className="mt-1 text-sm text-oxford-ash">
          {milestoneCount === 0
            ? 'No milestones yet'
            : plannedMilestoneCount === 1
              ? '1 planned'
              : `${plannedMilestoneCount} planned`}
        </div>
      </a>

      <a
        href="#citations"
        className="rounded-lg border border-oxford-stone bg-white p-4 transition hover:border-oxford-blue"
      >
        <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
          Citations
        </div>

        {citationSummary ? (
          <>
            <div className="mt-2 font-serif text-2xl font-semibold text-oxford-blue">
              {
                citationSummary.value
              }
            </div>

            <div className="mt-1 text-sm text-oxford-ash">
              {
                citationSummary.detail
              }
            </div>
          </>
        ) : (
          <div className="mt-2 text-sm text-oxford-ash">
            No citation data
          </div>
        )}
      </a>
    </section>
  )
}