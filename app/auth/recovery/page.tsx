'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import OxfordLogo from '@/components/oxford-logo'
import SiteFooter from '@/components/site-footer'
import Button from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type RecoveryState =
  | 'verifying'
  | 'ready'
  | 'saving'
  | 'failed'

export default function PasswordRecoveryPage() {
  const router = useRouter()
  const [state, setState] =
    useState<RecoveryState>('verifying')
  const [message, setMessage] = useState(
    'Verifying your password recovery link…'
  )
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')

  useEffect(() => {
    let cancelled = false

    async function establishRecoverySession() {
      const supabase = createClient()
      const url = new URL(window.location.href)
      const hash = new URLSearchParams(
        window.location.hash.replace(/^#/, '')
      )

      const errorDescription =
        hash.get('error_description') ??
        url.searchParams.get('error_description')

      if (errorDescription) {
        if (!cancelled) {
          setState('failed')
          setMessage(
            decodeURIComponent(
              errorDescription.replace(/\+/g, ' ')
            )
          )
        }
        return
      }

      const tokenHash =
        url.searchParams.get('token_hash')
      const type =
        url.searchParams.get('type')

      if (tokenHash && type === 'recovery') {
        const { error } =
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })

        if (error) {
          if (!cancelled) {
            setState('failed')
            setMessage(
              'The password recovery link is invalid or has expired.'
            )
          }
          return
        }

        window.history.replaceState(
          {},
          '',
          '/auth/recovery'
        )

        if (!cancelled) {
          setState('ready')
          setMessage('')
        }
        return
      }

      const accessToken =
        hash.get('access_token')
      const refreshToken =
        hash.get('refresh_token')
      const hashType = hash.get('type')

      if (
        accessToken &&
        refreshToken &&
        hashType === 'recovery'
      ) {
        const { error } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

        if (error) {
          if (!cancelled) {
            setState('failed')
            setMessage(
              'The password recovery session could not be established. The link may have expired.'
            )
          }
          return
        }

        window.history.replaceState(
          {},
          '',
          '/auth/recovery'
        )

        if (!cancelled) {
          setState('ready')
          setMessage('')
        }
        return
      }

      const code =
        url.searchParams.get('code')

      if (code) {
        let recoveryEvent = false

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(
          (event) => {
            if (event === 'PASSWORD_RECOVERY') {
              recoveryEvent = true
            }
          }
        )

        const { error } =
          await supabase.auth.exchangeCodeForSession(
            code
          )

        subscription.unsubscribe()

        if (error) {
          if (!cancelled) {
            setState('failed')
            setMessage(
              'The password recovery session could not be established. The link may have expired.'
            )
          }
          return
        }

        window.history.replaceState(
          {},
          '',
          '/auth/recovery'
        )

        if (!cancelled) {
          if (!recoveryEvent) {
            const {
              data: { user },
            } = await supabase.auth.getUser()

            if (!user) {
              setState('failed')
              setMessage(
                'No valid password recovery session was found.'
              )
              return
            }
          }

          setState('ready')
          setMessage('')
        }
        return
      }

      if (!cancelled) {
        setState('failed')
        setMessage(
          'No valid password recovery session was found. Request a new recovery email and use the newest link.'
        )
      }
    }

    void establishRecoverySession()

    return () => {
      cancelled = true
    }
  }, [])

  async function handlePasswordUpdate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (password.length < 8) {
      setMessage(
        'Choose a password with at least 8 characters.'
      )
      return
    }

    if (password !== confirmPassword) {
      setMessage('The passwords do not match.')
      return
    }

    setState('saving')
    setMessage('')

    const supabase = createClient()

    const { error } =
      await supabase.auth.updateUser({
        password,
      })

    if (error) {
      console.error(
        'Password recovery update failed:',
        error
      )
      setState('ready')
      setMessage(
        error.message ||
          'Your password could not be updated.'
      )
      return
    }

    const { error: signOutError } =
      await supabase.auth.signOut()

    if (signOutError) {
      console.error(
        'Password recovery sign-out failed:',
        signOutError
      )
    }

    router.replace(
      '/login?message=Password updated. Please sign in with your new password.'
    )
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <OxfordLogo className="w-[220px]" />
          </div>

          <div className="rounded-lg border border-oxford-stone bg-white p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-oxford-blue">
              Reset your password
            </h1>

            {state === 'verifying' && (
              <p className="mt-4 text-sm leading-6 text-oxford-ash">
                {message}
              </p>
            )}

            {state === 'failed' && (
              <>
                <p className="mt-4 text-sm leading-6 text-red-700">
                  {message}
                </p>

                <div className="mt-6 flex flex-wrap gap-4">
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm font-medium text-oxford-blue underline-offset-4 hover:underline"
                  >
                    Request a new recovery email
                  </Link>

                  <Link
                    href="/login"
                    className="text-sm font-medium text-oxford-ash underline-offset-4 hover:underline"
                  >
                    Return to sign in
                  </Link>
                </div>
              </>
            )}

            {(state === 'ready' ||
              state === 'saving') && (
              <form
                onSubmit={handlePasswordUpdate}
                className="mt-6 space-y-4"
              >
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-sm font-medium text-oxford-charcoal"
                  >
                    New password
                  </label>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm_password"
                    className="mb-1 block text-sm font-medium text-oxford-charcoal"
                  >
                    Confirm new password
                  </label>

                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
                  />
                </div>

                <p className="text-xs leading-5 text-oxford-ash">
                  Use at least 8 characters. After the password is changed, all current dashboard sessions for this account will be signed out.
                </p>

                {message && (
                  <p className="text-sm font-medium text-red-700">
                    {message}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={state === 'saving'}
                >
                  {state === 'saving'
                    ? 'Updating password…'
                    : 'Update password'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
