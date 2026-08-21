'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

const MAX_COFFEE_COUNT = 32767

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
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false
  }

  const [year, month, day] =
    value
      .split('-')
      .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day
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
  const value =
    getRequiredText(
      formData,
      'return_date'
    )

  return isValidDateString(
    value
  )
    ? value
    : getAmsterdamDate()
}

function getCoffeeCount(
  formData: FormData
) {
  const value =
    getRequiredText(
      formData,
      'coffee_count'
    )

  if (!/^\d+$/.test(value)) {
    return null
  }

  const parsed =
    Number.parseInt(
      value,
      10
    )

  if (
    !Number.isSafeInteger(
      parsed
    ) ||
    parsed < 0 ||
    parsed >
      MAX_COFFEE_COUNT
  ) {
    return null
  }

  return parsed
}

async function requireAuth() {
  const supabase =
    await createClient()

  const {
    data,
    error,
  } =
    await supabase.auth.getClaims()

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

function redirectDailyError(
  date: string,
  message: string
): never {
  redirect(
    `/hours?date=${encodeURIComponent(
      date
    )}&dailyError=${encodeURIComponent(
      message
    )}#daily-log`
  )
}

function redirectToDaily(
  date: string
): never {
  redirect(
    `/hours?date=${encodeURIComponent(
      date
    )}#daily-log`
  )
}

function redirectLabelError(
  date: string,
  message: string
): never {
  redirect(
    `/hours?date=${encodeURIComponent(
      date
    )}&labelError=${encodeURIComponent(
      message
    )}#activity-labels`
  )
}

function redirectToLabels(
  date: string
): never {
  redirect(
    `/hours?date=${encodeURIComponent(
      date
    )}#activity-labels`
  )
}

export async function saveDailyLog(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const logDate =
    getRequiredText(
      formData,
      'log_date'
    )

  if (
    !isValidDateString(
      logDate
    )
  ) {
    redirect('/hours')
  }

  const coffeeCount =
    getCoffeeCount(
      formData
    )

  if (
    coffeeCount === null
  ) {
    redirectDailyError(
      logDate,
      'Coffee count must be a non-negative whole number.'
    )
  }

  const {
    data: existingLog,
    error: existingError,
  } = await supabase
    .from('daily_logs')
    .select('id')
    .eq(
      'owner_id',
      userId
    )
    .eq(
      'log_date',
      logDate
    )
    .maybeSingle()

  if (existingError) {
    console.error(
      'Daily log lookup failed:',
      existingError
    )

    redirectDailyError(
      logDate,
      'The daily log could not be loaded.'
    )
  }

  if (existingLog) {
    const {
      data,
      error,
    } = await supabase
      .from('daily_logs')
      .update({
        coffee_count:
          coffeeCount,
      })
      .eq(
        'id',
        existingLog.id
      )
      .eq(
        'owner_id',
        userId
      )
      .select('id')
      .maybeSingle()

    if (error || !data) {
      console.error(
        'Daily log update failed:',
        error
      )

      redirectDailyError(
        logDate,
        'The daily log could not be updated.'
      )
    }
  } else {
    const {
      data,
      error,
    } = await supabase
      .from('daily_logs')
      .insert({
        owner_id: userId,
        log_date: logDate,
        coffee_count:
          coffeeCount,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error(
        'Daily log creation failed:',
        error
      )

      if (
        error?.code ===
        '23505'
      ) {
        redirectDailyError(
          logDate,
          'A daily log already exists for this date. Reload the page and try again.'
        )
      }

      redirectDailyError(
        logDate,
        'The daily log could not be created.'
      )
    }
  }

  revalidatePath('/hours')

  redirectToDaily(
    logDate
  )
}

export async function createActivityLabel(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const returnDate =
    getReturnDate(
      formData
    )

  const name =
    getRequiredText(
      formData,
      'name'
    )

  const description =
    getOptionalText(
      formData,
      'description'
    )

  if (!name) {
    redirectLabelError(
      returnDate,
      'Label name is required.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from('activity_labels')
    .insert({
      owner_id: userId,
      name,
      description,
      is_system: false,
      is_break: false,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Activity label creation failed:',
      error
    )

    if (
      error?.code ===
      '23505'
    ) {
      redirectLabelError(
        returnDate,
        'An activity label with this name already exists.'
      )
    }

    redirectLabelError(
      returnDate,
      'The activity label could not be created.'
    )
  }

  revalidatePath('/hours')

  redirectToLabels(
    returnDate
  )
}

export async function updateActivityLabel(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const returnDate =
    getReturnDate(
      formData
    )

  const labelId =
    getRequiredText(
      formData,
      'label_id'
    )

  const name =
    getRequiredText(
      formData,
      'name'
    )

  const description =
    getOptionalText(
      formData,
      'description'
    )

  if (!labelId) {
    redirectLabelError(
      returnDate,
      'Activity label is missing.'
    )
  }

  if (!name) {
    redirectLabelError(
      returnDate,
      'Label name is required.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from('activity_labels')
    .update({
      name,
      description,
    })
    .eq(
      'id',
      labelId
    )
    .eq(
      'owner_id',
      userId
    )
    .eq(
      'is_system',
      false
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Activity label update failed:',
      error
    )

    if (
      error?.code ===
      '23505'
    ) {
      redirectLabelError(
        returnDate,
        'An activity label with this name already exists.'
      )
    }

    redirectLabelError(
      returnDate,
      'The activity label could not be updated.'
    )
  }

  revalidatePath('/hours')

  redirectToLabels(
    returnDate
  )
}

export async function setActivityLabelActive(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const returnDate =
    getReturnDate(
      formData
    )

  const labelId =
    getRequiredText(
      formData,
      'label_id'
    )

  const nextActive =
    getRequiredText(
      formData,
      'next_active'
    )

  if (
    !labelId ||
    ![
      'true',
      'false',
    ].includes(
      nextActive
    )
  ) {
    redirectLabelError(
      returnDate,
      'Invalid activity-label request.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from('activity_labels')
    .update({
      is_active:
        nextActive ===
        'true',
    })
    .eq(
      'id',
      labelId
    )
    .eq(
      'owner_id',
      userId
    )
    .eq(
      'is_system',
      false
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Activity label status update failed:',
      error
    )

    redirectLabelError(
      returnDate,
      'The activity label status could not be changed.'
    )
  }

  revalidatePath('/hours')

  redirectToLabels(
    returnDate
  )
}

export async function deleteActivityLabel(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await requireAuth()

  const returnDate =
    getReturnDate(
      formData
    )

  const labelId =
    getRequiredText(
      formData,
      'label_id'
    )

  if (!labelId) {
    redirectLabelError(
      returnDate,
      'Activity label is missing.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from('activity_labels')
    .delete()
    .eq(
      'id',
      labelId
    )
    .eq(
      'owner_id',
      userId
    )
    .eq(
      'is_system',
      false
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Activity label deletion failed:',
      error
    )

    if (
      error?.code ===
      '23503'
    ) {
      redirectLabelError(
        returnDate,
        'This label is already used by work sessions. Deactivate it instead of deleting it.'
      )
    }

    redirectLabelError(
      returnDate,
      'The activity label could not be deleted.'
    )
  }

  revalidatePath('/hours')

  redirectToLabels(
    returnDate
  )
}