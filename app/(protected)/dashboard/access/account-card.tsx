import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

import AccountIdentityControls from './account-identity-controls'
import {
  saveCoauthorAssignments,
  setViewerAccess,
} from './actions'
import type {
  PaperRow,
  ProfileRow,
} from './types'

type AccountCardProps = {
  profile: ProfileRow
  isViewer: boolean
  assignedPaperIds: string[]
  papers: PaperRow[]
}

function displayName(
  profile: ProfileRow
) {
  return (
    profile.full_name?.trim() ||
    profile.email?.trim() ||
    'Unnamed account'
  )
}

export default function AccountCard({
  profile,
  isViewer,
  assignedPaperIds,
  papers,
}: AccountCardProps) {
  const assigned =
    new Set(assignedPaperIds)

  const isCoauthor =
    assigned.size > 0

  return (
    <Card>
      <div className="flex flex-col gap-4 border-b border-oxford-stone pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-xl font-semibold text-oxford-blue">
            {displayName(profile)}
          </h3>

          {profile.email && (
            <p className="mt-1 text-sm text-oxford-ash">
              {profile.email}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isViewer && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
              Viewer
            </span>
          )}

          {isCoauthor && (
            <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
              Coauthor · {assigned.size}{' '}
              {assigned.size === 1
                ? 'paper'
                : 'papers'}
            </span>
          )}

          {!isViewer && !isCoauthor && (
            <span className="rounded-full border border-oxford-stone bg-oxford-shell px-2.5 py-1 text-xs font-medium text-oxford-ash">
              No access
            </span>
          )}
        </div>
      </div>

      <AccountIdentityControls
        userId={profile.id}
        fullName={profile.full_name}
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
        <div>
          <h4 className="font-medium text-oxford-charcoal">
            Dashboard Viewer
          </h4>
          <p className="mt-1 text-sm leading-6 text-oxford-ash">
            Read-only access to Dashboard, Hours, Planning and all Papers.
          </p>

          <form
            action={setViewerAccess}
            className="mt-4"
          >
            <input
              type="hidden"
              name="user_id"
              value={profile.id}
            />
            <input
              type="hidden"
              name="enabled"
              value={
                isViewer
                  ? 'false'
                  : 'true'
              }
            />

            <Button
              type="submit"
              variant={
                isViewer
                  ? 'secondary'
                  : 'primary'
              }
            >
              {isViewer
                ? 'Remove Viewer access'
                : 'Grant Viewer access'}
            </Button>
          </form>
        </div>

        <div>
          <h4 className="font-medium text-oxford-charcoal">
            Paper Coauthor
          </h4>
          <p className="mt-1 text-sm leading-6 text-oxford-ash">
            Select the papers this account may collaborate on. Saving an empty selection removes all Coauthor assignments.
          </p>

          <form
            action={saveCoauthorAssignments}
            className="mt-4"
          >
            <input
              type="hidden"
              name="user_id"
              value={profile.id}
            />

            {papers.length === 0 ? (
              <p className="rounded-md border border-oxford-stone bg-oxford-shell px-4 py-3 text-sm text-oxford-ash">
                No papers are available for assignment.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-oxford-stone bg-oxford-off-white p-3">
                {papers.map((paper) => {
                  const archived =
                    Boolean(
                      paper.archived_at
                    )

                  const alreadyAssigned =
                    assigned.has(paper.id)

                  const disabled =
                    archived &&
                    !alreadyAssigned

                  return (
                    <label
                      key={paper.id}
                      className={
                        disabled
                          ? 'flex cursor-not-allowed items-start gap-3 rounded-md bg-white px-3 py-2.5 text-sm opacity-60'
                          : 'flex cursor-pointer items-start gap-3 rounded-md bg-white px-3 py-2.5 text-sm transition hover:bg-oxford-shell'
                      }
                    >
                      <input
                        type="checkbox"
                        name="paper_id"
                        value={paper.id}
                        defaultChecked={
                          alreadyAssigned
                        }
                        disabled={disabled}
                        className="mt-1 h-4 w-4 accent-oxford-blue"
                      />

                      <span className="min-w-0">
                        <span className="font-medium text-oxford-charcoal">
                          {paper.short_title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-oxford-ash">
                          {paper.title}
                          {archived
                            ? ' · Archived'
                            : ''}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="mt-4"
              disabled={papers.length === 0}
            >
              Save paper access
            </Button>

            <p className="mt-2 text-xs leading-5 text-oxford-ash">
              Archived assignments may be removed, but archived papers cannot receive new Coauthor assignments.
            </p>
          </form>
        </div>
      </div>
    </Card>
  )
}
