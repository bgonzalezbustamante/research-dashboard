import {
  createActivityLabel,
  deleteActivityLabel,
  setActivityLabelActive,
  updateActivityLabel,
} from '@/app/(protected)/hours/actions'
import { setMajorActivity } from '@/app/(protected)/hours/major-activity-actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type ActivityLabel = {
  id: string
  name: string
  description: string | null
  is_system: boolean
  is_break: boolean
  is_active: boolean
}

type MajorActivity =
  | 'research'
  | 'teaching'
  | 'administration'
  | 'outreach'

type ActivityLabelsSectionProps = {
  labels: ActivityLabel[]
  error?: string
  message?: string
  returnDate: string
}

const majorActivityOptions: {
  value: MajorActivity
  label: string
}[] = [
  {
    value: 'research',
    label: 'Research',
  },
  {
    value: 'teaching',
    label: 'Teaching',
  },
  {
    value: 'administration',
    label: 'Administration',
  },
  {
    value: 'outreach',
    label: 'Outreach',
  },
]

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const compactSelectClass =
  'w-full rounded-md border border-oxford-stone bg-white px-2.5 py-1.5 text-xs text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

export default async function ActivityLabelsSection({
  labels,
  error,
  message,
  returnDate,
}: ActivityLabelsSectionProps) {
  const supabase =
    await createClient()

  const labelIds =
    labels.map(
      (label) => label.id
    )

  const majorActivityById =
    new Map<
      string,
      MajorActivity | null
    >()

  if (labelIds.length > 0) {
    const {
      data,
      error: classificationError,
    } = await supabase
      .from('activity_labels')
      .select(`
        id,
        major_activity
      `)
      .in('id', labelIds)

    if (classificationError) {
      throw new Error(
        `Could not load major activity classifications: ${classificationError.message}`
      )
    }

    for (const row of
      data ?? []) {
      majorActivityById.set(
        row.id,
        (row.major_activity as MajorActivity | null) ??
          null
      )
    }
  }

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

  const unclassifiedCount =
    customLabels.filter(
      (label) =>
        !label.is_break &&
        !majorActivityById.get(
          label.id
        )
    ).length

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
            Define the categories assigned to work sessions and group them into major activities for annual Dashboard analytics.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {activeCustomCount}
            </strong>{' '}
            active
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {inactiveCustomCount}
            </strong>{' '}
            inactive
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {unclassifiedCount}
            </strong>{' '}
            unclassified
          </span>
        </div>
      </div>

      {message && (
        <div className="mb-3 inline-flex rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(250px,0.7fr)_minmax(0,2fr)]">
        <Card>
          <h3 className="font-serif text-lg font-semibold text-oxford-blue">
            Add activity label
          </h3>

          <p className="mt-1 text-sm leading-5 text-oxford-ash">
            Create a category for work-session activity. You can assign its major activity after creation.
          </p>

          <form
            action={createActivityLabel}
            className="mt-4 space-y-4"
          >
            <input
              type="hidden"
              name="return_date"
              value={returnDate}
            />

            <div>
              <label
                htmlFor="new-label-name"
                className={labelClass}
              >
                Name
              </label>

              <input
                id="new-label-name"
                name="name"
                type="text"
                required
                placeholder="e.g. Writing"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="new-label-description"
                className={labelClass}
              >
                Description
              </label>

              <textarea
                id="new-label-description"
                name="description"
                rows={3}
                placeholder="Optional description"
                className={inputClass}
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

        <div className="grid content-start gap-4 sm:grid-cols-2">
          {labels.map(
            (label) => {
              const majorActivity =
                majorActivityById.get(
                  label.id
                ) ?? null

              const majorActivityLabel =
                label.is_break
                  ? 'Breaks'
                  : majorActivityOptions.find(
                      (option) =>
                        option.value ===
                        majorActivity
                    )?.label ??
                    'Unclassified'

              return (
                <Card
                  key={label.id}
                  className="h-fit"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-oxford-charcoal">
                        {label.name}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
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
                  </div>

                  {label.description && (
                    <p className="mt-2 text-sm leading-5 text-oxford-ash">
                      {label.description}
                    </p>
                  )}

                  <div className="mt-3 rounded-md border border-oxford-stone bg-oxford-shell px-2.5 py-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-oxford-ash">
                      Major activity
                    </div>

                    {label.is_break ? (
                      <div className="mt-1 text-xs font-medium text-oxford-charcoal">
                        Breaks
                      </div>
                    ) : label.is_system ? (
                      <div className="mt-1 text-xs font-medium text-oxford-charcoal">
                        {majorActivityLabel}
                      </div>
                    ) : (
                      <form
                        action={setMajorActivity}
                        className="mt-1.5 flex items-end gap-2"
                      >
                        <input
                          type="hidden"
                          name="return_date"
                          value={returnDate}
                        />

                        <input
                          type="hidden"
                          name="label_id"
                          value={label.id}
                        />

                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={`major-activity-${label.id}`}
                            className="sr-only"
                          >
                            Major activity for {label.name}
                          </label>

                          <select
                            id={`major-activity-${label.id}`}
                            name="major_activity"
                            defaultValue={
                              majorActivity ?? ''
                            }
                            className={compactSelectClass}
                          >
                            <option value="">
                              Unclassified
                            </option>

                            {majorActivityOptions.map(
                              (option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <Button
                          type="submit"
                          variant="secondary"
                          className="!px-2.5 !py-1.5 !text-xs"
                        >
                          Save
                        </Button>
                      </form>
                    )}
                  </div>

                  {label.is_system ? (
                    <p className="mt-3 border-t border-oxford-stone pt-3 text-xs leading-5 text-oxford-ash">
                      Protected system label. It cannot be modified or deactivated. Break labels are classified as Breaks automatically.
                    </p>
                  ) : (
                    <div className="mt-3 border-t border-oxford-stone pt-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <form
                          action={setActivityLabelActive}
                        >
                          <input
                            type="hidden"
                            name="return_date"
                            value={returnDate}
                          />

                          <input
                            type="hidden"
                            name="label_id"
                            value={label.id}
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

                          <button
                            type="submit"
                            className="text-sm font-medium text-oxford-blue hover:underline"
                          >
                            {label.is_active
                              ? 'Deactivate'
                              : 'Reactivate'}
                          </button>
                        </form>

                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-oxford-blue hover:underline">
                            Edit
                          </summary>

                          <form
                            action={updateActivityLabel}
                            className="mt-3 space-y-3"
                          >
                            <input
                              type="hidden"
                              name="return_date"
                              value={returnDate}
                            />

                            <input
                              type="hidden"
                              name="label_id"
                              value={label.id}
                            />

                            <div>
                              <label
                                htmlFor={`label-name-${label.id}`}
                                className={labelClass}
                              >
                                Name
                              </label>

                              <input
                                id={`label-name-${label.id}`}
                                name="name"
                                type="text"
                                required
                                defaultValue={label.name}
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`label-description-${label.id}`}
                                className={labelClass}
                              >
                                Description
                              </label>

                              <textarea
                                id={`label-description-${label.id}`}
                                name="description"
                                rows={3}
                                defaultValue={
                                  label.description ?? ''
                                }
                                className={inputClass}
                              />
                            </div>

                            <Button
                              type="submit"
                              variant="primary"
                            >
                              Save
                            </Button>
                          </form>
                        </details>

                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-red-700 hover:underline">
                            Delete
                          </summary>

                          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
                            <p className="text-xs leading-5 text-red-800">
                              Delete only an erroneous, unused label. Deactivate labels with historical sessions.
                            </p>

                            <form
                              action={deleteActivityLabel}
                              className="mt-3"
                            >
                              <input
                                type="hidden"
                                name="return_date"
                                value={returnDate}
                              />

                              <input
                                type="hidden"
                                name="label_id"
                                value={label.id}
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
                    </div>
                  )}
                </Card>
              )
            }
          )}
        </div>
      </div>
    </section>
  )
}
