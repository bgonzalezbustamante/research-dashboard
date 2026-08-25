import Link from 'next/link'

import AppNavigation from '@/components/app-navigation'
import OxfordLogo from '@/components/oxford-logo'
import CoauthorPaperShortcut from '@/components/papers/coauthor-paper-shortcut'
import FormattingHints from '@/components/papers/formatting-hints'
import ResearchTextEnhancer from '@/components/papers/research-text-enhancer'
import QuerySectionError from '@/components/query-section-error'
import ReadOnlyMode from '@/components/read-only-mode'
import SiteFooter from '@/components/site-footer'
import Button from '@/components/ui/button'
import { requireAppAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const access =
    await requireAppAccess()

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

  const isOwner =
    access.canEditDashboard

  const isViewer =
    access.dashboardRole === 'viewer'

  const isCoauthor =
    access.hasCoauthorAccess

  const homeHref =
    access.hasDashboardAccess
      ? '/dashboard'
      : '/papers'

  const readOnlyByDefault =
    !isOwner

  let accessMessage = ''

  if (isViewer && isCoauthor) {
    accessMessage =
      'Viewer + Coauthor access. Dashboard-wide access is read-only; assigned papers allow permitted coauthor edits.'
  } else if (isViewer) {
    accessMessage =
      'Read-only access. You can browse Dashboard, Hours, Planning, and Papers, but changes are disabled.'
  } else if (isCoauthor) {
    accessMessage =
      'Coauthor access. You can browse assigned papers and edit permitted paper fields.'
  }

  return (
    <div
      data-app-read-only={
        readOnlyByDefault
          ? 'true'
          : 'false'
      }
      data-has-dashboard-access={
        access.hasDashboardAccess
          ? 'true'
          : 'false'
      }
      data-dashboard-role={
        access.dashboardRole ??
        'coauthor'
      }
      className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal"
    >
      <ReadOnlyMode
        enabled={readOnlyByDefault}
      />

      <FormattingHints />
      <ResearchTextEnhancer />

      <QuerySectionError
        parameter="locationError"
        targetId="location-labels"
      />

      <header className="border-b border-oxford-stone bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Link
                href={homeHref}
                aria-label={
                  access.hasDashboardAccess
                    ? 'Go to dashboard'
                    : 'Go to papers'
                }
                className="inline-flex"
              >
                <OxfordLogo className="w-[190px]" />
              </Link>

              <div className="hidden h-10 w-px bg-oxford-stone sm:block" />

              <Link
                href={homeHref}
                className="font-serif text-lg font-semibold text-oxford-blue transition hover:opacity-80"
              >
                Research Dashboard
              </Link>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <AppNavigation
                showDashboardModules={
                  access.hasDashboardAccess
                }
              />

              <div className="hidden h-8 w-px bg-oxford-stone sm:block" />

              <div className="flex items-center gap-2">
                {isViewer && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                    Viewer
                  </span>
                )}

                {isCoauthor && (
                  <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
                    Coauthor
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

      {accessMessage && (
        <div className="border-b border-sky-200 bg-sky-50">
          <div className="mx-auto max-w-7xl px-6 py-3 text-sm text-sky-900">
            {accessMessage}
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {isCoauthor && (
            <CoauthorPaperShortcut />
          )}

          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
