import PageHeader from '@/components/page-header'
import ExternalPublicationForm from '@/components/projects/external-publication-form'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import { requireDashboardAccess } from '@/lib/auth/dashboard-access'
import type { ExternalPublicationRow } from '@/lib/projects/external-publications'
import { createClient } from '@/lib/supabase/server'

import {
  createExternalPublication,
  deleteExternalPublication,
  updateExternalPublication,
} from './actions'

type ProjectPublicationsPageProps = {
  searchParams: Promise<{
    error?: string
    created?: string
    saved?: string
    deleted?: string
  }>
}

type ProjectOption = {
  id: string
  short_title: string
  title: string
}

type ProjectLinkRow = {
  project_id: string
  external_publication_id: string
}

export default async function ProjectPublicationsPage({
  searchParams,
}: ProjectPublicationsPageProps) {
  const access =
    await requireDashboardAccess()

  const params =
    await searchParams

  const supabase =
    await createClient()

  const [
    publicationsResult,
    projectsResult,
    linksResult,
  ] = await Promise.all([
    supabase
      .from('external_publications')
      .select(
        'id, title, authors, venue, publication_year, published_on, doi_url, publication_url, language, visibility'
      )
      .eq('owner_id', access.ownerId)
      .order('publication_year', {
        ascending: false,
      })
      .order('title', {
        ascending: true,
      }),

    supabase
      .from('projects')
      .select('id, short_title, title')
      .eq('owner_id', access.ownerId)
      .order('short_title', {
        ascending: true,
      }),

    supabase
      .from('project_external_publications')
      .select(
        'project_id, external_publication_id'
      ),
  ])

  if (publicationsResult.error) {
    throw new Error(
      `Could not load external publications: ${publicationsResult.error.message}`
    )
  }

  if (projectsResult.error) {
    throw new Error(
      `Could not load projects: ${projectsResult.error.message}`
    )
  }

  if (linksResult.error) {
    throw new Error(
      `Could not load project links: ${linksResult.error.message}`
    )
  }

  const publications =
    (publicationsResult.data ?? []) as ExternalPublicationRow[]

  const projects =
    (projectsResult.data ?? []) as ProjectOption[]

  const projectById =
    new Map(
      projects.map(
        (project) => [
          project.id,
          project,
        ] as const
      )
    )

  const projectIdsByPublication =
    new Map<string, string[]>()

  for (const link of (linksResult.data ?? []) as ProjectLinkRow[]) {
    const existing =
      projectIdsByPublication.get(
        link.external_publication_id
      ) ?? []

    existing.push(link.project_id)

    projectIdsByPublication.set(
      link.external_publication_id,
      existing
    )
  }

  const notice =
    params.created
      ? 'External publication created.'
      : params.saved
        ? 'External publication saved.'
        : params.deleted
          ? 'External publication deleted.'
          : null

  return (
    <div>
      <div className="mb-4">
        <ButtonLink
          href="/projects"
          variant="ghost"
        >
          ← Projects
        </ButtonLink>
      </div>

      <PageHeader
        title="Project publications"
        description="Research outputs relevant to your Projects on which you are not an author. They never appear among your own Papers, Planning or analytics, and the Academic API exposes them only through the project publications feed, when both the publication and its Project are Public."
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

      {access.canEdit && (
        <Card className="mb-8">
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Add external publication
          </h2>

          <p className="mt-1 text-sm text-oxford-ash">
            New external publications
            are Private until you make
            them Public.
          </p>

          <ExternalPublicationForm
            action={
              createExternalPublication
            }
            projects={projects}
            submitLabel="Add external publication"
          />
        </Card>
      )}

      {publications.length === 0 ? (
        <Card>
          <p className="text-sm text-oxford-ash">
            No external publications
            yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {publications.map(
            (publication) => {
              const linkedProjectIds =
                projectIdsByPublication.get(
                  publication.id
                ) ?? []

              return (
                <Card
                  key={publication.id}
                >
                  <div
                    id={`external-publication-${publication.id}`}
                    className="flex scroll-mt-6 flex-wrap items-start justify-between gap-3"
                  >
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

                      <p className="mt-2 text-xs text-oxford-ash">
                        Projects:{' '}
                        {linkedProjectIds.length >
                        0
                          ? linkedProjectIds
                              .map(
                                (id) =>
                                  projectById.get(
                                    id
                                  )
                                    ?.short_title ??
                                  'Unknown project'
                              )
                              .join(', ')
                          : 'none'}
                      </p>
                    </div>

                    <span
                      className={
                        publication.visibility ===
                        'public'
                          ? 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                          : 'rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700'
                      }
                    >
                      {publication.visibility ===
                      'public'
                        ? 'Public'
                        : 'Private'}
                    </span>
                  </div>

                  {access.canEdit && (
                    <details className="mt-5 rounded-lg border border-oxford-stone bg-oxford-off-white p-4">
                      <summary className="cursor-pointer text-sm font-medium text-oxford-blue">
                        Edit external
                        publication
                      </summary>

                      <ExternalPublicationForm
                        action={
                          updateExternalPublication
                        }
                        projects={projects}
                        publication={
                          publication
                        }
                        linkedProjectIds={
                          linkedProjectIds
                        }
                        submitLabel="Save external publication"
                      />

                      <form
                        action={
                          deleteExternalPublication
                        }
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
                          Delete external
                          publication
                        </Button>
                      </form>
                    </details>
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
