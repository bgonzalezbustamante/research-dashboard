import {
  CollectionCheckboxes,
  ProjectCheckboxes,
  type ProjectOption,
} from '@/components/papers/external-publication-form'
import Button from '@/components/ui/button'
import type { ExternalPublicationCollectionRow } from '@/lib/papers/external-publications'

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

export default function ApproveExternalPublicationForm({
  action,
  publicationId,
  expectedUpdatedAt,
  suggestedSlug,
  collections,
  projects,
}: {
  action: (
    formData: FormData
  ) => Promise<void>
  publicationId: string
  expectedUpdatedAt: string
  suggestedSlug: string
  collections: ExternalPublicationCollectionRow[]
  projects: ProjectOption[]
}) {
  return (
    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-serif text-lg font-semibold text-oxford-blue">
        Approve and publish
      </h3>

      <p className="mt-1 text-sm text-oxford-ash">
        Publishing makes this
        suggestion Public under the
        slug below, in the selected
        collections. The suggesting
        editor can still correct its
        details afterwards; the slug,
        collections and visibility
        stay with you.
      </p>

      <form
        action={action}
        className="mt-4"
      >
        <input
          type="hidden"
          name="id"
          value={publicationId}
        />

        <input
          type="hidden"
          name="expected_updated_at"
          value={expectedUpdatedAt}
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-4">
            <label
              htmlFor={`${publicationId}-approve-slug`}
              className={labelClass}
            >
              Public slug
            </label>

            <input
              id={`${publicationId}-approve-slug`}
              name="slug"
              type="text"
              required
              maxLength={200}
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={
                suggestedSlug
              }
              className={inputClass}
            />
          </div>

          <CollectionCheckboxes
            collections={collections}
          />

          <ProjectCheckboxes
            projects={projects}
          />
        </div>

        <div className="mt-5">
          <Button type="submit">
            Approve and publish
          </Button>
        </div>
      </form>
    </div>
  )
}
