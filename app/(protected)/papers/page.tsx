import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import StatusBadge from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/server'

type PaperStatus =
  | 'writing'
  | 'under-review'
  | 'revise-round'
  | 'published'
  | 'standby'
  | 'deprecated'

type PaperRow = {
  id: string
  short_title: string
  title: string
  status: PaperStatus
  revision_round: number | null
  target_venue: string | null
  current_venue: string | null
  started_on: string | null
  published_on: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

type MilestoneRow = {
  paper_id: string
  title: string
  target_date: string | null
  status: string
}

type CitationRow = {
  paper_id: string
  citation_count: number
  captured_on: string
  source: string
}

type PapersPageProps = {
  searchParams: Promise<{
    q?: string
    status?: string
    archive?: string
    sort?: string
  }>
}

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'writing', label: 'Writing' },
  { value: 'under-review', label: 'Under review' },
  { value: 'revise-round', label: 'Revise round' },
  { value: 'published', label: 'Published' },
  { value: 'standby', label: 'Standby' },
  { value: 'deprecated', label: 'Deprecated' },
]

const archiveOptions = [
  { value: 'active', label: 'Active papers' },
  { value: 'archived', label: 'Archived papers' },
  { value: 'all', label: 'Active + archived' },
]

const sortOptions = [
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'title-asc', label: 'Short title A–Z' },
  { value: 'started-desc', label: 'Started most recently' },
]

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  const [year, month, day] = value
    .slice(0, 10)
    .split('-')
    .map(Number)

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function getNextMilestones(milestones: MilestoneRow[]) {
  const sorted = [...milestones].sort((a, b) => {
    if (a.target_date && b.target_date) {
      return a.target_date.localeCompare(b.target_date)
    }

    if (a.target_date) {
      return -1
    }

    if (b.target_date) {
      return 1
    }

    return a.title.localeCompare(b.title)
  })

  const result = new Map<string, MilestoneRow>()

  for (const milestone of sorted) {
    if (!result.has(milestone.paper_id)) {
      result.set(milestone.paper_id, milestone)
    }
  }

  return result
}

function getLatestCitations(citations: CitationRow[]) {
  const sorted = [...citations].sort((a, b) =>
    b.captured_on.localeCompare(a.captured_on)
  )

  const result = new Map<string, CitationRow>()

  for (const citation of sorted) {
    if (!result.has(citation.paper_id)) {
      result.set(citation.paper_id, citation)
    }
  }

  return result
}

