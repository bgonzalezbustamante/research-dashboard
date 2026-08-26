'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAppAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

function getTrimmedText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getRawText(
  formData: FormData,
  name: string
) {
  const value = formData.get(name)

  return typeof value === 'string'
    ? value
    : ''
}

function redirectAccount(
  kind: 'notice' | 'error',
  message: string
): never {
  redirect(
    `/account?${kind}=${encodeURIComponent(
      message
    )}`
  )
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

async function getAccountContext() {
  const access =
    await requireAppAccess()

  const supabase =
    await createClient()

  return {
    access,
    supabase,
  }
}

export async function updateOwnName(
  formData: FormData
) {
  const fullName =
    getTrimmedText(
      formData,
      'full_name'
    )

  if (fullName.length < 2) {
    redirectAccount(
      'error',
      'Please enter your full name.'
    )
  }

  const { access, supabase } =
    await getAccountContext()

  const { error: profileError } =
    await supabase
      .from('profiles')
      .update({
        full_name: fullName,
      })
      .eq('id', access.userId)

  if (profileError) {
    console.error(
      'Own profile name update failed:',
      profileError
    )

    redirectAccount(
      'error',
      'Your name could not be updated.'
    )
  }

  const { error: metadataError } =
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
      },
    })

  if (metadataError) {
    console.error(
      'Own Auth metadata name update failed:',
      metadataError
    )
  }

  revalidatePath('/', 'layout')
  revalidatePath('/account')
  revalidatePath('/dashboard/access')

  redirectAccount(
    'notice',
    'Your name has been updated.'
  )
}

export async function requestEmailChange(
  formData: FormData
) {
  const newEmail =
    getTrimmedText(
      formData,
      'new_email'
    ).toLowerCase()

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      newEmail
    )
  ) {
    redirectAccount(
      'error',
      'Enter a valid email address.'
    )
  }

  const { supabase } =
    await getAccountContext()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const currentEmail =
    user.email?.trim().toLowerCase() ?? ''

  if (newEmail === currentEmail) {
    redirectAccount(
      'error',
      'The new email address is the same as your current email.'
    )
  }

  const emailRedirectTo =
    `${getSiteUrl()}/auth/email-change`

  const { error } =
    await supabase.auth.updateUser(
      {
        email: newEmail,
      },
      {
        emailRedirectTo,
      }
    )

  if (error) {
    console.error(
      'Email change request failed:',
      error
    )

    redirectAccount(
      'error',
      'The email change could not be requested.'
    )
  }

  redirectAccount(
    'notice',
    'Email change requested. Check both your current and new email addresses and complete all confirmation steps.'
  )
}

export async function changeOwnPassword(
  formData: FormData
) {
  const password =
    getRawText(
      formData,
      'password'
    )

  const confirmPassword =
    getRawText(
      formData,
      'confirm_password'
    )

  if (password.length < 10) {
    redirectAccount(
      'error',
      'Choose a password with at least 10 characters.'
    )
  }

  if (password !== confirmPassword) {
    redirectAccount(
      'error',
      'The passwords do not match.'
    )
  }

  const { supabase } =
    await getAccountContext()

  const { error } =
    await supabase.auth.updateUser({
      password,
    })

  if (error) {
    console.error(
      'Authenticated password change failed:',
      error
    )

    redirectAccount(
      'error',
      'Your password could not be updated.'
    )
  }

  const { error: signOutError } =
    await supabase.auth.signOut()

  if (signOutError) {
    console.error(
      'Authenticated password change sign-out failed:',
      signOutError
    )
  }

  redirect(
    '/login?message=Password updated. Please sign in with your new password.'
  )
}
