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
    )}&sessionError=${encodeURIComponent(
      message
    )}#location-labels`
  )
}

export async function setDefaultLocationLabel(
  formData: FormData
) {
  const supabase =
    await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

  const userId = data?.claims?.sub

  if (
    error ||
    typeof userId !== 'string'
  ) {
    redirect('/login')
  }

  const returnDate =
    getReturnDate(formData)

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

  const { error: defaultError } =
    await supabase.rpc(
      'set_default_location_label',
      {
        p_label_id: labelId,
      }
    )

  if (defaultError) {
    console.error(
      'Default location update failed:',
      defaultError
    )

    redirectLocationError(
      returnDate,
      'The default location could not be changed.'
    )
  }

  revalidatePath('/hours')

  redirect(
    `/hours?date=${encodeURIComponent(
      returnDate
    )}#location-labels`
  )
}
