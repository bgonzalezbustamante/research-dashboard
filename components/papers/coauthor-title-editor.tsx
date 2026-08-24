import { updateCoauthorPaperTitle } from '@/app/(protected)/papers/coauthor-actions'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

type CoauthorTitleEditorProps = {
  paperId: string
  title: string
  error?: string
}

const inputClass =
  'w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-sm text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue'

export default function CoauthorTitleEditor({
  paperId,
  title,
  error,
}: CoauthorTitleEditorProps) {
  return (
    <section
      id="paper-title"
      className="mb-6 scroll-mt-6"
    >
      <Card className="border-sky-200 bg-sky-50/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-medium uppercase tracking-wide text-sky-800">
              Coauthor editing
            </div>

            <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
              Full title
            </h2>

            <p className="mt-1 text-sm leading-6 text-oxford-ash">
              You can update the full
              paper title. The short title
              and all other paper fields
              remain owner-only.
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
            Coauthor
          </span>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form
          action={updateCoauthorPaperTitle}
          data-coauthor-editable="true"
          className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end"
        >
          <input
            type="hidden"
            name="paper_id"
            value={paperId}
          />

          <div className="min-w-0 flex-1">
            <label
              htmlFor="coauthor-paper-title"
              className="mb-1 block text-sm font-medium text-oxford-charcoal"
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

          <Button
            type="submit"
            variant="primary"
          >
            Save title
          </Button>
        </form>
      </Card>
    </section>
  )
}
