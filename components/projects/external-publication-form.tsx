import Button from '@/components/ui/button'
import {
  externalPublicationLanguages,
  type ExternalPublicationRow,
} from '@/lib/projects/external-publications'

type ProjectOption = {
  id: string
  short_title: string
  title: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

export default function ExternalPublicationForm({
  action,
  projects,
  publication,
  linkedProjectIds = [],
  submitLabel,
}: {
  action: (
    formData: FormData
  ) => Promise<void>
  projects: ProjectOption[]
  publication?: ExternalPublicationRow
  linkedProjectIds?: string[]
  submitLabel: string
}) {
  const prefix =
    publication?.id ?? 'new'

  const linked =
    new Set(linkedProjectIds)

  return (
    <form
      action={action}
      className="mt-5"
    >
      {publication && (
        <input
          type="hidden"
          name="id"
          value={publication.id}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2 xl:col-span-4">
          <label
            htmlFor={`${prefix}-title`}
            className={labelClass}
          >
            Title
          </label>

          <input
            id={`${prefix}-title`}
            name="title"
            type="text"
            required
            maxLength={500}
            defaultValue={
              publication?.title ?? ''
            }
            className={inputClass}
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor={`${prefix}-authors`}
            className={labelClass}
          >
            Authors
          </label>

          <textarea
            id={`${prefix}-authors`}
            name="authors"
            rows={4}
            required
            defaultValue={
              publication?.authors.join(
                '\n'
              ) ?? ''
            }
            placeholder={'One author per line, in citation order'}
            className={inputClass}
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor={`${prefix}-venue`}
            className={labelClass}
          >
            Venue
          </label>

          <input
            id={`${prefix}-venue`}
            name="venue"
            type="text"
            maxLength={300}
            defaultValue={
              publication?.venue ?? ''
            }
            placeholder="Journal, book or report series"
            className={inputClass}
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${prefix}-year`}
                className={labelClass}
              >
                Year
              </label>

              <input
                id={`${prefix}-year`}
                name="publication_year"
                type="number"
                required
                min={1900}
                max={2100}
                defaultValue={
                  publication?.publication_year ??
                  ''
                }
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor={`${prefix}-date`}
                className={labelClass}
              >
                Date (optional)
              </label>

              <input
                id={`${prefix}-date`}
                name="published_on"
                type="date"
                defaultValue={
                  publication?.published_on ??
                  ''
                }
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor={`${prefix}-doi`}
            className={labelClass}
          >
            DOI URL
          </label>

          <input
            id={`${prefix}-doi`}
            name="doi_url"
            type="url"
            defaultValue={
              publication?.doi_url ?? ''
            }
            placeholder="https://doi.org/..."
            className={inputClass}
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor={`${prefix}-url`}
            className={labelClass}
          >
            Publication URL
          </label>

          <input
            id={`${prefix}-url`}
            name="publication_url"
            type="url"
            defaultValue={
              publication?.publication_url ??
              ''
            }
            placeholder="https://..."
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor={`${prefix}-language`}
            className={labelClass}
          >
            Language
          </label>

          <select
            id={`${prefix}-language`}
            name="language"
            defaultValue={
              publication?.language ?? ''
            }
            className={inputClass}
          >
            <option value="">
              Not specified
            </option>
            {externalPublicationLanguages.map(
              (language) => (
                <option
                  key={language}
                  value={language}
                >
                  {language}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${prefix}-visibility`}
            className={labelClass}
          >
            Visibility
          </label>

          <select
            id={`${prefix}-visibility`}
            name="visibility"
            defaultValue={
              publication?.visibility ??
              'private'
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

        <div className="md:col-span-2 xl:col-span-4">
          <span className={labelClass}>
            Projects
          </span>

          {projects.length === 0 ? (
            <p className="text-sm text-oxford-ash">
              No projects yet.
            </p>
          ) : (
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-oxford-stone bg-oxford-off-white p-3 md:grid-cols-2">
              {projects.map(
                (project) => (
                  <label
                    key={project.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md bg-white px-3 py-2 text-sm transition hover:bg-oxford-shell"
                  >
                    <input
                      type="checkbox"
                      name="project_id"
                      value={project.id}
                      defaultChecked={linked.has(
                        project.id
                      )}
                      className="mt-1 h-4 w-4 accent-oxford-blue"
                    />

                    <span className="min-w-0">
                      <span className="font-medium text-oxford-charcoal">
                        {project.short_title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-oxford-ash">
                        {project.title}
                      </span>
                    </span>
                  </label>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <Button type="submit">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
