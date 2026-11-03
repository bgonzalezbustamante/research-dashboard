import Link from 'next/link'
import { redirect } from 'next/navigation'

import PageHeader from '@/components/page-header'
import Card from '@/components/ui/card'
import { requireAppAccess } from '@/lib/auth/dashboard-access'
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

  const {
    data,
    error,
  } = await supabase.rpc(
    'list_my_website_editor_papers'
  )

  if (error) {
    throw new Error(
      `Could not load Website Editor papers: ${error.message}`
    )
  }

  const papers =
    (data ?? []) as WebsiteEditorPaper[]

  return (
    <div>
      <PageHeader
        title="Website"
        description="Edit the public Website content of the papers assigned to you: publication index, citation and Key highlight. Visibility, public slug and Featured status remain managed by the Dashboard Owner."
      />

      {papers.length === 0 ? (
        <Card>
          <p className="text-sm text-oxford-ash">
            No papers are assigned
            to you at the moment.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {papers.map((paper) => (
            <Card key={paper.paper_id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                    {paper.short_title}
                  </p>

                  <h2 className="mt-1 font-serif text-lg font-semibold text-oxford-blue">
                    {paper.title}
                  </h2>
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

              {paper.authors.length >
                0 && (
                <p className="mt-2 text-sm text-oxford-ash">
                  {paper.authors.join(
                    ', '
                  )}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
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
                    Edit Website content
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
