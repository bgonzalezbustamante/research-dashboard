'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import OxfordLogo from '@/components/oxford-logo'
import SiteFooter from '@/components/site-footer'
import { createClient } from '@/lib/supabase/client'

export default function InviteCallbackPage() {
  const router = useRouter()
  const [message, setMessage] =
    useState('Confirming your invitation…')
  const [failed, setFailed] =
    useState(false)

  useEffect(() => {
    let cancelled = false

    async function confirmInvite() {
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
          setFailed(true)
          setMessage(
            decodeURIComponent(
              errorDescription.replace(/\+/g, ' ')
            )
          )
        }
        return
      }

      const accessToken =
        hash.get('access_token')
      const refreshToken =
        hash.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

        if (error) {
          if (!cancelled) {
            setFailed(true)
            setMessage(
              'The invitation session could not be established. The link may have expired.'
            )
          }
          return
        }

        window.history.replaceState(
          {},
          '',
          '/auth/invite'
        )

        if (!cancelled) {
          router.replace('/onboarding')
          router.refresh()
        }
        return
      }

      const code =
        url.searchParams.get('code')

      if (code) {
        const { error } =
          await supabase.auth.exchangeCodeForSession(
            code
          )

        if (error) {
          if (!cancelled) {
            setFailed(true)
            setMessage(
              'The invitation session could not be established. The link may have expired.'
            )
          }
          return
        }

        if (!cancelled) {
          router.replace('/onboarding')
          router.refresh()
        }
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        if (!cancelled) {
          router.replace('/onboarding')
          router.refresh()
        }
        return
      }

      if (!cancelled) {
        setFailed(true)
        setMessage(
          'No valid invitation session was found. The invitation link may have expired or already been used.'
        )
      }
    }

    void confirmInvite()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <OxfordLogo className="w-[220px]" />
          </div>

          <div className="rounded-lg border border-oxford-stone bg-white p-8 text-center shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-oxford-blue">
              Research Dashboard invitation
            </h1>

            <p
              className={
                failed
                  ? 'mt-4 text-sm leading-6 text-red-700'
                  : 'mt-4 text-sm leading-6 text-oxford-ash'
              }
            >
              {message}
            </p>

            {failed && (
              <a
                href="/login"
                className="mt-6 inline-flex rounded-md border border-oxford-blue bg-white px-4 py-2 text-sm font-medium text-oxford-blue transition hover:bg-oxford-shell"
              >
                Go to sign in
              </a>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
