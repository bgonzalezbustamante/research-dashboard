import { setDefaultLocationLabel } from '@/app/(protected)/hours/location-default-action'
import {
  createLocationLabel,
  deleteLocationLabel,
  setLocationLabelActive,
  updateLocationLabel,
} from '@/app/(protected)/hours/location-actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type LocationLabelsSectionProps = {
  returnDate: string
  actionError?: string
}

type LocationLabel = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  is_default: boolean
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

function LocationErrorNotice({
  message,
}: {
  message?: string
}) {
  const trimmedMessage =
    message?.trim() ?? ''

  if (!trimmedMessage) {
    return null
  }

  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {trimmedMessage}
    </div>
  )
}

export default async function LocationLabelsSection({
  returnDate,
  actionError,
}: LocationLabelsSectionProps) {
  const supabase =
    await createClient()

  const { data, error } =
    await supabase
      .from('location_labels')
      .select(`
        id,
        name,
        description,
        is_active,
        is_default
      `)
      .order(
        'is_active',
        { ascending: false }
      )
      .order(
        'is_default',
        { ascending: false }
      )
      .order(
        'name',
        { ascending: true }
      )

  if (error) {
    return (
      <section
        id="location-labels"
        className="mt-8 scroll-mt-6"
      >
        <div className="mb-4">
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Location labels
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Define reusable work
            locations for sessions.
          </p>
        </div>

        <LocationErrorNotice
          message={actionError}
        />

        <Card>
          <p className="text-sm leading-6 text-oxford-ash">
            Location labels are not
            available in the database
            yet. Until the migration is
            applied, work sessions keep
            using the existing free-text
            location field.
          </p>
        </Card>
      </section>
    )
  }

  const labels =
    (data ?? []) as LocationLabel[]

  const activeCount =
    labels.filter(
      (label) => label.is_active
    ).length

  const inactiveCount =
    labels.length - activeCount

  const defaultLocation =
    labels.find(
      (label) => label.is_default
    ) ?? null

  return (
    <section
      id="location-labels"
      className="mt-8 scroll-mt-6"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Location labels
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            Define reusable locations
            for new work sessions and
            choose one active location
            as the default. Existing
            session locations remain
            recorded as historical text.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-oxford-ash">
          <span>
            <strong className="font-medium text-oxford-charcoal">
              {activeCount}
            </strong>{' '}
            active
          </span>

          <span>
            <strong className="font-medium text-oxford-charcoal">
              {inactiveCount}
            </strong>{' '}
            inactive
          </span>

          <span>
            Default:{' '}
            <strong className="font-medium text-oxford-charcoal">
              {defaultLocation?.name ??
                'None'}
            </strong>
          </span>
        </div>
      </div>

      <LocationErrorNotice
        message={actionError}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(250px,0.7fr)_minmax(0,2fr)]">
        <Card>
          <h3 className="font-serif text-lg font-semibold text-oxford-blue">
            Add location label
          </h3>

          <p className="mt-1 text-sm leading-5 text-oxford-ash">
            Create a reusable work
            location. You can mark it
            as default afterwards.
          </p>

          <form
            action={createLocationLabel}
            className="mt-4 space-y-4"
          >
            <input
              type="hidden"
              name="return_date"
              value={returnDate}
            />

            <div>
              <label
                htmlFor="new-location-name"
                className={labelClass}
              >
                Name
              </label>

              <input
                id="new-location-name"
                name="name"
                type="text"
                required
                placeholder="e.g. Home"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="new-location-description"
                className={labelClass}
              >
                Description
              </label>

              <textarea
                id="new-location-description"
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
              Add location
            </Button>
          </form>
        </Card>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          {labels.length === 0 ? (
            <div className="sm:col-span-2">
              <Card>
                <div className="py-6 text-center">
                  <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                    No location labels
                    yet
                  </h3>

                  <p className="mt-1 text-sm text-oxford-ash">
                    Add the first
                    reusable location.
                  </p>
                </div>
              </Card>
            </div>
          ) : (
            labels.map((label) => (
              <Card
                key={label.id}
                className="h-fit"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-medium text-oxford-charcoal">
                    {label.name}
                  </h3>

                  <div className="flex flex-wrap justify-end gap-1.5">
                    {label.is_default && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
                        Default
                      </span>
                    )}

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
                  </div>
                </div>

                {label.description && (
                  <p className="mt-2 text-sm leading-5 text-oxford-ash">
                    {label.description}
                  </p>
                )}

                <div className="mt-3 border-t border-oxford-stone pt-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {!label.is_default && (
                      <form
                        action={setDefaultLocationLabel}
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

                        <button
                          type="submit"
                          className="text-sm font-medium text-oxford-blue hover:underline"
                        >
                          Set default
                        </button>
                      </form>
                    )}

                    <form
                      action={setLocationLabelActive}
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
                        action={updateLocationLabel}
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
                            htmlFor={`location-name-${label.id}`}
                            className={labelClass}
                          >
                            Name
                          </label>

                          <input
                            id={`location-name-${label.id}`}
                            name="name"
                            type="text"
                            required
                            defaultValue={label.name}
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`location-description-${label.id}`}
                            className={labelClass}
                          >
                            Description
                          </label>

                          <textarea
                            id={`location-description-${label.id}`}
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
                          Delete only an
                          erroneous, unused
                          location. Deactivate
                          locations retained in
                          work-session history.
                        </p>

                        <form
                          action={deleteLocationLabel}
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
              </Card>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
