import { notFound } from 'next/navigation'

import CitationsSection from '@/components/papers/citations-section'
import HistorySection from '@/components/papers/history-section'
import MilestonesSection from '@/components/papers/milestones-section'
import NotesSection from '@/components/papers/notes-section'
import PresentationsSection from '@/components/papers/presentations-section'
import PaperSummary from '@/components/papers/paper-summary'
import PaperWorkspaceNav from '@/components/papers/paper-workspace-nav'
import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import StatusBadge from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/server'

import {
  archivePaper,
  restorePaper,
} from '../actions'

type PaperStatus =
  | 'writing'
  | 'under-review'
  | 'revise-round'
  | 'published'
  | 'standby'
  | 'deprecated'

type PaperPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    milestoneError?: string
    historyError?: string
    presentationError?: string
    noteError?: string
    citationError?: string
  }>
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
    milestoneError,
    historyError,
    presentationError,
    noteError,
    citationError,
  } = await searchParams

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
      target_venue,
      current_venue,
      started_on,
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
    milestonesResult,
    historyResult,
    presentationsResult,
    notesResult,
    citationsResult,
    workSessionsResult,
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
      .from('paper_presentations')
      .select(`
        id,
        event_name,
        location,
        presentation_date,
        presentation_title,
        presentation_type,
        url,
        notes
      `)
      .eq('paper_id', id),

    supabase
      .from('paper_notes')
      .select(`
        id,
        note_date,
        note_type,
        body,
        created_by,
        created_at,
        updated_at,
        profiles (
          full_name,
          email
        )
      `)
      .eq('paper_id', id)
      .order('note_date', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      }),

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
        start_time,
        end_time
      `)
      .eq('paper_id', id),
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

  if (milestonesResult.error) {
    throw new Error(
      `Could not load milestones: ${milestonesResult.error.message}`
    )
  }

  if (historyResult.error) {
    throw new Error(
      `Could not load paper history: ${historyResult.error.message}`
    )
  }

  if (presentationsResult.error) {
    throw new Error(
      `Could not load presentations: ${presentationsResult.error.message}`
    )
  }

  if (notesResult.error) {
    throw new Error(
      `Could not load paper notes: ${notesResult.error.message}`
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

  const authorRows =
    authorResult.data ?? []

  const links =
    linksResult.data ?? []

  const milestones =
    milestonesResult.data ?? []

  const historyEvents =
    historyResult.data ?? []

  const presentations =
    presentationsResult.data ?? []

  const notes =
    notesResult.data ?? []

  const citationSnapshots =
    citationsResult.data ?? []

  const workSessions =
    workSessionsResult.data ?? []

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

  const normalizedNotes =
    notes.map((note) => {
      const profile =
        Array.isArray(
          note.profiles
        )
          ? note.profiles[0]
          : note.profiles

      return {
        id: note.id,
        note_date:
          note.note_date,
        note_type:
          note.note_type,
        body:
          note.body,
        created_at:
          note.created_at,
        updated_at:
          note.updated_at,
        creator_name:
          profile?.full_name ??
          profile?.email ??
          'You',
      }
    })

  const today =
    getAmsterdamDate()

  const plannedMilestones =
    milestones
      .filter(
        (milestone) =>
          milestone.status ===
          'planned'
      )
      .sort((a, b) => {
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

  const nextMilestone =
    plannedMilestones[0] ??
    null

  const latestHistory =
    historyEvents.length > 0
      ? historyEvents[
          historyEvents.length -
            1
        ]
      : null

  const upcomingPresentations =
    presentations
      .filter(
        (presentation) =>
          presentation.presentation_date !==
            null &&
          presentation.presentation_date >=
            today
      )
      .sort((a, b) =>
        (
          a.presentation_date ??
          ''
        ).localeCompare(
          b.presentation_date ??
            ''
        )
      )

  const nextPresentation =
    upcomingPresentations[0] ??
    null

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
        milestoneCount={
          milestones.length
        }
        historyCount={
          historyEvents.length
        }
        presentationCount={
          presentations.length
        }
        noteCount={
          normalizedNotes.length
        }
        citationCount={
          citationSnapshots.length
        }
        totalMinutes={
          totalPaperMinutes
        }
      />

      <PaperSummary
        nextMilestone={
          nextMilestone
            ? {
                title:
                  nextMilestone.title,
                targetDate:
                  nextMilestone.target_date,
                overdue:
                  nextMilestone.target_date !==
                    null &&
                  nextMilestone.target_date <
                    today,
              }
            : null
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
        nextPresentation={
          nextPresentation &&
          nextPresentation.presentation_date
            ? {
                eventName:
                  nextPresentation.event_name,
                date:
                  nextPresentation.presentation_date,
                location:
                  nextPresentation.location,
              }
            : null
        }
        noteCount={
          normalizedNotes.length
        }
        latestNoteDate={
          normalizedNotes[0]
            ?.note_date ??
          null
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
                  Target venue
                </dt>

                <dd className="mt-1 text-oxford-ash">
                  {
                    paper.target_venue ??
                    '—'
                  }
                </dd>
              </div>

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
                  {
                    paper.started_on ??
                    '—'
                  }
                </dd>
              </div>

              <div>
                <dt className="font-medium text-oxford-charcoal">
                  Published
                </dt>

                <dd className="mt-1 text-oxford-ash">
                  {
                    paper.published_on ??
                    '—'
                  }
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

      <PresentationsSection
        paperId={
          paper.id
        }
        presentations={
          presentations
        }
        error={
          presentationError
        }
      />

      <NotesSection
        paperId={
          paper.id
        }
        notes={
          normalizedNotes
        }
        error={
          noteError
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
    </div>
  )
}