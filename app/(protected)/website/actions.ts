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

const assetFilenamePattern =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$/i

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

  const citation =
    getOptionalText(
      formData,
      'citation'
    )

  const highlightText =
    getOptionalText(
      formData,
      'highlight_text'
    )

  const highlightImageFilename =
    getOptionalText(
      formData,
      'highlight_image_filename'
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
    citation &&
    citation.length > 2000
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Citation must be 2,000 characters or fewer.'
    )
  }

  if (
    highlightText &&
    highlightText.length > 2000
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Key highlight text must be 2,000 characters or fewer.'
    )
  }

  if (
    highlightImageFilename &&
    !assetFilenamePattern.test(
      highlightImageFilename
    )
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Key highlight image must be a single PNG, WebP, JPG, or JPEG filename without folders.'
    )
  }

  if (
    highlightImageFilename &&
    !rawHighlightImageAlt
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Image alt text is required when a Key highlight image filename is configured.'
    )
  }

  if (
    rawHighlightImageAlt &&
    rawHighlightImageAlt.length >
      500
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Image alt text must be 500 characters or fewer.'
    )
  }

  if (
    rawHighlightImageCaption &&
    rawHighlightImageCaption.length >
      500
  ) {
    paperWebsiteRedirect(
      paperId,
      'websiteError',
      'Image caption must be 500 characters or fewer.'
    )
  }

  const highlightImageAlt =
    highlightImageFilename
      ? rawHighlightImageAlt
      : null

  const highlightImageCaption =
    highlightImageFilename
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
      citation,
      highlight_text:
        highlightText,
      highlight_image_filename:
        highlightImageFilename,
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
