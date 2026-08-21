type NextMilestone = {
  title: string
  targetDate: string | null
  overdue: boolean
} | null

type LatestHistory = {
  label: string
  date: string
  detail: string | null
} | null

type NextPresentation = {
  eventName: string
  date: string
  location: string | null
} | null

type CitationSummary = {
  value: string
  detail: string
} | null

type PaperSummaryProps = {
  nextMilestone: NextMilestone
  latestHistory: LatestHistory
  nextPresentation: NextPresentation
  noteCount: number
  latestNoteDate: string | null
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
  nextMilestone,
  latestHistory,
  nextPresentation,
  noteCount,
  latestNoteDate,
  citationSummary,
}: PaperSummaryProps) {
  return (
    <section
      aria-label="Paper summary"
      className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5"
    >
      <a
        href="#milestones"
        className="rounded-lg border border-oxford-stone bg-white p-4 transition hover:border-oxford-blue"
      >
        <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
          Next milestone
        </div>

        {nextMilestone ? (
          <>
            <div className="mt-2 font-medium text-oxford-charcoal">
              {nextMilestone.title}
            </div>

            <div
              className={`mt-1 text-sm ${
                nextMilestone.overdue
                  ? 'font-medium text-red-700'
                  : 'text-oxford-ash'
              }`}
            >
              {nextMilestone.targetDate
                ? formatDate(
                    nextMilestone.targetDate
                  )
                : 'No target date'}

              {nextMilestone.overdue &&
                ' · Overdue'}
            </div>
          </>
        ) : (
          <div className="mt-2 text-sm text-oxford-ash">
            No planned milestone
          </div>
        )}
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
        href="#presentations"
        className="rounded-lg border border-oxford-stone bg-white p-4 transition hover:border-oxford-blue"
      >
        <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
          Next presentation
        </div>

        {nextPresentation ? (
          <>
            <div className="mt-2 font-medium text-oxford-charcoal">
              {nextPresentation.eventName}
            </div>

            <div className="mt-1 text-sm text-oxford-ash">
              {formatDate(
                nextPresentation.date
              )}
            </div>

            {nextPresentation.location && (
              <div className="mt-1 truncate text-xs text-oxford-ash">
                {
                  nextPresentation.location
                }
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 text-sm text-oxford-ash">
            No upcoming presentation
          </div>
        )}
      </a>

      <a
        href="#notes"
        className="rounded-lg border border-oxford-stone bg-white p-4 transition hover:border-oxford-blue"
      >
        <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
          Notes
        </div>

        <div className="mt-2 font-serif text-2xl font-semibold text-oxford-blue">
          {noteCount}
        </div>

        <div className="mt-1 text-sm text-oxford-ash">
          {latestNoteDate
            ? `Latest ${formatDate(
                latestNoteDate
              )}`
            : 'No notes yet'}
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