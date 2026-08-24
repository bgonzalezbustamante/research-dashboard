import Link from 'next/link'

import AppNavigation from '@/components/app-navigation'
import OxfordLogo from '@/components/oxford-logo'
import QuerySectionError from '@/components/query-section-error'
import ReadOnlyMode from '@/components/read-only-mode'
import SiteFooter from '@/components/site-footer'
import Button from '@/components/ui/button'
import { requireDashboardAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const access =
    await requireDashboardAccess()

  const supabase =
    await createClient()

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', access.userId)
    .maybeSingle()

  if (profileError) {
    throw new Error(
      `Could not load profile: ${profileError.message}`
    )
  }

  const fullName =
    profile?.full_name?.trim() ??
    ''

  const isViewer =
    access.role === 'viewer'

  return (
    <div
      data-dashboard-role={access.role}
      className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal"
    >
      <ReadOnlyMode
        enabled={isViewer}
      />

      <QuerySectionError
        parameter="locationError"
        targetId="location-labels"
      />

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
                {isViewer && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                    Viewer
                  </span>
                )}

                {fullName && (
                  <span className="hidden text-sm text-oxford-ash xl:inline">
                    {fullName}
                  </span>
                )}

                <form
                  action="/auth/signout"
                  method="post"
                >
                  <Button
                    type="submit"
                    variant="secondary"
                  >
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isViewer && (
        <div className="border-b border-sky-200 bg-sky-50">
          <div className="mx-auto max-w-7xl px-6 py-3 text-sm text-sky-900">
            <strong className="font-medium">
              Read-only access.
            </strong>{' '}
            You can browse Dashboard,
            Hours, Planning, and Papers,
            but changes are disabled.
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
