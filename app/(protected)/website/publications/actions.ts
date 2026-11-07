'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireWebsiteEditorAccess } from '@/lib/auth/dashboard-access'
import {
  editorPendingPublicationLimit,
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

function editorPublicationsRedirect(
  key:
    | 'error'
    | 'created'
    | 'saved'
    | 'deleted',
  value: string
): never {
  redirect(
    `/website/publications?${key}=${encodeURIComponent(
      value
    )}`
  )
}

// Editors submit bibliographic fields only: the RPCs force Private
// visibility and never link Projects.
function readEditorPublicationFields(
  formData: FormData
) {
  const result =
    readExternalPublicationFields(
      formData
    )

  if (!result.fields) {
    editorPublicationsRedirect(
      'error',
      result.error ??
        'The publication is invalid.'
    )
  }

  const { fields } = result

  return {
    p_title: fields.p_title,
    p_authors: fields.p_authors,
    p_publication_year:
      fields.p_publication_year,
    p_published_on:
      fields.p_published_on,
    p_venue: fields.p_venue,
    p_doi_url: fields.p_doi_url,
    p_publication_url:
      fields.p_publication_url,
    p_language: fields.p_language,
  }
}

function revalidateEditorPublications() {
  revalidatePath(
    '/website/publications'
  )
  revalidatePath('/website')
}

export async function createMyExternalPublication(
  formData: FormData
) {
  await requireWebsiteEditorAccess()

  const fields =
    readEditorPublicationFields(
      formData
    )

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'create_my_external_publication',
      fields
    )

  if (error) {
    console.error(
      'Editor publication creation failed:',
      error
    )

    editorPublicationsRedirect(
      'error',
      error.code === '53400'
        ? `You already have ${editorPendingPublicationLimit} publications awaiting review. Add more once the Dashboard Owner has reviewed some of them.`
        : 'The publication could not be added.'
    )
  }

  revalidateEditorPublications()

  editorPublicationsRedirect(
    'created',
    '1'
  )
}

export async function updateMyExternalPublication(
  formData: FormData
) {
  await requireWebsiteEditorAccess()

  const id =
    getRequiredText(
      formData,
      'id'
    )

  if (!id) {
    editorPublicationsRedirect(
      'error',
      'Publication ID is required.'
    )
  }

  const fields =
    readEditorPublicationFields(
      formData
    )

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'update_my_external_publication',
      {
        p_id: id,
        ...fields,
      }
    )

  if (error) {
    console.error(
      'Editor publication update failed:',
      error
    )

    editorPublicationsRedirect(
      'error',
      error.code === '42501'
        ? 'Only your own publications can be edited.'
        : 'The publication could not be saved.'
    )
  }

  revalidateEditorPublications()

  editorPublicationsRedirect(
    'saved',
    '1'
  )
}

export async function deleteMyExternalPublication(
  formData: FormData
) {
  await requireWebsiteEditorAccess()

  const id =
    getRequiredText(
      formData,
      'id'
    )

  if (!id) {
    editorPublicationsRedirect(
      'error',
      'Publication ID is required.'
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'delete_my_external_publication',
      {
        p_id: id,
      }
    )

  if (error) {
    console.error(
      'Editor publication deletion failed:',
      error
    )

    editorPublicationsRedirect(
      'error',
      error.code === '42501'
        ? 'Only your own publications can be deleted, and only while they are awaiting review.'
        : 'The publication could not be deleted.'
    )
  }

  revalidateEditorPublications()

  editorPublicationsRedirect(
    'deleted',
    '1'
  )
}
