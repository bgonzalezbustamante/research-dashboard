'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import {
  publicSlugPattern,
  readExternalPublicationFields,
} from '@/lib/papers/external-publications'
import { createClient } from '@/lib/supabase/server'

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

function otherPapersRedirect(
  key:
    | 'error'
    | 'created'
    | 'saved'
    | 'deleted'
    | 'approved'
    | 'collection',
  value: string
): never {
  redirect(
    `/papers/others?${key}=${encodeURIComponent(
      value
    )}`
  )
}

function revalidateOtherPapers() {
  revalidatePath('/papers/others')
  revalidatePath('/projects')
}

const stalePublicationMessage =
  'This publication changed since you opened the page. Review the latest version and try again.'

// Guards Owner saves against lost updates: a Website Editor may edit their
// own publication while the Owner has the page open, so the form carries the
// updated_at it was rendered from and the save is refused if it moved on.
async function assertPublicationUnchanged(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  ownerId: string,
  id: string,
  expectedUpdatedAt: string | null
) {
  const {
    data,
    error,
  } = await supabase
    .from('external_publications')
    .select('updated_at')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error || !data) {
    otherPapersRedirect(
      'error',
      'That external publication was not found.'
    )
  }

  if (
    !expectedUpdatedAt ||
    data.updated_at !==
      expectedUpdatedAt
  ) {
    otherPapersRedirect(
      'error',
      stalePublicationMessage
    )
  }
}

function publicationErrorMessage(
  code: string | undefined,
  fallback: string
) {
  return code === '23505'
    ? 'That public slug is already in use by another external publication.'
    : fallback
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
    otherPapersRedirect(
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

    otherPapersRedirect(
      'error',
      publicationErrorMessage(
        error.code,
        'The external publication could not be created.'
      )
    )
  }

  revalidateOtherPapers()

  otherPapersRedirect(
    'created',
    '1'
  )
}

