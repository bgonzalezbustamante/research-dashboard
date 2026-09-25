import { notFound } from 'next/navigation'

import CitationsSection from '@/components/papers/citations-section'
import HistorySection from '@/components/papers/history-section'
import MilestonesSection from '@/components/papers/milestones-section'
import PaperSummary from '@/components/papers/paper-summary'
import PaperWorkspaceNav from '@/components/papers/paper-workspace-nav'
import WebsiteSection, {
  type PaperPublicMetadata,
} from '@/components/papers/website-section'
import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import StatusBadge from '@/components/ui/status-badge'
import {
  requireAppAccess,
} from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import {
  archivePaper,
  restorePaper,
} from '../actions'
import {
  updatePublicPaperMetadata,
} from '../../website/actions'

type PaperStatus =
  | 'writing'
  | 'under-review'
  | 'revise-round'
  | 'published'
  | 'standby'
  | 'deprecated'

type PaperWorkSession = {
  id: string
  activity_label_id: string | null
  start_time: string
  end_time: string
  daily_logs:
    | {
        log_date: string
      }
    | {
        log_date: string
      }[]
    | null
}

type AssociatedProject = {
  id: string
  short_title: string
  title: string
  funder: string
  status: string
  url: string | null
}

type AssociatedProjectLink = {
  project_id: string
  projects:
    | AssociatedProject
    | AssociatedProject[]
    | null
}

type LinkedConferencePresentation = {
  id: string
  event_name: string
  event_short_name: string
  location: string | null
  start_date: string
  end_date: string
  presentation_title: string | null
  authors: string[]
  presentation_type: string | null
  url: string | null
}

type PaperPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    historyError?: string
    milestoneError?: string
    citationError?: string
    websiteError?: string
    websiteSaved?: string
  }>
}

