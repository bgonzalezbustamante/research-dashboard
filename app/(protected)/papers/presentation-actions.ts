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

function getOptionalText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}

function getOptionalDate(
  formData: FormData,
  name: string
) {
  const value = getOptionalText(
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

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
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
    `/papers/${paperId}?presentationError=${encodeURIComponent(
      message
    )}#presentations`
  )
}

function redirectToPresentations(
  paperId: string
): never {
  redirect(
    `/papers/${paperId}#presentations`
  )
}

function getPresentationPayload(
  formData: FormData
) {
  const eventName =
    getRequiredText(
      formData,
      'event_name'
    )

  if (!eventName) {
    return {
      error:
        'Conference or event name is required.',
    }
  }

  const url =
    getOptionalText(
      formData,
      'url'
    )

  if (
    url &&
    !isValidHttpUrl(url)
  ) {
    return {
      error:
        'Presentation URL must be a valid HTTP or HTTPS URL.',
    }
  }

  return {
    payload: {
      eventName,
      location:
        getOptionalText(
          formData,
          'location'
        ),
      presentationDate:
        getOptionalDate(
          formData,
          'presentation_date'
        ),
      presentationTitle:
        getOptionalText(
          formData,
          'presentation_title'
        ),
      presentationType:
        getOptionalText(
          formData,
          'presentation_type'
        ),
      url,
      notes:
        getOptionalText(
          formData,
          'notes'
        ),
    },
  }
}

export async function createPresentation(
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
    getPresentationPayload(
      formData
    )

  if (!result.payload) {
    redirectWithError(
      paperId,
      result.error ??
        'Invalid presentation.'
    )
  }

  const payload =
    result.payload

  const {
    data,
    error,
  } = await supabase
    .from('paper_presentations')
    .insert({
      paper_id: paperId,
      event_name:
        payload.eventName,
      location:
        payload.location,
      presentation_date:
        payload.presentationDate,
      presentation_title:
        payload.presentationTitle,
      presentation_type:
        payload.presentationType,
      url:
        payload.url,
      notes:
        payload.notes,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Presentation creation failed:',
      error
    )

    redirectWithError(
      paperId,
      'The presentation could not be created.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToPresentations(
    paperId
  )
}

export async function updatePresentation(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const presentationId =
    getRequiredText(
      formData,
      'presentation_id'
    )

  if (
    !paperId ||
    !presentationId
  ) {
    redirect('/papers')
  }

  const result =
    getPresentationPayload(
      formData
    )

  if (!result.payload) {
    redirectWithError(
      paperId,
      result.error ??
        'Invalid presentation.'
    )
  }

  const payload =
    result.payload

  const {
    data,
    error,
  } = await supabase
    .from('paper_presentations')
    .update({
      event_name:
        payload.eventName,
      location:
        payload.location,
      presentation_date:
        payload.presentationDate,
      presentation_title:
        payload.presentationTitle,
      presentation_type:
        payload.presentationType,
      url:
        payload.url,
      notes:
        payload.notes,
    })
    .eq(
      'id',
      presentationId
    )
    .eq(
      'paper_id',
      paperId
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Presentation update failed:',
      error
    )

    redirectWithError(
      paperId,
      'The presentation could not be updated.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToPresentations(
    paperId
  )
}

export async function deletePresentation(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const presentationId =
    getRequiredText(
      formData,
      'presentation_id'
    )

  if (
    !paperId ||
    !presentationId
  ) {
    redirect('/papers')
  }

  const {
    data,
    error,
  } = await supabase
    .from('paper_presentations')
    .delete()
    .eq(
      'id',
      presentationId
    )
    .eq(
      'paper_id',
      paperId
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Presentation deletion failed:',
      error
    )

    redirectWithError(
      paperId,
      'The presentation could not be deleted.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToPresentations(
    paperId
  )
}