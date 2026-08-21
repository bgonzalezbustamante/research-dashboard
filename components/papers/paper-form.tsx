import type { ReactNode } from 'react'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'

type PaperFormValues = {
  shortTitle?: string
  title?: string
  authors?: string
  abstract?: string
  status?: string
  revisionRound?: number | null
  targetVenue?: string
  currentVenue?: string
  startedOn?: string
  publishedOn?: string
  overleafUrl?: string
  dataverseUrl?: string
  githubUrl?: string
  preprintUrl?: string
  publicationUrl?: string
}

type PaperFormProps = {
  action: (
    formData: FormData
  ) => Promise<void>
  submitLabel: string
  cancelHref: string
  error?: string
  initialValues?: PaperFormValues
  hiddenFields?: ReactNode
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

export default function PaperForm({
  action,
  submitLabel,
  cancelHref,
  error,
  initialValues = {},
  hiddenFields,
}: PaperFormProps) {
  return (
    <form
      action={action}
      className="space-y-6"
    >
      {hiddenFields}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Paper details
        </h2>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div>
            <label
              htmlFor="short_title"
              className={labelClass}
            >
              Short title
            </label>

            <input
              id="short_title"
              name="short_title"
              type="text"
              required
              defaultValue={
                initialValues.shortTitle ?? ''
              }
              className={inputClass}
            />

            <p className="mt-1 text-xs text-oxford-ash">
              Used throughout the dashboard.
            </p>
          </div>

          <div>
            <label
              htmlFor="status"
              className={labelClass}
            >
              Status
            </label>

            <select
              id="status"
              name="status"
              defaultValue={
                initialValues.status ??
                'writing'
              }
              className={inputClass}
            >
              <option value="writing">
                Writing
              </option>

              <option value="under-review">
                Under review
              </option>

              <option value="revise-round">
                Revise round
              </option>

              <option value="published">
                Published
              </option>

              <option value="standby">
                Standby
              </option>

              <option value="deprecated">
                Deprecated
              </option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="title"
              className={labelClass}
            >
              Full title
            </label>

            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={
                initialValues.title ?? ''
              }
              className={inputClass}
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="authors"
              className={labelClass}
            >
              Authors
            </label>

            <textarea
              id="authors"
              name="authors"
              required
              rows={4}
              defaultValue={
                initialValues.authors ?? ''
              }
              placeholder={`Bastián González-Bustamante\nCoauthor Two\nCoauthor Three`}
              className={inputClass}
            />

            <p className="mt-1 text-xs text-oxford-ash">
              Enter one author per line, in
              publication order.
            </p>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="abstract"
              className={labelClass}
            >
              Abstract
            </label>

            <textarea
              id="abstract"
              name="abstract"
              rows={8}
              defaultValue={
                initialValues.abstract ?? ''
              }
              className={inputClass}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Publication status
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="revision_round"
              className={labelClass}
            >
              Revision round
            </label>

            <input
              id="revision_round"
              name="revision_round"
              type="number"
              min="1"
              defaultValue={
                initialValues.revisionRound ??
                ''
              }
              className={inputClass}
            />

            <p className="mt-1 text-xs text-oxford-ash">
              Required only when status is
              Revise round.
            </p>
          </div>

          <div />

          <div>
            <label
              htmlFor="target_venue"
              className={labelClass}
            >
              Target journal or venue
            </label>

            <input
              id="target_venue"
              name="target_venue"
              type="text"
              defaultValue={
                initialValues.targetVenue ?? ''
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="current_venue"
              className={labelClass}
            >
              Current journal or venue
            </label>

            <input
              id="current_venue"
              name="current_venue"
              type="text"
              defaultValue={
                initialValues.currentVenue ?? ''
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="started_on"
              className={labelClass}
            >
              Started
            </label>

            <input
              id="started_on"
              name="started_on"
              type="date"
              defaultValue={
                initialValues.startedOn ?? ''
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="published_on"
              className={labelClass}
            >
              Published
            </label>

            <input
              id="published_on"
              name="published_on"
              type="date"
              defaultValue={
                initialValues.publishedOn ??
                ''
              }
              className={inputClass}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Research links
        </h2>

        <p className="mt-2 text-sm text-oxford-ash">
          Optional. URLs must begin with
          http:// or https://.
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="overleaf_url"
              className={labelClass}
            >
              Overleaf
            </label>

            <input
              id="overleaf_url"
              name="overleaf_url"
              type="url"
              defaultValue={
                initialValues.overleafUrl ?? ''
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="github_url"
              className={labelClass}
            >
              GitHub repository
            </label>

            <input
              id="github_url"
              name="github_url"
              type="url"
              defaultValue={
                initialValues.githubUrl ?? ''
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="dataverse_url"
              className={labelClass}
            >
              Dataverse
            </label>

            <input
              id="dataverse_url"
              name="dataverse_url"
              type="url"
              defaultValue={
                initialValues.dataverseUrl ?? ''
              }
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="preprint_url"
              className={labelClass}
            >
              Preprint
            </label>

            <input
              id="preprint_url"
              name="preprint_url"
              type="url"
              defaultValue={
                initialValues.preprintUrl ?? ''
              }
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="publication_url"
              className={labelClass}
            >
              DOI / publication URL
            </label>

            <input
              id="publication_url"
              name="publication_url"
              type="url"
              defaultValue={
                initialValues.publicationUrl ??
                ''
              }
              className={inputClass}
            />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="primary"
        >
          {submitLabel}
        </Button>

        <ButtonLink
          href={cancelHref}
          variant="secondary"
        >
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}