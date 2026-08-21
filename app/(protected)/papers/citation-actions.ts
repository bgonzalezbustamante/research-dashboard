'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

function getOptionalDate(
  formData: FormData,
  name: string
) {
  const value = getRequiredText(
    formData,
    name
  )

  if (!value) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null
}

function getNonNegativeInteger(
  formData: FormData,
  name: string
) {
  const value = getRequiredText(
    formData,
    name
  )

  if (!/^\d+$/.test(value)) {
    return null
  }

  const parsed = Number.parseInt(
    value,
    10
  )

  return Number.isSafeInteger(parsed)
    ? parsed
    : null
}

function getAmsterdamDate() {
  const parts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(new Date())

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    )

  return `${values.year}-${values.month}-${values.day}`
}

async function requireAuth() {
  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase.auth.getClaims()

  if (
    error ||
    !data?.claims
  ) {
    redirect('/login')
  }

  return supabase
}

function redirectWithError(
  paperId: string,
  message: string
): never {
  redirect(
    `/papers/${paperId}?citationError=${encodeURIComponent(
      message
    )}#citations`
  )
}

function redirectToCitations(
  paperId: string
): never {
  redirect(
    `/papers/${paperId}#citations`
  )
}

function getCitationPayload(
  formData: FormData
) {
  const source =
    getRequiredText(
      formData,
      'source'
    ) || 'Google Scholar'

  const citationCount =
    getNonNegativeInteger(
      formData,
      'citation_count'
    )

  if (citationCount === null) {
    return {
      error:
        'Citation count must be a non-negative whole number.',
    }
  }

  return {
    payload: {
      source,
      citationCount,
      capturedOn:
        getOptionalDate(
          formData,
          'captured_on'
        ) ?? getAmsterdamDate(),
    },
  }
}

export async function createCitationSnapshot(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  if (!paperId) {
    redirect('/papers')
  }

  const result =
    getCitationPayload(
      formData
    )

  if (!result.payload) {
    redirectWithError(
      paperId,
      result.error ??
        'Invalid citation snapshot.'
    )
  }

  const payload =
    result.payload

  const {
    data,
    error,
  } = await supabase
    .from('citation_snapshots')
    .insert({
      paper_id: paperId,
      source:
        payload.source,
      citation_count:
        payload.citationCount,
      captured_on:
        payload.capturedOn,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Citation snapshot creation failed:',
      error
    )

    if (error?.code === '23505') {
      redirectWithError(
        paperId,
        'A citation snapshot for this source and date already exists.'
      )
    }

    redirectWithError(
      paperId,
      'The citation snapshot could not be created.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  revalidatePath('/papers')

  redirectToCitations(
    paperId
  )
}

export async function updateCitationSnapshot(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const snapshotId =
    getRequiredText(
      formData,
      'snapshot_id'
    )

  if (
    !paperId ||
    !snapshotId
  ) {
    redirect('/papers')
  }

  const result =
    getCitationPayload(
      formData
    )

  if (!result.payload) {
    redirectWithError(
      paperId,
      result.error ??
        'Invalid citation snapshot.'
    )
  }

  const payload =
    result.payload

  const {
    data,
    error,
  } = await supabase
    .from('citation_snapshots')
    .update({
      source:
        payload.source,
      citation_count:
        payload.citationCount,
      captured_on:
        payload.capturedOn,
    })
    .eq('id', snapshotId)
    .eq('paper_id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Citation snapshot update failed:',
      error
    )

    if (error?.code === '23505') {
      redirectWithError(
        paperId,
        'A citation snapshot for this source and date already exists.'
      )
    }

    redirectWithError(
      paperId,
      'The citation snapshot could not be updated.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  revalidatePath('/papers')

  redirectToCitations(
    paperId
  )
}

export async function deleteCitationSnapshot(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const snapshotId =
    getRequiredText(
      formData,
      'snapshot_id'
    )

  if (
    !paperId ||
    !snapshotId
  ) {
    redirect('/papers')
  }

  const {
    data,
    error,
  } = await supabase
    .from('citation_snapshots')
    .delete()
    .eq('id', snapshotId)
    .eq('paper_id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Citation snapshot deletion failed:',
      error
    )

    redirectWithError(
      paperId,
      'The citation snapshot could not be deleted.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  revalidatePath('/papers')

  redirectToCitations(
    paperId
  )
}