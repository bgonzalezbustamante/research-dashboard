'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

const MAX_COFFEE_COUNT = 32767

type ServerSupabaseClient =
  Awaited<ReturnType<typeof createClient>>

type SessionPayload = {
  startTime: string
  endTime: string
  activityLabelId: string
  place: string
  paperId: string | null
}

type SessionPayloadResult =
  | {
      payload: SessionPayload
      error?: never
    }
  | {
      payload?: never
      error: string
    }

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

function isValidTimeString(
  value: string
) {
  if (
    !/^\d{2}:\d{2}$/.test(
      value
    )
  ) {
    return false
  }

  const [hours, minutes] =
    value
      .split(':')
      .map(Number)

  return (
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  )
}

function timeToMinutes(
  value: string
) {
  const [hours, minutes] =
    value
      .split(':')
      .map(Number)

  return hours * 60 + minutes
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

function redirectSessionError(
  date: string,
  message: string
): never {
  redirect(
    `/hours?date=${encodeURIComponent(
      date
    )}&sessionError=${encodeURIComponent(
      message
    )}#work-sessions`
  )
}

function redirectToSessions(
  date: string
): never {
  redirect(
    `/hours?date=${encodeURIComponent(
      date
    )}#work-sessions`
  )
}

function getSessionPayload(
  formData: FormData
): SessionPayloadResult {
  const startTime =
    getRequiredText(
      formData,
      'start_time'
    )

  const endTime =
    getRequiredText(
      formData,
      'end_time'
    )

  const activityLabelId =
    getRequiredText(
      formData,
      'activity_label_id'
    )

  const place =
    getRequiredText(
      formData,
      'place'
    )

  const paperId =
    getOptionalText(
      formData,
      'paper_id'
    )

  if (
    !isValidTimeString(
      startTime
    ) ||
    !isValidTimeString(
      endTime
    )
  ) {
    return {
      error:
        'Start and end times must be valid clock times.',
    }
  }

  if (
    timeToMinutes(
      endTime
    ) <=
    timeToMinutes(
      startTime
    )
  ) {
    return {
      error:
        'End time must be later than start time.',
    }
  }

  if (!activityLabelId) {
    return {
      error:
        'Activity label is required.',
    }
  }

  if (!place) {
    return {
      error:
        'Work location is required.',
    }
  }

  return {
    payload: {
      startTime,
      endTime,
      activityLabelId,
      place,
      paperId,
    },
  }
}

async function validateSessionReferences(
  supabase: ServerSupabaseClient,
  userId: string,
  activityLabelId: string,
  paperId: string | null,
  allowedInactiveLabelId?: string
) {
  const {
    data: label,
    error: labelError,
  } = await supabase
    .from('activity_labels')
    .select(`
      id,
      is_break,
      is_active
    `)
    .eq(
      'id',
      activityLabelId
    )
    .eq(
      'owner_id',
      userId
    )
    .maybeSingle()

  if (
    labelError ||
    !label
  ) {
    return {
      error:
        'The selected activity label is not available.',
    }
  }

  if (
    !label.is_active &&
    label.id !==
      allowedInactiveLabelId
  ) {
    return {
      error:
        'The selected activity label is inactive.',
    }
  }

  if (
    label.is_break &&
    paperId
  ) {
    return {
      error:
        'Break sessions cannot be linked to a paper.',
    }
  }

  if (paperId) {
    const {
      data: paper,
      error: paperError,
    } = await supabase
      .from('papers')
      .select('id')
      .eq(
        'id',
        paperId
      )
      .eq(
        'owner_id',
        userId
      )
      .maybeSingle()

    if (
      paperError ||
      !paper
    ) {
      return {
        error:
          'The selected paper is not available.',
      }
    }
  }

  return {
    label,
  }
}

async function getOrCreateDailyLog(
  supabase: ServerSupabaseClient,
  userId: string,
  logDate: string
) {
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
    return {
      error:
        'The daily log could not be loaded.',
    }
  }

  if (existingLog) {
    return {
      id: existingLog.id,
    }
  }

  const {
    data: createdLog,
    error: createError,
  } = await supabase
    .from('daily_logs')
    .insert({
      owner_id: userId,
      log_date: logDate,
      coffee_count: 0,
    })
    .select('id')
    .single()

  if (
    !createError &&
    createdLog
  ) {
    return {
      id: createdLog.id,
    }
  }

  if (
    createError?.code ===
    '23505'
  ) {
    const {
      data: concurrentLog,
      error: concurrentError,
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

    if (
      !concurrentError &&
      concurrentLog
    ) {
      return {
        id:
          concurrentLog.id,
      }
    }
  }

  console.error(
    'Automatic daily log creation failed:',
    createError
  )

  return {
    error:
      'The daily log could not be created.',
  }
}

function getSessionDatabaseError(
  error: {
    code?: string
    message?: string
    details?: string
  } | null
) {
  const text =
    `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase()

  if (
    text.includes(
      'work sessions cannot overlap'
    )
  ) {
    return 'This interval overlaps an existing work session.'
  }

  if (
    text.includes(
      'break sessions cannot be linked to papers'
    )
  ) {
    return 'Break sessions cannot be linked to a paper.'
  }

  if (
    text.includes(
      'end_time'
    ) ||
    text.includes(
      'positive_interval'
    )
  ) {
    return 'End time must be later than start time.'
  }

  if (
    text.includes(
      'activity label'
    )
  ) {
    return 'The selected activity label is not valid for this session.'
  }

  if (
    text.includes(
      'paper'
    )
  ) {
    return 'The selected paper is not valid for this session.'
  }

  return 'The work session could not be saved.'
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

export async function createWorkSession(
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

  const result =
    getSessionPayload(
      formData
    )

  if (!result.payload) {
    redirectSessionError(
      logDate,
      result.error
    )
  }

  const payload =
    result.payload

  const referenceResult =
    await validateSessionReferences(
      supabase,
      userId,
      payload.activityLabelId,
      payload.paperId
    )

  if (
    referenceResult.error
  ) {
    redirectSessionError(
      logDate,
      referenceResult.error
    )
  }

  const dailyLogResult =
    await getOrCreateDailyLog(
      supabase,
      userId,
      logDate
    )

  if (
    !dailyLogResult.id
  ) {
    redirectSessionError(
      logDate,
      dailyLogResult.error ??
        'The daily log could not be created.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from('work_sessions')
    .insert({
      daily_log_id:
        dailyLogResult.id,
      activity_label_id:
        payload.activityLabelId,
      paper_id:
        payload.paperId,
      start_time:
        payload.startTime,
      end_time:
        payload.endTime,
      place:
        payload.place,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Work session creation failed:',
      error
    )

    redirectSessionError(
      logDate,
      getSessionDatabaseError(
        error
      )
    )
  }

  revalidatePath('/hours')

  redirectToSessions(
    logDate
  )
}

export async function updateWorkSession(
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

  const sessionId =
    getRequiredText(
      formData,
      'session_id'
    )

  if (
    !isValidDateString(
      logDate
    ) ||
    !sessionId
  ) {
    redirect('/hours')
  }

  const result =
    getSessionPayload(
      formData
    )

  if (!result.payload) {
    redirectSessionError(
      logDate,
      result.error
    )
  }

  const payload =
    result.payload

  const {
    data: dailyLog,
    error: dailyLogError,
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

  if (
    dailyLogError ||
    !dailyLog
  ) {
    redirectSessionError(
      logDate,
      'The daily log could not be loaded.'
    )
  }

  const {
    data: existingSession,
    error: existingError,
  } = await supabase
    .from('work_sessions')
    .select(`
      id,
      activity_label_id
    `)
    .eq(
      'id',
      sessionId
    )
    .eq(
      'daily_log_id',
      dailyLog.id
    )
    .maybeSingle()

  if (
    existingError ||
    !existingSession
  ) {
    redirectSessionError(
      logDate,
      'The work session could not be found.'
    )
  }

  const referenceResult =
    await validateSessionReferences(
      supabase,
      userId,
      payload.activityLabelId,
      payload.paperId,
      existingSession.activity_label_id
    )

  if (
    referenceResult.error
  ) {
    redirectSessionError(
      logDate,
      referenceResult.error
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from('work_sessions')
    .update({
      activity_label_id:
        payload.activityLabelId,
      paper_id:
        payload.paperId,
      start_time:
        payload.startTime,
      end_time:
        payload.endTime,
      place:
        payload.place,
    })
    .eq(
      'id',
      sessionId
    )
    .eq(
      'daily_log_id',
      dailyLog.id
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Work session update failed:',
      error
    )

    redirectSessionError(
      logDate,
      getSessionDatabaseError(
        error
      )
    )
  }

  revalidatePath('/hours')

  redirectToSessions(
    logDate
  )
}

export async function deleteWorkSession(
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

  const sessionId =
    getRequiredText(
      formData,
      'session_id'
    )

  if (
    !isValidDateString(
      logDate
    ) ||
    !sessionId
  ) {
    redirect('/hours')
  }

  const {
    data: dailyLog,
    error: dailyLogError,
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

  if (
    dailyLogError ||
    !dailyLog
  ) {
    redirectSessionError(
      logDate,
      'The daily log could not be loaded.'
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from('work_sessions')
    .delete()
    .eq(
      'id',
      sessionId
    )
    .eq(
      'daily_log_id',
      dailyLog.id
    )
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'Work session deletion failed:',
      error
    )

    redirectSessionError(
      logDate,
      'The work session could not be deleted.'
    )
  }

  revalidatePath('/hours')

  redirectToSessions(
    logDate
  )
}