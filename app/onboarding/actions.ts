'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

function getText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function redirectWithError(
  message: string
): never {
  redirect(
    `/onboarding?error=${encodeURIComponent(
      message
    )}`
  )
}

type AcceptanceResult = {
  destination?: string
}

export async function completeOnboarding(
  formData: FormData
) {
  const supabase = await createClient()

  const { data: claimsData } =
    await supabase.auth.getClaims()

  const userId =
    claimsData?.claims?.sub

  if (typeof userId !== 'string') {
    redirect('/login')
  }

  const fullName =
    getText(
      formData,
      'full_name'
    )

  const password =
    getText(
      formData,
      'password'
    )

  const confirmPassword =
    getText(
      formData,
      'confirm_password'
    )

  if (fullName.length < 2) {
    redirectWithError(
      'Please enter your full name.'
    )
  }

  if (password.length < 10) {
    redirectWithError(
      'Choose a password with at least 10 characters.'
    )
  }

  if (password !== confirmPassword) {
    redirectWithError(
      'The passwords do not match.'
    )
  }

  const { error: authError } =
    await supabase.auth.updateUser({
      password,
      data: {
        full_name: fullName,
      },
    })

  if (authError) {
    console.error(
      'Invitation password setup failed:',
      authError
    )

    redirectWithError(
      authError.message ||
        'Your password could not be saved.'
    )
  }

  const { error: profileError } =
    await supabase
      .from('profiles')
      .update({
        full_name: fullName,
      })
      .eq('id', userId)

  if (profileError) {
    console.error(
      'Invitation profile setup failed:',
      profileError
    )

    redirectWithError(
      'Your profile could not be completed.'
    )
  }

  const {
    data: acceptanceData,
    error: acceptanceError,
  } = await supabase.rpc(
    'accept_access_invitation'
  )

  if (acceptanceError) {
    console.error(
      'Invitation acceptance failed:',
      acceptanceError
    )

    redirectWithError(
      'Your invitation could not be activated. Please contact the dashboard owner.'
    )
  }

  const acceptance =
    (acceptanceData ?? {}) as AcceptanceResult

  const destination =
    acceptance.destination === '/papers'
      ? '/papers'
      : '/dashboard'

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard/access')
  revalidatePath('/dashboard')
  revalidatePath('/papers')

  redirect(destination)
}
