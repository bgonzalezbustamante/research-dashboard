import { publicationIndexes } from '@/lib/website/paper-content'

export type PaperWebsiteContentValues = {
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

// Grid children for the Website content fields. Render inside a grid with
// md:grid-cols-2 xl:grid-cols-4.
export default function WebsiteContentFields({
  values,
  slug,
}: {
  values: PaperWebsiteContentValues
  slug: string | null
}) {
  return (
    <>
      <div className="md:col-span-2 xl:col-span-4">
        <label
          htmlFor="paper-publication-index"
          className={labelClass}
        >
          Publication index
        </label>

        <select
          id="paper-publication-index"
          name="publication_index"
          defaultValue={
            values.publication_index ??
            ''
          }
          className={inputClass}
        >
          <option value="">
            Not specified
          </option>
          {publicationIndexes.map(
            (publicationIndex) => (
              <option
                key={publicationIndex}
                value={publicationIndex}
              >
                {publicationIndex}
              </option>
            )
          )}
        </select>
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
            values.citation ??
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
            values.highlight_text ??
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
            values.highlight_image_filename ??
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

        {slug &&
          values.highlight_image_filename && (
            <p className="mt-1 text-xs leading-5 text-oxford-ash">
              Current path:{' '}
              <code>
                {'/publication-highlights/' +
                  slug +
                  '/' +
                  values.highlight_image_filename}
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
            values.highlight_image_alt ??
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
            values.highlight_image_caption ??
            ''
          }
          placeholder="Optional short caption or source line"
          className={inputClass}
        />
      </div>
    </>
  )
}
