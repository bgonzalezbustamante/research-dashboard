// Values mirror the external_publications_language_check constraint, which
// reuses the Paper language vocabulary.
export const externalPublicationLanguages = [
  'English',
  'Spanish',
  'Portuguese',
  'Dutch',
  'German',
  'French',
  'Italian',
] as const

export type ExternalPublicationRow = {
  id: string
  title: string
  authors: string[]
  venue: string | null
  publication_year: number
  published_on: string | null
  doi_url: string | null
  publication_url: string | null
  language: string | null
  visibility: 'private' | 'public'
  slug?: string | null
  created_by?: string | null
  editor_edited_at?: string | null
}

export type ExternalPublicationCollectionRow = {
  id: string
  slug: string
  name: string
  description: string | null
}

export const publicSlugPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Suggests a public slug such as "partner-study-on-voting-2025" from a title
// and year: accents removed, lowercase, single hyphens, about 80 characters.
export function suggestExternalPublicationSlug(
  title: string,
  year: number
) {
  const words =
    title
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)

  const kept: string[] = []

  for (const word of words) {
    if (
      [...kept, word].join('-').length > 80
    ) {
      break
    }

    kept.push(word)
  }

  return [
    ...kept,
    String(year),
  ].join('-')
}

const allowedLanguages =
  new Set<string>(
    externalPublicationLanguages
  )

const allowedVisibilities = new Set([
  'private',
  'public',
])

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

function isValidHttpUrl(
  value: string
) {
  try {
    const url =
      new URL(value)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

function getUuidList(
  formData: FormData,
  name: string
) {
  return formData
    .getAll(name)
    .filter(
      (value):
        value is string =>
        typeof value ===
        'string'
    )
    .map((value) =>
      value.trim()
    )
    .filter(Boolean)
}

export type ExternalPublicationFields = {
  p_title: string
  p_authors: string[]
  p_publication_year: number
  p_published_on: string | null
  p_venue: string | null
  p_doi_url: string | null
  p_publication_url: string | null
  p_language: string | null
  p_visibility: string
  p_slug: string | null
  p_project_ids: string[]
  p_collection_ids: string[]
}

export function readExternalPublicationFields(
  formData: FormData
):
  | {
      fields: ExternalPublicationFields
      error?: never
    }
  | {
      fields?: never
      error: string
    } {
  const title =
    getRequiredText(
      formData,
      'title'
    )

  if (
    title.length === 0 ||
    title.length > 500
  ) {
    return {
      error:
        'Title is required and must be 500 characters or fewer.',
    }
  }

  const authors =
    getRequiredText(
      formData,
      'authors'
    )
      .split(/\r?\n/)
      .map((author) =>
        author.trim()
      )
      .filter(Boolean)

  if (
    authors.length === 0 ||
    authors.length > 100
  ) {
    return {
      error:
        'Enter between 1 and 100 authors, one per line.',
    }
  }

  const publicationYear =
    Number.parseInt(
      getRequiredText(
        formData,
        'publication_year'
      ),
      10
    )

  if (
    !Number.isInteger(
      publicationYear
    ) ||
    publicationYear < 1900 ||
    publicationYear > 2100
  ) {
    return {
      error:
        'Publication year must be between 1900 and 2100.',
    }
  }

  const publishedOn =
    getOptionalText(
      formData,
      'published_on'
    )

  if (
    publishedOn &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(
      publishedOn
    ) ||
      Number(
        publishedOn.slice(0, 4)
      ) !== publicationYear)
  ) {
    return {
      error:
        'The publication date must fall in the publication year.',
    }
  }

  const venue =
    getOptionalText(
      formData,
      'venue'
    )

  if (
    venue &&
    venue.length > 300
  ) {
    return {
      error:
        'Venue must be 300 characters or fewer.',
    }
  }

  const doiUrl =
    getOptionalText(
      formData,
      'doi_url'
    )

  const publicationUrl =
    getOptionalText(
      formData,
      'publication_url'
    )

  for (const url of [
    doiUrl,
    publicationUrl,
  ]) {
    if (
      url &&
      (!isValidHttpUrl(url) ||
        url.length > 2048)
    ) {
      return {
        error:
          'DOI and publication links must be absolute HTTP(S) URLs.',
      }
    }
  }

  const language =
    getOptionalText(
      formData,
      'language'
    )

  if (
    language &&
    !allowedLanguages.has(
      language
    )
  ) {
    return {
      error:
        'Invalid publication language.',
    }
  }

  const visibility =
    getRequiredText(
      formData,
      'visibility'
    ) || 'private'

  if (
    !allowedVisibilities.has(
      visibility
    )
  ) {
    return {
      error:
        'Invalid public visibility.',
    }
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
    (slug.length > 200 ||
      !publicSlugPattern.test(slug))
  ) {
    return {
      error:
        'Slug must use lowercase letters, numbers, and single hyphens only.',
    }
  }

  if (
    visibility === 'public' &&
    !slug
  ) {
    return {
      error:
        'Public external publications require a slug.',
    }
  }

  return {
    fields: {
      p_title: title,
      p_authors: authors,
      p_publication_year:
        publicationYear,
      p_published_on:
        publishedOn,
      p_venue: venue,
      p_doi_url: doiUrl,
      p_publication_url:
        publicationUrl,
      p_language: language,
      p_visibility: visibility,
      p_slug: slug,
      p_project_ids:
        getUuidList(
          formData,
          'project_id'
        ),
      p_collection_ids:
        getUuidList(
          formData,
          'collection_id'
        ),
    },
  }
}
