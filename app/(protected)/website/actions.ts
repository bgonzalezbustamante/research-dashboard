'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

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

function websiteRedirect(
  key: 'error' | 'saved',
  value: string
): never {
  redirect(
    `/website?${key}=${encodeURIComponent(
      value
    )}`
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
    websiteRedirect(
      'error',
      'Paper ID is required.'
    )
  }

  if (
    !allowedVisibilities.has(
      visibility
    )
  ) {
    websiteRedirect(
      'error',
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
    websiteRedirect(
      'error',
      'Slug must use lowercase letters, numbers, and single hyphens only.'
    )
  }

  if (
    visibility === 'public' &&
    !slug
  ) {
    websiteRedirect(
      'error',
      'Public papers require a slug.'
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
      publication_index:
        getOptionalText(
          formData,
          'publication_index'
        ),
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
      websiteRedirect(
        'error',
        'That public slug is already in use.'
      )
    }

    websiteRedirect(
      'error',
      'The public paper settings could not be saved.'
    )
  }

  if (!data) {
    websiteRedirect(
      'error',
      'Public metadata was not found for that paper.'
    )
  }

  revalidatePath('/website')

  websiteRedirect(
    'saved',
    paperId
  )
}