export async function updateExternalPublication(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const id =
    getRequiredText(
      formData,
      'id'
    )

  if (!id) {
    otherPapersRedirect(
      'error',
      'External publication ID is required.'
    )
  }

  const result =
    readExternalPublicationFields(
      formData
    )

  if (!result.fields) {
    otherPapersRedirect(
      'error',
      result.error ??
        'The external publication is invalid.'
    )
  }

  const supabase =
    await createClient()

  await assertPublicationUnchanged(
    supabase,
    access.ownerId,
    id,
    getOptionalText(
      formData,
      'expected_updated_at'
    )
  )

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

    otherPapersRedirect(
      'error',
      publicationErrorMessage(
        error.code,
        'The external publication could not be saved.'
      )
    )
  }

  revalidateOtherPapers()

  otherPapersRedirect(
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
    otherPapersRedirect(
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

    otherPapersRedirect(
      'error',
      'The external publication could not be deleted.'
    )
  }

  revalidateOtherPapers()

  otherPapersRedirect(
    'deleted',
    '1'
  )
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

export async function approveExternalPublication(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const id =
    getRequiredText(
      formData,
      'id'
    )

  if (!id) {
    otherPapersRedirect(
      'error',
      'External publication ID is required.'
    )
  }

  const slug =
    getRequiredText(
      formData,
      'slug'
    ).toLowerCase()

  if (
    slug.length === 0 ||
    slug.length > 200 ||
    !publicSlugPattern.test(slug)
  ) {
    otherPapersRedirect(
      'error',
      'A public slug is required: lowercase letters, numbers, and single hyphens only.'
    )
  }

  const supabase =
    await createClient()

  const {
    data: publication,
    error: loadError,
  } = await supabase
    .from('external_publications')
    .select(
      'title, authors, venue, publication_year, published_on, doi_url, publication_url, language, visibility, updated_at'
    )
    .eq('id', id)
    .eq('owner_id', access.ownerId)
    .maybeSingle()

  if (loadError || !publication) {
    otherPapersRedirect(
      'error',
      'That external publication was not found.'
    )
  }

  if (
    publication.visibility !==
    'private'
  ) {
    otherPapersRedirect(
      'error',
      'That external publication is already published.'
    )
  }

  // Approve publishes exactly the version the Owner reviewed.
  if (
    publication.updated_at !==
    getOptionalText(
      formData,
      'expected_updated_at'
    )
  ) {
    otherPapersRedirect(
      'error',
      stalePublicationMessage
    )
  }

  // Publishing reuses the Owner update RPC so visibility, slug, collections
  // and Projects change together in one transaction.
  const { error } =
    await supabase.rpc(
      'update_external_publication',
      {
        p_id: id,
        p_title: publication.title,
        p_authors: publication.authors,
        p_publication_year:
          publication.publication_year,
        p_published_on:
          publication.published_on,
        p_venue: publication.venue,
        p_doi_url: publication.doi_url,
        p_publication_url:
          publication.publication_url,
        p_language: publication.language,
        p_visibility: 'public',
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
      }
    )

  if (error) {
    console.error(
      'External publication approval failed:',
      error
    )

    otherPapersRedirect(
      'error',
      publicationErrorMessage(
        error.code,
        'The external publication could not be published.'
      )
    )
  }

  revalidateOtherPapers()
  revalidatePath(
    '/website/publications'
  )

  otherPapersRedirect(
    'approved',
    '1'
  )
}

function readCollectionFields(
  formData: FormData
) {
  const name =
    getRequiredText(
      formData,
      'name'
    )

  if (
    name.length === 0 ||
    name.length > 200
  ) {
    otherPapersRedirect(
      'error',
      'Collection name is required and must be 200 characters or fewer.'
    )
  }

  const slug =
    getRequiredText(
      formData,
      'slug'
    ).toLowerCase()

  if (
    slug.length === 0 ||
    slug.length > 100 ||
    !publicSlugPattern.test(slug)
  ) {
    otherPapersRedirect(
      'error',
      'Collection slug must use lowercase letters, numbers, and single hyphens only.'
    )
  }

  const description =
    getOptionalText(
      formData,
      'description'
    )

  if (
    description &&
    description.length > 1000
  ) {
    otherPapersRedirect(
      'error',
      'Collection description must be 1,000 characters or fewer.'
    )
  }

  return {
    name,
    slug,
    description,
  }
}

function collectionErrorMessage(
  code: string | undefined,
  fallback: string
) {
  return code === '23505'
    ? 'That collection slug is already in use.'
    : fallback
}

export async function createExternalPublicationCollection(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const fields =
    readCollectionFields(
      formData
    )

  const supabase =
    await createClient()

  const { error } =
    await supabase
      .from(
        'external_publication_collections'
      )
      .insert({
        owner_id: access.ownerId,
        ...fields,
      })

  if (error) {
    console.error(
      'Collection creation failed:',
      error
    )

    otherPapersRedirect(
      'error',
      collectionErrorMessage(
        error.code,
        'The collection could not be created.'
      )
    )
  }

  revalidateOtherPapers()

  otherPapersRedirect(
    'collection',
    'created'
  )
}

export async function updateExternalPublicationCollection(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const id =
    getRequiredText(
      formData,
      'id'
    )

  if (!id) {
    otherPapersRedirect(
      'error',
      'Collection ID is required.'
    )
  }

  const fields =
    readCollectionFields(
      formData
    )

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from(
      'external_publication_collections'
    )
    .update(fields)
    .eq('id', id)
    .eq('owner_id', access.ownerId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Collection update failed:',
      error
    )

    otherPapersRedirect(
      'error',
      collectionErrorMessage(
        error?.code,
        'The collection could not be saved.'
      )
    )
  }

  revalidateOtherPapers()

  otherPapersRedirect(
    'collection',
    'saved'
  )
}

export async function deleteExternalPublicationCollection(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const id =
    getRequiredText(
      formData,
      'id'
    )

  if (!id) {
    otherPapersRedirect(
      'error',
      'Collection ID is required.'
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase
      .from(
        'external_publication_collections'
      )
      .delete()
      .eq('id', id)
      .eq('owner_id', access.ownerId)

  if (error) {
    console.error(
      'Collection deletion failed:',
      error
    )

    otherPapersRedirect(
      'error',
      'The collection could not be deleted.'
    )
  }

  revalidateOtherPapers()

  otherPapersRedirect(
    'collection',
    'deleted'
  )
}
