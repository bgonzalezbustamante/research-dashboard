// Website card content fields shared by the Owner Website section and the
// restricted Website Editor form. Database CHECK constraints remain the
// authoritative validation; these checks give friendlier messages first.

export const publicationIndexes = [
  'WoS-SSCI',
  'Scopus',
  'WoS-ESCI',
  'Book chapter',
  'SciELO/Latindex',
  'Working paper',
  'Preprint',
  'Dataset',
] as const

const allowedPublicationIndexes =
  new Set<string>(
    publicationIndexes
  )

const assetFilenamePattern =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|webp|jpg|jpeg)$/i

export type PaperWebsiteContent = {
  publication_index: string | null
  citation: string | null
  highlight_text: string | null
  highlight_image_filename: string | null
  highlight_image_alt: string | null
  highlight_image_caption: string | null
}

export type PaperWebsiteContentResult =
  | {
      content: PaperWebsiteContent
      error?: never
    }
  | {
      content?: never
      error: string
    }

function getOptionalText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

export function readPaperWebsiteContent(
  formData: FormData
): PaperWebsiteContentResult {
  const publicationIndex =
    getOptionalText(
      formData,
      'publication_index'
    )

  if (
    publicationIndex &&
    !allowedPublicationIndexes.has(
      publicationIndex
    )
  ) {
    return {
      error:
        'Invalid publication index category.',
    }
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
    return {
      error:
        'Citation must be 2,000 characters or fewer.',
    }
  }

  if (
    highlightText &&
    highlightText.length > 2000
  ) {
    return {
      error:
        'Key highlight text must be 2,000 characters or fewer.',
    }
  }

  if (
    highlightImageFilename &&
    !assetFilenamePattern.test(
      highlightImageFilename
    )
  ) {
    return {
      error:
        'Key highlight image must be a single PNG, WebP, JPG, or JPEG filename without folders.',
    }
  }

  if (
    highlightImageFilename &&
    !rawHighlightImageAlt
  ) {
    return {
      error:
        'Image alt text is required when a Key highlight image filename is configured.',
    }
  }

  if (
    rawHighlightImageAlt &&
    rawHighlightImageAlt.length >
      500
  ) {
    return {
      error:
        'Image alt text must be 500 characters or fewer.',
    }
  }

  if (
    rawHighlightImageCaption &&
    rawHighlightImageCaption.length >
      500
  ) {
    return {
      error:
        'Image caption must be 500 characters or fewer.',
    }
  }

  return {
    content: {
      publication_index:
        publicationIndex,
      citation,
      highlight_text:
        highlightText,
      highlight_image_filename:
        highlightImageFilename,
      highlight_image_alt:
        highlightImageFilename
          ? rawHighlightImageAlt
          : null,
      highlight_image_caption:
        highlightImageFilename
          ? rawHighlightImageCaption
          : null,
    },
  }
}
