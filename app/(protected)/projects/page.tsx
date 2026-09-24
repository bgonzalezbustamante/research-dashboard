import Link from 'next/link'

import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import {
  requireDashboardAccess,
} from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import {
  createProject,
  deleteProject,
  updateProject,
} from './actions'

type ProjectsPageProps = {
  searchParams: Promise<{
    error?: string
    created?: string
    saved?: string
    deleted?: string
  }>
}

type ProjectStatus =
  | 'active'
  | 'completed'

type ProjectVisibility =
  | 'private'
  | 'public'

type ProjectRow = {
  id: string
  owner_id: string
  short_title: string
  title: string
  abstract: string
  funder: string
  funder_note: string | null
  url: string | null
  start_year: number | null
  end_year: number | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

type ProjectMetadataRow = {
  project_id: string
  visibility: ProjectVisibility
  slug: string | null
  featured: boolean
  project_image_filename: string | null
  funder_image_filename: string | null
}

type ProjectPaperRow = {
  project_id: string
  paper_id: string
}

type ProjectActivityLabelRow = {
  project_id: string
  activity_label_id: string
}

type PaperRow = {
  id: string
  short_title: string
  title: string
  status: string
  published_on: string | null
}

type ActivityLabelRow = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  is_break: boolean
  major_activity: string | null
}

