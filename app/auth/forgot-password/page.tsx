'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

import OxfordLogo from '@/components/oxford-logo'
import SiteFooter from '@/components/site-footer'
import Button from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setError('Enter your email address.')
      return
    }

    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/recovery`

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo }
      )

    setSubmitting(false)

    if (resetError) {
      console.error(
        'Password recovery request failed:',
        resetError
      )
      setError(
        'The password recovery request could not be processed. Please try again.'
      )
      return
    }

    setSent(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <OxfordLogo className="w-[220px]" />
          </div>

          <div className="rounded-lg border border-oxford-stone bg-white p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-oxford-blue">
              Recover your password
            </h1>

            {sent ? (
              <>
                <p className="mt-3 text-sm leading-6 text-oxford-ash">
                  If an account exists for that email address, a password recovery message has been sent. Please follow the link in the email to choose a new password.
                </p>

                <Link
                  href="/login"
                  className="mt-6 inline-flex text-sm font-medium text-oxford-blue underline-offset-4 hover:underline"
                >
                  Return to sign in
                </Link>
              </>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-4"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block text-sm font-medium text-oxford-charcoal"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
                  />
                </div>

                <p className="text-xs leading-5 text-oxford-ash">
                  For security, the dashboard will not indicate whether an account exists for the email address entered.
                </p>

                {error && (
                  <p className="text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Sending recovery email…'
                    : 'Send recovery email'}
                </Button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-oxford-blue underline-offset-4 hover:underline"
                  >
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
