'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardOwner } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

const allowedPresentationTypes =
  new Set([
    'Conference paper',
    'Keynote',
    'Workshop',
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
    getRequiredText(
      formData,
      name
    )

  return value.length > 0
    ? value
    : null
}

function parseAuthors(
  formData: FormData
) {
  const raw =
    getRequiredText(
      formData,
      'authors'
    )

  const seen = new Set<string>()

  return raw
    .split(/\r?\n/)
    .map((author) =>
      author.trim()
    )
    .filter(Boolean)
    .filter((author) => {
      const key =
        author.toLocaleLowerCase()

      if (seen.has(key)) {
        return false
      }

      seen.add(key)

      return true
    })
}

function getOptionalDate(
  formData: FormData,
  name: string
) {
  const value =
    getOptionalText(
      formData,
      name
    )

  if (!value) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  )
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

function conferencesRedirect(
  key:
    | 'error'
    | 'created'
    | 'saved'
    | 'deleted',
  value: string
): never {
  redirect(
    `/conferences?${key}=${encodeURIComponent(
      value
    )}`
  )
}

function validateConferenceFields(
  formData: FormData
) {
  const eventName =
    getRequiredText(
      formData,
      'event_name'
    )

  if (!eventName) {
    return {
      ok: false as const,
      error:
        'Conference or event name is required.',
    }
  }

  const eventShortName =
    getRequiredText(
      formData,
      'event_short_name'
    )

  if (!eventShortName) {
    return {
      ok: false as const,
      error:
        'Conference or event short name is required.',
    }
  }

  const startDate =
    getOptionalDate(
      formData,
      'start_date'
    )

  const endDate =
    getOptionalDate(
      formData,
      'end_date'
    )

  if (!startDate || !endDate) {
    return {
      ok: false as const,
      error:
        'Conference start and end dates are required.',
    }
  }

  if (endDate < startDate) {
    return {
      ok: false as const,
      error:
        'Conference end date cannot be earlier than the start date.',
    }
  }

  const presentationType =
    getRequiredText(
      formData,
      'presentation_type'
    )

  if (
    !allowedPresentationTypes.has(
      presentationType
    )
  ) {
    return {
      ok: false as const,
      error:
        'Presentation type must be Conference paper, Keynote, or Workshop.',
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
      ok: false as const,
      error:
        'Presentation URL must be a valid HTTP or HTTPS URL.',
    }
  }

  return {
    ok: true as const,
    eventName,
    eventShortName,
    paperId:
      getOptionalText(
        formData,
        'paper_id'
      ),
    location:
      getOptionalText(
        formData,
        'location'
      ),
    startDate,
    endDate,
    presentationTitle:
      getOptionalText(
        formData,
        'presentation_title'
      ),
    authors:
      parseAuthors(formData),
    presentationType,
    url,
    notes:
      getOptionalText(
        formData,
        'notes'
      ),
  }
}

export async function createConferencePresentation(
  formData: FormData
) {
  const access =
    await requireDashboardOwner()

  const fields =
    validateConferenceFields(
      formData
    )

  if (!fields.ok) {
    conferencesRedirect(
      'error',
      fields.error
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from(
      'conference_presentations'
    )
    .insert({
      owner_id:
        access.ownerId,
      paper_id:
        fields.paperId,
      event_name:
        fields.eventName,
      event_short_name:
        fields.eventShortName,
      location:
        fields.location,
      start_date:
        fields.startDate,
      end_date:
        fields.endDate,
      presentation_title:
        fields.presentationTitle,
      authors:
        fields.authors,
      presentation_type:
        fields.presentationType,
      url:
        fields.url,
      notes:
        fields.notes,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Conference presentation creation failed:',
      error
    )

    conferencesRedirect(
      'error',
      'The conference presentation could not be created.'
    )
  }

  revalidatePath(
    '/conferences'
  )

  conferencesRedirect(
    'created',
    data.id
  )
}

export async function updateConferencePresentation(
  formData: FormData
) {
  await requireDashboardOwner()

  const presentationId =
    getRequiredText(
      formData,
      'presentation_id'
    )

  if (!presentationId) {
    conferencesRedirect(
      'error',
      'Conference presentation ID is required.'
    )
  }

  const fields =
    validateConferenceFields(
      formData
    )

  if (!fields.ok) {
    conferencesRedirect(
      'error',
      fields.error
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from(
      'conference_presentations'
    )
    .update({
      paper_id:
        fields.paperId,
      event_name:
        fields.eventName,
      event_short_name:
        fields.eventShortName,
      location:
        fields.location,
      start_date:
        fields.startDate,
      end_date:
        fields.endDate,
      presentation_title:
        fields.presentationTitle,
      authors:
        fields.authors,
      presentation_type:
        fields.presentationType,
      url:
        fields.url,
      notes:
        fields.notes,
    })
    .eq(
      'id',
      presentationId
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Conference presentation update failed:',
      error
    )

    conferencesRedirect(
      'error',
      'The conference presentation could not be updated.'
    )
  }

  revalidatePath(
    '/conferences'
  )

  conferencesRedirect(
    'saved',
    presentationId
  )
}

export async function deleteConferencePresentation(
  formData: FormData
) {
  await requireDashboardOwner()

  const presentationId =
    getRequiredText(
      formData,
      'presentation_id'
    )

  if (!presentationId) {
    conferencesRedirect(
      'error',
      'Conference presentation ID is required.'
    )
  }

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase
    .from(
      'conference_presentations'
    )
    .delete()
    .eq(
      'id',
      presentationId
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Conference presentation deletion failed:',
      error
    )

    conferencesRedirect(
      'error',
      'The conference presentation could not be deleted.'
    )
  }

  revalidatePath(
    '/conferences'
  )

  conferencesRedirect(
    'deleted',
    presentationId
  )
}
