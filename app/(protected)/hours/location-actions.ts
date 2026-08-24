'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireDashboardAccess } from '@/lib/auth/dashboard-access'
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

function isValidDateString(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  )
}

function getAmsterdamDate() {
  const parts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          'Europe/Amsterdam',
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

function getReturnDate(
  formData: FormData
) {
  const value = getRequiredText(
    formData,
    'return_date'
  )

  return isValidDateString(value)
    ? value
    : getAmsterdamDate()
}

function redirectLocationError(
  date: string,
  message: string
): never {
  redirect(
    `/hours?date=${encodeURIComponent(
      date
    )}&locationError=${encodeURIComponent(
      message
    )}#location-labels`
  )
}

function redirectToLocations(
  date: string
): never {
  redirect(
    `/hours?date=${encodeURIComponent(
      date
    )}#location-labels`
  )
}

async function requireLocationWriteAccess(
  returnDate: string
) {
  const access =
    await requireDashboardAccess()

  if (!access.canEdit) {
    redirectLocationError(
      returnDate,
      'Viewer access is read-only. Location labels cannot be changed.'
    )
  }

  const supabase =
    await createClient()

  return {
    supabase,
    userId: access.userId,
  }
}

export async function createLocationLabel(
  formData: FormData
) {
  const returnDate =
    getReturnDate(formData)

  const {
    supabase,
    userId,
  } = await requireLocationWriteAccess(
    returnDate
  )

  const name = getRequiredText(
    formData,
    'name'
  )

  const description =
    getOptionalText(
      formData,
      'description'
    )

  if (!name) {
    redirectLocationError(
      returnDate,
      'Location name is required.'
    )
  }

  const { data, error } =
    await supabase
      .from('location_labels')
      .insert({
        owner_id: userId,
        name,
        description,
        is_active: true,
      })
      .select('id')
      .single()

  if (error || !data) {
    console.error(
      'Location label creation failed:',
      error
    )

    if (error?.code === '23505') {
      redirectLocationError(
        returnDate,
        'A location label with this name already exists.'
      )
    }

    redirectLocationError(
      returnDate,
      'The location label could not be created.'
    )
  }

  revalidatePath('/hours')
  redirectToLocations(returnDate)
}

export async function updateLocationLabel(
  formData: FormData
) {
  const returnDate =
    getReturnDate(formData)

  const {
    supabase,
    userId,
  } = await requireLocationWriteAccess(
    returnDate
  )

  const labelId = getRequiredText(
    formData,
    'label_id'
  )

  const name = getRequiredText(
    formData,
    'name'
  )

  const description =
    getOptionalText(
      formData,
      'description'
    )

  if (!labelId) {
    redirectLocationError(
      returnDate,
      'Location label is missing.'
    )
  }

  if (!name) {
    redirectLocationError(
      returnDate,
      'Location name is required.'
    )
  }

  const { data, error } =
    await supabase
      .from('location_labels')
      .update({
        name,
        description,
      })
      .eq('id', labelId)
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle()

  if (error || !data) {
    console.error(
      'Location label update failed:',
      error
    )

    if (error?.code === '23505') {
      redirectLocationError(
        returnDate,
        'A location label with this name already exists.'
      )
    }

    redirectLocationError(
      returnDate,
      'The location label could not be updated.'
    )
  }

  revalidatePath('/hours')
  redirectToLocations(returnDate)
}

export async function setLocationLabelActive(
  formData: FormData
) {
  const returnDate =
    getReturnDate(formData)

  const {
    supabase,
    userId,
  } = await requireLocationWriteAccess(
    returnDate
  )

  const labelId = getRequiredText(
    formData,
    'label_id'
  )

  const nextActive = getRequiredText(
    formData,
    'next_active'
  )

  if (
    !labelId ||
    !['true', 'false'].includes(
      nextActive
    )
  ) {
    redirectLocationError(
      returnDate,
      'Invalid location-label request.'
    )
  }

  const { data, error } =
    await supabase
      .from('location_labels')
      .update({
        is_active:
          nextActive === 'true',
      })
      .eq('id', labelId)
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle()

  if (error || !data) {
    console.error(
      'Location label status update failed:',
      error
    )

    redirectLocationError(
      returnDate,
      'The location label status could not be changed.'
    )
  }

  revalidatePath('/hours')
  redirectToLocations(returnDate)
}

export async function deleteLocationLabel(
  formData: FormData
) {
  const returnDate =
    getReturnDate(formData)

  const {
    supabase,
    userId,
  } = await requireLocationWriteAccess(
    returnDate
  )

  const labelId = getRequiredText(
    formData,
    'label_id'
  )

  if (!labelId) {
    redirectLocationError(
      returnDate,
      'Location label is missing.'
    )
  }

  const {
    data: label,
    error: labelError,
  } = await supabase
    .from('location_labels')
    .select('id, name')
    .eq('id', labelId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (labelError || !label) {
    redirectLocationError(
      returnDate,
      'The location label could not be found.'
    )
  }

  const {
    data: usedSessions,
    error: usageError,
  } = await supabase
    .from('work_sessions')
    .select('id')
    .eq('place', label.name)
    .limit(1)

  if (usageError) {
    console.error(
      'Location label usage check failed:',
      usageError
    )

    redirectLocationError(
      returnDate,
      'The location label could not be checked for existing use.'
    )
  }

  if (
    (usedSessions ?? []).length > 0
  ) {
    redirectLocationError(
      returnDate,
      'This location is already used by work sessions. Deactivate it instead of deleting it.'
    )
  }

  const { data, error } =
    await supabase
      .from('location_labels')
      .delete()
      .eq('id', labelId)
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle()

  if (error || !data) {
    console.error(
      'Location label deletion failed:',
      error
    )

    redirectLocationError(
      returnDate,
      'The location label could not be deleted.'
    )
  }

  revalidatePath('/hours')
  redirectToLocations(returnDate)
}
