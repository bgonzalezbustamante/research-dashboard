import PageHeader from '@/components/page-header'
import ExternalPublicationForm from '@/components/projects/external-publication-form'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import { requireWebsiteEditorAccess } from '@/lib/auth/dashboard-access'
import type { ExternalPublicationRow } from '@/lib/projects/external-publications'
import { createClient } from '@/lib/supabase/server'

import {
  createMyExternalPublication,
  deleteMyExternalPublication,
  updateMyExternalPublication,
} from './actions'

type EditorPublicationsPageProps = {
  searchParams: Promise<{
    error?: string
    created?: string
    saved?: string
    deleted?: string
  }>
}

export default async function EditorPublicationsPage({
  searchParams,
}: EditorPublicationsPageProps) {
  await requireWebsiteEditorAccess()

  const params =
    await searchParams

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase.rpc(
    'list_my_external_publications'
  )

  if (error) {
    throw new Error(
      `Could not load your publications: ${error.message}`
    )
  }

  const publications =
    (data ?? []) as ExternalPublicationRow[]

  const notice =
    params.created
      ? 'Publication added. It is awaiting review by the Dashboard Owner.'
      : params.saved
        ? 'Publication saved.'
        : params.deleted
          ? 'Publication deleted.'
          : null

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
        title="Your publications"
        description="Add papers by you or other authors that are relevant to the research projects on the Academic Website. Each one stays private until the Dashboard Owner reviews it, links it to the relevant projects and publishes it. You can edit or delete a publication while it is awaiting review."
        wide
      />

      {params.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {params.error}
        </div>
      )}

      {notice && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <Card className="mb-8">
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Add a publication
        </h2>

        <ExternalPublicationForm
          action={
            createMyExternalPublication
          }
          projects={[]}
          showVisibility={false}
          showProjects={false}
          websiteEditable
          submitLabel="Add publication"
        />
      </Card>

      {publications.length === 0 ? (
        <Card>
          <p className="text-sm text-oxford-ash">
            You have not added any
            publications yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {publications.map(
            (publication) => {
              const awaitingReview =
                publication.visibility ===
                'private'

              return (
                <Card
                  key={publication.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-serif text-lg font-semibold text-oxford-blue">
                        {publication.title}
                      </h2>

                      <p className="mt-1 text-sm text-oxford-ash">
                        {publication.authors.join(
                          ', '
                        )}{' '}
                        ·{' '}
                        {publication.publication_year}
                        {publication.venue
                          ? ` · ${publication.venue}`
                          : ''}
                      </p>
                    </div>

                    <span
                      className={
                        awaitingReview
                          ? 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900'
                          : 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                      }
                    >
                      {awaitingReview
                        ? 'Awaiting review'
                        : 'Published'}
                    </span>
                  </div>

                  {awaitingReview ? (
                    <details className="mt-5 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                      <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                        Edit publication
                      </summary>

                      <ExternalPublicationForm
                          action={
                            updateMyExternalPublication
                          }
                          projects={[]}
                          publication={
                            publication
                          }
                          showVisibility={
                            false
                          }
                          showProjects={
                            false
                          }
                          websiteEditable
                          submitLabel="Save publication"
                        />

                      <form
                        action={
                          deleteMyExternalPublication
                        }
                        data-website-editable="true"
                        className="mt-5 border-t border-oxford-stone pt-4"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={
                            publication.id
                          }
                        />

                        <Button
                          type="submit"
                          variant="secondary"
                        >
                          Delete publication
                        </Button>
                      </form>
                    </details>
                  ) : (
                    <p className="mt-4 text-xs text-oxford-ash">
                      Published by the
                      Dashboard Owner. Ask
                      them to unpublish it if
                      it needs changes.
                    </p>
                  )}
                </Card>
              )
            }
          )}
        </div>
      )}
    </div>
  )
}
