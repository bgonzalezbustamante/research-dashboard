import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import {
  requireDashboardAccess,
} from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import {
  createTeachingItem,
  deleteTeachingItem,
  updateTeachingItem,
} from './actions'

type TeachingPageProps = {
  searchParams: Promise<{
    error?: string
    created?: string
    saved?: string
    deleted?: string
  }>
}

type TeachingLevel =
  | 'undergraduate'
  | 'master'
  | 'phd'

type TeachingVisibility =
  | 'private'
  | 'public'

type TeachingRow = {
  id: string
  owner_id: string
  name: string
  institution: string
  summary: string
  start_year: number
  end_year: number | null
  is_current: boolean
  levels: TeachingLevel[]
  times_taught: number
  student_count: number
  created_at: string
  updated_at: string
}

type TeachingMetadataRow = {
  teaching_id: string
  visibility: TeachingVisibility
  slug: string | null
  course_image_filename: string | null
}

type TeachingActivityLabelRow = {
  teaching_id: string
  activity_label_id: string
}

type ActivityLabelRow = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  major_activity: string | null
}

type TeachingHoursRow = {
  teaching_id: string
  net_minutes: number | string
  session_count: number | string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

const levelLabels: Record<
  TeachingLevel,
  string
> = {
  undergraduate: 'Undergraduate',
  master: 'Master',
  phd: 'PhD',
}

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
    return (
      String(hours) +
      'h ' +
      String(minutes) +
      'm'
    )
  }

  if (hours > 0) {
    return String(hours) + 'h'
  }

  return String(minutes) + 'm'
}

function formatPeriod(
  item: Pick<
    TeachingRow,
    | 'start_year'
    | 'end_year'
    | 'is_current'
  >
) {
  if (item.is_current) {
    return (
      String(item.start_year) +
      '–present'
    )
  }

  if (
    item.end_year ===
    item.start_year
  ) {
    return String(
      item.start_year
    )
  }

  return (
    String(item.start_year) +
    '–' +
    String(
      item.end_year ?? '—'
    )
  )
}

function visibilityClass(
  visibility: TeachingVisibility
) {
  return visibility === 'public'
    ? 'border-sky-200 bg-sky-50 text-sky-900'
    : 'border-gray-300 bg-gray-100 text-gray-700'
}

