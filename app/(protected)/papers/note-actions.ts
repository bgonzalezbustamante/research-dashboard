'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAppAccess } from '@/lib/auth/dashboard-access'
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
  const body = getRequiredText(
    formData,
    'body'
  )

  if (!body) {
    return {
      error: 'Note text is required.',
    }
  }

  const noteType =
    getNoteType(formData)

  if (!noteType) {
    return {
      error: 'Invalid note category.',
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

async function getPaperAccess(
  paperId: string
) {
  const access =
    await requireAppAccess()

  const supabase =
    await createClient()

  if (access.canEditDashboard) {
    return {
      access,
      supabase,
      canCollaborate: true,
      canEditAllNotes: true,
    }
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from('paper_members')
    .select('role')
    .eq('paper_id', paperId)
    .eq('user_id', access.userId)
    .maybeSingle()

  if (membershipError) {
    throw new Error(
      `Could not load paper membership: ${membershipError.message}`
    )
  }

  return {
    access,
    supabase,
    canCollaborate:
      membership?.role === 'coauthor',
    canEditAllNotes: false,
  }
}

export async function createNote(
  formData: FormData
) {
  const paperId = getRequiredText(
    formData,
    'paper_id'
  )

  if (!paperId) {
    redirect('/papers')
  }

  const {
    access,
    supabase,
    canCollaborate,
  } = await getPaperAccess(
    paperId
  )

  if (!canCollaborate) {
    redirectWithError(
      paperId,
      'You do not have permission to add notes to this paper.'
    )
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
      body: payload.body,
      created_by:
        access.userId,
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

  redirectToNotes(paperId)
}

export async function updateNote(
  formData: FormData
) {
  const paperId = getRequiredText(
    formData,
    'paper_id'
  )

  const noteId = getRequiredText(
    formData,
    'note_id'
  )

  if (!paperId || !noteId) {
    redirect('/papers')
  }

  const {
    access,
    supabase,
    canCollaborate,
    canEditAllNotes,
  } = await getPaperAccess(
    paperId
  )

  if (!canCollaborate) {
    redirectWithError(
      paperId,
      'You do not have permission to edit notes on this paper.'
    )
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

  let updateQuery = supabase
    .from('paper_notes')
    .update({
      note_date:
        payload.noteDate,
      note_type:
        payload.noteType,
      body: payload.body,
    })
    .eq('id', noteId)
    .eq('paper_id', paperId)

  if (!canEditAllNotes) {
    updateQuery = updateQuery.eq(
      'created_by',
      access.userId
    )
  }

  const {
    data,
    error,
  } = await updateQuery
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Note update failed:',
      error
    )

    redirectWithError(
      paperId,
      canEditAllNotes
        ? 'The note could not be updated.'
        : 'You can edit only notes that you created.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToNotes(paperId)
}

export async function deleteNote(
  formData: FormData
) {
  const paperId = getRequiredText(
    formData,
    'paper_id'
  )

  const noteId = getRequiredText(
    formData,
    'note_id'
  )

  if (!paperId || !noteId) {
    redirect('/papers')
  }

  const {
    access,
    supabase,
    canCollaborate,
    canEditAllNotes,
  } = await getPaperAccess(
    paperId
  )

  if (!canCollaborate) {
    redirectWithError(
      paperId,
      'You do not have permission to delete notes on this paper.'
    )
  }

  let deleteQuery = supabase
    .from('paper_notes')
    .delete()
    .eq('id', noteId)
    .eq('paper_id', paperId)

  if (!canEditAllNotes) {
    deleteQuery = deleteQuery.eq(
      'created_by',
      access.userId
    )
  }

  const {
    data,
    error,
  } = await deleteQuery
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Note deletion failed:',
      error
    )

    redirectWithError(
      paperId,
      canEditAllNotes
        ? 'The note could not be deleted.'
        : 'You can delete only notes that you created.'
    )
  }

  revalidatePath(
    `/papers/${paperId}`
  )

  redirectToNotes(paperId)
}
