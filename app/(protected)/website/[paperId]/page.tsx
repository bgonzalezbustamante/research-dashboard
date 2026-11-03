import { notFound } from 'next/navigation'

import PageHeader from '@/components/page-header'
import WebsiteContentFields from '@/components/papers/website-content-fields'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import { requireWebsiteEditorAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'
import type { WebsiteEditorPaper } from '@/lib/website/editor-papers'

import { updatePaperWebsiteContent } from '../actions'

type WebsiteEditorPaperPageProps = {
  params: Promise<{
    paperId: string
  }>
  searchParams: Promise<{
    error?: string
    saved?: string
  }>
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function WebsiteEditorPaperPage({
  params,
  searchParams,
}: WebsiteEditorPaperPageProps) {
  const { paperId } =
    await params

  const {
    error: saveError,
    saved,
  } = await searchParams

  await requireWebsiteEditorAccess()

  if (!uuidPattern.test(paperId)) {
    notFound()
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .rpc(
      'get_website_editor_paper',
      {
        p_paper_id: paperId,
      }
    )
    .maybeSingle()

  if (error) {
    throw new Error(
      `Could not load Website content: ${error.message}`
    )
  }

  if (!data) {
    notFound()
  }

  const paper =
    data as WebsiteEditorPaper

  return (
    <div>
      <div className="mb-4">
        <ButtonLink
          href="/website"
          variant="ghost"
        >
          ← All assigned papers
        </ButtonLink>
      </div>

      <PageHeader
        title={paper.short_title}
        description="Edit the public Website content for this paper. Changes appear on the Academic Website only while the Dashboard Owner keeps the paper Public."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Paper
          </h2>

          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-oxford-charcoal">
                Title
              </dt>
              <dd className="mt-1 text-oxford-ash">
                {paper.title}
              </dd>
            </div>

            <div>
              <dt className="font-medium text-oxford-charcoal">
                Authors
              </dt>
              <dd className="mt-1 text-oxford-ash">
                {paper.authors.length >
                0
                  ? paper.authors.join(
                      ', '
                    )
                  : 'Not specified'}
              </dd>
            </div>

            {paper.abstract && (
              <div>
                <dt className="font-medium text-oxford-charcoal">
                  Abstract
                </dt>
                <dd className="mt-1 whitespace-pre-line leading-6 text-oxford-ash">
                  {paper.abstract}
                </dd>
              </div>
            )}

            <div>
              <dt className="font-medium text-oxford-charcoal">
                Website status
              </dt>
              <dd className="mt-1 text-oxford-ash">
                {paper.visibility ===
                'public'
                  ? 'Public'
                  : 'Private'}
                {paper.featured
                  ? ' · Featured'
                  : ''}
                {paper.slug && (
                  <>
                    {' · '}
                    <code>
                      {paper.slug}
                    </code>
                  </>
                )}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-xs leading-5 text-oxford-ash">
            Title, authors, abstract,
            visibility, slug and
            Featured status are
            managed by the Dashboard
            Owner.
          </p>
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Website content
          </h2>

          {saveError && (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {saveError}
            </div>
          )}

          {saved && (
            <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Website content saved.
            </div>
          )}

          {paper.archived ? (
            <p className="mt-5 text-sm text-oxford-ash">
              This paper is archived,
              so Website editing is
              paused.
            </p>
          ) : (
            <form
              action={
                updatePaperWebsiteContent
              }
              data-website-editable="true"
              className="mt-6"
            >
              <input
                type="hidden"
                name="paper_id"
                value={paper.paper_id}
              />

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <WebsiteContentFields
                  values={paper}
                  slug={paper.slug}
                />
              </div>

              <div className="mt-5">
                <Button type="submit">
                  Save Website content
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
