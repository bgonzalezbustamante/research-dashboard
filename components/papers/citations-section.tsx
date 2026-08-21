import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

import {
  createCitationSnapshot,
  deleteCitationSnapshot,
  updateCitationSnapshot,
} from '@/app/(protected)/papers/citation-actions'

type CitationSnapshot = {
  id: string
  source: string
  citation_count: number
  captured_on: string
  created_at: string
}

type CitationsSectionProps = {
  paperId: string
  snapshots: CitationSnapshot[]
  error?: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function formatDate(value: string) {
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

function getToday() {
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

function groupBySource(
  snapshots: CitationSnapshot[]
) {
  const grouped = new Map<
    string,
    CitationSnapshot[]
  >()

  for (const snapshot of snapshots) {
    const existing =
      grouped.get(
        snapshot.source
      ) ?? []

    existing.push(snapshot)

    grouped.set(
      snapshot.source,
      existing
    )
  }

  return [...grouped.entries()]
    .map(
      ([
        source,
        sourceSnapshots,
      ]) => ({
        source,
        snapshots: [
          ...sourceSnapshots,
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
        }),
      })
    )
    .sort((a, b) =>
      a.source.localeCompare(
        b.source
      )
    )
}

function CitationSparkline({
  snapshots,
  source,
}: {
  snapshots: CitationSnapshot[]
  source: string
}) {
  if (snapshots.length === 0) {
    return null
  }

  const width = 500
  const height = 120
  const padding = 12

  const counts =
    snapshots.map(
      (snapshot) =>
        snapshot.citation_count
    )

  const minCount =
    Math.min(...counts)

  const maxCount =
    Math.max(...counts)

  const usableWidth =
    width - padding * 2

  const usableHeight =
    height - padding * 2

  const points =
    snapshots.map(
      (snapshot, index) => {
        const x =
          snapshots.length === 1
            ? width / 2
            : padding +
              (index /
                (snapshots.length -
                  1)) *
                usableWidth

        const y =
          minCount === maxCount
            ? height / 2
            : padding +
              (1 -
                (snapshot.citation_count -
                  minCount) /
                  (maxCount -
                    minCount)) *
                usableHeight

        return {
          x,
          y,
          snapshot,
        }
      }
    )

  const polyline =
    points
      .map(
        (point) =>
          `${point.x},${point.y}`
      )
      .join(' ')

  return (
    <div className="mt-5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${source} citation trajectory`}
        className="h-28 w-full overflow-visible text-oxford-blue"
        preserveAspectRatio="none"
      >
        <line
          x1={padding}
          y1={
            height - padding
          }
          x2={
            width - padding
          }
          y2={
            height - padding
          }
          stroke="currentColor"
          strokeWidth="1"
          className="text-oxford-stone"
          vectorEffect="non-scaling-stroke"
        />

        {points.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {points.map(
          (point) => (
            <circle
              key={
                point.snapshot.id
              }
              cx={point.x}
              cy={point.y}
              r="4"
              fill="currentColor"
              vectorEffect="non-scaling-stroke"
            />
          )
        )}
      </svg>

      <div className="mt-1 flex justify-between text-xs text-oxford-ash">
        <span>
          {formatDate(
            snapshots[0]
              .captured_on
          )}
        </span>

        <span>
          {formatDate(
            snapshots[
              snapshots.length - 1
            ].captured_on
          )}
        </span>
      </div>
    </div>
  )
}

export default function CitationsSection({
  paperId,
  snapshots,
  error,
}: CitationsSectionProps) {
  const groups =
    groupBySource(
      snapshots
    )

  return (
    <section
      id="citations"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Citations
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Record dated citation
            counts and follow their
            development over time.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {
                snapshots.length
              }
            </strong>{' '}
            snapshots
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {groups.length}
            </strong>{' '}
            sources
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)]">
        <Card>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            Add citation snapshot
          </h3>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Record the citation count
            shown by a particular
            source on a particular
            date.
          </p>

          <form
            action={
              createCitationSnapshot
            }
            className="mt-5 space-y-4"
          >
            <input
              type="hidden"
              name="paper_id"
              value={paperId}
            />

            <div>
              <label
                htmlFor="citation_source"
                className={
                  labelClass
                }
              >
                Source
              </label>

              <input
                id="citation_source"
                name="source"
                type="text"
                list="citation-sources"
                defaultValue="Google Scholar"
                required
                className={
                  inputClass
                }
              />

              <datalist id="citation-sources">
                <option value="Google Scholar" />
                <option value="Scopus" />
                <option value="Web of Science" />
                <option value="OpenAlex" />
                <option value="Crossref" />
                <option value="Semantic Scholar" />
              </datalist>
            </div>

            <div>
              <label
                htmlFor="citation_count"
                className={
                  labelClass
                }
              >
                Citation count
              </label>

              <input
                id="citation_count"
                name="citation_count"
                type="number"
                min="0"
                step="1"
                required
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="citation_date"
                className={
                  labelClass
                }
              >
                Date captured
              </label>

              <input
                id="citation_date"
                name="captured_on"
                type="date"
                defaultValue={
                  getToday()
                }
                required
                className={
                  inputClass
                }
              />
            </div>

            <Button
              type="submit"
              variant="primary"
            >
              Add snapshot
            </Button>
          </form>
        </Card>

        <div className="space-y-5">
          {groups.length === 0 ? (
            <Card>
              <div className="py-6 text-center">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  No citation data yet
                </h3>

                <p className="mt-2 text-sm text-oxford-ash">
                  Add the first
                  citation snapshot
                  to begin tracking
                  this paper.
                </p>
              </div>
            </Card>
          ) : (
            groups.map(
              ({
                source,
                snapshots:
                  sourceSnapshots,
              }) => {
                const latest =
                  sourceSnapshots[
                    sourceSnapshots.length -
                      1
                  ]

                const previous =
                  sourceSnapshots.length >
                  1
                    ? sourceSnapshots[
                        sourceSnapshots.length -
                          2
                      ]
                    : null

                const delta =
                  previous
                    ? latest.citation_count -
                      previous.citation_count
                    : null

                const descendingSnapshots =
                  [
                    ...sourceSnapshots,
                  ].reverse()

                return (
                  <Card
                    key={source}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-oxford-blue">
                          {source}
                        </h3>

                        <p className="mt-1 text-sm text-oxford-ash">
                          Latest
                          snapshot:{' '}
                          {formatDate(
                            latest.captured_on
                          )}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="font-serif text-3xl font-semibold text-oxford-blue">
                          {
                            latest.citation_count
                          }
                        </div>

                        {previous ? (
                          <div className="mt-1 text-sm text-oxford-ash">
                            {delta !==
                              null &&
                            delta > 0
                              ? `+${delta}`
                              : delta}{' '}
                            since{' '}
                            {formatDate(
                              previous.captured_on
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-oxford-ash">
                            First
                            snapshot
                          </div>
                        )}
                      </div>
                    </div>

                    <CitationSparkline
                      source={
                        source
                      }
                      snapshots={
                        sourceSnapshots
                      }
                    />

                    <div className="mt-6 border-t border-oxford-stone pt-4">
                      <h4 className="font-medium text-oxford-charcoal">
                        Snapshot history
                      </h4>

                      <div className="mt-3 divide-y divide-oxford-stone">
                        {descendingSnapshots.map(
                          (snapshot) => {
                            const snapshotIndex =
                              sourceSnapshots.findIndex(
                                (item) =>
                                  item.id ===
                                  snapshot.id
                              )

                            const preceding =
                              snapshotIndex >
                              0
                                ? sourceSnapshots[
                                    snapshotIndex -
                                      1
                                  ]
                                : null

                            const snapshotDelta =
                              preceding
                                ? snapshot.citation_count -
                                  preceding.citation_count
                                : null

                            return (
                              <div
                                key={
                                  snapshot.id
                                }
                                className="py-4 first:pt-0 last:pb-0"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-baseline gap-3">
                                      <span className="text-lg font-semibold text-oxford-charcoal">
                                        {
                                          snapshot.citation_count
                                        }
                                      </span>

                                      {snapshotDelta !==
                                        null && (
                                        <span className="text-sm text-oxford-ash">
                                          {snapshotDelta >
                                          0
                                            ? `+${snapshotDelta}`
                                            : snapshotDelta}
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-1 text-sm text-oxford-ash">
                                      {formatDate(
                                        snapshot.captured_on
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <details className="mt-3">
                                  <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                                    Edit
                                    snapshot
                                  </summary>

                                  <form
                                    action={
                                      updateCitationSnapshot
                                    }
                                    className="mt-4 grid gap-4 rounded-md border border-oxford-stone bg-oxford-off-white p-4 md:grid-cols-3"
                                  >
                                    <input
                                      type="hidden"
                                      name="paper_id"
                                      value={
                                        paperId
                                      }
                                    />

                                    <input
                                      type="hidden"
                                      name="snapshot_id"
                                      value={
                                        snapshot.id
                                      }
                                    />

                                    <div>
                                      <label
                                        htmlFor={`citation-source-${snapshot.id}`}
                                        className={
                                          labelClass
                                        }
                                      >
                                        Source
                                      </label>

                                      <input
                                        id={`citation-source-${snapshot.id}`}
                                        name="source"
                                        type="text"
                                        required
                                        defaultValue={
                                          snapshot.source
                                        }
                                        className={
                                          inputClass
                                        }
                                      />
                                    </div>

                                    <div>
                                      <label
                                        htmlFor={`citation-count-${snapshot.id}`}
                                        className={
                                          labelClass
                                        }
                                      >
                                        Count
                                      </label>

                                      <input
                                        id={`citation-count-${snapshot.id}`}
                                        name="citation_count"
                                        type="number"
                                        min="0"
                                        step="1"
                                        required
                                        defaultValue={
                                          snapshot.citation_count
                                        }
                                        className={
                                          inputClass
                                        }
                                      />
                                    </div>

                                    <div>
                                      <label
                                        htmlFor={`citation-date-${snapshot.id}`}
                                        className={
                                          labelClass
                                        }
                                      >
                                        Date
                                      </label>

                                      <input
                                        id={`citation-date-${snapshot.id}`}
                                        name="captured_on"
                                        type="date"
                                        required
                                        defaultValue={
                                          snapshot.captured_on
                                        }
                                        className={
                                          inputClass
                                        }
                                      />
                                    </div>

                                    <div className="md:col-span-3">
                                      <Button
                                        type="submit"
                                        variant="primary"
                                      >
                                        Save
                                        snapshot
                                      </Button>
                                    </div>
                                  </form>
                                </details>

                                <details className="mt-3">
                                  <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                                    Delete
                                    snapshot
                                  </summary>

                                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
                                    <p className="text-sm text-red-800">
                                      This
                                      permanently
                                      removes
                                      this
                                      citation
                                      snapshot.
                                      Use this
                                      only for
                                      an
                                      erroneous
                                      record.
                                    </p>

                                    <form
                                      action={
                                        deleteCitationSnapshot
                                      }
                                      className="mt-3"
                                    >
                                      <input
                                        type="hidden"
                                        name="paper_id"
                                        value={
                                          paperId
                                        }
                                      />

                                      <input
                                        type="hidden"
                                        name="snapshot_id"
                                        value={
                                          snapshot.id
                                        }
                                      />

                                      <Button
                                        type="submit"
                                        variant="danger"
                                      >
                                        Confirm
                                        delete
                                      </Button>
                                    </form>
                                  </div>
                                </details>
                              </div>
                            )
                          }
                        )}
                      </div>
                    </div>
                  </Card>
                )
              }
            )
          )}
        </div>
      </div>
    </section>
  )
}