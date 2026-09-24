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
  value: string,
  page: number
): never {
  const params =
    new URLSearchParams({
      [key]: value,
    })

  if (page > 1) {
    params.set(
      'page',
      String(page)
    )
  }

  redirect(
    `/website?${params.toString()}`
  )
}

function isValidHttpsUrl(
  value: string
) {
  try {
    const url =
      new URL(value)

    return (
      url.protocol === 'https:' &&
      value.length <= 2048
    )
  } catch {
    return false
  }
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

  const requestedPage =
    Number.parseInt(
      getRequiredText(
        formData,
        'current_page'
      ) || '1',
      10
    )

  const currentPage =
    Number.isFinite(
      requestedPage
    ) &&
    requestedPage > 0
      ? requestedPage
      : 1

  const visibility =
    getRequiredText(
      formData,
      'visibility'
    )

  if (!paperId) {
    websiteRedirect(
      'error',
      'Paper ID is required.',
      currentPage
    )
  }

  if (
    !allowedVisibilities.has(
      visibility
    )
  ) {
    websiteRedirect(
      'error',
      'Invalid public visibility.',
      currentPage
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
      'Slug must use lowercase letters, numbers, and single hyphens only.',
      currentPage
    )
  }

  if (
    visibility === 'public' &&
    !slug
  ) {
    websiteRedirect(
      'error',
      'Public papers require a slug.',
      currentPage
    )
  }

  const highlightText =
    getOptionalText(
      formData,
      'highlight_text'
    )

  const highlightImageUrl =
    getOptionalText(
      formData,
      'highlight_image_url'
    )

  const rawHighlightImageAlt =
    getOptionalText(
      formData,
      'highlight_image_alt'
    )

  const rawHighlightImageCaption =
    getOptionalText(
      formData,
      'highlight_image_caption'
    )

  if (
    highlightText &&
    highlightText.length > 2000
  ) {
    websiteRedirect(
      'error',
      'Key highlight text must be 2,000 characters or fewer.',
      currentPage
    )
  }

  if (
    highlightImageUrl &&
    !isValidHttpsUrl(
      highlightImageUrl
    )
  ) {
    websiteRedirect(
      'error',
      'Key highlight image must use a valid HTTPS URL.',
      currentPage
    )
  }

  if (
    highlightImageUrl &&
    !rawHighlightImageAlt
  ) {
    websiteRedirect(
      'error',
      'Image alt text is required when a Key highlight image is configured.',
      currentPage
    )
  }

  if (
    rawHighlightImageAlt &&
    rawHighlightImageAlt.length >
      500
  ) {
    websiteRedirect(
      'error',
      'Image alt text must be 500 characters or fewer.',
      currentPage
    )
  }

  if (
    rawHighlightImageCaption &&
    rawHighlightImageCaption.length >
      500
  ) {
    websiteRedirect(
      'error',
      'Image caption must be 500 characters or fewer.',
      currentPage
    )
  }

  const highlightImageAlt =
    highlightImageUrl
      ? rawHighlightImageAlt
      : null

  const highlightImageCaption =
    highlightImageUrl
      ? rawHighlightImageCaption
      : null

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
      highlight_text:
        highlightText,
      highlight_image_url:
        highlightImageUrl,
      highlight_image_alt:
        highlightImageAlt,
      highlight_image_caption:
        highlightImageCaption,
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
        'That public slug is already in use.',
        currentPage
      )
    }

    websiteRedirect(
      'error',
      'The public paper settings could not be saved.',
      currentPage
    )
  }

  if (!data) {
    websiteRedirect(
      'error',
      'Public metadata was not found for that paper.',
      currentPage
    )
  }

  revalidatePath('/website')

  websiteRedirect(
    'saved',
    paperId,
    currentPage
  )
}
