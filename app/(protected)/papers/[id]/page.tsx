import {
  notFound,
} from 'next/navigation'
import PageHeader from '@/components/page-header'
import Button from '@/components/ui/button'
import ButtonLink from '@/components/ui/button-link'
import Card from '@/components/ui/card'
import StatusBadge from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/server'
import {
  archivePaper,
  restorePaper,
} from '../actions'

type PaperStatus =
  | 'writing'
  | 'under-review'
  | 'revise-round'
  | 'published'
  | 'standby'
  | 'deprecated'

type PaperPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function PaperPage({
  params,
}: PaperPageProps) {
  const { id } =
    await params

  const supabase =
    await createClient()

  const {
    data: paper,
    error: paperError,
  } = await supabase
    .from('papers')
    .select(`
      id,
      short_title,
      title,
      abstract,
      status,
      revision_round,
      target_venue,
      current_venue,
      started_on,
      published_on,
      archived_at
    `)
    .eq('id', id)
    .maybeSingle()

  if (paperError) {
    throw new Error(
      `Could not load paper: ${paperError.message}`
    )
  }

  if (!paper) {
    notFound()
  }

  const {
    data: authorRows,
    error: authorError,
  } = await supabase
    .from('paper_authors')
    .select(`
      author_order,
      authors (
        full_name
      )
    `)
    .eq('paper_id', id)
    .order(
      'author_order',
      {
        ascending: true,
      }
    )

  if (authorError) {
    throw new Error(
      `Could not load authors: ${authorError.message}`
    )
  }

  const {
    data: links,
    error: linksError,
  } = await supabase
    .from('paper_links')
    .select(`
      id,
      link_type,
      label,
      url,
      sort_order
    `)
    .eq('paper_id', id)
    .order(
      'sort_order',
      {
        ascending: true,
      }
    )

  if (linksError) {
    throw new Error(
      `Could not load links: ${linksError.message}`
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={
            paper.short_title
          }
          description={
            paper.title
          }
        />

        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href="/papers"
            variant="secondary"
          >
            Back to papers
          </ButtonLink>

          <ButtonLink
            href={`/papers/${paper.id}/edit`}
            variant="primary"
          >
            Edit
          </ButtonLink>

          {paper.archived_at ? (
            <form
              action={
                restorePaper
              }
            >
              <input
                type="hidden"
                name="paper_id"
                value={paper.id}
              />

              <Button
                type="submit"
                variant="secondary"
              >
                Restore
              </Button>
            </form>
          ) : (
            <form
              action={
                archivePaper
              }
            >
              <input
                type="hidden"
                name="paper_id"
                value={paper.id}
              />

              <Button
                type="submit"
                variant="danger"
              >
                Archive
              </Button>
            </form>
          )}
        </div>
      </div>

      {paper.archived_at && (
        <div className="mb-6 rounded-md border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-700">
          This paper is archived and
          does not appear in the
          default active-papers list.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              status={
                paper.status as PaperStatus
              }
            />

            {paper.status ===
              'revise-round' &&
              paper.revision_round && (
                <span className="text-sm text-oxford-ash">
                  Round{' '}
                  {
                    paper.revision_round
                  }
                </span>
              )}
          </div>

          <h2 className="mt-6 font-serif text-xl font-semibold text-oxford-blue">
            Authors
          </h2>

          <p className="mt-2 text-oxford-charcoal">
            {authorRows &&
            authorRows.length > 0
              ? authorRows
                  .map((row) => {
                    const author =
                      Array.isArray(
                        row.authors
                      )
                        ? row
                            .authors[0]
                        : row.authors

                    return (
                      author?.full_name
                    )
                  })
                  .filter(Boolean)
                  .join(', ')
              : '—'}
          </p>

          {paper.abstract && (
            <>
              <h2 className="mt-6 font-serif text-xl font-semibold text-oxford-blue">
                Abstract
              </h2>

              <p className="mt-2 whitespace-pre-line leading-7 text-oxford-charcoal">
                {paper.abstract}
              </p>
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-serif text-xl font-semibold text-oxford-blue">
            Publication
          </h2>

          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-oxford-charcoal">
                Target venue
              </dt>

              <dd className="mt-1 text-oxford-ash">
                {paper.target_venue ??
                  '—'}
              </dd>
            </div>

            <div>
              <dt className="font-medium text-oxford-charcoal">
                Current venue
              </dt>

              <dd className="mt-1 text-oxford-ash">
                {paper.current_venue ??
                  '—'}
              </dd>
            </div>

            <div>
              <dt className="font-medium text-oxford-charcoal">
                Started
              </dt>

              <dd className="mt-1 text-oxford-ash">
                {paper.started_on ??
                  '—'}
              </dd>
            </div>

            <div>
              <dt className="font-medium text-oxford-charcoal">
                Published
              </dt>

              <dd className="mt-1 text-oxford-ash">
                {paper.published_on ??
                  '—'}
              </dd>
            </div>
          </dl>

          {links &&
            links.length > 0 && (
              <>
                <h2 className="mt-6 font-serif text-xl font-semibold text-oxford-blue">
                  Links
                </h2>

                <div className="mt-3 flex flex-col gap-2">
                  {links.map(
                    (link) => (
                      <a
                        key={
                          link.id
                        }
                        href={
                          link.url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-oxford-blue hover:underline"
                      >
                        {link.label ??
                          link.link_type}
                      </a>
                    )
                  )}
                </div>
              </>
            )}
        </Card>
      </div>
    </div>
  )
}