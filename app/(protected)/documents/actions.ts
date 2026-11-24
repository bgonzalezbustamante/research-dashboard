'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import {
  parseLegacyImport,
  parseSignerManifest,
} from '@/lib/documents/manifest'
import { createClient } from '@/lib/supabase/server'

function getText(
  formData: FormData,
  name: string
) {
  const value =
    formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

/** A chosen file takes precedence over pasted text. */
async function getUploadOrText(
  formData: FormData,
  fileName: string,
  textName: string
) {
  const file =
    formData.get(fileName)

  if (
    file instanceof File &&
    file.size > 0
  ) {
    if (file.size > 500_000) {
      return null
    }

    return (
      await file.text()
    ).trim()
  }

  return getText(
    formData,
    textName
  )
}

function documentsRedirect(
  key:
    | 'error'
    | 'registered'
    | 'revoked'
    | 'removed'
    | 'imported',
  value: string
): never {
  redirect(
    `/documents?${key}=${encodeURIComponent(
      value
    )}`
  )
}

function revalidateDocuments() {
  revalidatePath('/documents')
  revalidatePath('/dashboard/access')
}

export async function registerSignedDocument(
  formData: FormData
) {
  await requireDashboardOwner()

  const text =
    await getUploadOrText(
      formData,
      'manifest_file',
      'manifest'
    )

  if (!text) {
    documentsRedirect(
      'error',
      'Choose a manifest file or paste its contents (500 KB at most).'
    )
  }

  const manifest =
    parseSignerManifest(text)

  if (!manifest.ok) {
    documentsRedirect(
      'error',
      manifest.error
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'register_signed_document',
      {
        p_code:
          manifest.value.code,
        p_title:
          manifest.value.title,
        p_issued_at:
          manifest.value.issuedAt,
        p_sha256:
          manifest.value.sha256,
      }
    )

  if (error) {
    console.error(
      'Document registration failed:',
      error
    )

    documentsRedirect(
      'error',
      error.code === '23505'
        ? 'A document with this code is already registered.'
        : error.code === '23514'
          ? 'The manifest contains a value the registry does not accept.'
          : 'The document could not be registered.'
    )
  }

  revalidateDocuments()
  documentsRedirect(
    'registered',
    manifest.value.code
  )
}

export async function revokeSignedDocument(
  formData: FormData
) {
  await requireDashboardOwner()

  const code =
    getText(
      formData,
      'code'
    )

  const note =
    getText(
      formData,
      'note'
    )

  if (note.length > 1000) {
    documentsRedirect(
      'error',
      'The revocation note can have 1,000 characters at most.'
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'revoke_signed_document',
      {
        p_code:
          code,
        p_note:
          note || null,
      }
    )

  if (error) {
    console.error(
      'Document revocation failed:',
      error
    )

    documentsRedirect(
      'error',
      error.code === 'P0002'
        ? 'No registered document has this code; it may already be revoked.'
        : 'The document could not be revoked.'
    )
  }

  revalidateDocuments()
  documentsRedirect(
    'revoked',
    code
  )
}

export async function removeSignedDocument(
  formData: FormData
) {
  await requireDashboardOwner()

  const code =
    getText(
      formData,
      'code'
    )

  if (
    formData.get('confirm_test') !==
    'yes'
  ) {
    documentsRedirect(
      'error',
      'Confirm that this was a test document that was never issued. Revoke issued documents instead.'
    )
  }

  const supabase =
    await createClient()

  const { error } =
    await supabase.rpc(
      'remove_signed_document',
      {
        p_code:
          code,
      }
    )

  if (error) {
    console.error(
      'Document removal failed:',
      error
    )

    documentsRedirect(
      'error',
      error.code === 'P0002'
        ? 'No document has this code.'
        : 'The document could not be removed.'
    )
  }

  revalidateDocuments()
  documentsRedirect(
    'removed',
    code
  )
}

export async function importLegacyDocuments(
  formData: FormData
) {
  await requireDashboardOwner()

  const text =
    await getUploadOrText(
      formData,
      'legacy_file',
      'legacy'
    )

  if (!text) {
    documentsRedirect(
      'error',
      'Choose a file or paste the historical records (500 KB at most).'
    )
  }

  const records =
    parseLegacyImport(text)

  if (!records.ok) {
    documentsRedirect(
      'error',
      records.error
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase.rpc(
    'import_legacy_documents',
    {
      p_rows:
        records.value,
    }
  )

  if (error) {
    console.error(
      'Historical record import failed:',
      error
    )

    documentsRedirect(
      'error',
      error.code === '23514'
        ? 'A historical record contains a value the registry does not accept.'
        : 'The historical records could not be imported.'
    )
  }

  revalidateDocuments()
  documentsRedirect(
    'imported',
    String(data ?? records.value.length)
  )
}
