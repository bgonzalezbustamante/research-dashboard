'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type NoteType =
  | 'general'
  | 'writing'
  | 'review'
  | 'revision'
  | 'publication'

const allowedNoteTypes = new Set<NoteType>([
  'general',
  'writing',
  'review',
  'revision',
  'publication',
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

function getNoteType(
  formData: FormData
): NoteType | null {
  const value = getRequiredText(
    formData,
    'note_type'
  ) as NoteType

  return allowedNoteTypes.has(value)
    ? value
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

  const userId =
    data?.claims?.sub

  if (
    error ||
    typeof userId !== 'string'
  ) {
    redirect('/login')
  }

  return {
    supabase,
    userId,
  }
}

function redirectWithError(
  paperId: string,
  message: string
): never {
  redirect(
    `/papers/${paperId}?noteError=${encodeURIComponent(
      message
    )}#notes`
  )
}

function redirectToNotes(
  paperId: string
): never {
  redirect(
    `/papers/${paperId}#notes`
  )
}

function getNotePayload(
  formData: FormData
) {
  const body =
    getRequiredText(
      formData,
      'body'
    )

  if (!body) {
    return {
      error:
        'Note text is required.',
    }
  }

  const noteType =
    getNoteType(formData)

  if (!noteType) {
    return {
      error:
        'Invalid note category.',
    }
  }

  return {
    payload: {
      noteDate:
        getOptionalDate(
          formData,
          'note_date'
        ) ?? getAmsterdamDate(),

      noteType,

      body,
    },
  }
}

export async function createNote(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  if (!paperId) {
    redirect('/papers')
  }

  const result =
    getNotePayload(formData)

  if (!result.payload) {
    redirectWithError(
      paperId,
      result.error ??
        'Invalid note.'
    )
  }

  const payload =
    result.payload

  const {
    data,
    error,
  } = await supabase
    .from('paper_notes')
    .insert({
      paper_id: paperId,
      note_date:
        payload.noteDate,
      note_type:
        payload.noteType,
      body:
        payload.body,
      created_by:
        userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Note creation failed:',
      error
    )

    redirectWithError(
      paperId,
      'The note could not be created.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToNotes(
    paperId
  )
}

export async function updateNote(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const noteId =
    getRequiredText(
      formData,
      'note_id'
    )

  if (!paperId || !noteId) {
    redirect('/papers')
  }

  const result =
    getNotePayload(formData)

  if (!result.payload) {
    redirectWithError(
      paperId,
      result.error ??
        'Invalid note.'
    )
  }

  const payload =
    result.payload

  const {
    data,
    error,
  } = await supabase
    .from('paper_notes')
    .update({
      note_date:
        payload.noteDate,
      note_type:
        payload.noteType,
      body:
        payload.body,
    })
    .eq('id', noteId)
    .eq('paper_id', paperId)
    .eq('created_by', userId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Note update failed:',
      error
    )

    redirectWithError(
      paperId,
      'The note could not be updated.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToNotes(
    paperId
  )
}

export async function deleteNote(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const paperId =
    getRequiredText(
      formData,
      'paper_id'
    )

  const noteId =
    getRequiredText(
      formData,
      'note_id'
    )

  if (!paperId || !noteId) {
    redirect('/papers')
  }

  const {
    data,
    error,
  } = await supabase
    .from('paper_notes')
    .delete()
    .eq('id', noteId)
    .eq('paper_id', paperId)
    .eq('created_by', userId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Note deletion failed:',
      error
    )

    redirectWithError(
      paperId,
      'The note could not be deleted.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToNotes(
    paperId
  )
}