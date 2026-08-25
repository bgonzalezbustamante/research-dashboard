import {
  notFound,
  redirect,
} from 'next/navigation'

import CoauthorTitleEditor from '@/components/papers/coauthor-title-editor'
import PageHeader from '@/components/page-header'
import ButtonLink from '@/components/ui/button-link'
import { requireAppAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

type CoauthorTitlePageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    editError?: string
  }>
}

export default async function CoauthorTitlePage({
  params,
  searchParams,
}: CoauthorTitlePageProps) {
  const { id } = await params
  const { editError } =
    await searchParams

  const access =
    await requireAppAccess()

  const supabase =
    await createClient()

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from('paper_members')
    .select('role')
    .eq('paper_id', id)
    .eq('user_id', access.userId)
    .maybeSingle()

  if (membershipError) {
    throw new Error(
      `Could not load paper membership: ${membershipError.message}`
    )
  }

  if (
    membership?.role !==
    'coauthor'
  ) {
    if (access.canEditDashboard) {
      redirect(
        `/papers/${id}/edit`
      )
    }

    redirect(`/papers/${id}`)
  }

  const [
    paperResult,
    authorResult,
    linksResult,
  ] = await Promise.all([
    supabase
      .from('papers')
      .select(`
        id,
        short_title,
        title,
        abstract,
        target_venue,
        current_venue
      `)
      .eq('id', id)
      .maybeSingle(),

    supabase
      .from('paper_authors')
      .select(`
        author_order,
        authors (
          full_name
        )
      `)
      .eq('paper_id', id)
      .order('author_order', {
        ascending: true,
      }),

    supabase
      .from('paper_links')
      .select(`
        link_type,
        url,
        sort_order
      `)
      .eq('paper_id', id)
      .order('sort_order', {
        ascending: true,
      }),
  ])

  if (paperResult.error) {
    throw new Error(
      `Could not load paper: ${paperResult.error.message}`
    )
  }

  if (authorResult.error) {
    throw new Error(
      `Could not load authors: ${authorResult.error.message}`
    )
  }

  if (linksResult.error) {
    throw new Error(
      `Could not load links: ${linksResult.error.message}`
    )
  }

  const paper =
    paperResult.data

  if (!paper) {
    notFound()
  }

  const authors =
    (authorResult.data ?? [])
      .map((row) => {
        const author =
          Array.isArray(row.authors)
            ? row.authors[0]
            : row.authors

        return author?.full_name ?? ''
      })
      .filter(Boolean)
      .join('\n')

  const links = new Map(
    (linksResult.data ?? []).map(
      (link) => [
        link.link_type,
        link.url,
      ]
    )
  )

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={paper.short_title}
          description="Edit the collaborative fields available to assigned coauthors."
        />

        <ButtonLink
          href={`/papers/${paper.id}`}
          variant="secondary"
        >
          Back to paper
        </ButtonLink>
      </div>

      <CoauthorTitleEditor
        paperId={paper.id}
        shortTitle={paper.short_title}
        title={paper.title}
        authors={authors}
        abstract={paper.abstract ?? ''}
        targetVenue={
          paper.target_venue ?? ''
        }
        currentVenue={
          paper.current_venue ?? ''
        }
        overleafUrl={
          links.get('overleaf') ?? ''
        }
        dataverseUrl={
          links.get('dataverse') ?? ''
        }
        githubUrl={
          links.get('github') ?? ''
        }
        preprintUrl={
          links.get('preprint') ?? ''
        }
        publicationUrl={
          links.get('publication') ??
          links.get('doi') ??
          ''
        }
        error={editError}
      />
    </div>
  )
}
