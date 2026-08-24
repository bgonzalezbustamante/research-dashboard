import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import OxfordLogo from '@/components/oxford-logo'
import AppNavigation from '@/components/app-navigation'
import SiteFooter from '@/components/site-footer'
import Button from '@/components/ui/button'

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/login')
  }
  
  const userId =
  typeof data.claims.sub === 'string'
    ? data.claims.sub
    : ''

  let fullName = ''

  if (userId) {
    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      throw new Error(
        `Could not load profile: ${profileError.message}`
      )
    }

    fullName =
      profile?.full_name?.trim() ??
      ''
  }

  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <header className="border-b border-oxford-stone bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Link
                href="/dashboard"
                aria-label="Go to dashboard"
                className="inline-flex"
              >
                <OxfordLogo className="w-[190px]" />
              </Link>

              <div className="hidden h-10 w-px bg-oxford-stone sm:block" />

              <Link
                href="/dashboard"
                className="font-serif text-lg font-semibold text-oxford-blue transition hover:opacity-80"
              >
                Research Dashboard
              </Link>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <AppNavigation />

              <div className="hidden h-8 w-px bg-oxford-stone sm:block" />

              <div className="flex items-center gap-3">
                {fullName && (
                  <span className="hidden text-sm text-oxford-ash xl:inline">
                    {fullName}
                  </span>
                )}

                <form action="/auth/signout" method="post">
                  <Button type="submit" variant="secondary">
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}