export default async function TeachingPage({
  searchParams,
}: TeachingPageProps) {
  const access =
    await requireDashboardAccess()

  const params =
    await searchParams

  const supabase =
    await createClient()

  const [
    teachingResult,
    metadataResult,
    teachingLabelsResult,
    labelsResult,
    hoursResult,
  ] = await Promise.all([
    supabase
      .from('teaching_portfolio')
      .select(`
        id,
        owner_id,
        name,
        institution,
        summary,
        start_year,
        end_year,
        is_current,
        levels,
        times_taught,
        student_count,
        created_at,
        updated_at
      `)
      .eq(
        'owner_id',
        access.ownerId
      ),

    supabase
      .from(
        'teaching_public_metadata'
      )
      .select(`
        teaching_id,
        visibility,
        slug,
        course_image_filename
      `),

    supabase
      .from(
        'teaching_activity_labels'
      )
      .select(
        'teaching_id, activity_label_id'
      ),

    supabase
      .from('activity_labels')
      .select(`
        id,
        name,
        description,
        is_active,
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
      .eq(
        'major_activity',
        'teaching'
      )
      .order(
        'name',
        {
          ascending: true,
        }
      ),

    supabase.rpc(
      'get_teaching_hours'
    ),
  ])

  for (const [
    label,
    result,
  ] of [
    [
      'Teaching Portfolio',
      teachingResult,
    ],
    [
      'Teaching public metadata',
      metadataResult,
    ],
    [
      'Teaching activity labels',
      teachingLabelsResult,
    ],
    [
      'Teaching activity vocabulary',
      labelsResult,
    ],
    [
      'Teaching tracked hours',
      hoursResult,
    ],
  ] as const) {
    if (result.error) {
      throw new Error(
        'Could not load ' +
          label +
          ': ' +
          result.error.message
      )
    }
  }

  const teachingItems =
    (teachingResult.data ??
      []) as TeachingRow[]

  const metadataRows =
    (metadataResult.data ??
      []) as TeachingMetadataRow[]

  const teachingLabelRows =
    (teachingLabelsResult.data ??
      []) as TeachingActivityLabelRow[]

  const activityLabels =
    (labelsResult.data ??
      []) as ActivityLabelRow[]

  const hoursRows =
    (hoursResult.data ??
      []) as TeachingHoursRow[]

  const metadataByTeaching =
    new Map(
      metadataRows.map(
        (row) => [
          row.teaching_id,
          row,
        ]
      )
    )

  const labelsByTeaching =
    new Map<
      string,
      Set<string>
    >()

  for (
    const row of
    teachingLabelRows
  ) {
    const current =
      labelsByTeaching.get(
        row.teaching_id
      ) ??
      new Set<string>()

    current.add(
      row.activity_label_id
    )

    labelsByTeaching.set(
      row.teaching_id,
      current
    )
  }

  const teachingNameById =
    new Map(
      teachingItems.map(
        (item) => [
          item.id,
          item.name,
        ]
      )
    )

  const labelTeachingById =
    new Map(
      teachingLabelRows.map(
        (row) => [
          row.activity_label_id,
          row.teaching_id,
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

  const hoursByTeaching =
    new Map(
      hoursRows.map(
        (row) => [
          row.teaching_id,
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

  const sortedTeaching = [
    ...teachingItems,
  ].sort((a, b) => {
    if (
      a.is_current !==
      b.is_current
    ) {
      return a.is_current
        ? -1
        : 1
    }

    if (
      a.start_year !==
      b.start_year
    ) {
      return (
        b.start_year -
        a.start_year
      )
    }

    return a.name.localeCompare(
      b.name
    )
  })

  const isOwner =
    access.canEdit

  return (
    <div>
      <PageHeader
        title="Teaching"
        description="Manage a Teaching Portfolio, connect Teaching activity labels to courses, and curate the public teaching cards used by the academic website."
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
            ? 'Teaching Portfolio item created.'
            : params.saved
              ? 'Teaching Portfolio item saved.'
              : 'Teaching Portfolio item deleted.'}
        </div>
      )}

      <div
        className={
          isOwner
            ? 'grid gap-6 lg:grid-cols-2'
            : 'grid gap-6'
        }
      >
        {isOwner && (
          <Card>
            <h2 className="font-serif text-xl font-semibold text-oxford-blue">
              Add course or activity
            </h2>

            <p className="mt-2 text-sm leading-6 text-oxford-ash">
              Use one portfolio item
              for the same course
              across cohorts. Link the
              Teaching activity labels
              used for its tracked
              work.
            </p>

            <form
              action={
                createTeachingItem
              }
              className="mt-5 space-y-5"
            >
              <div>
                <label
                  htmlFor="new-teaching-name"
                  className={labelClass}
                >
                  Course / activity
                  name
                </label>

                <input
                  id="new-teaching-name"
                  name="name"
                  required
                  maxLength={300}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-teaching-institution"
                  className={labelClass}
                >
                  University /
                  institution
                </label>

                <input
                  id="new-teaching-institution"
                  name="institution"
                  required
                  maxLength={300}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-teaching-summary"
                  className={labelClass}
                >
                  Summary
                </label>

                <textarea
                  id="new-teaching-summary"
                  name="summary"
                  required
                  rows={5}
                  maxLength={4000}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="new-teaching-start-year"
                    className={labelClass}
                  >
                    Start year
                  </label>

                  <input
                    id="new-teaching-start-year"
                    name="start_year"
                    type="number"
                    min={1900}
                    max={2100}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-teaching-end-year"
                    className={labelClass}
                  >
                    End year
                  </label>

                  <input
                    id="new-teaching-end-year"
                    name="end_year"
                    type="number"
                    min={1900}
                    max={2100}
                    className={inputClass}
                  />

                  <p className="mt-1 text-xs text-oxford-ash">
                    Leave blank when
                    Still teaching is
                    selected.
                  </p>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-oxford-charcoal">
                <input
                  name="is_current"
                  type="checkbox"
                  className="h-4 w-4 rounded border-oxford-stone"
                />
                Still teaching
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <fieldset>
                  <legend
                    className={labelClass}
                  >
                    Level
                  </legend>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        'undergraduate',
                        'master',
                        'phd',
                      ] as TeachingLevel[]
                    ).map((level) => (
                      <label
                        key={level}
                        className="inline-flex items-center gap-2 rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal"
                      >
                        <input
                          type="checkbox"
                          name="levels"
                          value={level}
                          defaultChecked={
                            level ===
                            'master'
                          }
                          className="h-4 w-4 rounded border-oxford-stone"
                        />
                        {
                          levelLabels[
                            level
                          ]
                        }
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label
                    htmlFor="new-teaching-times"
                    className={labelClass}
                  >
                    Times taught
                  </label>

                  <input
                    id="new-teaching-times"
                    name="times_taught"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-teaching-students"
                    className={labelClass}
                  >
                    Students
                  </label>

                  <input
                    id="new-teaching-students"
                    name="student_count"
                    type="number"
                    min={0}
                    defaultValue={0}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="border-t border-oxford-stone pt-5">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  Website
                </h3>

                <p className="mt-1 text-xs leading-5 text-oxford-ash">
                  Public cards expose
                  the course information
                  above, but never
                  activity labels,
                  tracked hours, or
                  session counts.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="new-teaching-visibility"
                    className={labelClass}
                  >
                    Website visibility
                  </label>

                  <select
                    id="new-teaching-visibility"
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
                    htmlFor="new-teaching-slug"
                    className={labelClass}
                  >
                    Public slug
                  </label>

                  <input
                    id="new-teaching-slug"
                    name="slug"
                    type="text"
                    placeholder="optional-stable-key"
                    className={inputClass}
                  />

                  <p className="mt-1 text-xs text-oxford-ash">
                    Optional; public
                    teaching cards do
                    not require a
                    detail-page route.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-teaching-image"
                  className={labelClass}
                >
                  Course image filename
                </label>

                <input
                  id="new-teaching-image"
                  name="course_image_filename"
                  type="text"
                  placeholder="course-image.png"
                  className={inputClass}
                />

                <p className="mt-1 text-xs leading-5 text-oxford-ash">
                  Static asset filename
                  only. The academic
                  website resolves it
                  under{' '}
                  <code>
                    /teaching/&lt;filename&gt;
                  </code>
                  .
                </p>
              </div>

              <details className="rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                  Teaching activity
                  labels
                </summary>

                {activityLabels.length >
                0 ? (
                  <div className="mt-4 grid gap-2">
                    {activityLabels.map(
                      (label) => {
                        const assignedTeachingId =
                          labelTeachingById.get(
                            label.id
                          )

                        return (
                          <label
                            key={label.id}
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
                                  assignedTeachingId
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

                              {assignedTeachingId && (
                                <span className="mt-1 block text-xs text-oxford-ash">
                                  Already assigned
                                  to{' '}
                                  {teachingNameById.get(
                                    assignedTeachingId
                                  ) ??
                                    'another course'}
                                  .
                                </span>
                              )}

                              {label.description && (
                                <span className="mt-1 block text-xs text-oxford-ash">
                                  {
                                    label.description
                                  }
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      }
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-oxford-ash">
                    No activity labels
                    are currently
                    classified as
                    Teaching in Hours.
                  </p>
                )}
              </details>

              <Button type="submit">
                Add teaching item
              </Button>
            </form>
          </Card>
        )}

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Public teaching contract
          </h2>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            The academic website can
            read explicitly Public
            Teaching Portfolio items
            through{' '}
            <code>
              list_public_teaching()
            </code>
            .
          </p>

          <div className="mt-4 rounded-md border border-oxford-stone bg-oxford-off-white p-4 text-sm leading-6 text-oxford-charcoal">
            <p>
              Public: name,
              institution, summary,
              period, current status,
              one or more levels, times taught,
              cumulative students,
              optional slug, and course
              image filename.
            </p>

            <p className="mt-2">
              Private: Activity-label
              relationships, tracked
              hours, session counts,
              owner metadata, and
              internal IDs.
            </p>

            <p className="mt-2 text-xs text-oxford-ash">
              Course images use{' '}
              <code>
                /teaching/&lt;filename&gt;
              </code>{' '}
              in the academic website
              public directory.
            </p>
          </div>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
              Teaching Portfolio
            </h2>

            <p className="mt-1 text-sm text-oxford-ash">
              {sortedTeaching.length}{' '}
              {sortedTeaching.length ===
              1
                ? 'course or activity'
                : 'courses or activities'}
            </p>
          </div>
        </div>

        {sortedTeaching.length ===
        0 ? (
          <Card>
            <p className="text-sm text-oxford-ash">
              No Teaching Portfolio
              items yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-5">
            {sortedTeaching.map(
              (item) => {
                const metadata =
                  metadataByTeaching.get(
                    item.id
                  ) ??
                  ({
                    teaching_id:
                      item.id,
                    visibility:
                      'private',
                    slug: null,
                    course_image_filename:
                      null,
                  } satisfies TeachingMetadataRow)

                const linkedLabelIds =
                  labelsByTeaching.get(
                    item.id
                  ) ??
                  new Set<string>()

                const linkedLabels =
                  [
                    ...linkedLabelIds,
                  ]
                    .map((id) =>
                      labelById.get(id)
                    )
                    .filter(
                      (
                        label
                      ): label is ActivityLabelRow =>
                        Boolean(label)
                    )
                    .sort((a, b) =>
                      a.name.localeCompare(
                        b.name
                      )
                    )

                const tracked =
                  hoursByTeaching.get(
                    item.id
                  ) ?? {
                    minutes: 0,
                    sessions: 0,
                  }

                return (
                  <Card
                    key={item.id}
                    className={
                      params.saved ===
                      item.id
                        ? 'ring-2 ring-green-200'
                        : ''
                    }
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
                            {item.name}
                          </h3>

                          {item.levels.map(
                            (level) => (
                              <span
                                key={
                                  level
                                }
                                className="rounded-full border border-oxford-stone bg-oxford-off-white px-2 py-0.5 text-xs font-medium text-oxford-charcoal"
                              >
                                {
                                  levelLabels[
                                    level
                                  ]
                                }
                              </span>
                            )
                          )}

                          <span
                            className={
                              'rounded-full border px-2 py-0.5 text-xs font-medium ' +
                              visibilityClass(
                                metadata.visibility
                              )
                            }
                          >
                            {metadata.visibility ===
                            'public'
                              ? 'Public'
                              : 'Private'}
                          </span>

                          {item.is_current && (
                            <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                              Current
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm font-medium text-oxford-charcoal">
                          {item.institution}
                        </p>

                        <p className="mt-1 text-sm text-oxford-ash">
                          {formatPeriod(
                            item
                          )}
                          {' · '}
                          {item.times_taught}{' '}
                          {item.times_taught ===
                          1
                            ? 'time taught'
                            : 'times taught'}
                          {' · '}
                          {item.student_count}{' '}
                          {item.student_count ===
                          1
                            ? 'student'
                            : 'students'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-right">
                        <div className="rounded-md border border-oxford-stone bg-oxford-off-white px-3 py-2">
                          <div className="text-xs uppercase tracking-wide text-oxford-ash">
                            Tracked
                          </div>
                          <div className="mt-1 font-medium text-oxford-charcoal">
                            {formatDuration(
                              tracked.minutes
                            )}
                          </div>
                        </div>

                        <div className="rounded-md border border-oxford-stone bg-oxford-off-white px-3 py-2">
                          <div className="text-xs uppercase tracking-wide text-oxford-ash">
                            Sessions
                          </div>
                          <div className="mt-1 font-medium text-oxford-charcoal">
                            {
                              tracked.sessions
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-oxford-charcoal">
                      {item.summary}
                    </p>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <h4 className="font-serif text-lg font-semibold text-oxford-blue">
                          Teaching activity
                          labels
                        </h4>

                        {linkedLabels.length >
                        0 ? (
                          <ul className="mt-2 space-y-1 text-sm text-oxford-charcoal">
                            {linkedLabels.map(
                              (label) => (
                                <li
                                  key={
                                    label.id
                                  }
                                >
                                  {label.name}
                                  {!label.is_active
                                    ? ' (inactive)'
                                    : ''}
                                </li>
                              )
                            )}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-oxford-ash">
                            No Teaching
                            activity labels
                            linked.
                          </p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-serif text-lg font-semibold text-oxford-blue">
                          Website
                        </h4>

                        <dl className="mt-2 space-y-1 text-sm">
                          <div>
                            <dt className="inline text-oxford-ash">
                              Slug:{' '}
                            </dt>
                            <dd className="inline text-oxford-charcoal">
                              {metadata.slug ??
                                '—'}
                            </dd>
                          </div>

                          <div>
                            <dt className="inline text-oxford-ash">
                              Image:{' '}
                            </dt>
                            <dd className="inline text-oxford-charcoal">
                              {metadata.course_image_filename ??
                                '—'}
                            </dd>
                          </div>
                        </dl>

                        {metadata.course_image_filename && (
                          <p className="mt-2 text-xs text-oxford-ash">
                            Public path:{' '}
                            <code>
                              {'/teaching/' +
                                metadata.course_image_filename}
                            </code>
                          </p>
                        )}
                      </div>
                    </div>

                    {isOwner && (
                      <details className="mt-6 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                        <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                          Edit teaching item
                        </summary>

                        <form
                          action={
                            updateTeachingItem
                          }
                          className="mt-5 space-y-5"
                        >
                          <input
                            type="hidden"
                            name="teaching_id"
                            value={
                              item.id
                            }
                          />

                          <div>
                            <label
                              htmlFor={
                                'teaching-name-' +
                                item.id
                              }
                              className={
                                labelClass
                              }
                            >
                              Course /
                              activity name
                            </label>

                            <input
                              id={
                                'teaching-name-' +
                                item.id
                              }
                              name="name"
                              required
                              maxLength={300}
                              defaultValue={
                                item.name
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={
                                'teaching-institution-' +
                                item.id
                              }
                              className={
                                labelClass
                              }
                            >
                              University /
                              institution
                            </label>

                            <input
                              id={
                                'teaching-institution-' +
                                item.id
                              }
                              name="institution"
                              required
                              maxLength={300}
                              defaultValue={
                                item.institution
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={
                                'teaching-summary-' +
                                item.id
                              }
                              className={
                                labelClass
                              }
                            >
                              Summary
                            </label>

                            <textarea
                              id={
                                'teaching-summary-' +
                                item.id
                              }
                              name="summary"
                              required
                              rows={5}
                              maxLength={4000}
                              defaultValue={
                                item.summary
                              }
                              className={
                                inputClass
                              }
                            />
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label
                                htmlFor={
                                  'teaching-start-' +
                                  item.id
                                }
                                className={
                                  labelClass
                                }
                              >
                                Start year
                              </label>

                              <input
                                id={
                                  'teaching-start-' +
                                  item.id
                                }
                                name="start_year"
                                type="number"
                                min={1900}
                                max={2100}
                                required
                                defaultValue={
                                  item.start_year
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={
                                  'teaching-end-' +
                                  item.id
                                }
                                className={
                                  labelClass
                                }
                              >
                                End year
                              </label>

                              <input
                                id={
                                  'teaching-end-' +
                                  item.id
                                }
                                name="end_year"
                                type="number"
                                min={1900}
                                max={2100}
                                defaultValue={
                                  item.end_year ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={
                                  'teaching-times-' +
                                  item.id
                                }
                                className={
                                  labelClass
                                }
                              >
                                Times taught
                              </label>

                              <input
                                id={
                                  'teaching-times-' +
                                  item.id
                                }
                                name="times_taught"
                                type="number"
                                min={1}
                                required
                                defaultValue={
                                  item.times_taught
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={
                                  'teaching-students-' +
                                  item.id
                                }
                                className={
                                  labelClass
                                }
                              >
                                Students
                              </label>

                              <input
                                id={
                                  'teaching-students-' +
                                  item.id
                                }
                                name="student_count"
                                type="number"
                                min={0}
                                required
                                defaultValue={
                                  item.student_count
                                }
                                className={
                                  inputClass
                                }
                              />
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <fieldset>
                              <legend
                                className={
                                  labelClass
                                }
                              >
                                Level
                              </legend>

                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    'undergraduate',
                                    'master',
                                    'phd',
                                  ] as TeachingLevel[]
                                ).map(
                                  (
                                    level
                                  ) => (
                                    <label
                                      key={
                                        level
                                      }
                                      className="inline-flex items-center gap-2 rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal"
                                    >
                                      <input
                                        type="checkbox"
                                        name="levels"
                                        value={
                                          level
                                        }
                                        defaultChecked={item.levels.includes(
                                          level
                                        )}
                                        className="h-4 w-4 rounded border-oxford-stone"
                                      />
                                      {
                                        levelLabels[
                                          level
                                        ]
                                      }
                                    </label>
                                  )
                                )}
                              </div>
                            </fieldset>

                            <label className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-oxford-charcoal">
                              <input
                                name="is_current"
                                type="checkbox"
                                defaultChecked={
                                  item.is_current
                                }
                                className="h-4 w-4 rounded border-oxford-stone"
                              />
                              Still teaching
                            </label>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor={
                                  'teaching-visibility-' +
                                  item.id
                                }
                                className={
                                  labelClass
                                }
                              >
                                Website
                                visibility
                              </label>

                              <select
                                id={
                                  'teaching-visibility-' +
                                  item.id
                                }
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
                                htmlFor={
                                  'teaching-slug-' +
                                  item.id
                                }
                                className={
                                  labelClass
                                }
                              >
                                Public slug
                              </label>

                              <input
                                id={
                                  'teaching-slug-' +
                                  item.id
                                }
                                name="slug"
                                type="text"
                                defaultValue={
                                  metadata.slug ??
                                  ''
                                }
                                className={
                                  inputClass
                                }
                              />

                              <p className="mt-1 text-xs text-oxford-ash">
                                Optional.
                              </p>
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={
                                'teaching-image-' +
                                item.id
                              }
                              className={
                                labelClass
                              }
                            >
                              Course image
                              filename
                            </label>

                            <input
                              id={
                                'teaching-image-' +
                                item.id
                              }
                              name="course_image_filename"
                              type="text"
                              defaultValue={
                                metadata.course_image_filename ??
                                ''
                              }
                              placeholder="course-image.png"
                              className={
                                inputClass
                              }
                            />

                            <p className="mt-1 text-xs text-oxford-ash">
                              Academic
                              website path:{' '}
                              <code>
                                /teaching/&lt;filename&gt;
                              </code>
                            </p>
                          </div>

                          <details className="rounded-lg border border-oxford-stone bg-white p-4">
                            <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                              Teaching
                              activity labels (
                              {
                                linkedLabelIds.size
                              }
                              )
                            </summary>

                            {activityLabels.length >
                            0 ? (
                              <div className="mt-4 grid gap-2 md:grid-cols-2">
                                {activityLabels.map(
                                  (
                                    label
                                  ) => {
                                    const assignedTeachingId =
                                      labelTeachingById.get(
                                        label.id
                                      )

                                    const assignedElsewhere =
                                      Boolean(
                                        assignedTeachingId &&
                                        assignedTeachingId !==
                                          item.id
                                      )

                                    return (
                                      <label
                                        key={
                                          label.id
                                        }
                                        className="flex items-start gap-2 rounded-md bg-oxford-off-white px-3 py-2 text-sm"
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

                                          {assignedElsewhere && (
                                            <span className="mt-1 block text-xs text-oxford-ash">
                                              Assigned
                                              to{' '}
                                              {teachingNameById.get(
                                                assignedTeachingId!
                                              ) ??
                                                'another course'}
                                              .
                                            </span>
                                          )}
                                        </span>
                                      </label>
                                    )
                                  }
                                )}
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-oxford-ash">
                                No Teaching
                                activity labels
                                available.
                              </p>
                            )}
                          </details>

                          <Button
                            type="submit"
                          >
                            Save teaching item
                          </Button>
                        </form>

                        <form
                          action={
                            deleteTeachingItem
                          }
                          className="mt-4 border-t border-oxford-stone pt-4"
                        >
                          <input
                            type="hidden"
                            name="teaching_id"
                            value={
                              item.id
                            }
                          />

                          <Button
                            type="submit"
                            variant="danger"
                          >
                            Delete teaching item
                          </Button>
                        </form>
                      </details>
                    )}
                  </Card>
                )
              }
            )}
          </div>
        )}
      </section>
    </div>
  )
}
