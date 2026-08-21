import {
  createActivityLabel,
  deleteActivityLabel,
  setActivityLabelActive,
  updateActivityLabel,
} from '@/app/(protected)/hours/actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

type ActivityLabel = {
  id: string
  name: string
  description: string | null
  is_system: boolean
  is_break: boolean
  is_active: boolean
}

type ActivityLabelsSectionProps = {
  labels: ActivityLabel[]
  error?: string
  returnDate: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

export default function ActivityLabelsSection({
  labels,
  error,
  returnDate,
}: ActivityLabelsSectionProps) {
  const customLabels =
    labels.filter(
      (label) =>
        !label.is_system
    )

  const activeCustomCount =
    customLabels.filter(
      (label) =>
        label.is_active
    ).length

  const inactiveCustomCount =
    customLabels.length -
    activeCustomCount

  return (
    <section
      id="activity-labels"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Activity labels
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Define the categories
            that will be assigned to
            work sessions.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {
                activeCustomCount
              }
            </strong>{' '}
            active
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {
                inactiveCustomCount
              }
            </strong>{' '}
            inactive
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
            Add activity label
          </h3>

          <p className="mt-2 text-sm leading-6 text-oxford-ash">
            Labels describe what
            you were doing during a
            recorded interval.
          </p>

          <form
            action={
              createActivityLabel
            }
            className="mt-5 space-y-4"
          >
            <input
              type="hidden"
              name="return_date"
              value={
                returnDate
              }
            />

            <div>
              <label
                htmlFor="new-label-name"
                className={
                  labelClass
                }
              >
                Name
              </label>

              <input
                id="new-label-name"
                name="name"
                type="text"
                required
                placeholder="e.g. Writing"
                className={
                  inputClass
                }
              />
            </div>

            <div>
              <label
                htmlFor="new-label-description"
                className={
                  labelClass
                }
              >
                Description
              </label>

              <textarea
                id="new-label-description"
                name="description"
                rows={4}
                placeholder="Optional description"
                className={
                  inputClass
                }
              />
            </div>

            <Button
              type="submit"
              variant="primary"
            >
              Add label
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          {labels.map(
            (label) => (
              <Card
                key={
                  label.id
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-oxford-charcoal">
                        {
                          label.name
                        }
                      </h3>

                      {label.is_break && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Break
                        </span>
                      )}

                      {label.is_system && (
                        <span className="rounded-full border border-oxford-stone bg-oxford-shell px-2 py-0.5 text-xs font-medium text-oxford-ash">
                          System
                        </span>
                      )}

                      {!label.is_system && (
                        <span
                          className={
                            label.is_active
                              ? 'rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800'
                              : 'rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700'
                          }
                        >
                          {label.is_active
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm leading-6 text-oxford-ash">
                      {label.description ??
                        'No description.'}
                    </p>
                  </div>
                </div>

                {label.is_system ? (
                  <div className="mt-4 rounded-md border border-oxford-stone bg-oxford-shell px-4 py-3 text-sm text-oxford-ash">
                    This is a protected
                    system label. It
                    cannot be renamed,
                    deactivated, or
                    deleted.
                  </div>
                ) : (
                  <div className="mt-5 border-t border-oxford-stone pt-4">
                    <div className="flex flex-wrap gap-3">
                      <form
                        action={
                          setActivityLabelActive
                        }
                      >
                        <input
                          type="hidden"
                          name="return_date"
                          value={
                            returnDate
                          }
                        />

                        <input
                          type="hidden"
                          name="label_id"
                          value={
                            label.id
                          }
                        />

                        <input
                          type="hidden"
                          name="next_active"
                          value={
                            label.is_active
                              ? 'false'
                              : 'true'
                          }
                        />

                        <Button
                          type="submit"
                          variant="secondary"
                        >
                          {label.is_active
                            ? 'Deactivate'
                            : 'Reactivate'}
                        </Button>
                      </form>
                    </div>

                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                        Edit label
                      </summary>

                      <form
                        action={
                          updateActivityLabel
                        }
                        className="mt-4 grid gap-4"
                      >
                        <input
                          type="hidden"
                          name="return_date"
                          value={
                            returnDate
                          }
                        />

                        <input
                          type="hidden"
                          name="label_id"
                          value={
                            label.id
                          }
                        />

                        <div>
                          <label
                            htmlFor={`label-name-${label.id}`}
                            className={
                              labelClass
                            }
                          >
                            Name
                          </label>

                          <input
                            id={`label-name-${label.id}`}
                            name="name"
                            type="text"
                            required
                            defaultValue={
                              label.name
                            }
                            className={
                              inputClass
                            }
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`label-description-${label.id}`}
                            className={
                              labelClass
                            }
                          >
                            Description
                          </label>

                          <textarea
                            id={`label-description-${label.id}`}
                            name="description"
                            rows={4}
                            defaultValue={
                              label.description ??
                              ''
                            }
                            className={
                              inputClass
                            }
                          />
                        </div>

                        <Button
                          type="submit"
                          variant="primary"
                        >
                          Save label
                        </Button>
                      </form>
                    </details>

                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                        Delete label
                      </summary>

                      <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
                        <p className="text-sm leading-6 text-red-800">
                          Delete only an
                          erroneous,
                          unused label.
                          Once a label
                          has work-session
                          history,
                          deactivate it
                          instead.
                        </p>

                        <form
                          action={
                            deleteActivityLabel
                          }
                          className="mt-3"
                        >
                          <input
                            type="hidden"
                            name="return_date"
                            value={
                              returnDate
                            }
                          />

                          <input
                            type="hidden"
                            name="label_id"
                            value={
                              label.id
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
                )}
              </Card>
            )
          )}
        </div>
      </div>
    </section>
  )
}