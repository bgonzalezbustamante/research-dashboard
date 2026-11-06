import Link from 'next/link'
import { redirect } from 'next/navigation'

import PageHeader from '@/components/page-header'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import { requireAppAccess } from '@/lib/auth/dashboard-access'
import type { ExternalPublicationRow } from '@/lib/papers/external-publications'
import { createClient } from '@/lib/supabase/server'
import type { WebsiteEditorPaper } from '@/lib/website/editor-papers'

export default async function WebsitePage() {
  const access =
    await requireAppAccess()

  // Owners manage Website settings inside each Paper workspace.
  if (access.canEditDashboard) {
    redirect('/papers')
  }

  if (!access.hasWebsiteEditorAccess) {
    redirect('/dashboard')
  }

  const supabase =
    await createClient()

  const [
    papersResult,
    publicationsResult,
  ] = await Promise.all([
    supabase.rpc(
      'list_my_website_editor_papers'
    ),

    supabase.rpc(
      'list_my_external_publications'
    ),
  ])

  if (papersResult.error) {
    throw new Error(
      `Could not load Website Editor papers: ${papersResult.error.message}`
    )
  }

  if (publicationsResult.error) {
    throw new Error(
      `Could not load your publications: ${publicationsResult.error.message}`
    )
  }

  const papers =
    (papersResult.data ?? []) as WebsiteEditorPaper[]

  const publications =
    (publicationsResult.data ?? []) as ExternalPublicationRow[]

  const awaitingReviewCount =
    publications.filter(
      (publication) =>
        publication.visibility ===
        'private'
    ).length

  return (
    <div>
      <PageHeader
        title="Website"
        description="Keep the citations of your assigned papers accurate on the Academic Website, and suggest papers by other authors for it and related sites. The Dashboard Owner reviews suggestions and manages visibility, public addresses and where they appear."
      />

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-oxford-blue">
          Your assigned papers
        </h2>

        {papers.length === 0 ? (
          <Card>
            <p className="text-sm text-oxford-ash">
              No papers are assigned
              to you at the moment.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {papers.map((paper) => (
              <Card key={paper.paper_id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                      {paper.short_title}
                    </p>

                    <h3 className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                      {paper.title}
                    </h3>

                    {paper.authors.length >
                      0 && (
                      <p className="mt-2 text-sm text-oxford-ash">
                        {paper.authors.join(
                          ', '
                        )}
                      </p>
                    )}
                  </div>

                  <span
                    className={
                      paper.visibility ===
                      'public'
                        ? 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                        : 'rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700'
                    }
                  >
                    {paper.visibility ===
                    'public'
                      ? 'Public'
                      : 'Private'}
                  </span>
                </div>

                <div className="mt-4">
                  {paper.archived ? (
                    <span className="text-xs text-oxford-ash">
                      Archived: editing
                      is paused.
                    </span>
                  ) : (
                    <Link
                      href={`/website/${paper.paper_id}`}
                      className="text-sm font-medium text-oxford-blue underline-offset-4 hover:underline"
                    >
                      Edit citation
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
            Publications you added
          </h2>

          <ButtonLink
            href="/website/publications"
            variant="secondary"
          >
            Manage your publications
          </ButtonLink>
        </div>

        <Card>
          <p className="text-sm text-oxford-ash">
            {publications.length === 0
              ? 'You have not added any publications yet.'
              : `${publications.length} added · ${awaitingReviewCount} awaiting review · ${publications.length - awaitingReviewCount} published`}
          </p>
        </Card>
      </section>
    </div>
  )
}
