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
    titleError?: string
  }>
}

export default async function CoauthorTitlePage({
  params,
  searchParams,
}: CoauthorTitlePageProps) {
  const { id } = await params
  const { titleError } =
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

  const {
    data: paper,
    error: paperError,
  } = await supabase
    .from('papers')
    .select(`
      id,
      short_title,
      title
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

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={paper.short_title}
          description="Edit the full paper title with coauthor permission."
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
        title={paper.title}
        error={titleError}
      />
    </div>
  )
}
