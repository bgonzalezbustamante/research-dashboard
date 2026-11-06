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
