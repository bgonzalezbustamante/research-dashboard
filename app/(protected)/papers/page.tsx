import Link from 'next/link'

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
  created_at: string
}

type HistoryRow = {
  paper_id: string
  event_date: string
  event_type: string
  venue: string | null
  round_number: number | null
  decision: string | null
  created_at: string
}

type AuthorJoinRow = {
  paper_id: string
  author_order: number
  authors:
    | {
        full_name: string
      }
    | {
        full_name: string
      }[]
    | null
}

type WorkSessionRow = {
  paper_id: string
  start_time: string
  end_time: string
}

type CitationDisplay = {
  value: string
  detail: string
}

type PapersPageProps = {
  searchParams: Promise<{
    q?: string
    status?: string
    archive?: string
    sort?: string
    page?: string
  }>
}

const PAPERS_PER_PAGE = 10

const statusOptions = [
  {
    value: 'all',
    label: 'All statuses',
  },
  {
    value: 'writing',
    label: 'Writing',
  },
  {
    value: 'under-review',
    label: 'Under review',
  },
  {
    value: 'revise-round',
    label: 'Revise round',
  },
  {
    value: 'published',
    label: 'Published',
  },
  {
    value: 'standby',
    label: 'Standby',
  },
  {
    value: 'deprecated',
    label: 'Deprecated',
  },
]

const archiveOptions = [
  {
    value: 'active',
    label: 'Active papers',
  },
  {
    value: 'archived',
    label: 'Archived papers',
  },
  {
    value: 'all',
    label: 'Active + archived',
  },
]

const sortOptions = [
  {
    value: 'updated-desc',
    label: 'Recently updated',
  },
  {
    value: 'title-asc',
    label: 'Short title A–Z',
  },
  {
    value: 'started-desc',
    label: 'Started most recently',
  },
  {
    value: 'milestone-asc',
    label: 'Next milestone',
  },
]

