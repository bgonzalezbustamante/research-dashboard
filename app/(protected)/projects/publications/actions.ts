'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { readExternalPublicationFields } from '@/lib/projects/external-publications'
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