type ProjectHoursRow = {
  project_id: string
  net_minutes: number | string
  session_count: number | string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function formatDuration(
  value: number
) {
  if (value <= 0) {
    return '0h'
  }

  const hours =
    Math.floor(
      value / 60
    )

  const minutes =
    value % 60

  if (
    hours > 0 &&
    minutes > 0
  ) {
    return `${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}m`
}

function statusClass(
  status: ProjectStatus
) {
  return status === 'active'
    ? 'border-green-200 bg-green-50 text-green-800'
    : 'border-gray-300 bg-gray-100 text-gray-700'
}

function visibilityClass(
  visibility: ProjectVisibility
) {
  return visibility === 'public'
    ? 'border-sky-200 bg-sky-50 text-sky-900'
    : 'border-gray-300 bg-gray-100 text-gray-700'
}

function groupIds(
  rows: {
    project_id: string
    [key: string]: string
  }[],
  key: string
) {
  const grouped =
    new Map<
      string,
      Set<string>
    >()

  for (const row of rows) {
    const current =
      grouped.get(
        row.project_id
      ) ??
      new Set<string>()

    current.add(
      row[key]
    )

    grouped.set(
      row.project_id,
      current
    )
  }

  return grouped
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const access =
    await requireDashboardAccess()

  const params =
    await searchParams

  const supabase =
    await createClient()

  const [
    projectsResult,
    metadataResult,
    projectPapersResult,
    projectLabelsResult,
    papersResult,
    labelsResult,
    hoursResult,
  ] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        id,
        owner_id,
        short_title,
        title,
        abstract,
        funder,
        funder_note,
        url,
        start_year,
        end_year,
        status,
        created_at,
        updated_at
      `)
      .eq(
        'owner_id',
        access.ownerId
      ),

    supabase
      .from(
        'project_public_metadata'
      )
      .select(`
        project_id,
        visibility,
        slug,
        featured,
        project_image_filename,
        funder_image_filename
      `),

    supabase
      .from('project_papers')
      .select(
        'project_id, paper_id'
      ),

    supabase
      .from(
        'project_activity_labels'
      )
      .select(
        'project_id, activity_label_id'
      ),

    supabase
      .from('papers')
      .select(`
        id,
        short_title,
        title,
        status,
        published_on
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .order(
        'short_title',
        {
          ascending: true,
        }
      ),

    supabase
      .from('activity_labels')
      .select(`
        id,
        name,
        description,
        is_active,
        is_break,
        major_activity
      `)
      .eq(
        'owner_id',
        access.ownerId
      )
      .eq(
        'is_break',
        false
      )
      .order(
        'name',
        {
          ascending: true,
        }
      ),

    supabase.rpc(
      'get_project_hours'
    ),
  ])

  for (const [
    label,
    result,
  ] of [
    ['projects', projectsResult],
    [
      'project public metadata',
      metadataResult,
    ],
    [
      'project papers',
      projectPapersResult,
    ],
    [
      'project activity labels',
      projectLabelsResult,
    ],
    ['papers', papersResult],
    [
      'activity labels',
      labelsResult,
    ],
    ['project hours', hoursResult],
  ] as const) {
    if (result.error) {
      throw new Error(
        `Could not load ${label}: ${result.error.message}`
      )
    }
  }

  const projects =
    (projectsResult.data ??
      []) as ProjectRow[]

  const metadataRows =
    (metadataResult.data ??
      []) as ProjectMetadataRow[]

  const projectPaperRows =
    (projectPapersResult.data ??
      []) as ProjectPaperRow[]

  const projectLabelRows =
    (projectLabelsResult.data ??
      []) as ProjectActivityLabelRow[]

  const papers =
    (papersResult.data ??
      []) as PaperRow[]

  const activityLabels =
    (labelsResult.data ??
      []) as ActivityLabelRow[]

  const hoursRows =
    (hoursResult.data ??
      []) as ProjectHoursRow[]

  const metadataByProject =
    new Map(
      metadataRows.map(
        (row) => [
          row.project_id,
          row,
        ]
      )
    )

  const papersByProject =
    groupIds(
      projectPaperRows,
      'paper_id'
    )

  const labelsByProject =
    groupIds(
      projectLabelRows,
      'activity_label_id'
    )

  const projectTitleById =
    new Map(
      projects.map(
        (project) => [
          project.id,
          project.short_title,
        ]
      )
    )

  const labelProjectById =
    new Map(
      projectLabelRows.map(
        (row) => [
          row.activity_label_id,
          row.project_id,
        ]
      )
    )

  const hoursByProject =
    new Map(
      hoursRows.map(
        (row) => [
          row.project_id,
          {
            minutes:
              Number(
                row.net_minutes
              ),
            sessions:
              Number(
                row.session_count
              ),
          },
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

  const labelById =
    new Map(
      activityLabels.map(
        (label) => [
          label.id,
          label,
        ]
      )
    )

  const sortedProjects = [
    ...projects,
  ].sort((a, b) => {
    if (
      a.status !==
      b.status
    ) {
      return a.status ===
        'active'
        ? -1
        : 1
    }

    return a.short_title.localeCompare(
      b.short_title
    )
  })

  const isOwner =
    access.canEdit

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Manage funded and research projects, public presentation, associated publications, and Dashboard-only activity tracking."
      />

      {params.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {params.error}
        </div>
      )}

      {(params.created ||
        params.saved ||
        params.deleted) && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {params.created
            ? 'Project created.'
            : params.saved
              ? 'Project saved.'
              : 'Project deleted.'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Public contract
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Projects are Private by
            default. Public projects
            expose only canonical
            project content, funder
            note, canonical URL,
            start/end years,
            Featured state, static asset
            filenames, and the slugs of
            associated papers
            that are themselves Public.
            Activity-label links and
            tracked hours remain
            Dashboard-only.
          </p>
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Static assets
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Store only filenames here.
            The academic website will
            resolve project images from{' '}
            <code>
              /projects/&lt;slug&gt;/&lt;filename&gt;
            </code>{' '}
            and funder logos from{' '}
            <code>
              /funders/&lt;filename&gt;
            </code>.
          </p>

          <p className="mt-2 text-xs leading-5 text-oxford-ash">
            Supported formats: PNG,
            WebP, JPG and JPEG.
          </p>
        </Card>
      </div>

      {isOwner && (
        <Card className="mt-6">
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            New project
          </h2>

          <form
            action={createProject}
            className="mt-5"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="new-project-short-title"
                  className={labelClass}
                >
                  Short title
                </label>

                <input
                  id="new-project-short-title"
                  name="short_title"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-project-funder"
                  className={labelClass}
                >
                  Funder
                </label>

                <input
                  id="new-project-funder"
                  name="funder"
                  required
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-project-title"
                  className={labelClass}
                >
                  Long title
                </label>

                <input
                  id="new-project-title"
                  name="title"
                  required
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-project-funder-note"
                  className={labelClass}
                >
                  Funder note
                </label>

                <textarea
                  id="new-project-funder-note"
                  name="funder_note"
                  rows={3}
                  maxLength={1000}
                  placeholder="Optional public note about the funder, grant, or funding arrangement"
                  className={inputClass}
                />

                <p className="mt-1 text-xs text-oxford-ash">
                  Optional and public for
                  Public projects.
                </p>
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-project-url"
                  className={labelClass}
                >
                  Project URL
                </label>

                <input
                  id="new-project-url"
                  name="url"
                  type="url"
                  placeholder="https://..."
                  className={inputClass}
                />

                <p className="mt-1 text-xs text-oxford-ash">
                  Optional. Public projects
                  expose this URL to the
                  academic website.
                </p>
              </div>

              <div>
                <label
                  htmlFor="new-project-start-year"
                  className={labelClass}
                >
                  Start year
                </label>

                <input
                  id="new-project-start-year"
                  name="start_year"
                  type="number"
                  min={1000}
                  max={9999}
                  placeholder="2025"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-project-end-year"
                  className={labelClass}
                >
                  End year
                </label>

                <input
                  id="new-project-end-year"
                  name="end_year"
                  type="number"
                  min={1000}
                  max={9999}
                  placeholder="2027"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-project-abstract"
                  className={labelClass}
                >
                  Abstract
                </label>

                <textarea
                  id="new-project-abstract"
                  name="abstract"
                  rows={5}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-project-status"
                  className={labelClass}
                >
                  Status
                </label>

                <select
                  id="new-project-status"
                  name="status"
                  defaultValue="active"
                  className={inputClass}
                >
                  <option value="active">
                    Active
                  </option>
                  <option value="completed">
                    Completed
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-project-visibility"
                  className={labelClass}
                >
                  Website visibility
                </label>

                <select
                  id="new-project-visibility"
                  name="visibility"
                  defaultValue="private"
                  className={inputClass}
                >
                  <option value="private">
                    Private
                  </option>
                  <option value="public">
                    Public
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-project-slug"
                  className={labelClass}
                >
                  Public slug
                </label>

                <input
                  id="new-project-slug"
                  name="slug"
                  placeholder="project-slug"
                  className={inputClass}
                />
              </div>

              <div className="flex items-start pt-7">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-oxford-charcoal">
                  <input
                    name="featured"
                    type="checkbox"
                    className="h-4 w-4 rounded border-oxford-stone"
                  />
                  Featured
                </label>
              </div>

              <div>
                <label
                  htmlFor="new-project-image"
                  className={labelClass}
                >
                  Project image filename
                </label>

                <input
                  id="new-project-image"
                  name="project_image_filename"
                  placeholder="project.png"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-funder-image"
                  className={labelClass}
                >
                  Funder image filename
                </label>

                <input
                  id="new-funder-image"
                  name="funder_image_filename"
                  placeholder="funder.png"
                  className={inputClass}
                />
              </div>
            </div>

            <details className="mt-5 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                Associated papers
              </summary>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {papers.map(
                  (paper) => (
                    <label
                      key={paper.id}
                      className="flex items-start gap-2 rounded-md bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="paper_ids"
                        value={
                          paper.id
                        }
                        className="mt-0.5 h-4 w-4"
                      />

                      <span>
                        <span className="font-medium text-oxford-charcoal">
                          {
                            paper.short_title
                          }
                        </span>

                        <span className="ml-2 text-xs text-oxford-ash">
                          {
                            paper.status
                          }
                        </span>
                      </span>
                    </label>
                  )
                )}
              </div>
            </details>

            <details className="mt-4 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                Activity labels for
                tracked hours
              </summary>

              <p className="mt-2 text-xs leading-5 text-oxford-ash">
                Each activity label
                can belong to only one
                project so hours are
                not double-counted.
              </p>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {activityLabels.map(
                  (label) => {
                    const assignedProjectId =
                      labelProjectById.get(
                        label.id
                      )

                    const assignedTitle =
                      assignedProjectId
                        ? projectTitleById.get(
                            assignedProjectId
                          )
                        : null

                    return (
                      <label
                        key={
                          label.id
                        }
                        className="flex items-start gap-2 rounded-md bg-white px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="activity_label_ids"
                          value={
                            label.id
                          }
                          disabled={
                            Boolean(
                              assignedProjectId
                            )
                          }
                          className="mt-0.5 h-4 w-4"
                        />

                        <span>
                          <span className="font-medium text-oxford-charcoal">
                            {
                              label.name
                            }
                          </span>

                          {!label.is_active && (
                            <span className="ml-2 text-xs text-oxford-ash">
                              Inactive
                            </span>
                          )}

                          {assignedTitle && (
                            <span className="mt-1 block text-xs text-oxford-ash">
                              Assigned to{' '}
                              {
                                assignedTitle
                              }
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  }
                )}
              </div>
            </details>

            <div className="mt-5">
              <Button type="submit">
                Create project
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-8 space-y-6">
        {sortedProjects.length ===
        0 ? (
          <Card>
            <p className="text-sm text-oxford-ash">
              No projects have been
              created yet.
            </p>
          </Card>
        ) : (
          sortedProjects.map(
            (project) => {
              const metadata =
                metadataByProject.get(
                  project.id
                ) ?? {
                  project_id:
                    project.id,
                  visibility:
                    'private' as const,
                  slug: null,
                  project_image_filename:
                    null,
                  funder_image_filename:
                    null,
                  featured: false,
                }

              const linkedPaperIds =
                papersByProject.get(
                  project.id
                ) ??
                new Set<string>()

              const linkedLabelIds =
                labelsByProject.get(
                  project.id
                ) ??
                new Set<string>()

              const projectHours =
                hoursByProject.get(
                  project.id
                ) ?? {
                  minutes: 0,
                  sessions: 0,
                }

              const linkedPapers =
                [
                  ...linkedPaperIds,
                ]
                  .map((id) =>
                    paperById.get(
                      id
                    )
                  )
                  .filter(
                    (
                      paper
                    ): paper is PaperRow =>
                      Boolean(
                        paper
                      )
                  )
                  .sort((a, b) =>
                    a.short_title.localeCompare(
                      b.short_title
                    )
                  )

              const linkedLabels =
                [
                  ...linkedLabelIds,
                ]
                  .map((id) =>
                    labelById.get(
                      id
                    )
                  )
                  .filter(
                    (
                      label
                    ): label is ActivityLabelRow =>
                      Boolean(
                        label
                      )
                  )
                  .sort((a, b) =>
                    a.name.localeCompare(
                      b.name
                    )
                  )

              const projectAssetPath =
                metadata.slug &&
                metadata.project_image_filename
                  ? `/projects/${metadata.slug}/${metadata.project_image_filename}`
                  : null

              const funderAssetPath =
                metadata.funder_image_filename
                  ? `/funders/${metadata.funder_image_filename}`
                  : null

              return (
                <Card
                  key={
                    project.id
                  }
                  className={
                    params.saved ===
                      project.id ||
                    params.created ===
                      project.id
                      ? 'ring-2 ring-green-200'
                      : ''
                  }
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
                          {
                            project.short_title
                          }
                        </h2>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                            project.status
                          )}`}
                        >
                          {project.status ===
                          'active'
                            ? 'Active'
                            : 'Completed'}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${visibilityClass(
                            metadata.visibility
                          )}`}
                        >
                          {metadata.visibility ===
                          'public'
                            ? 'Public'
                            : 'Private'}
                        </span>

                        {metadata.featured && (
                          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
                            Featured
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm font-medium text-oxford-charcoal">
                        {
                          project.title
                        }
                      </p>

                      {(project.start_year ||
                        project.end_year) && (
                        <p className="mt-2 text-sm text-oxford-ash">
                          Years:{' '}
                          <span className="text-oxford-charcoal">
                            {project.start_year ??
                              '—'}
                            {'–'}
                            {project.end_year ??
                              'present'}
                          </span>
                        </p>
                      )}

                      <p className="mt-2 text-sm text-oxford-ash">
                        Funder:{' '}
                        <span className="text-oxford-charcoal">
                          {
                            project.funder
                          }
                        </span>
                      </p>

                      {project.funder_note && (
                        <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-oxford-ash">
                          {
                            project.funder_note
                          }
                        </p>
                      )}

                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm font-medium text-oxford-blue hover:underline"
                        >
                          Project website
                        </a>
                      )}
                    </div>

                    <div className="rounded-lg border border-oxford-stone bg-oxford-off-white px-4 py-3 text-right">
                      <div className="font-serif text-xl font-semibold text-oxford-blue">
                        {formatDuration(
                          projectHours.minutes
                        )}
                      </div>
                      <div className="text-xs text-oxford-ash">
                        tracked from{' '}
                        {
                          projectHours.sessions
                        }{' '}
                        {projectHours.sessions ===
                        1
                          ? 'session'
                          : 'sessions'}
                      </div>
                    </div>
                  </div>

                  {!isOwner ? (
                    <div className="mt-6 grid gap-5 lg:grid-cols-2">
                      <div>
                        <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                          Abstract
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-oxford-charcoal">
                          {
                            project.abstract
                          }
                        </p>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                            Associated
                            papers
                          </h3>

                          {linkedPapers.length >
                          0 ? (
                            <ul className="mt-2 space-y-2 text-sm">
                              {linkedPapers.map(
                                (
                                  paper
                                ) => (
                                  <li
                                    key={
                                      paper.id
                                    }
                                  >
                                    <Link
                                      href={`/papers/${paper.id}`}
                                      className="font-medium text-oxford-blue hover:underline"
                                    >
                                      {
                                        paper.short_title
                                      }
                                    </Link>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-oxford-ash">
                              No linked
                              papers.
                            </p>
                          )}
                        </div>

                        <div>
                          <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                            Activity labels
                          </h3>

                          {linkedLabels.length >
                          0 ? (
                            <p className="mt-2 text-sm text-oxford-charcoal">
                              {linkedLabels
                                .map(
                                  (
                                    label
                                  ) =>
                                    label.name
                                )
                                .join(
                                  ', '
                                )}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-oxford-ash">
                              No labels
                              assigned.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <form
                        action={
                          updateProject
                        }
                        className="mt-6"
                      >
                        <input
                          type="hidden"
                          name="project_id"
                          value={
                            project.id
                          }
                        />

                        <div className="grid gap-5 md:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`short-title-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Short title
                            </label>

                            <input
                              id={`short-title-${project.id}`}
                              name="short_title"
                              required
                              defaultValue={
                                project.short_title
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`funder-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Funder
                            </label>

                            <input
                              id={`funder-${project.id}`}
                              name="funder"
                              required
                              defaultValue={
                                project.funder
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`title-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Long title
                            </label>

                            <input
                              id={`title-${project.id}`}
                              name="title"
                              required
                              defaultValue={
                                project.title
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`funder-note-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Funder note
                            </label>

                            <textarea
                              id={`funder-note-${project.id}`}
                              name="funder_note"
                              rows={3}
                              maxLength={1000}
                              defaultValue={
                                project.funder_note ??
                                ''
                              }
                              placeholder="Optional public note about the funder, grant, or funding arrangement"
                              className={
                                inputClass
                              }
                            />

                            <p className="mt-1 text-xs text-oxford-ash">
                              Optional and
                              public for
                              Public projects.
                            </p>
                          </div>

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`url-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Project URL
                            </label>

                            <input
                              id={`url-${project.id}`}
                              name="url"
                              type="url"
                              defaultValue={
                                project.url ??
                                ''
                              }
                              placeholder="https://..."
                              className={
                                inputClass
                              }
                            />

                            <p className="mt-1 text-xs text-oxford-ash">
                              Optional.
                              Public projects
                              expose this URL
                              to the academic
                              website.
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor={`start-year-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Start year
                            </label>

                            <input
                              id={`start-year-${project.id}`}
                              name="start_year"
                              type="number"
                              min={1000}
                              max={9999}
                              defaultValue={
                                project.start_year ??
                                ''
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`end-year-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              End year
                            </label>

                            <input
                              id={`end-year-${project.id}`}
                              name="end_year"
                              type="number"
                              min={1000}
                              max={9999}
                              defaultValue={
                                project.end_year ??
                                ''
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`abstract-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Abstract
                            </label>

                            <textarea
                              id={`abstract-${project.id}`}
                              name="abstract"
                              rows={5}
                              required
                              defaultValue={
                                project.abstract
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`status-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Status
                            </label>

                            <select
                              id={`status-${project.id}`}
                              name="status"
                              defaultValue={
                                project.status
                              }
                              className={
                                inputClass
                              }
                            >
                              <option value="active">
                                Active
                              </option>
                              <option value="completed">
                                Completed
                              </option>
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor={`visibility-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Website
                              visibility
                            </label>

                            <select
                              id={`visibility-${project.id}`}
                              name="visibility"
                              defaultValue={
                                metadata.visibility
                              }
                              className={
                                inputClass
                              }
                            >
                              <option value="private">
                                Private
                              </option>
                              <option value="public">
                                Public
                              </option>
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor={`slug-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Public slug
                            </label>

                            <input
                              id={`slug-${project.id}`}
                              name="slug"
                              defaultValue={
                                metadata.slug ??
                                ''
                              }
                              placeholder="project-slug"
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div className="flex items-start pt-7">
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-oxford-charcoal">
                              <input
                                name="featured"
                                type="checkbox"
                                defaultChecked={
                                  metadata.featured
                                }
                                className="h-4 w-4 rounded border-oxford-stone"
                              />
                              Featured
                            </label>
                          </div>

                          <div>
                            <label
                              htmlFor={`project-image-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Project image
                              filename
                            </label>

                            <input
                              id={`project-image-${project.id}`}
                              name="project_image_filename"
                              defaultValue={
                                metadata.project_image_filename ??
                                ''
                              }
                              placeholder="project.png"
                              className={
                                inputClass
                              }
                            />

                            {projectAssetPath && (
                              <p className="mt-1 text-xs text-oxford-ash">
                                Public
                                path:{' '}
                                <code>
                                  {
                                    projectAssetPath
                                  }
                                </code>
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor={`funder-image-${project.id}`}
                              className={
                                labelClass
                              }
                            >
                              Funder image
                              filename
                            </label>

                            <input
                              id={`funder-image-${project.id}`}
                              name="funder_image_filename"
                              defaultValue={
                                metadata.funder_image_filename ??
                                ''
                              }
                              placeholder="funder.png"
                              className={
                                inputClass
                              }
                            />

                            {funderAssetPath && (
                              <p className="mt-1 text-xs text-oxford-ash">
                                Public
                                path:{' '}
                                <code>
                                  {
                                    funderAssetPath
                                  }
                                </code>
                              </p>
                            )}
                          </div>
                        </div>

                        <details className="mt-5 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                          <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                            Associated
                            papers (
                            {
                              linkedPapers.length
                            }
                            )
                          </summary>

                          <div className="mt-4 grid gap-2 md:grid-cols-2">
                            {papers.map(
                              (
                                paper
                              ) => (
                                <label
                                  key={
                                    paper.id
                                  }
                                  className="flex items-start gap-2 rounded-md bg-white px-3 py-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    name="paper_ids"
                                    value={
                                      paper.id
                                    }
                                    defaultChecked={
                                      linkedPaperIds.has(
                                        paper.id
                                      )
                                    }
                                    className="mt-0.5 h-4 w-4"
                                  />

                                  <span>
                                    <span className="font-medium text-oxford-charcoal">
                                      {
                                        paper.short_title
                                      }
                                    </span>

                                    <span className="ml-2 text-xs text-oxford-ash">
                                      {
                                        paper.status
                                      }
                                    </span>
                                  </span>
                                </label>
                              )
                            )}
                          </div>
                        </details>

                        <details className="mt-4 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                          <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                            Activity labels
                            for tracked
                            hours (
                            {
                              linkedLabels.length
                            }
                            )
                          </summary>

                          <div className="mt-4 grid gap-2 md:grid-cols-2">
                            {activityLabels.map(
                              (
                                label
                              ) => {
                                const assignedProjectId =
                                  labelProjectById.get(
                                    label.id
                                  )

                                const assignedElsewhere =
                                  Boolean(
                                    assignedProjectId &&
                                      assignedProjectId !==
                                        project.id
                                  )

                                const assignedTitle =
                                  assignedProjectId
                                    ? projectTitleById.get(
                                        assignedProjectId
                                      )
                                    : null

                                return (
                                  <label
                                    key={
                                      label.id
                                    }
                                    className="flex items-start gap-2 rounded-md bg-white px-3 py-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      name="activity_label_ids"
                                      value={
                                        label.id
                                      }
                                      defaultChecked={
                                        linkedLabelIds.has(
                                          label.id
                                        )
                                      }
                                      disabled={
                                        assignedElsewhere
                                      }
                                      className="mt-0.5 h-4 w-4"
                                    />

                                    <span>
                                      <span className="font-medium text-oxford-charcoal">
                                        {
                                          label.name
                                        }
                                      </span>

                                      {!label.is_active && (
                                        <span className="ml-2 text-xs text-oxford-ash">
                                          Inactive
                                        </span>
                                      )}

                                      {assignedElsewhere &&
                                        assignedTitle && (
                                          <span className="mt-1 block text-xs text-oxford-ash">
                                            Assigned
                                            to{' '}
                                            {
                                              assignedTitle
                                            }
                                          </span>
                                        )}
                                    </span>
                                  </label>
                                )
                              }
                            )}
                          </div>
                        </details>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <Button type="submit">
                            Save project
                          </Button>

                          {metadata.slug && (
                            <span className="text-xs text-oxford-ash">
                              Public
                              slug:{' '}
                              <code>
                                {
                                  metadata.slug
                                }
                              </code>
                            </span>
                          )}
                        </div>
                      </form>

                      <div className="mt-6 border-t border-oxford-stone pt-5">
                        <form
                          action={
                            deleteProject
                          }
                        >
                          <input
                            type="hidden"
                            name="project_id"
                            value={
                              project.id
                            }
                          />

                          <Button
                            type="submit"
                            variant="danger"
                          >
                            Delete project
                          </Button>
                        </form>

                        <p className="mt-2 text-xs leading-5 text-oxford-ash">
                          Deleting a
                          project removes
                          only its project
                          record and
                          associations. It
                          does not delete
                          papers, activity
                          labels, or work
                          sessions.
                        </p>
                      </div>
                    </>
                  )}
                </Card>
              )
            }
          )
        )}
      </div>
    </div>
  )
}
