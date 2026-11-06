import {
  WebsiteCitationFields,
  WebsiteHighlightFields,
} from '@/components/papers/website-content-fields'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

export type PaperPublicMetadata = {
  visibility: 'public' | 'private'
  slug: string | null
  featured: boolean
  publication_index: string | null
  citation: string | null
  highlight_text: string | null
  highlight_image_filename: string | null
  highlight_image_alt: string | null
  highlight_image_caption: string | null
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

export default function WebsiteSection({
  paperId,
  metadata,
  canEdit,
  error,
  saved,
  action,
}: {
  paperId: string
  metadata: PaperPublicMetadata
  canEdit: boolean
  error?: string
  saved?: boolean
  action: (
    formData: FormData
  ) => Promise<void>
}) {
  return (
    <section
      id="website"
      className="mt-6 scroll-mt-6"
    >
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-oxford-blue">
              Website
            </h2>

            <p className="mt-2 text-sm leading-6 text-oxford-ash">
              Public-site settings for
              this paper. Canonical
              title, authors, abstract,
              venue, publication date,
              language, and research
              links remain
              managed elsewhere in the
              Paper workspace.
            </p>
          </div>

          <span
            className={
              metadata.visibility ===
              'public'
                ? 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                : 'rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700'
            }
          >
            {metadata.visibility ===
            'public'
              ? 'Public'
              : 'Private'}
          </span>
        </div>

        {error && (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {saved && (
          <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Website settings saved.
          </div>
        )}

        {canEdit ? (
          <form
            action={action}
            className="mt-6"
          >
            <input
              type="hidden"
              name="paper_id"
              value={paperId}
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label
                  htmlFor="paper-website-visibility"
                  className={labelClass}
                >
                  Visibility
                </label>

                <select
                  id="paper-website-visibility"
                  name="visibility"
                  defaultValue={
                    metadata.visibility
                  }
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

              <div className="xl:col-span-2">
                <label
                  htmlFor="paper-website-slug"
                  className={labelClass}
                >
                  Public slug
                </label>

                <input
                  id="paper-website-slug"
                  name="slug"
                  type="text"
                  defaultValue={
                    metadata.slug ?? ''
                  }
                  placeholder="stable-paper-slug"
                  className={inputClass}
                />

                <p className="mt-1 text-xs text-oxford-ash">
                  Required when Public.
                  Lowercase letters,
                  numbers, and hyphens.
                </p>
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

              <WebsiteCitationFields
                values={metadata}
              />

              <WebsiteHighlightFields
                values={metadata}
                slug={metadata.slug}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="submit">
                Save website settings
              </Button>

              {metadata.slug && (
                <span className="text-xs text-oxford-ash">
                  Stable slug:{' '}
                  <code>
                    {metadata.slug}
                  </code>
                </span>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-5 text-sm leading-6 text-oxford-ash">
            Website presentation
            settings are managed by the
            Dashboard Owner.
          </div>
        )}
      </Card>
    </section>
  )
}
