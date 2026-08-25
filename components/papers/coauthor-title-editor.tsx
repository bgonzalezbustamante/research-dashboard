import { updateCoauthorPaperDetails } from '@/app/(protected)/papers/coauthor-actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

type CoauthorTitleEditorProps = {
  paperId: string
  shortTitle: string
  title: string
  authors: string
  abstract: string
  targetVenue: string
  currentVenue: string
  overleafUrl: string
  dataverseUrl: string
  githubUrl: string
  preprintUrl: string
  publicationUrl: string
  error?: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

const labelClass =
  'mb-1 block text-sm font-medium text-oxford-charcoal'

export default function CoauthorTitleEditor({
  paperId,
  shortTitle,
  title,
  authors,
  abstract,
  targetVenue,
  currentVenue,
  overleafUrl,
  dataverseUrl,
  githubUrl,
  preprintUrl,
  publicationUrl,
  error,
}: CoauthorTitleEditorProps) {
  return (
    <section
      id="paper-collaboration"
      className="mb-6 scroll-mt-6"
    >
      <Card className="border-green-200 bg-green-50/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-medium uppercase tracking-wide text-green-800">
              Coauthor editing
            </div>

            <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
              Collaborative paper details
            </h2>

            <p className="mt-1 text-sm leading-6 text-oxford-ash">
              Edit bibliographic and research-facing fields for this paper.
              The short title, workflow status, revision round, dates,
              submission history, citations, archive state, Hours, and
              Planning remain owner-only.
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
            Coauthor
          </span>
        </div>

        <div className="mt-4 rounded-md border border-oxford-stone bg-white px-4 py-3 text-sm">
          <span className="font-medium text-oxford-charcoal">
            Short title:
          </span>{' '}
          <span className="text-oxford-ash">
            {shortTitle}
          </span>{' '}
          <span className="text-xs text-oxford-ash">
            (owner-only)
          </span>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form
          action={updateCoauthorPaperDetails}
          data-coauthor-editable="true"
          className="mt-6 space-y-6"
        >
          <input
            type="hidden"
            name="paper_id"
            value={paperId}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label
                htmlFor="coauthor-paper-title"
                className={labelClass}
              >
                Full title
              </label>

              <input
                id="coauthor-paper-title"
                name="title"
                type="text"
                required
                defaultValue={title}
                className={inputClass}
              />
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="coauthor-paper-authors"
                className={labelClass}
              >
                Authors
              </label>

              <textarea
                id="coauthor-paper-authors"
                name="authors"
                rows={5}
                required
                defaultValue={authors}
                className={inputClass}
              />

              <p className="mt-1 text-xs text-oxford-ash">
                Enter one author per line, in publication order.
              </p>
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="coauthor-paper-abstract"
                className={labelClass}
              >
                Abstract
              </label>

              <textarea
                id="coauthor-paper-abstract"
                name="abstract"
                rows={10}
                defaultValue={abstract}
                className={inputClass}
              />

              <p className="mt-1 text-xs text-oxford-ash">
                Supports Markdown and LaTeX-style math notation using
                $...$ or $$...$$.
              </p>
            </div>

            <div>
              <label
                htmlFor="coauthor-target-venue"
                className={labelClass}
              >
                Target journal or venue
              </label>

              <input
                id="coauthor-target-venue"
                name="target_venue"
                type="text"
                defaultValue={targetVenue}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="coauthor-current-venue"
                className={labelClass}
              >
                Current journal or venue
              </label>

              <input
                id="coauthor-current-venue"
                name="current_venue"
                type="text"
                defaultValue={currentVenue}
                className={inputClass}
              />
            </div>
          </div>

          <div className="border-t border-oxford-stone pt-6">
            <h3 className="font-serif text-lg font-semibold text-oxford-blue">
              Research links
            </h3>

            <p className="mt-1 text-sm text-oxford-ash">
              Optional. URLs must begin with http:// or https://.
            </p>

            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="coauthor-overleaf-url"
                  className={labelClass}
                >
                  Overleaf
                </label>
                <input
                  id="coauthor-overleaf-url"
                  name="overleaf_url"
                  type="url"
                  defaultValue={overleafUrl}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="coauthor-github-url"
                  className={labelClass}
                >
                  GitHub repository
                </label>
                <input
                  id="coauthor-github-url"
                  name="github_url"
                  type="url"
                  defaultValue={githubUrl}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="coauthor-dataverse-url"
                  className={labelClass}
                >
                  Dataverse
                </label>
                <input
                  id="coauthor-dataverse-url"
                  name="dataverse_url"
                  type="url"
                  defaultValue={dataverseUrl}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="coauthor-preprint-url"
                  className={labelClass}
                >
                  Preprint
                </label>
                <input
                  id="coauthor-preprint-url"
                  name="preprint_url"
                  type="url"
                  defaultValue={preprintUrl}
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="coauthor-publication-url"
                  className={labelClass}
                >
                  DOI / publication URL
                </label>
                <input
                  id="coauthor-publication-url"
                  name="publication_url"
                  type="url"
                  defaultValue={publicationUrl}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
          >
            Save collaborative fields
          </Button>
        </form>
      </Card>
    </section>
  )
}
