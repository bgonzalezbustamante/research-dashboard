'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  requireDashboardOwner,
  requireWebsiteEditorAccess,
} from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'
import {
  readPaperWebsiteCitation,
  readPaperWebsiteContent,
} from '@/lib/website/paper-content'

const allowedVisibilities = new Set([
  'private',
  'public',
])

const slugPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function getRequiredText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getOptionalText(
  formData: FormData,
  name: string
) {
  const value =
    getRequiredText(formData, name)

  return value.length > 0
    ? value
    : null
}

function paperWebsiteRedirect(
  paperId: string,
  key: 'websiteError' | 'websiteSaved',
  value: string
): never {
  const params =
    new URLSearchParams({
      [key]: value,
    })

  redirect(
    `/papers/${paperId}?${params.toString()}#website`
  )
}

function websiteEditorRedirect(
  paperId: string,
  key: 'error' | 'saved',
  value: string
): never {
  const params =
    new URLSearchParams({
      [key]: value,
    })

  redirect(
    `/website/${paperId}?${params.toString()}`
  )
}

export async function updatePublicPaperMetadata(
  formData: FormData
) {
  await requireDashboardOwner()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const visibility =
    getRequiredText(
      formData,
      'visibility'
    )

  if (!paperId) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Paper ID is required.'
    )
  }

  if (
    !allowedVisibilities.has(
      visibility
    )
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Invalid public visibility.'
    )
  }

  const rawSlug =
    getOptionalText(
      formData,
      'slug'
    )

  const slug =
    rawSlug?.toLowerCase() ??
    null

  if (
    slug &&
    !slugPattern.test(slug)
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Slug must use lowercase letters, numbers, and single hyphens only.'
    )
  }

  if (
    visibility === 'public' &&
    !slug
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Public papers require a slug.'
    )
  }

  const contentResult =
    readPaperWebsiteContent(
      formData
    )

  if (!contentResult.content) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      contentResult.error ??
        "The Website content is invalid."
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from(
      'paper_public_metadata'
    )
    .update({
      visibility,
      slug,
      featured:
        formData.get('featured') ===
        'on',
      ...contentResult.content,
    })
    .eq('paper_id', paperId)
    .select('paper_id')
    .maybeSingle()

  if (error) {
    console.error(
      'Public paper metadata update failed:',
      error
    )

    if (error.code === '23505') {
      paperWebsiteRedirect(
        paperId,
        'websiteError',
        'That public slug is already in use.'
      )
    }

    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'The public paper settings could not be saved.'
    )
  }

  if (!data) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Public metadata was not found for that paper.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  paperWebsiteRedirect(
    paperId,
    'websiteSaved',
    '1'
  )
}

export async function updatePaperWebsiteContent(
  formData: FormData
) {
  await requireWebsiteEditorAccess()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  if (!paperId) {
    redirect('/website')
  }

  const citationResult =
    readPaperWebsiteCitation(
      formData
    )

  if (!citationResult.content) {
    websiteEditorRedirect(
      paperId,
      'error',
      citationResult.error ??
        'The Website citation is invalid.'
    )
  }

  const { content } =
    citationResult

  const supabase =
    await createClient()

  // The RPC re-checks the assignment and writes only the citation and
  // publication index; Key highlight fields stay Owner-only.
  const { error } =
    await supabase.rpc(
      'update_paper_website_content',
      {
        p_paper_id: paperId,
        p_publication_index:
          content.publication_index,
        p_citation:
          content.citation,
      }
    )

  if (error) {
    console.error(
      'Website content update failed:',
      error
    )

    websiteEditorRedirect(
      paperId,
      'error',
      error.code === '42501'
        ? 'You can no longer edit this paper. It may have been archived or unassigned.'
        : 'The Website content could not be saved.'
    )
  }

  revalidatePath('/website')
  revalidatePath(
    `/website/${paperId}`
  )

  websiteEditorRedirect(
    paperId,
    'saved',
    '1'
  )
}
