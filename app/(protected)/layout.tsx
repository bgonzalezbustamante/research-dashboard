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

  const email =
    typeof data.claims.email === 'string'
      ? data.claims.email
      : ''

  return (
    <div className="flex min-h-screen flex-col bg-oxford-off-white text-oxford-charcoal">
      <header className="border-b border-oxford-stone bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <OxfordLogo className="w-[190px]" />

              <div className="hidden h-10 w-px bg-oxford-stone sm:block" />

              <p className="font-serif text-lg font-semibold text-oxford-blue">
                Research Dashboard
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <AppNavigation />

              <div className="hidden h-8 w-px bg-oxford-stone sm:block" />

              <div className="flex items-center gap-3">
                {email && (
                  <span className="hidden text-sm text-oxford-ash xl:inline">
                    {email}
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