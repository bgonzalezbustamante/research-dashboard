import {
  notFound,
} from 'next/navigation'

import PageHeader from '@/components/page-header'
import PaperForm from '@/components/papers/paper-form'
import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'
import { updatePaper } from '../../actions'

type EditPaperPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

export default async function EditPaperPage({
  params,
  searchParams,
}: EditPaperPageProps) {
  await requireDashboardOwner()

  const { id } =
    await params

  const { error } =
    await searchParams

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
      published_on
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
      link_type,
      url
    `)
    .eq('paper_id', id)

  if (linksError) {
    throw new Error(
      `Could not load links: ${linksError.message}`
    )
  }

  const authors = (
    authorRows ?? []
  )
    .map((row) => {
      const author =
        Array.isArray(
          row.authors
        )
          ? row.authors[0]
          : row.authors

      return (
        author?.full_name ??
        ''
      )
    })
    .filter(Boolean)
    .join('\n')

  function getLink(
    type: string
  ) {
    return (
      links?.find(
        (link) =>
          link.link_type ===
          type
      )?.url ?? ''
    )
  }

  const publicationUrl =
    getLink('publication') ||
    getLink('doi')

  return (
    <div>
      <PageHeader
        title={`Edit ${paper.short_title}`}
        description="Update the paper's core metadata, authors, publication status, and research links."
      />

      <PaperForm
        action={updatePaper}
        submitLabel="Save changes"
        cancelHref={`/papers/${paper.id}`}
        error={error}
        hiddenFields={
          <input
            type="hidden"
            name="paper_id"
            value={paper.id}
          />
        }
        initialValues={{
          shortTitle:
            paper.short_title,
          title:
            paper.title,
          authors,
          abstract:
            paper.abstract ?? '',
          status:
            paper.status,
          revisionRound:
            paper.revision_round,
          targetVenue:
            paper.target_venue ??
            '',
          currentVenue:
            paper.current_venue ??
            '',
          startedOn:
            paper.started_on ?? '',
          publishedOn:
            paper.published_on ??
            '',
          overleafUrl:
            getLink('overleaf'),
          dataverseUrl:
            getLink('dataverse'),
          githubUrl:
            getLink('github'),
          preprintUrl:
            getLink('preprint'),
          publicationUrl,
        }}
      />
    </div>
  )
}
