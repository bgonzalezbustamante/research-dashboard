import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

import { createAccessInvitation } from './actions'
import type { PaperRow } from './types'

type InviteAccountFormProps = {
  papers: PaperRow[]
}

export default function InviteAccountForm({
  papers,
}: InviteAccountFormProps) {
  return (
    <Card className="mb-6">
      <h2 className="font-serif text-2xl font-semibold text-oxford-blue">
        Invite account
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-oxford-ash">
        Send a new collaborator an invitation by email. The selected permissions remain inactive until the recipient accepts the email, creates a password and completes onboarding.
      </p>

      <form
        action={createAccessInvitation}
        className="mt-5"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
          <div>
            <label
              htmlFor="invite_email"
              className="mb-1 block text-sm font-medium text-oxford-charcoal"
            >
              Email address
            </label>
            <input
              id="invite_email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="collaborator@example.com"
              className="w-full rounded-md border border-oxford-stone bg-white px-3 py-2 text-oxford-charcoal outline-none transition focus:border-oxford-blue focus:ring-1 focus:ring-oxford-blue"
            />

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md border border-oxford-stone bg-oxford-off-white p-3">
              <input
                type="checkbox"
                name="viewer_enabled"
                value="true"
                className="mt-1 h-4 w-4 accent-oxford-blue"
              />
              <span>
                <span className="block text-sm font-medium text-oxford-charcoal">
                  Dashboard Viewer
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-oxford-ash">
                  Read-only access to Dashboard, Hours, Planning and all Papers.
                </span>
              </span>
            </label>
          </div>

          <div>
            <h3 className="text-sm font-medium text-oxford-charcoal">
              Paper Coauthor
            </h3>
            <p className="mt-1 text-xs leading-5 text-oxford-ash">
              Optionally select the papers this person may collaborate on. Viewer and Coauthor permissions can be combined.
            </p>

            {papers.length === 0 ? (
              <p className="mt-3 rounded-md border border-oxford-stone bg-oxford-shell px-4 py-3 text-sm text-oxford-ash">
                No papers are available for assignment.
              </p>
            ) : (
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-md border border-oxford-stone bg-oxford-off-white p-3">
                {papers.map((paper) => (
                  <label
                    key={paper.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md bg-white px-3 py-2.5 text-sm transition hover:bg-oxford-shell"
                  >
                    <input
                      type="checkbox"
                      name="paper_id"
                      value={paper.id}
                      className="mt-1 h-4 w-4 accent-oxford-blue"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-oxford-charcoal">
                        {paper.short_title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-oxford-ash">
                        {paper.title}
                        {paper.archived_at
                          ? ' · Archived'
                          : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="mt-5"
        >
          Send invitation
        </Button>
      </form>
    </Card>
  )
}
