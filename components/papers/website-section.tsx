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
  ) => Promise<never>
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
              and research links remain
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

              <div className="md:col-span-2 xl:col-span-4">
                <label
                  htmlFor="paper-publication-index"
                  className={labelClass}
                >
                  Publication index
                </label>

                <input
                  id="paper-publication-index"
                  name="publication_index"
                  type="text"
                  defaultValue={
                    metadata.publication_index ??
                    ''
                  }
                  placeholder="Optional public-facing index or classification"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2 xl:col-span-4">
                <label
                  htmlFor="paper-public-citation"
                  className={labelClass}
                >
                  Citation
                </label>

                <textarea
                  id="paper-public-citation"
                  name="citation"
                  rows={3}
                  maxLength={2000}
                  defaultValue={
                    metadata.citation ??
                    ''
                  }
                  placeholder="Enter the preferred citation exactly as it should appear on the public site."
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2 xl:col-span-4 border-t border-oxford-stone pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-lg font-semibold text-oxford-blue">
                    Key highlight
                  </h3>

                  <span className="rounded-full border border-oxford-stone bg-oxford-off-white px-2 py-0.5 text-xs font-medium text-oxford-ash">
                    Optional
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-oxford-ash">
                  You can prepare these
                  fields while the paper
                  is Private. They are
                  returned anonymously
                  only when the paper is
                  Public.
                </p>
              </div>

              <div className="md:col-span-2 xl:col-span-4">
                <label
                  htmlFor="paper-highlight-text"
                  className={labelClass}
                >
                  Highlight text
                </label>

                <textarea
                  id="paper-highlight-text"
                  name="highlight_text"
                  rows={4}
                  maxLength={2000}
                  defaultValue={
                    metadata.highlight_text ??
                    ''
                  }
                  placeholder="Optional short public-facing statement of the paper's key result or contribution."
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2 xl:col-span-4">
                <label
                  htmlFor="paper-highlight-image"
                  className={labelClass}
                >
                  Highlight image
                  filename
                </label>

                <input
                  id="paper-highlight-image"
                  name="highlight_image_filename"
                  type="text"
                  autoCapitalize="none"
                  spellCheck={false}
                  defaultValue={
                    metadata.highlight_image_filename ??
                    ''
                  }
                  placeholder="figure-1.png"
                  className={inputClass}
                />

                <p className="mt-1 text-xs leading-5 text-oxford-ash">
                  Academic website path:{' '}
                  <code>
                    /publication-highlights/&lt;slug&gt;/&lt;filename&gt;
                  </code>
                  .
                </p>

                {metadata.slug &&
                  metadata.highlight_image_filename && (
                    <p className="mt-1 text-xs leading-5 text-oxford-ash">
                      Current path:{' '}
                      <code>
                        {'/publication-highlights/' +
                          metadata.slug +
                          '/' +
                          metadata.highlight_image_filename}
                      </code>
                    </p>
                  )}
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="paper-highlight-alt"
                  className={labelClass}
                >
                  Image alt text
                </label>

                <input
                  id="paper-highlight-alt"
                  name="highlight_image_alt"
                  type="text"
                  maxLength={500}
                  defaultValue={
                    metadata.highlight_image_alt ??
                    ''
                  }
                  placeholder="Required whenever an image filename is configured"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="paper-highlight-caption"
                  className={labelClass}
                >
                  Image caption / source
                </label>

                <input
                  id="paper-highlight-caption"
                  name="highlight_image_caption"
                  type="text"
                  maxLength={500}
                  defaultValue={
                    metadata.highlight_image_caption ??
                    ''
                  }
                  placeholder="Optional short caption or source line"
                  className={inputClass}
                />
              </div>
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