function formatDisplayDate(
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

function formatDisplayDateRange(
  startDate: string,
  endDate: string
) {
  if (startDate === endDate) {
    return formatDisplayDate(
      startDate
    )
  }

  return `${formatDisplayDate(
    startDate
  )} – ${formatDisplayDate(
    endDate
  )}`
}

function getHistoryLabel(
  eventType: string,
  decision: string | null
) {
  if (
    eventType === 'decision' &&
    decision
  ) {
    return decision
  }

  switch (eventType) {
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

function timeToMinutes(
  value: string
) {
  const [hours, minutes] =
    value
      .slice(0, 5)
      .split(':')
      .map(Number)

  return hours * 60 + minutes
}

function getSessionDuration(
  startTime: string,
  endTime: string
) {
  return (
    timeToMinutes(endTime) -
    timeToMinutes(startTime)
  )
}

export default async function PaperPage({
  params,
  searchParams,
}: PaperPageProps) {
  const { id } = await params

  const {
    historyError,
    milestoneError,
    citationError,
    websiteError,
    websiteSaved,
  } = await searchParams

  const access =
    await requireAppAccess()

  const supabase =
    await createClient()

  const {
    data: paper,
    error: paperError,
  } = await supabase
    .from('papers')
    .select(`
      id,
      short_title,
      title,
      abstract,
      status,
      revision_round,
      current_venue,
      published_on,
      archived_at
    `)
    .eq('id', id)
    .maybeSingle()

  if (paperError) {
    throw new Error(
      `Could not load paper: ${paperError.message}`
    )
  }

  if (!paper) {
    notFound()
  }

  const [
    authorResult,
    linksResult,
    historyResult,
    milestonesResult,
    citationsResult,
    workSessionsResult,
    conferencePresentationsResult,
    projectsResult,
    publicMetadataResult,
  ] = await Promise.all([
    supabase
      .from('paper_authors')
      .select(`
        author_order,
        authors (
          full_name
        )
      `)
      .eq('paper_id', id)
      .order('author_order', {
        ascending: true,
      }),

    supabase
      .from('paper_links')
      .select(`
        id,
        link_type,
        label,
        url,
        sort_order
      `)
      .eq('paper_id', id)
      .order('sort_order', {
        ascending: true,
      }),

    supabase
      .from('paper_history')
      .select(`
        id,
        event_date,
        event_type,
        venue,
        round_number,
        decision,
        notes,
        created_at
      `)
      .eq('paper_id', id)
      .order('event_date', {
        ascending: true,
      })
      .order('created_at', {
        ascending: true,
      }),

    supabase
      .from('paper_milestones')
      .select(`
        id,
        title,
        target_date,
        completed_on,
        status,
        notes
      `)
      .eq('paper_id', id),

    supabase
      .from('citation_snapshots')
      .select(`
        id,
        source,
        citation_count,
        captured_on,
        created_at
      `)
      .eq('paper_id', id)
      .order('captured_on', {
        ascending: true,
      })
      .order('created_at', {
        ascending: true,
      }),

    supabase
      .from('work_sessions')
      .select(`
        id,
        activity_label_id,
        start_time,
        end_time,
        daily_logs (
          log_date
        )
      `)
      .eq('paper_id', id),

    supabase.rpc(
      'list_paper_conference_presentations',
      {
        p_paper_id: id,
      }
    ),

    supabase
      .from('project_papers')
      .select(`
        project_id,
        projects (
          id,
          short_title,
          title,
          funder,
          status,
          url
        )
      `)
      .eq('paper_id', id),

    supabase
      .from(
        'paper_public_metadata'
      )
      .select(`
        visibility,
        slug,
        featured,
        publication_index,
        citation,
        highlight_text,
        highlight_image_filename,
        highlight_image_alt,
        highlight_image_caption
      `)
      .eq('paper_id', id)
      .maybeSingle(),
  ])

  if (authorResult.error) {
    throw new Error(
      `Could not load authors: ${authorResult.error.message}`
    )
  }

  if (linksResult.error) {
    throw new Error(
      `Could not load links: ${linksResult.error.message}`
    )
  }

  if (historyResult.error) {
    throw new Error(
      `Could not load paper history: ${historyResult.error.message}`
    )
  }

  if (milestonesResult.error) {
    throw new Error(
      `Could not load milestones: ${milestonesResult.error.message}`
    )
  }

  if (citationsResult.error) {
    throw new Error(
      `Could not load citation history: ${citationsResult.error.message}`
    )
  }

  if (workSessionsResult.error) {
    throw new Error(
      `Could not load paper working hours: ${workSessionsResult.error.message}`
    )
  }

  if (
    conferencePresentationsResult.error
  ) {
    throw new Error(
      `Could not load linked conference presentations: ${conferencePresentationsResult.error.message}`
    )
  }

  if (projectsResult.error) {
    throw new Error(
      `Could not load associated projects: ${projectsResult.error.message}`
    )
  }

  if (publicMetadataResult.error) {
    throw new Error(
      `Could not load paper Website settings: ${publicMetadataResult.error.message}`
    )
  }

  const authorRows =
    authorResult.data ?? []

  const links =
    linksResult.data ?? []

  const historyEvents =
    historyResult.data ?? []

  const milestones =
    milestonesResult.data ?? []

  const citationSnapshots =
    citationsResult.data ?? []

  const workSessions =
    (workSessionsResult.data ??
      []) as PaperWorkSession[]

  const conferencePresentations =
    (conferencePresentationsResult.data ??
      []) as LinkedConferencePresentation[]

  const associatedProjects =
    ((projectsResult.data ??
      []) as AssociatedProjectLink[])
      .map((row) =>
        Array.isArray(row.projects)
          ? row.projects[0]
          : row.projects
      )
      .filter(
        (project): project is AssociatedProject =>
          project !== null &&
          project !== undefined
      )
      .sort((a, b) =>
        a.short_title.localeCompare(
          b.short_title
        )
      )

  const publicMetadata =
    (publicMetadataResult.data ?? {
      visibility: 'private',
      slug: null,
      featured: false,
      publication_index: null,
      citation: null,
      highlight_text: null,
      highlight_image_filename: null,
      highlight_image_alt: null,
      highlight_image_caption: null,
    }) as PaperPublicMetadata

  const totalPaperMinutes =
    workSessions.reduce(
      (total, session) =>
        total +
        getSessionDuration(
          session.start_time,
          session.end_time
        ),
      0
    )

  const automaticStartedDate =
    workSessions.reduce<
      string | null
    >((earliest, session) => {
      if (!session.activity_label_id) {
        return earliest
      }

      const dailyLog =
        Array.isArray(
          session.daily_logs
        )
          ? session.daily_logs[0]
          : session.daily_logs

      const logDate =
        dailyLog?.log_date

      if (!logDate) {
        return earliest
      }

      return (
        earliest === null ||
        logDate < earliest
      )
        ? logDate
        : earliest
    }, null)

  const latestHistory =
    historyEvents.length > 0
      ? historyEvents[
          historyEvents.length -
            1
        ]
      : null

  const latestCitationBySource =
    new Map<
      string,
      (typeof citationSnapshots)[number]
    >()

  for (const snapshot of
    citationSnapshots) {
    latestCitationBySource.set(
      snapshot.source,
      snapshot
    )
  }

  const citationSources = [
    ...latestCitationBySource.values(),
  ]

  const googleScholar =
    citationSources.find(
      (snapshot) =>
        snapshot.source
          .trim()
          .toLowerCase() ===
        'google scholar'
    )

  const citationSummary =
    googleScholar
      ? {
          value: String(
            googleScholar.citation_count
          ),
          detail: `Google Scholar · ${googleScholar.captured_on}`,
        }
      : citationSources.length === 1
        ? {
            value: String(
              citationSources[0]
                .citation_count
            ),
            detail: `${citationSources[0].source} · ${citationSources[0].captured_on}`,
          }
        : citationSources.length > 1
          ? {
              value: String(
                citationSources.length
              ),
              detail:
                'Sources tracked separately',
            }
          : null

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={
            paper.short_title
          }
          description={
            paper.title
          }
        />

        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href="/papers"
            variant="secondary"
          >
            Back to papers
          </ButtonLink>

          <ButtonLink
            href={`/papers/${paper.id}/edit`}
            variant="primary"
          >
            Edit
          </ButtonLink>

          {paper.archived_at ? (
            <form
              action={
                restorePaper
              }
            >
              <input
                type="hidden"
                name="paper_id"
                value={
                  paper.id
                }
              />

              <Button
                type="submit"
                variant="secondary"
              >
                Restore
              </Button>
            </form>
          ) : (
            <form
              action={
                archivePaper
              }
            >
              <input
                type="hidden"
                name="paper_id"
                value={
                  paper.id
                }
              />

              <Button
                type="submit"
                variant="danger"
              >
                Archive
              </Button>
            </form>
          )}
        </div>
      </div>

      {paper.archived_at && (
        <div className="mb-6 rounded-md border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-700">
          This paper is archived and
          does not appear in the
          default active-papers list.
        </div>
      )}

      <PaperWorkspaceNav
        historyCount={
          historyEvents.length
        }
        milestoneCount={
          milestones.length
        }
        citationCount={
          citationSnapshots.length
        }
        projectCount={
          associatedProjects.length
        }
        conferenceCount={
          conferencePresentations.length
        }
        totalMinutes={
          totalPaperMinutes
        }
      />

      <PaperSummary
        conferenceCount={
          conferencePresentations.length
        }
        latestHistory={
          latestHistory
            ? {
                label:
                  getHistoryLabel(
                    latestHistory.event_type,
                    latestHistory.decision
                  ),
                date:
                  latestHistory.event_date,
                detail:
                  latestHistory.venue,
              }
            : null
        }
        milestoneCount={
          milestones.length
        }
        plannedMilestoneCount={
          milestones.filter(
            (milestone) =>
              milestone.status ===
              'planned'
          ).length
        }
        citationSummary={
          citationSummary
        }
      />

      <section
        id="overview"
        className="scroll-mt-6"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                status={
                  paper.status as PaperStatus
                }
              />

              {paper.status ===
                'revise-round' &&
                paper.revision_round && (
                  <span className="text-sm text-oxford-ash">
                    Round{' '}
                    {
                      paper.revision_round
                    }
                  </span>
                )}
            </div>

            <h2 className="mt-6 font-serif text-xl font-semibold text-oxford-blue">
              Authors
            </h2>

            <p className="mt-2 text-oxford-charcoal">
              {authorRows.length >
              0
                ? authorRows
                    .map(
                      (row) => {
                        const author =
                          Array.isArray(
                            row.authors
                          )
                            ? row
                                .authors[0]
                            : row.authors

                        return (
                          author?.full_name
                        )
                      }
                    )
                    .filter(Boolean)
                    .join(', ')
                : '—'}
            </p>

            {paper.abstract && (
              <>
                <h2 className="mt-6 font-serif text-xl font-semibold text-oxford-blue">
                  Abstract
                </h2>

                <p className="mt-2 whitespace-pre-line leading-7 text-oxford-charcoal">
                  {
                    paper.abstract
                  }
                </p>
              </>
            )}
          </Card>

          <Card>
            <h2 className="font-serif text-xl font-semibold text-oxford-blue">
              Publication
            </h2>

            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-oxford-charcoal">
                  Current venue
                </dt>

                <dd className="mt-1 text-oxford-ash">
                  {
                    paper.current_venue ??
                    '—'
                  }
                </dd>
              </div>

              <div>
                <dt className="font-medium text-oxford-charcoal">
                  Started
                </dt>

                <dd className="mt-1 text-oxford-ash">
                  {formatDisplayDate(
                    automaticStartedDate
                  )}
                </dd>
              </div>

              <div>
                <dt className="font-medium text-oxford-charcoal">
                  Published
                </dt>

                <dd className="mt-1 text-oxford-ash">
                  {formatDisplayDate(
                    paper.published_on
                  )}
                </dd>
              </div>
            </dl>

            {links.length >
              0 && (
              <>
                <h2 className="mt-6 font-serif text-xl font-semibold text-oxford-blue">
                  Links
                </h2>

                <div className="mt-3 flex flex-col gap-2">
                  {links.map(
                    (link) => (
                      <a
                        key={
                          link.id
                        }
                        href={
                          link.url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-oxford-blue hover:underline"
                      >
                        {link.label ??
                          link.link_type}
                      </a>
                    )
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      </section>

      <HistorySection
        paperId={
          paper.id
        }
        events={
          historyEvents
        }
        error={
          historyError
        }
      />

      <MilestonesSection
        paperId={
          paper.id
        }
        milestones={
          milestones
        }
        error={
          milestoneError
        }
      />

      <CitationsSection
        paperId={
          paper.id
        }
        snapshots={
          citationSnapshots
        }
        error={
          citationError
        }
      />

      <section
        id="projects"
        className="mt-8 scroll-mt-6"
      >
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-oxford-blue">
                Associated projects
              </h2>

              <p className="mt-2 text-sm leading-6 text-oxford-ash">
                Projects linked to this paper. Project associations are managed in the Projects module.
              </p>
            </div>

            {access.hasDashboardAccess && (
              <ButtonLink
                href="/projects"
                variant="secondary"
              >
                Projects
              </ButtonLink>
            )}
          </div>

          {associatedProjects.length > 0 ? (
            <div className="mt-5 divide-y divide-oxford-stone">
              {associatedProjects.map(
                (project) => (
                  <div
                    key={project.id}
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-oxford-charcoal">
                        {project.short_title}
                      </h3>

                      <span className="rounded-full border border-oxford-stone bg-oxford-off-white px-2 py-0.5 text-xs font-medium capitalize text-oxford-ash">
                        {project.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-oxford-charcoal">
                      {project.title}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-oxford-ash">
                      <span>
                        {project.funder}
                      </span>

                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-oxford-blue hover:underline"
                        >
                          Project website
                        </a>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="mt-5 text-sm text-oxford-ash">
              No associated projects.
            </p>
          )}
        </Card>
      </section>

      <section
        id="conferences"
        className="mt-6 scroll-mt-6"
      >
        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Conference presentations
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Read-only presentations linked to this paper. Conference editing remains in the Conferences module.
          </p>

          {conferencePresentations.length > 0 ? (
            <div className="mt-5 divide-y divide-oxford-stone">
              {conferencePresentations.map(
                (presentation) => (
                  <div
                    key={
                      presentation.id
                    }
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-oxford-charcoal">
                        {
                          presentation.event_name
                        }
                      </h3>

                      <span className="rounded-full border border-oxford-stone bg-oxford-off-white px-2 py-0.5 text-xs font-medium text-oxford-ash">
                        {
                          presentation.event_short_name
                        }
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-oxford-ash">
                      <span>
                        {formatDisplayDateRange(
                          presentation.start_date,
                          presentation.end_date
                        )}
                      </span>

                      {presentation.location && (
                        <span>
                          {
                            presentation.location
                          }
                        </span>
                      )}

                      {presentation.presentation_type && (
                        <span>
                          {
                            presentation.presentation_type
                          }
                        </span>
                      )}
                    </div>

                    {presentation.presentation_title && (
                      <p className="mt-2 text-sm font-medium text-oxford-charcoal">
                        {
                          presentation.presentation_title
                        }
                      </p>
                    )}

                    {presentation.authors.length >
                      0 && (
                      <p className="mt-1 text-sm text-oxford-ash">
                        {presentation.authors.join(
                          ', '
                        )}
                      </p>
                    )}

                    {presentation.url && (
                      <a
                        href={
                          presentation.url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm font-medium text-oxford-blue hover:underline"
                      >
                        Presentation link
                      </a>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="mt-5 text-sm text-oxford-ash">
              No associated conference presentations.
            </p>
          )}
        </Card>
      </section>

      <WebsiteSection
        paperId={paper.id}
        metadata={publicMetadata}
        canEdit={
          access.canEditDashboard
        }
        error={websiteError}
        saved={
          websiteSaved === '1'
        }
        action={
          updatePublicPaperMetadata
        }
      />

    </div>
  )
}