function formatDate(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const [
    year,
    month,
    day,
  ] = value
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

function timeToMinutes(
  value: string
) {
  const [
    hours,
    minutes,
  ] = value
    .slice(0, 5)
    .split(':')
    .map(Number)

  return (
    hours * 60 +
    minutes
  )
}

function getSessionDuration(
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

function getHoursByPaper(
  sessions: WorkSessionRow[]
) {
  const totals =
    new Map<
      string,
      number
    >()

  for (const session of sessions) {
    const duration =
      getSessionDuration(
        session.start_time,
        session.end_time
      )

    totals.set(
      session.paper_id,
      (
        totals.get(
          session.paper_id
        ) ?? 0
      ) + duration
    )
  }

  return totals
}

function getHistoryLabel(
  event: HistoryRow
) {
  if (
    event.event_type ===
      'decision' &&
    event.decision
  ) {
    return event.decision
  }

  switch (event.event_type) {
    case 'submitted':
      return 'Submitted'

    case 'decision':
      return 'Decision'

    case 'revision-submitted':
      return 'Revision submitted'

    case 'accepted':
      return 'Accepted'

    case 'rejected':
      return 'Rejected'

    case 'withdrawn':
      return 'Withdrawn'

    case 'published':
      return 'Published'

    default:
      return 'Other'
  }
}

function getNextMilestones(
  milestones: MilestoneRow[]
) {
  const sorted = [
    ...milestones,
  ].sort((a, b) => {
    if (
      a.target_date &&
      b.target_date
    ) {
      return a.target_date.localeCompare(
        b.target_date
      )
    }

    if (a.target_date) {
      return -1
    }

    if (b.target_date) {
      return 1
    }

    return a.title.localeCompare(
      b.title
    )
  })

  const result =
    new Map<
      string,
      MilestoneRow
    >()

  for (const milestone of sorted) {
    if (
      !result.has(
        milestone.paper_id
      )
    ) {
      result.set(
        milestone.paper_id,
        milestone
      )
    }
  }

  return result
}

function getLatestHistory(
  events: HistoryRow[]
) {
  const sorted = [
    ...events,
  ].sort((a, b) => {
    const dateDifference =
      b.event_date.localeCompare(
        a.event_date
      )

    if (
      dateDifference !== 0
    ) {
      return dateDifference
    }

    return b.created_at.localeCompare(
      a.created_at
    )
  })

  const result =
    new Map<
      string,
      HistoryRow
    >()

  for (const event of sorted) {
    if (
      !result.has(
        event.paper_id
      )
    ) {
      result.set(
        event.paper_id,
        event
      )
    }
  }

  return result
}

function getAuthorsByPaper(
  rows: AuthorJoinRow[]
) {
  const grouped =
    new Map<
      string,
      {
        order: number
        name: string
      }[]
    >()

  for (const row of rows) {
    const author =
      Array.isArray(
        row.authors
      )
        ? row.authors[0]
        : row.authors

    if (!author?.full_name) {
      continue
    }

    const existing =
      grouped.get(
        row.paper_id
      ) ?? []

    existing.push({
      order:
        row.author_order,
      name:
        author.full_name,
    })

    grouped.set(
      row.paper_id,
      existing
    )
  }

  const result =
    new Map<
      string,
      string[]
    >()

  for (const [
    paperId,
    authors,
  ] of grouped) {
    result.set(
      paperId,
      authors
        .sort(
          (a, b) =>
            a.order -
            b.order
        )
        .map(
          (author) =>
            author.name
        )
    )
  }

  return result
}

function getCitationDisplays(
  citations: CitationRow[]
) {
  const byPaper =
    new Map<
      string,
      CitationRow[]
    >()

  for (const citation of citations) {
    const existing =
      byPaper.get(
        citation.paper_id
      ) ?? []

    existing.push(
      citation
    )

    byPaper.set(
      citation.paper_id,
      existing
    )
  }

  const result =
    new Map<
      string,
      CitationDisplay
    >()

  for (const [
    paperId,
    paperCitations,
  ] of byPaper) {
    const latestBySource =
      new Map<
        string,
        CitationRow
      >()

    const sorted = [
      ...paperCitations,
    ].sort((a, b) => {
      const dateDifference =
        a.captured_on.localeCompare(
          b.captured_on
        )

      if (
        dateDifference !== 0
      ) {
        return dateDifference
      }

      return a.created_at.localeCompare(
        b.created_at
      )
    })

    for (const citation of sorted) {
      latestBySource.set(
        citation.source,
        citation
      )
    }

    const latestSources = [
      ...latestBySource.values(),
    ]

    const googleScholar =
      latestSources.find(
        (citation) =>
          citation.source
            .trim()
            .toLowerCase() ===
          'google scholar'
      )

    if (googleScholar) {
      result.set(
        paperId,
        {
          value: String(
            googleScholar.citation_count
          ),
          detail:
            'Google Scholar',
        }
      )

      continue
    }

    if (
      latestSources.length === 1
    ) {
      const citation =
        latestSources[0]

      result.set(
        paperId,
        {
          value: String(
            citation.citation_count
          ),
          detail:
            citation.source,
        }
      )

      continue
    }

    if (
      latestSources.length > 1
    ) {
      result.set(
        paperId,
        {
          value: `${latestSources.length} sources`,
          detail:
            'Tracked separately',
        }
      )
    }
  }

  return result
}

export default async function PapersPage({
  searchParams,
}: PapersPageProps) {
  const params =
    await searchParams

  const query =
    params.q?.trim() ?? ''

  const statusFilter =
    statusOptions.some(
      (option) =>
        option.value ===
        params.status
    )
      ? params.status!
      : 'all'

  const archiveFilter =
    archiveOptions.some(
      (option) =>
        option.value ===
        params.archive
    )
      ? params.archive!
      : 'active'

  const sort =
    sortOptions.some(
      (option) =>
        option.value ===
        params.sort
    )
      ? params.sort!
      : 'updated-desc'

  const requestedPage =
    Number.parseInt(
      params.page ?? '1',
      10
    )

  const supabase =
    await createClient()

  const {
    data: paperData,
    error: papersError,
  } = await supabase
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
    .order(
      'updated_at',
      {
        ascending: false,
      }
    )

  if (papersError) {
    throw new Error(
      `Could not load papers: ${papersError.message}`
    )
  }

  const papers =
    (paperData ??
      []) as PaperRow[]

  const paperIds =
    papers.map(
      (paper) =>
        paper.id
    )

  let milestones:
    MilestoneRow[] = []

  let citations:
    CitationRow[] = []

  let history:
    HistoryRow[] = []

  let authorRows:
    AuthorJoinRow[] = []

  let workSessions:
    WorkSessionRow[] = []

  if (
    paperIds.length > 0
  ) {
    const [
      milestoneResult,
      citationResult,
      historyResult,
      authorResult,
      workSessionResult,
    ] = await Promise.all([
      supabase
        .from(
          'paper_milestones'
        )
        .select(`
          paper_id,
          title,
          target_date,
          status
        `)
        .in(
          'paper_id',
          paperIds
        )
        .eq(
          'status',
          'planned'
        ),

      supabase
        .from(
          'citation_snapshots'
        )
        .select(`
          paper_id,
          citation_count,
          captured_on,
          source,
          created_at
        `)
        .in(
          'paper_id',
          paperIds
        ),

      supabase
        .from(
          'paper_history'
        )
        .select(`
          paper_id,
          event_date,
          event_type,
          venue,
          round_number,
          decision,
          created_at
        `)
        .in(
          'paper_id',
          paperIds
        ),

      supabase
        .from(
          'paper_authors'
        )
        .select(`
          paper_id,
          author_order,
          authors (
            full_name
          )
        `)
        .in(
          'paper_id',
          paperIds
        )
        .order(
          'author_order',
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          'work_sessions'
        )
        .select(`
          paper_id,
          start_time,
          end_time
        `)
        .in(
          'paper_id',
          paperIds
        ),
    ])

    if (
      milestoneResult.error
    ) {
      throw new Error(
        `Could not load milestones: ${milestoneResult.error.message}`
      )
    }

    if (
      citationResult.error
    ) {
      throw new Error(
        `Could not load citations: ${citationResult.error.message}`
      )
    }

    if (
      historyResult.error
    ) {
      throw new Error(
        `Could not load paper history: ${historyResult.error.message}`
      )
    }

    if (
      authorResult.error
    ) {
      throw new Error(
        `Could not load authors: ${authorResult.error.message}`
      )
    }

    if (
      workSessionResult.error
    ) {
      throw new Error(
        `Could not load paper working hours: ${workSessionResult.error.message}`
      )
    }

    milestones =
      (milestoneResult.data ??
        []) as MilestoneRow[]

    citations =
      (citationResult.data ??
        []) as CitationRow[]

    history =
      (historyResult.data ??
        []) as HistoryRow[]

    authorRows =
      (authorResult.data ??
        []) as AuthorJoinRow[]

    workSessions =
      (workSessionResult.data ??
        []) as WorkSessionRow[]
  }

  const nextMilestoneByPaper =
    getNextMilestones(
      milestones
    )

  const latestHistoryByPaper =
    getLatestHistory(
      history
    )

  const authorsByPaper =
    getAuthorsByPaper(
      authorRows
    )

  const citationDisplayByPaper =
    getCitationDisplays(
      citations
    )

  const hoursByPaper =
    getHoursByPaper(
      workSessions
    )

  const normalizedQuery =
    query.toLowerCase()

  let filteredPapers =
    papers.filter(
      (paper) => {
        if (
          archiveFilter ===
            'active' &&
          paper.archived_at !==
            null
        ) {
          return false
        }

        if (
          archiveFilter ===
            'archived' &&
          paper.archived_at ===
            null
        ) {
          return false
        }

        if (
          statusFilter !==
            'all' &&
          paper.status !==
            statusFilter
        ) {
          return false
        }

        if (
          normalizedQuery
        ) {
          const authors =
            authorsByPaper.get(
              paper.id
            ) ?? []

          const latestHistory =
            latestHistoryByPaper.get(
              paper.id
            )

          const searchableText =
            [
              paper.short_title,
              paper.title,
              paper.target_venue,
              paper.current_venue,
              ...authors,
              latestHistory?.venue,
              latestHistory?.decision,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()

          if (
            !searchableText.includes(
              normalizedQuery
            )
          ) {
            return false
          }
        }

        return true
      }
    )

  filteredPapers = [
    ...filteredPapers,
  ].sort((a, b) => {
    switch (sort) {
      case 'title-asc':
        return a.short_title.localeCompare(
          b.short_title
        )

      case 'started-desc':
        if (
          a.started_on &&
          b.started_on
        ) {
          return b.started_on.localeCompare(
            a.started_on
          )
        }

        if (a.started_on) {
          return -1
        }

        if (b.started_on) {
          return 1
        }

        return a.short_title.localeCompare(
          b.short_title
        )

      case 'milestone-asc': {
        const aMilestone =
          nextMilestoneByPaper.get(
            a.id
          )

        const bMilestone =
          nextMilestoneByPaper.get(
            b.id
          )

        const aDate =
          aMilestone?.target_date

        const bDate =
          bMilestone?.target_date

        if (
          aDate &&
          bDate
        ) {
          return aDate.localeCompare(
            bDate
          )
        }

        if (aDate) {
          return -1
        }

        if (bDate) {
          return 1
        }

        if (
          aMilestone &&
          bMilestone
        ) {
          return aMilestone.title.localeCompare(
            bMilestone.title
          )
        }

        if (aMilestone) {
          return -1
        }

        if (bMilestone) {
          return 1
        }

        return a.short_title.localeCompare(
          b.short_title
        )
      }

      case 'updated-desc':
      default:
        return b.updated_at.localeCompare(
          a.updated_at
        )
    }
  })

  const totalMatchingPapers =
    filteredPapers.length

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalMatchingPapers /
          PAPERS_PER_PAGE
      )
    )

  const validRequestedPage =
    Number.isFinite(
      requestedPage
    ) &&
    requestedPage > 0
      ? requestedPage
      : 1

  const currentPage =
    Math.min(
      validRequestedPage,
      totalPages
    )

  const pageStart =
    (currentPage - 1) *
    PAPERS_PER_PAGE

  const paginatedPapers =
    filteredPapers.slice(
      pageStart,
      pageStart +
        PAPERS_PER_PAGE
    )

  const visibleStart =
    totalMatchingPapers === 0
      ? 0
      : pageStart + 1

  const visibleEnd =
    Math.min(
      pageStart +
        PAPERS_PER_PAGE,
      totalMatchingPapers
    )

  const getPageHref = (
    pageNumber: number
  ) => {
    const pageParams =
      new URLSearchParams()

    if (query) {
      pageParams.set(
        'q',
        query
      )
    }

    if (
      statusFilter !== 'all'
    ) {
      pageParams.set(
        'status',
        statusFilter
      )
    }

    if (
      archiveFilter !==
      'active'
    ) {
      pageParams.set(
        'archive',
        archiveFilter
      )
    }

    if (
      sort !== 'updated-desc'
    ) {
      pageParams.set(
        'sort',
        sort
      )
    }

    if (pageNumber > 1) {
      pageParams.set(
        'page',
        String(pageNumber)
      )
    }

    const pageQuery =
      pageParams.toString()

    return pageQuery
      ? `/papers?${pageQuery}`
      : '/papers'
  }

  const activePapers =
    papers.filter(
      (paper) =>
        paper.archived_at ===
        null
    )

  const activeCount =
    activePapers.length

  const archivedCount =
    papers.length -
    activeCount

  const writingCount =
    activePapers.filter(
      (paper) =>
        paper.status ===
        'writing'
    ).length

  const reviewCount =
    activePapers.filter(
      (paper) =>
        paper.status ===
          'under-review' ||
        paper.status ===
          'revise-round'
    ).length

  const publishedCount =
    activePapers.filter(
      (paper) =>
        paper.status ===
        'published'
    ).length

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Papers"
          description="Track manuscripts, milestones, submissions, publications, and research activity."
        />

        <ButtonLink
          href="/papers/new"
          variant="primary"
          className="shrink-0"
        >
          Add paper
        </ButtonLink>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Active
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {activeCount}
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Writing
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {writingCount}
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Review / revision
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {reviewCount}
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Published
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {publishedCount}
          </div>
        </div>

        <div className="rounded-lg border border-oxford-stone bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Archived
          </div>

          <div className="mt-1 font-serif text-2xl font-semibold text-oxford-blue">
            {archivedCount}
          </div>
        </div>
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
              defaultValue={
                query
              }
              placeholder="Title, author, venue, or decision"
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
              defaultValue={
                statusFilter
              }
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            >
              {statusOptions.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                )
              )}
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
              defaultValue={
                archiveFilter
              }
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            >
              {archiveOptions.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                )
              )}
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
              defaultValue={
                sort
              }
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            >
              {sortOptions.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
          >
            Apply filters
          </Button>

          <ButtonLink
            href="/papers"
            variant="secondary"
          >
            Reset
          </ButtonLink>

          <span className="ml-auto text-sm text-oxford-ash">
            Showing{' '}
            <strong className="font-medium text-oxford-charcoal">
              {visibleStart ===
              visibleEnd
                ? visibleStart
                : `${visibleStart}–${visibleEnd}`}
            </strong>{' '}
            of{' '}
            <strong className="font-medium text-oxford-charcoal">
              {
                totalMatchingPapers
              }
            </strong>
          </span>
        </div>
      </form>

      {totalMatchingPapers ===
      0 ? (
        <div className="rounded-lg border border-oxford-stone bg-white px-6 py-12 text-center">
          {papers.length ===
          0 ? (
            <>
              <h2 className="font-serif text-xl font-semibold text-oxford-blue">
                No papers yet
              </h2>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-oxford-ash">
                Add your first paper
                to start tracking its
                status, milestones,
                publication history,
                presentations,
                citations, and
                research activity.
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
                Try changing the
                search or filters.
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
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-oxford-stone bg-white">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="border-b border-oxford-stone bg-oxford-shell">
                <tr>
                  <th className="px-4 py-3 font-medium text-oxford-charcoal">
                    Paper
                  </th>

                  <th className="px-4 py-3 font-medium text-oxford-charcoal">
                    Status
                  </th>

                  <th className="px-4 py-3 font-medium text-oxford-charcoal">
                    Next milestone
                  </th>

                  <th className="px-4 py-3 font-medium text-oxford-charcoal">
                    Latest activity
                  </th>

                  <th className="px-4 py-3 font-medium text-oxford-charcoal">
                    Citations
                  </th>

                  <th className="px-4 py-3 font-medium text-oxford-charcoal">
                    Hours
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedPapers.map(
                  (paper) => {
                    const milestone =
                      nextMilestoneByPaper.get(
                        paper.id
                      )

                    const latestHistory =
                      latestHistoryByPaper.get(
                        paper.id
                      )

                    const authors =
                      authorsByPaper.get(
                        paper.id
                      ) ?? []

                    const citation =
                      citationDisplayByPaper.get(
                        paper.id
                      )

                    const paperMinutes =
                      hoursByPaper.get(
                        paper.id
                      ) ?? 0

                    return (
                      <tr
                        key={
                          paper.id
                        }
                        className="border-b border-oxford-stone align-top last:border-b-0 hover:bg-oxford-off-white"
                      >
                        <td className="px-4 py-4">
                          <Link
                            href={`/papers/${paper.id}`}
                            className="font-medium text-oxford-blue hover:underline"
                          >
                            {
                              paper.short_title
                            }
                          </Link>

                          <div className="mt-1 max-w-md leading-5 text-oxford-charcoal">
                            {
                              paper.title
                            }
                          </div>

                          {authors.length >
                            0 && (
                            <div className="mt-2 max-w-md text-xs leading-5 text-oxford-ash">
                              {authors.join(
                                ', '
                              )}
                            </div>
                          )}

                          {paper.archived_at && (
                            <span className="mt-2 inline-flex rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              Archived
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            status={
                              paper.status
                            }
                          />

                          {paper.status ===
                            'revise-round' &&
                            paper.revision_round && (
                              <div className="mt-2 text-xs text-oxford-ash">
                                Round{' '}
                                {
                                  paper.revision_round
                                }
                              </div>
                            )}
                        </td>

                        <td className="px-4 py-4">
                          {milestone ? (
                            <>
                              <div className="max-w-52 text-oxford-charcoal">
                                {
                                  milestone.title
                                }
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
                          {latestHistory ? (
                            <>
                              <div className="max-w-52 font-medium text-oxford-charcoal">
                                {getHistoryLabel(
                                  latestHistory
                                )}
                              </div>

                              <div className="mt-1 text-xs text-oxford-ash">
                                {formatDate(
                                  latestHistory.event_date
                                )}
                              </div>

                              {latestHistory.venue && (
                                <div className="mt-1 max-w-52 truncate text-xs text-oxford-ash">
                                  {
                                    latestHistory.venue
                                  }
                                </div>
                              )}
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
                                {
                                  citation.value
                                }
                              </div>

                              <div className="mt-1 text-xs text-oxford-ash">
                                {
                                  citation.detail
                                }
                              </div>
                            </>
                          ) : (
                            <span className="text-oxford-ash">
                              —
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span className="font-medium text-oxford-charcoal">
                            {formatDuration(
                              paperMinutes
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Papers pagination"
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-oxford-ash">
                Page{' '}
                <strong className="font-medium text-oxford-charcoal">
                  {currentPage}
                </strong>{' '}
                of{' '}
                <strong className="font-medium text-oxford-charcoal">
                  {totalPages}
                </strong>
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {currentPage > 1 && (
                  <ButtonLink
                    href={getPageHref(
                      currentPage - 1
                    )}
                    variant="secondary"
                  >
                    Previous
                  </ButtonLink>
                )}

                {currentPage <
                  totalPages && (
                  <ButtonLink
                    href={getPageHref(
                      currentPage + 1
                    )}
                    variant="secondary"
                  >
                    Next
                  </ButtonLink>
                )}
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
