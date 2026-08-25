import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

import {
  cancelAccessInvitation,
  retryAccessInvitation,
} from './actions'
import type {
  AccessInvitationRow,
  PaperRow,
} from './types'

type InvitationCardProps = {
  invitation: AccessInvitationRow
  papers: PaperRow[]
}

function formatTimestamp(
  value: string | null
) {
  if (!value) {
    return 'Not sent yet'
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    }
  ).format(new Date(value))
}

function statusLabel(
  status: AccessInvitationRow['status']
) {
  switch (status) {
    case 'sent':
      return 'Sent'
    case 'failed':
      return 'Send failed'
    default:
      return 'Pending'
  }
}

export default function InvitationCard({
  invitation,
  papers,
}: InvitationCardProps) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-lg font-semibold text-oxford-blue">
            {invitation.email}
          </h3>
          <p className="mt-1 text-xs text-oxford-ash">
            {invitation.sent_at
              ? `Sent ${formatTimestamp(invitation.sent_at)}`
              : `Created ${formatTimestamp(invitation.created_at)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={
              invitation.status === 'failed'
                ? 'rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700'
                : invitation.status === 'sent'
                  ? 'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800'
                  : 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800'
            }
          >
            {statusLabel(invitation.status)}
          </span>

          {invitation.viewer_enabled && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
              Viewer
            </span>
          )}

          {papers.length > 0 && (
            <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
              Coauthor · {papers.length}{' '}
              {papers.length === 1
                ? 'paper'
                : 'papers'}
            </span>
          )}
        </div>
      </div>

      {papers.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {papers.map((paper) => (
            <span
              key={paper.id}
              className="rounded-md border border-oxford-stone bg-oxford-off-white px-2.5 py-1 text-xs text-oxford-charcoal"
            >
              {paper.short_title}
              {paper.archived_at
                ? ' · Archived'
                : ''}
            </span>
          ))}
        </div>
      )}

      {invitation.status === 'failed' &&
        invitation.last_error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {invitation.last_error}
          </p>
        )}

      <div className="mt-5 flex flex-wrap gap-2">
        {(invitation.status === 'pending' ||
          invitation.status === 'failed') && (
          <form action={retryAccessInvitation}>
            <input
              type="hidden"
              name="invitation_id"
              value={invitation.id}
            />
            <Button
              type="submit"
              variant="secondary"
            >
              Retry email
            </Button>
          </form>
        )}

        <form action={cancelAccessInvitation}>
          <input
            type="hidden"
            name="invitation_id"
            value={invitation.id}
          />
          <Button
            type="submit"
            variant="danger"
          >
            Cancel invitation
          </Button>
        </form>
      </div>
    </Card>
  )
}
