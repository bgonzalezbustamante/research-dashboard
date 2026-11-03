'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { externalPublicationLanguages } from '@/lib/projects/external-publications'
import { createClient } from '@/lib/supabase/server'

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

function publicationsRedirect(
  key:
    | 'error'
    | 'created'
    | 'saved'
    | 'deleted',
  value: string
): never {
  redirect(
    `/projects/publications?${key}=${encodeURIComponent(
      value
    )}`
  )
}

type ExternalPublicationFields = {
  p_title: string
  p_authors: string[]
  p_publication_year: number
  p_published_on: string | null
  p_venue: string | null
  p_doi_url: string | null
  p_publication_url: string | null
  p_language: string | null
  p_visibility: string
  p_project_ids: string[]
}

function readExternalPublicationFields(
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
      p_project_ids:
        getUuidList(
          formData,
          'project_id'
        ),
    },
  }
}

function revalidateProjectPublications() {
  revalidatePath(
    '/projects/publications'
  )
  revalidatePath('/projects')
}

export async function createExternalPublication(
  formData: FormData
) {
  await requireDashboardOwner()

  const result =
    readExternalPublicationFields(
      formData
    )

  if (!result.fields) {
    publicationsRedirect(
      'error',
      result.error ??
        'The external publication is invalid.'
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'create_external_publication',
      result.fields
    )

  if (error) {
    console.error(
      'External publication creation failed:',
      error
    )

    publicationsRedirect(
      'error',
      'The external publication could not be created.'
    )
  }

  revalidateProjectPublications()

  publicationsRedirect(
    'created',
    '1'
  )
}

export async function updateExternalPublication(
  formData: FormData
) {
  await requireDashboardOwner()

  const id =
    getRequiredText(
      formData,
      'id'
    )

  if (!id) {
    publicationsRedirect(
      'error',
      'External publication ID is required.'
    )
  }

  const result =
    readExternalPublicationFields(
      formData
    )

  if (!result.fields) {
    publicationsRedirect(
      'error',
      result.error ??
        'The external publication is invalid.'
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'update_external_publication',
      {
        p_id: id,
        ...result.fields,
      }
    )

  if (error) {
    console.error(
      'External publication update failed:',
      error
    )

    publicationsRedirect(
      'error',
      'The external publication could not be saved.'
    )
  }

  revalidateProjectPublications()

  publicationsRedirect(
    'saved',
    '1'
  )
}

export async function deleteExternalPublication(
  formData: FormData
) {
  await requireDashboardOwner()

  const id =
    getRequiredText(
      formData,
      'id'
    )

  if (!id) {
    publicationsRedirect(
      'error',
      'External publication ID is required.'
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'delete_external_publication',
      {
        p_id: id,
      }
    )

  if (error) {
    console.error(
      'External publication deletion failed:',
      error
    )

    publicationsRedirect(
      'error',
      'The external publication could not be deleted.'
    )
  }

  revalidateProjectPublications()

  publicationsRedirect(
    'deleted',
    '1'
  )
}
