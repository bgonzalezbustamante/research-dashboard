import OxfordLogo from '@/components/oxford-logo'
import Button from '@/components/ui/button'

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen bg-oxford-off-white px-6 py-16 text-oxford-charcoal">
      <div className="mx-auto max-w-xl rounded-lg border border-oxford-stone bg-white p-8 shadow-sm">
        <OxfordLogo className="w-[190px]" />

        <h1 className="mt-8 font-serif text-3xl font-semibold text-oxford-blue">
          Access not granted
        </h1>

        <p className="mt-3 text-sm leading-6 text-oxford-ash">
          This account is authenticated,
          but it does not currently have
          access to this Research Dashboard.
          Ask the dashboard owner to grant
          access before signing in again.
        </p>

        <form
          action="/auth/signout"
          method="post"
          className="mt-6"
        >
          <Button
            type="submit"
            variant="secondary"
          >
            Sign out
          </Button>
        </form>
      </div>
    </main>
  )
}
