'use client'

import { useState } from 'react'

import {
  deleteCitationSnapshot,
  updateCitationSnapshot,
} from '@/app/(protected)/papers/citation-actions'
import Button from '@/components/ui/button'

type CitationSnapshot = {
  id: string
  source: string
  citation_count: number
  captured_on: string
  created_at: string
}

type CitationSnapshotHistoryProps = {
  paperId: string
  snapshots: CitationSnapshot[]
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

export default function CitationSnapshotHistory({
  paperId,
  snapshots,
}: CitationSnapshotHistoryProps) {
  const [page, setPage] =
    useState(1)

  const totalPages =
    Math.max(
      1,
      snapshots.length
    )

  const currentPage =
    Math.min(
      page,
      totalPages
    )

  const snapshot =
    snapshots[
      currentPage - 1
    ]

  if (!snapshot) {
    return null
  }

  const ascendingSnapshots =
    [...snapshots].reverse()

  const snapshotIndex =
    ascendingSnapshots.findIndex(
      (item) =>
        item.id ===
        snapshot.id
    )

  const preceding =
    snapshotIndex > 0
      ? ascendingSnapshots[
          snapshotIndex - 1
        ]
      : null

  const snapshotDelta =
    preceding
      ? snapshot.citation_count -
        preceding.citation_count
      : null

  return (
    <div className="mt-6 border-t border-oxford-stone pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-medium text-oxford-charcoal">
          Snapshot history
        </h4>

        {totalPages > 1 && (
          <span className="text-xs text-oxford-ash">
            Page {currentPage} of{' '}
            {totalPages}
          </span>
        )}
      </div>

      <div className="mt-3 border-y border-oxford-stone py-4">
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
                  {snapshotDelta > 0
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
            Edit snapshot
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
              value={paperId}
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
                Save snapshot
              </Button>
            </div>
          </form>
        </details>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
            Delete snapshot
          </summary>

          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">
              This permanently removes
              this citation snapshot.
              Use this only for an
              erroneous record.
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
                value={paperId}
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
                Confirm delete
              </Button>
            </form>
          </div>
        </details>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={
              currentPage <= 1
            }
            onClick={() =>
              setPage(
                Math.max(
                  1,
                  currentPage - 1
                )
              )
            }
          >
            Previous
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={
              currentPage >=
              totalPages
            }
            onClick={() =>
              setPage(
                Math.min(
                  totalPages,
                  currentPage + 1
                )
              )
            }
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
