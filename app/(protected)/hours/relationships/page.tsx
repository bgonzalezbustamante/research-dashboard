import Link from 'next/link'

import PageHeader from '@/components/page-header'
import Card from '@/components/ui/card'
import ButtonLink from '@/components/ui/button-link'
import { requireDashboardAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

type ActivityLabel = {
  id: string
  name: string
  is_active: boolean
  is_system: boolean
  is_break: boolean
  major_activity: string | null
  merged_into_id: string | null
}

type Project = {
  id: string
  short_title: string
  title: string
  status: string
}

type Paper = {
  id: string
  short_title: string
  status: string
  archived_at: string | null
}

type TeachingItem = {
  id: string
  name: string
  institution: string
  is_current: boolean
}

type WorkSession = {
  id: string
  activity_label_id: string
  paper_id: string
  start_time: string
  end_time: string
}

type UsageSummary = {
  sessions: number
  minutes: number
}

const SESSION_PAGE_SIZE = 1000

function normaliseTime(value: string) {
  return value.slice(0, 5)
}

function timeToMinutes(value: string) {
  const [hours, minutes] =
    normaliseTime(value)
      .split(':')
      .map(Number)

  return hours * 60 + minutes
}

function getDurationMinutes(
  startTime: string,
  endTime: string
) {
  return Math.max(
    0,
    timeToMinutes(endTime) -
      timeToMinutes(startTime)
  )
}

function formatDuration(
  minutes: number
) {
  if (minutes <= 0) {
    return '0h'
  }

  const hours =
    Math.floor(minutes / 60)

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

function formatMajorActivity(
  value: string | null
) {
  if (!value) {
    return 'Unclassified'
  }

  return value
    .split('-')
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(' ')
}

export default async function HoursRelationshipsPage() {
  const access =
    await requireDashboardAccess()

  const supabase =
    await createClient()

  const [
    labelsResult,
    projectsResult,
    papersResult,
    teachingResult,
  ] = await Promise.all([
    supabase
      .from('activity_labels')
      .select(`
        id,
        name,
        is_active,
        is_system,
        is_break,
        major_activity,
        merged_into_id
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .order(
        'name',
        { ascending: true }
      ),

    supabase
      .from('projects')
      .select(`
        id,
        short_title,
        title,
        status
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .order(
        'short_title',
        { ascending: true }
      ),

    supabase
      .from('papers')
      .select(`
        id,
        short_title,
        status,
        archived_at
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .order(
        'short_title',
        { ascending: true }
      ),

    supabase
      .from('teaching_portfolio')
      .select(`
        id,
        name,
        institution,
        is_current
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .order(
        'name',
        { ascending: true }
      ),
  ])

  for (const [label, result] of [
    ['Activity labels', labelsResult],
    ['Projects', projectsResult],
    ['Papers', papersResult],
    ['Teaching', teachingResult],
  ] as const) {
    if (result.error) {
      throw new Error(
        `Could not load ${label}: ${result.error.message}`
      )
    }
  }

  const labels =
    (labelsResult.data ?? []) as ActivityLabel[]

  const projects =
    (projectsResult.data ?? []) as Project[]

  const papers =
    (papersResult.data ?? []) as Paper[]

  const teachingItems =
    (teachingResult.data ?? []) as TeachingItem[]

  const projectIds =
    projects.map(
      (project) => project.id
    )

  const paperIds =
    papers.map(
      (paper) => paper.id
    )

  const teachingIds =
    teachingItems.map(
      (item) => item.id
    )

  const [
    projectLabelsResult,
    projectPapersResult,
    teachingLabelsResult,
  ] = await Promise.all([
    projectIds.length > 0
      ? supabase
          .from(
            'project_activity_labels'
          )
          .select(
            'project_id, activity_label_id'
          )
          .in(
            'project_id',
            projectIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),

    projectIds.length > 0
      ? supabase
          .from('project_papers')
          .select(
            'project_id, paper_id'
          )
          .in(
            'project_id',
            projectIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),

    teachingIds.length > 0
      ? supabase
          .from(
            'teaching_activity_labels'
          )
          .select(
            'teaching_id, activity_label_id'
          )
          .in(
            'teaching_id',
            teachingIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ])

  for (const [label, result] of [
    [
      'Project Activity-label relationships',
      projectLabelsResult,
    ],
    [
      'Project Paper relationships',
      projectPapersResult,
    ],
    [
      'Teaching Activity-label relationships',
      teachingLabelsResult,
    ],
  ] as const) {
    if (result.error) {
      throw new Error(
        `Could not load ${label}: ${result.error.message}`
      )
    }
  }

  const paperLinkedSessions:
    WorkSession[] = []

  if (paperIds.length > 0) {
    let from = 0

    while (true) {
      const { data, error } =
        await supabase
          .from('work_sessions')
          .select(`
            id,
            activity_label_id,
            paper_id,
            start_time,
            end_time
          `)
          .in(
            'paper_id',
            paperIds
          )
          .order(
            'id',
            { ascending: true }
          )
          .range(
            from,
            from +
              SESSION_PAGE_SIZE -
              1
          )

      if (error) {
        throw new Error(
          `Could not load Paper-linked work sessions: ${error.message}`
        )
      }

      const rows =
        (data ?? [])
          .filter(
            (
              row
            ): row is WorkSession =>
              row.paper_id !==
              null
          )

      paperLinkedSessions.push(
        ...rows
      )

      if (
        (data ?? []).length <
        SESSION_PAGE_SIZE
      ) {
        break
      }

      from +=
        SESSION_PAGE_SIZE
    }
  }

  const labelById =
    new Map(
      labels.map(
        (label) => [
          label.id,
          label,
        ]
      )
    )

  const projectById =
    new Map(
      projects.map(
        (project) => [
          project.id,
          project,
        ]
      )
    )

  const paperById =
    new Map(
      papers.map(
        (paper) => [
          paper.id,
          paper,
        ]
      )
    )

  const projectLabelIds =
    new Map<
      string,
      string[]
    >()

  const labelProjectId =
    new Map<
      string,
      string
    >()

  for (const row of
    projectLabelsResult.data ??
    []) {
    const existing =
      projectLabelIds.get(
        row.project_id
      ) ?? []

    existing.push(
      row.activity_label_id
    )

    projectLabelIds.set(
      row.project_id,
      existing
    )

    labelProjectId.set(
      row.activity_label_id,
      row.project_id
    )
  }

  const projectPaperIds =
    new Map<
      string,
      string[]
    >()

  const paperProjectIds =
    new Map<
      string,
      Set<string>
    >()

  for (const row of
    projectPapersResult.data ??
    []) {
    const projectPapers =
      projectPaperIds.get(
        row.project_id
      ) ?? []

    projectPapers.push(
      row.paper_id
    )

    projectPaperIds.set(
      row.project_id,
      projectPapers
    )

    const paperProjects =
      paperProjectIds.get(
        row.paper_id
      ) ?? new Set<string>()

    paperProjects.add(
      row.project_id
    )

    paperProjectIds.set(
      row.paper_id,
      paperProjects
    )
  }

  const teachingLabelIds =
    new Map<
      string,
      string[]
    >()

  const labelsUsedByTeaching =
    new Set<string>()

  for (const row of
    teachingLabelsResult.data ??
    []) {
    const existing =
      teachingLabelIds.get(
        row.teaching_id
      ) ?? []

    existing.push(
      row.activity_label_id
    )

    teachingLabelIds.set(
      row.teaching_id,
      existing
    )

    labelsUsedByTeaching.add(
      row.activity_label_id
    )
  }

  const usageByPaper =
    new Map<
      string,
      Map<
        string,
        UsageSummary
      >
    >()

  for (const session of
    paperLinkedSessions) {
    const paperUsage =
      usageByPaper.get(
        session.paper_id
      ) ??
      new Map<
        string,
        UsageSummary
      >()

    const existing =
      paperUsage.get(
        session.activity_label_id
      ) ?? {
        sessions: 0,
        minutes: 0,
      }

    existing.sessions += 1
    existing.minutes +=
      getDurationMinutes(
        session.start_time,
        session.end_time
      )

    paperUsage.set(
      session.activity_label_id,
      existing
    )

    usageByPaper.set(
      session.paper_id,
      paperUsage
    )
  }

  const mismatches:
    {
      paper: Paper
      observedLabel: ActivityLabel
      assignedProject: Project
      paperProjects: Project[]
      usage: UsageSummary
    }[] = []

  for (const [
    paperId,
    paperUsage,
  ] of usageByPaper) {
    const paper =
      paperById.get(
        paperId
      )

    if (!paper) {
      continue
    }

    const ownProjectIds =
      paperProjectIds.get(
        paperId
      ) ?? new Set<string>()

    for (const [
      labelId,
      usage,
    ] of paperUsage) {
      const assignedProjectId =
        labelProjectId.get(
          labelId
        )

      if (
        !assignedProjectId ||
        ownProjectIds.has(
          assignedProjectId
        )
      ) {
        continue
      }

      const observedLabel =
        labelById.get(
          labelId
        )

      const assignedProject =
        projectById.get(
          assignedProjectId
        )

      if (
        !observedLabel ||
        !assignedProject
      ) {
        continue
      }

      const paperProjects =
        [
          ...ownProjectIds,
        ]
          .map(
            (projectId) =>
              projectById.get(
                projectId
              )
          )
          .filter(
            (
              project
            ): project is Project =>
              Boolean(project)
          )

      mismatches.push({
        paper,
        observedLabel,
        assignedProject,
        paperProjects,
        usage,
      })
    }
  }

  mismatches.sort(
    (a, b) =>
      b.usage.minutes -
        a.usage.minutes ||
      a.paper.short_title.localeCompare(
        b.paper.short_title
      )
  )

  const standalonePapers =
    papers.filter(
      (paper) =>
        !paperProjectIds.has(
          paper.id
        ) &&
        usageByPaper.has(
          paper.id
        )
    )

  const standaloneLabelIds =
    new Set<string>()

  for (const paper of
    standalonePapers) {
    for (const labelId of
      usageByPaper
        .get(paper.id)
        ?.keys() ?? []) {
      standaloneLabelIds.add(
        labelId
      )
    }
  }

  const explicitlyAssociatedLabels =
    new Set<string>([
      ...labelProjectId.keys(),
      ...labelsUsedByTeaching,
    ])

  const otherActiveLabels =
    labels.filter(
      (label) =>
        label.is_active &&
        !label.is_system &&
        !label.is_break &&
        !label.merged_into_id &&
        !explicitlyAssociatedLabels.has(
          label.id
        ) &&
        !standaloneLabelIds.has(
          label.id
        )
    )

  const renderObservedLabels = (
    paperId: string
  ) => {
    const usage =
      usageByPaper.get(
        paperId
      )

    if (
      !usage ||
      usage.size === 0
    ) {
      return (
        <span className="text-xs text-oxford-ash">
          No recorded Paper-linked
          sessions
        </span>
      )
    }

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {[
          ...usage.entries(),
        ]
          .sort(
            (
              [, a],
              [, b]
            ) =>
              b.minutes -
              a.minutes
          )
          .map(
            ([
              labelId,
              summary,
            ]) => {
              const label =
                labelById.get(
                  labelId
                )

              if (!label) {
                return null
              }

              const assignedProjectId =
                labelProjectId.get(
                  labelId
                )

              const ownProjects =
                paperProjectIds.get(
                  paperId
                ) ?? new Set<string>()

              const mismatch =
                Boolean(
                  assignedProjectId &&
                  !ownProjects.has(
                    assignedProjectId
                  )
                )

              return (
                <span
                  key={labelId}
                  className={
                    mismatch
                      ? 'rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900'
                      : 'rounded-full border border-oxford-stone bg-oxford-off-white px-2 py-1 text-xs text-oxford-charcoal'
                  }
                >
                  Observed: {label.name}
                  {' · '}
                  {formatDuration(
                    summary.minutes
                  )}
                  {mismatch
                    ? ' · Potential mismatch'
                    : ''}
                </span>
              )
            }
          )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Activity relationships"
          description="A read-only map of how Activity labels connect to Projects, Papers, and Teaching."
        />

        <ButtonLink
          href="/hours"
          variant="secondary"
        >
          Back to Hours
        </ButtonLink>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
              Assigned
            </div>
            <p className="mt-1 text-sm leading-6 text-oxford-charcoal">
              Explicit Project or Teaching relationships stored in the Dashboard.
            </p>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
              Observed
            </div>
            <p className="mt-1 text-sm leading-6 text-oxford-charcoal">
              Activity labels actually used in work sessions linked to a Paper.
            </p>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-amber-800">
              Potential mismatch
            </div>
            <p className="mt-1 text-sm leading-6 text-oxford-charcoal">
              A Paper used a label explicitly assigned to a different Project.
            </p>
          </div>
        </div>
      </Card>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Relationship check
          </h2>
          <p className="mt-1 text-sm text-oxford-ash">
            Conservative cross-Project checks only; general labels such as Writing are not treated as mismatches.
          </p>
        </div>

        {mismatches.length ===
        0 ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            No cross-Project Activity-label mismatches detected.
          </div>
        ) : (
          <div className="space-y-3">
            {mismatches.map(
              (mismatch) => (
                <div
                  key={`${mismatch.paper.id}-${mismatch.observedLabel.id}`}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/papers/${mismatch.paper.id}`}
                      className="font-medium text-oxford-blue hover:underline"
                    >
                      {mismatch.paper.short_title}
                    </Link>
                    <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-900">
                      Potential mismatch
                    </span>
                  </div>

                  <p className="mt-1 text-sm leading-6 text-amber-950">
                    Observed label “{mismatch.observedLabel.name}” ({formatDuration(
                      mismatch.usage.minutes
                    )}) is assigned to {mismatch.assignedProject.short_title}
                    {mismatch.paperProjects.length > 0
                      ? `, while this Paper belongs to ${mismatch.paperProjects
                          .map(
                            (project) =>
                              project.short_title
                          )
                          .join(', ')}.`
                      : ', while this Paper has no Project association.'}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Research projects
          </h2>
          <p className="mt-1 text-sm text-oxford-ash">
            Project labels are assigned explicitly; Papers are nested from Project associations.
          </p>
        </div>

        <div className="space-y-3">
          {projects.map(
            (project) => {
              const assignedLabels =
                (
                  projectLabelIds.get(
                    project.id
                  ) ?? []
                )
                  .map(
                    (labelId) =>
                      labelById.get(
                        labelId
                      )
                  )
                  .filter(
                    (
                      label
                    ): label is ActivityLabel =>
                      Boolean(label)
                  )

              const linkedPapers =
                (
                  projectPaperIds.get(
                    project.id
                  ) ?? []
                )
                  .map(
                    (paperId) =>
                      paperById.get(
                        paperId
                      )
                  )
                  .filter(
                    (
                      paper
                    ): paper is Paper =>
                      Boolean(paper)
                  )
                  .sort(
                    (a, b) =>
                      a.short_title.localeCompare(
                        b.short_title
                      )
                  )

              return (
                <details
                  key={project.id}
                  className="rounded-lg border border-oxford-stone bg-white"
                  open
                >
                  <summary className="cursor-pointer px-4 py-3">
                    <span className="font-serif text-lg font-semibold text-oxford-blue">
                      {project.short_title}
                    </span>
                    <span className="ml-2 text-xs capitalize text-oxford-ash">
                      {project.status}
                    </span>
                  </summary>

                  <div className="border-t border-oxford-stone px-4 py-4">
                    <p className="text-sm text-oxford-charcoal">
                      {project.title}
                    </p>

                    <div className="mt-4 border-l-2 border-oxford-stone pl-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                        Assigned Activity labels
                      </div>

                      {assignedLabels.length >
                      0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {assignedLabels.map(
                            (label) => (
                              <span
                                key={label.id}
                                className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900"
                              >
                                {label.name}
                                {' · '}
                                {formatMajorActivity(
                                  label.major_activity
                                )}
                                {!label.is_active
                                  ? ' · inactive'
                                  : ''}
                              </span>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-amber-800">
                          No Activity label assigned.
                        </p>
                      )}

                      <div className="mt-5 text-xs font-medium uppercase tracking-wide text-oxford-ash">
                        Papers
                      </div>

                      {linkedPapers.length >
                      0 ? (
                        <div className="mt-2 space-y-3">
                          {linkedPapers.map(
                            (paper) => (
                              <div
                                key={paper.id}
                                className="border-l border-oxford-stone pl-4"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    href={`/papers/${paper.id}`}
                                    className="text-sm font-medium text-oxford-blue hover:underline"
                                  >
                                    {paper.short_title}
                                  </Link>
                                  <span className="text-xs capitalize text-oxford-ash">
                                    {paper.status}
                                    {paper.archived_at
                                      ? ' · archived'
                                      : ''}
                                  </span>
                                </div>

                                {renderObservedLabels(
                                  paper.id
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-oxford-ash">
                          No associated Papers.
                        </p>
                      )}
                    </div>
                  </div>
                </details>
              )
            }
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Standalone papers
          </h2>
          <p className="mt-1 text-sm text-oxford-ash">
            Papers without a Project association are shown when they have recorded Paper-linked work; labels are observed from those sessions rather than assigned.
          </p>
        </div>

        {standalonePapers.length >
        0 ? (
          <div className="space-y-3">
            {standalonePapers.map(
              (paper) => (
                <div
                  key={paper.id}
                  className="rounded-lg border border-oxford-stone bg-white px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/papers/${paper.id}`}
                      className="font-medium text-oxford-blue hover:underline"
                    >
                      {paper.short_title}
                    </Link>
                    <span className="text-xs capitalize text-oxford-ash">
                      {paper.status}
                      {paper.archived_at
                        ? ' · archived'
                        : ''}
                    </span>
                  </div>

                  {renderObservedLabels(
                    paper.id
                  )}
                </div>
              )
            )}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-oxford-ash">
              No standalone Papers have recorded Paper-linked work.
            </p>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Teaching
          </h2>
          <p className="mt-1 text-sm text-oxford-ash">
            Teaching relationships are explicit assignments from Teaching Portfolio items to Activity labels.
          </p>
        </div>

        <div className="space-y-3">
          {teachingItems.map(
            (item) => {
              const assignedLabels =
                (
                  teachingLabelIds.get(
                    item.id
                  ) ?? []
                )
                  .map(
                    (labelId) =>
                      labelById.get(
                        labelId
                      )
                  )
                  .filter(
                    (
                      label
                    ): label is ActivityLabel =>
                      Boolean(label)
                  )

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-oxford-stone bg-white px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-oxford-charcoal">
                      {item.name}
                    </span>
                    {item.is_current && (
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-oxford-ash">
                    {item.institution}
                  </p>

                  {assignedLabels.length >
                  0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {assignedLabels.map(
                        (label) => (
                          <span
                            key={label.id}
                            className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900"
                          >
                            Assigned: {label.name}
                            {!label.is_active
                              ? ' · inactive'
                              : ''}
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-amber-800">
                      No Activity label assigned.
                    </p>
                  )}
                </div>
              )
            }
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Other active labels
          </h2>
          <p className="mt-1 text-sm text-oxford-ash">
            Active labels with no explicit Project or Teaching assignment and no observed use in a standalone Paper.
          </p>
        </div>

        {otherActiveLabels.length >
        0 ? (
          <Card>
            <div className="flex flex-wrap gap-2">
              {otherActiveLabels.map(
                (label) => (
                  <span
                    key={label.id}
                    className="rounded-full border border-oxford-stone bg-oxford-off-white px-2 py-1 text-xs text-oxford-charcoal"
                  >
                    {label.name}
                    {' · '}
                    {formatMajorActivity(
                      label.major_activity
                    )}
                  </span>
                )
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-oxford-ash">
              No other active labels.
            </p>
          </Card>
        )}
      </section>
    </div>
  )
}
