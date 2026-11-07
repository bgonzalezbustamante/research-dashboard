import { notFound } from 'next/navigation'

import PageHeader from '@/components/page-header'
import { WebsiteCitationFields } from '@/components/papers/website-content-fields'
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
          ← Website
        </ButtonLink>
      </div>

      <PageHeader
        title={paper.short_title}
        description="Edit how this paper is cited and classified on the Academic Website. Changes appear publicly only while the Dashboard Owner keeps the paper Public."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Paper
          </h2>

          <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">
            <div className="md:col-span-2">
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

            {paper.abstract && (
              <div className="md:col-span-2">
                <dt className="font-medium text-oxford-charcoal">
                  Abstract
                </dt>
                <dd className="mt-1 whitespace-pre-line leading-6 text-oxford-ash">
                  {paper.abstract}
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-5 text-xs leading-5 text-oxford-ash">
            Title, authors, abstract,
            visibility, public slug,
            Featured status and Key
            highlight are managed by
            the Dashboard Owner.
          </p>
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Citation
          </h2>

          {saveError && (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {saveError}
            </div>
          )}

          {saved && (
            <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Citation saved.
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
                <WebsiteCitationFields
                  values={paper}
                />
              </div>

              <div className="mt-5">
                <Button type="submit">
                  Save citation
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