export default async function PapersPage({
  searchParams,
}: PapersPageProps) {
  const params = await searchParams

  const query = params.q?.trim() ?? ''

  const statusFilter = statusOptions.some(
    (option) => option.value === params.status
  )
    ? params.status!
    : 'all'

  const archiveFilter = archiveOptions.some(
    (option) => option.value === params.archive
  )
    ? params.archive!
    : 'active'

  const sort = sortOptions.some(
    (option) => option.value === params.sort
  )
    ? params.sort!
    : 'updated-desc'

  const supabase = await createClient()

  const { data: paperData, error: papersError } = await supabase
    .from('papers')
    .select(`
      id,
      short_title,
      title,
      status,
      revision_round,
      target_venue,
      current_venue,
      started_on,
      published_on,
      archived_at,
      created_at,
      updated_at
    `)
    .order('updated_at', { ascending: false })

  if (papersError) {
    throw new Error(
      `Could not load papers: ${papersError.message}`
    )
  }

  const papers = (paperData ?? []) as PaperRow[]
  const paperIds = papers.map((paper) => paper.id)

  let milestones: MilestoneRow[] = []
  let citations: CitationRow[] = []

  if (paperIds.length > 0) {
    const {
      data: milestoneData,
      error: milestoneError,
    } = await supabase
      .from('paper_milestones')
      .select(`
        paper_id,
        title,
        target_date,
        status
      `)
      .in('paper_id', paperIds)
      .eq('status', 'planned')

    if (milestoneError) {
      throw new Error(
        `Could not load milestones: ${milestoneError.message}`
      )
    }

    milestones = (milestoneData ?? []) as MilestoneRow[]

    const {
      data: citationData,
      error: citationError,
    } = await supabase
      .from('citation_snapshots')
      .select(`
        paper_id,
        citation_count,
        captured_on,
        source
      `)
      .in('paper_id', paperIds)
      .order('captured_on', { ascending: false })

    if (citationError) {
      throw new Error(
        `Could not load citations: ${citationError.message}`
      )
    }

    citations = (citationData ?? []) as CitationRow[]
  }

  const nextMilestoneByPaper =
    getNextMilestones(milestones)

  const latestCitationByPaper =
    getLatestCitations(citations)

  const normalizedQuery = query.toLowerCase()

  let filteredPapers = papers.filter((paper) => {
    if (
      archiveFilter === 'active' &&
      paper.archived_at !== null
    ) {
      return false
    }

    if (
      archiveFilter === 'archived' &&
      paper.archived_at === null
    ) {
      return false
    }

    if (
      statusFilter !== 'all' &&
      paper.status !== statusFilter
    ) {
      return false
    }

    if (normalizedQuery) {
      const searchableText = [
        paper.short_title,
        paper.title,
        paper.target_venue,
        paper.current_venue,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (!searchableText.includes(normalizedQuery)) {
        return false
      }
    }

    return true
  })

  filteredPapers = [...filteredPapers].sort((a, b) => {
    switch (sort) {
      case 'title-asc':
        return a.short_title.localeCompare(b.short_title)

      case 'started-desc':
        if (a.started_on && b.started_on) {
          return b.started_on.localeCompare(a.started_on)
        }

        if (a.started_on) {
          return -1
        }

        if (b.started_on) {
          return 1
        }

        return a.short_title.localeCompare(b.short_title)

      case 'updated-desc':
      default:
        return b.updated_at.localeCompare(a.updated_at)
    }
  })

  const activeCount = papers.filter(
    (paper) => paper.archived_at === null
  ).length

  const archivedCount = papers.filter(
    (paper) => paper.archived_at !== null
  ).length

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Papers"
          description="Track manuscripts, milestones, submissions, and publications."
        />

        <ButtonLink
          href="/papers/new"
          variant="primary"
          className="shrink-0"
        >
          Add paper
        </ButtonLink>
      </div>

      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-oxford-ash">
        <span>
          <strong className="font-medium text-oxford-charcoal">
            {activeCount}
          </strong>{' '}
          active
        </span>

        <span>
          <strong className="font-medium text-oxford-charcoal">
            {archivedCount}
          </strong>{' '}
          archived
        </span>

        <span>
          <strong className="font-medium text-oxford-charcoal">
            {filteredPapers.length}
          </strong>{' '}
          shown
        </span>
      </div>

      <form
        method="get"
        className="mb-6 rounded-lg border border-oxford-stone bg-white p-4"
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label
              htmlFor="q"
              className="mb-1 block text-sm font-medium text-oxford-charcoal"
            >
              Search
            </label>

            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Title or venue"
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-sm font-medium text-oxford-charcoal"
            >
              Status
            </label>

            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            >
              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="archive"
              className="mb-1 block text-sm font-medium text-oxford-charcoal"
            >
              Archive
            </label>

            <select
              id="archive"
              name="archive"
              defaultValue={archiveFilter}
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            >
              {archiveOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="sort"
              className="mb-1 block text-sm font-medium text-oxford-charcoal"
            >
              Sort
            </label>

            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            >
              {sortOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="submit">
            Apply filters
          </Button>

          <ButtonLink
            href="/papers"
            variant="secondary"
          >
            Reset
          </ButtonLink>
        </div>
      </form>

      {filteredPapers.length === 0 ? (
        <div className="rounded-lg border border-oxford-stone bg-white px-6 py-12 text-center">
          {papers.length === 0 ? (
            <>
              <h2 className="font-serif text-xl font-semibold text-oxford-blue">
                No papers yet
              </h2>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-oxford-ash">
                Add your first paper to start tracking its
                status, milestones, publication history,
                presentations, citations, and research effort.
              </p>

              <ButtonLink
                href="/papers/new"
                className="mt-5"
              >
                Add first paper
              </ButtonLink>
            </>
          ) : (
            <>
              <h2 className="font-serif text-xl font-semibold text-oxford-blue">
                No matching papers
              </h2>

              <p className="mt-2 text-sm text-oxford-ash">
                Try changing the search or filters.
              </p>

              <ButtonLink
                href="/papers"
                variant="secondary"
                className="mt-5"
              >
                Clear filters
              </ButtonLink>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-oxford-stone bg-white">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="border-b border-oxford-stone bg-oxford-shell">
              <tr>
                <th className="px-4 py-3 font-medium text-oxford-charcoal">
                  Paper
                </th>

                <th className="px-4 py-3 font-medium text-oxford-charcoal">
                  Status
                </th>

                <th className="px-4 py-3 font-medium text-oxford-charcoal">
                  Venue
                </th>

                <th className="px-4 py-3 font-medium text-oxford-charcoal">
                  Next milestone
                </th>

                <th className="px-4 py-3 font-medium text-oxford-charcoal">
                  Citations
                </th>

                <th className="px-4 py-3 font-medium text-oxford-charcoal">
                  Updated
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPapers.map((paper) => {
                const milestone =
                  nextMilestoneByPaper.get(paper.id)

                const citation =
                  latestCitationByPaper.get(paper.id)

                const venue =
                  paper.current_venue ??
                  paper.target_venue

                const venueType =
                  paper.current_venue
                    ? 'Current'
                    : paper.target_venue
                      ? 'Target'
                      : null

                return (
                  <tr
                    key={paper.id}
                    className="border-b border-oxford-stone align-top last:border-b-0 hover:bg-oxford-off-white"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-oxford-blue">
                        {paper.short_title}
                      </div>

                      <div className="mt-1 max-w-md leading-5 text-oxford-charcoal">
                        {paper.title}
                      </div>

                      {paper.archived_at && (
                        <span className="mt-2 inline-flex rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Archived
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge
                        status={paper.status}
                      />

                      {paper.status ===
                        'revise-round' &&
                        paper.revision_round && (
                          <div className="mt-2 text-xs text-oxford-ash">
                            Round{' '}
                            {paper.revision_round}
                          </div>
                        )}
                    </td>

                    <td className="px-4 py-4">
                      {venue ? (
                        <>
                          <div className="max-w-48 text-oxford-charcoal">
                            {venue}
                          </div>

                          <div className="mt-1 text-xs text-oxford-ash">
                            {venueType}
                          </div>
                        </>
                      ) : (
                        <span className="text-oxford-ash">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {milestone ? (
                        <>
                          <div className="max-w-52 text-oxford-charcoal">
                            {milestone.title}
                          </div>

                          <div className="mt-1 text-xs text-oxford-ash">
                            {formatDate(
                              milestone.target_date
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-oxford-ash">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {citation ? (
                        <>
                          <div className="font-medium text-oxford-charcoal">
                            {citation.citation_count}
                          </div>

                          <div className="mt-1 text-xs text-oxford-ash">
                            {citation.source}
                          </div>
                        </>
                      ) : (
                        <span className="text-oxford-ash">
                          —
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-oxford-ash">
                      {formatDate(paper.updated_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}