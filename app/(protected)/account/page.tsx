import { redirect } from 'next/navigation'

import Button from '@/components/ui/button'
import { requireAppAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'

import {
  changeOwnPassword,
  requestEmailChange,
  updateOwnName,
} from './actions'

type AccountPageProps = {
  searchParams: Promise<{
    notice?: string
    error?: string
  }>
}

export default async function AccountPage({
  searchParams,
}: AccountPageProps) {
  const params = await searchParams
  const access = await requireAppAccess()
  const supabase = await createClient()

  const [
    profileResult,
    userResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, timezone')
      .eq('id', access.userId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (userResult.error || !userResult.data.user) {
    redirect('/login')
  }

  if (profileResult.error) {
    throw new Error(
      `Could not load account profile: ${profileResult.error.message}`
    )
  }

  const profile = profileResult.data
  const user = userResult.data.user

  const currentEmail =
    user.email ?? profile?.email ?? ''

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-oxford-ash">
          Personal settings
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-oxford-blue">
          Account
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-oxford-ash">
          Manage your personal profile and sign-in credentials. These settings apply only to your own account and do not change dashboard or paper permissions.
        </p>
      </div>

      {params.notice && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {params.notice}
        </div>
      )}

      {params.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {params.error}
        </div>
      )}

      <section className="rounded-lg border border-oxford-stone bg-white p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Personal details
        </h2>
        <p className="mt-1 text-sm leading-6 text-oxford-ash">
          Your display name is used throughout the Research Dashboard.
        </p>

        <form
          action={updateOwnName}
          data-self-service="true"
          className="mt-6 max-w-xl space-y-4"
        >
          <div>
            <label
              htmlFor="full_name"
              className="mb-1 block text-sm font-medium text-oxford-charcoal"
            >
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              minLength={2}
              defaultValue={profile?.full_name ?? ''}
              autoComplete="name"
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
          >
            Save name
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-oxford-stone bg-white p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Email address
        </h2>
        <p className="mt-1 text-sm leading-6 text-oxford-ash">
          Your email address is your sign-in identity. A change takes effect only after the required email-verification steps are completed.
        </p>

        <div className="mt-5 max-w-xl rounded-md border border-oxford-stone bg-oxford-off-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
            Current email
          </div>
          <div className="mt-1 break-all text-sm font-medium text-oxford-charcoal">
            {currentEmail}
          </div>
        </div>

        <form
          action={requestEmailChange}
          data-self-service="true"
          className="mt-6 max-w-xl space-y-4"
        >
          <div>
            <label
              htmlFor="new_email"
              className="mb-1 block text-sm font-medium text-oxford-charcoal"
            >
              New email address
            </label>
            <input
              id="new_email"
              name="new_email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            />
          </div>

          <p className="text-xs leading-5 text-oxford-ash">
            For security, you may be asked to confirm the change from both your current and new email addresses. Your dashboard permissions remain attached to the same account.
          </p>

          <Button
            type="submit"
            variant="primary"
          >
            Change email
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-oxford-stone bg-white p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Password
        </h2>
        <p className="mt-1 text-sm leading-6 text-oxford-ash">
          Set a new password for this account. Passwords must contain at least 10 characters.
        </p>

        <form
          action={changeOwnPassword}
          data-self-service="true"
          className="mt-6 max-w-xl space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
                minLength={10}
                autoComplete="new-password"
                className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
              />
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className="mb-1 block text-sm font-medium text-oxford-charcoal"
              >
                Confirm password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
              />
            </div>
          </div>

          <p className="text-xs leading-5 text-oxford-ash">
            After the password is changed, the application signs this account out so you can sign in again with the new password.
          </p>

          <Button
            type="submit"
            variant="primary"
          >
            Change password
          </Button>
        </form>
      </section>
    </div>
  )
}
