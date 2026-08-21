'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type HistoryEventType =
  | 'submitted'
  | 'decision'
  | 'revision-submitted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'published'
  | 'other'

const allowedEventTypes = new Set<HistoryEventType>([
  'submitted',
  'decision',
  'revision-submitted',
  'accepted',
  'rejected',
  'withdrawn',
  'published',
  'other',
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

function getOptionalPositiveInteger(
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

  const parsed = Number.parseInt(
    value,
    10
  )

  return Number.isInteger(parsed) &&
    parsed >= 1
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

function getEventType(
  formData: FormData
): HistoryEventType | null {
  const value = getRequiredText(
    formData,
    'event_type'
  ) as HistoryEventType

  return allowedEventTypes.has(value)
    ? value
    : null
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
    `/papers/${paperId}?historyError=${encodeURIComponent(
      message
    )}#history`
  )
}

function redirectToHistory(
  paperId: string
): never {
  redirect(
    `/papers/${paperId}#history`
  )
}

function getHistoryPayload(
  formData: FormData
) {
  const eventType =
    getEventType(formData)

  if (!eventType) {
    return {
      error:
        'Invalid history event type.',
    }
  }

  const decision =
    getOptionalText(
      formData,
      'decision'
    )

  if (
    eventType === 'decision' &&
    !decision
  ) {
    return {
      error:
        'Decision is required for a decision event.',
    }
  }

  return {
    payload: {
      eventDate:
        getOptionalDate(
          formData,
          'event_date'
        ) ?? getAmsterdamDate(),

      eventType,

      venue:
        getOptionalText(
          formData,
          'venue'
        ),

      roundNumber:
        getOptionalPositiveInteger(
          formData,
          'round_number'
        ),

      decision,

      notes:
        getOptionalText(
          formData,
          'notes'
        ),
    },
  }
}

export async function createHistoryEvent(
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
    getHistoryPayload(formData)

  if (!result.payload) {
    redirectWithError(
      paperId,
      result.error ??
        'Invalid history event.'
    )
  }

  const payload =
    result.payload

  const {
    data,
    error,
  } = await supabase
    .from('paper_history')
    .insert({
      paper_id: paperId,
      event_date:
        payload.eventDate,
      event_type:
        payload.eventType,
      venue:
        payload.venue,
      round_number:
        payload.roundNumber,
      decision:
        payload.decision,
      notes:
        payload.notes,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'History event creation failed:',
      error
    )

    redirectWithError(
      paperId,
      'The history event could not be created.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToHistory(
    paperId
  )
}

export async function updateHistoryEvent(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const historyId =
    getRequiredText(
      formData,
      'history_id'
    )

  if (
    !paperId ||
    !historyId
  ) {
    redirect('/papers')
  }

  const result =
    getHistoryPayload(formData)

  if (!result.payload) {
    redirectWithError(
      paperId,
      result.error ??
        'Invalid history event.'
    )
  }

  const payload =
    result.payload

  const {
    data,
    error,
  } = await supabase
    .from('paper_history')
    .update({
      event_date:
        payload.eventDate,
      event_type:
        payload.eventType,
      venue:
        payload.venue,
      round_number:
        payload.roundNumber,
      decision:
        payload.decision,
      notes:
        payload.notes,
    })
    .eq('id', historyId)
    .eq('paper_id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'History event update failed:',
      error
    )

    redirectWithError(
      paperId,
      'The history event could not be updated.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToHistory(
    paperId
  )
}

export async function deleteHistoryEvent(
  formData: FormData
) {
  const supabase =
    await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const historyId =
    getRequiredText(
      formData,
      'history_id'
    )

  if (
    !paperId ||
    !historyId
  ) {
    redirect('/papers')
  }

  const {
    data,
    error,
  } = await supabase
    .from('paper_history')
    .delete()
    .eq('id', historyId)
    .eq('paper_id', paperId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'History event deletion failed:',
      error
    )

    redirectWithError(
      paperId,
      'The history event could not be deleted.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToHistory(
    paperId
  )
}