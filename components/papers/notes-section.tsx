import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

import {
  createNote,
  deleteNote,
  updateNote,
} from '@/app/(protected)/papers/note-actions'

type Note = {
  id: string
  note_date: string
  note_type: string
  body: string
  created_at: string
  updated_at: string
  creator_name: string
}

type NotesSectionProps = {
  paperId: string
  notes: Note[]
  error?: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function formatDate(
  value: string
) {
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

function getNoteTypeLabel(
  type: string
) {
  switch (type) {
    case 'writing':
      return 'Writing'

    case 'review':
      return 'Review'

    case 'revision':
      return 'Revision'

    case 'publication':
      return 'Publication'

    case 'general':
    default:
      return 'General'
  }
}

function getNoteTypeClasses(
  type: string
) {
  switch (type) {
    case 'writing':
      return 'border-sky-200 bg-sky-50 text-sky-900'

    case 'review':
      return 'border-amber-200 bg-amber-50 text-amber-800'

    case 'revision':
      return 'border-orange-200 bg-orange-50 text-orange-800'

    case 'publication':
      return 'border-green-200 bg-green-50 text-green-800'

    case 'general':
    default:
      return 'border-oxford-stone bg-oxford-shell text-oxford-charcoal'
  }
}

function sortNotes(
  notes: Note[]
) {
  return [...notes].sort(
    (a, b) => {
      const dateDifference =
        b.note_date.localeCompare(
          a.note_date
        )

      if (dateDifference !== 0) {
        return dateDifference
      }

      return b.created_at.localeCompare(
        a.created_at
      )
    }
  )
}

function wasEdited(
  note: Note
) {
  const created =
    new Date(
      note.created_at
    ).getTime()

  const updated =
    new Date(
      note.updated_at
    ).getTime()

  return (
    Math.abs(
      updated - created
    ) > 1000
  )
}

export default function NotesSection({
  paperId,
  notes,
  error,
}: NotesSectionProps) {
  const sortedNotes =
    sortNotes(notes)

  const writingCount =
    notes.filter(
      (note) =>
        note.note_type ===
        'writing'
    ).length

  const reviewCount =
    notes.filter(
      (note) =>
        note.note_type ===
          'review' ||
        note.note_type ===
          'revision'
    ).length

  return (
    <section
      id="notes"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Notes
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Keep a chronological
            research log for writing,
            review, revision, and
            publication work.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {notes.length}
            </strong>{' '}
            notes
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {writingCount}
            </strong>{' '}
            writing
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {reviewCount}
            </strong>{' '}
            review/revision
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
            Add note
          </h3>

          <form
            action={createNote}
            className="mt-5 space-y-4"
          >
            <input
              type="hidden"
              name="paper_id"
              value={paperId}
            />

            <div>
              <label
                htmlFor="note_date"
                className={labelClass}
              >
                Date
              </label>

              <input
                id="note_date"
                name="note_date"
                type="date"
                defaultValue={getToday()}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="note_type"
                className={labelClass}
              >
                Category
              </label>

              <select
                id="note_type"
                name="note_type"
                defaultValue="general"
                className={inputClass}
              >
                <option value="general">
                  General
                </option>

                <option value="writing">
                  Writing
                </option>

                <option value="review">
                  Review
                </option>

                <option value="revision">
                  Revision
                </option>

                <option value="publication">
                  Publication
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="note_body"
                className={labelClass}
              >
                Note
              </label>

              <textarea
                id="note_body"
                name="body"
                rows={8}
                required
                placeholder="Record progress, decisions, outstanding issues, or other research notes..."
                className={inputClass}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
            >
              Add note
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          {sortedNotes.length === 0 ? (
            <Card>
              <div className="py-6 text-center">
                <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                  No notes yet
                </h3>

                <p className="mt-2 text-sm text-oxford-ash">
                  Add the first note
                  to start the
                  paper&apos;s
                  research log.
                </p>
              </div>
            </Card>
          ) : (
            sortedNotes.map(
              (note) => (
                <Card
                  key={note.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getNoteTypeClasses(
                            note.note_type
                          )}`}
                        >
                          {getNoteTypeLabel(
                            note.note_type
                          )}
                        </span>

                        <span className="text-sm font-medium text-oxford-charcoal">
                          {formatDate(
                            note.note_date
                          )}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-oxford-ash">
                        By{' '}
                        {note.creator_name}

                        {wasEdited(
                          note
                        ) && (
                          <>
                            {' '}
                            · Edited
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-oxford-charcoal">
                    {note.body}
                  </p>

                  <div className="mt-5 border-t border-oxford-stone pt-4">
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                        Edit note
                      </summary>

                      <form
                        action={
                          updateNote
                        }
                        className="mt-4 grid gap-4 md:grid-cols-2"
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
                          name="note_id"
                          value={
                            note.id
                          }
                        />

                        <div>
                          <label
                            htmlFor={`note-date-${note.id}`}
                            className={
                              labelClass
                            }
                          >
                            Date
                          </label>

                          <input
                            id={`note-date-${note.id}`}
                            name="note_date"
                            type="date"
                            required
                            defaultValue={
                              note.note_date
                            }
                            className={
                              inputClass
                            }
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`note-type-${note.id}`}
                            className={
                              labelClass
                            }
                          >
                            Category
                          </label>

                          <select
                            id={`note-type-${note.id}`}
                            name="note_type"
                            defaultValue={
                              note.note_type
                            }
                            className={
                              inputClass
                            }
                          >
                            <option value="general">
                              General
                            </option>

                            <option value="writing">
                              Writing
                            </option>

                            <option value="review">
                              Review
                            </option>

                            <option value="revision">
                              Revision
                            </option>

                            <option value="publication">
                              Publication
                            </option>
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label
                            htmlFor={`note-body-${note.id}`}
                            className={
                              labelClass
                            }
                          >
                            Note
                          </label>

                          <textarea
                            id={`note-body-${note.id}`}
                            name="body"
                            rows={8}
                            required
                            defaultValue={
                              note.body
                            }
                            className={
                              inputClass
                            }
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Button
                            type="submit"
                            variant="primary"
                          >
                            Save note
                          </Button>
                        </div>
                      </form>
                    </details>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                        Delete note
                      </summary>

                      <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-800">
                          This permanently
                          removes this note.
                          Use this for an
                          erroneous or
                          unwanted entry.
                        </p>

                        <form
                          action={
                            deleteNote
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
                            name="note_id"
                            value={
                              note.id
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
                </Card>
              )
            )
          )}
        </div>
      </div>
    </section>
  )
}