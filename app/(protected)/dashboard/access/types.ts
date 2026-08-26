export type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  deactivated_at: string | null
}

export type PaperRow = {
  id: string
  short_title: string
  title: string
  archived_at: string | null
}

export type AccessInvitationRow = {
  id: string
  email: string
  viewer_enabled: boolean
  status:
    | 'pending'
    | 'sent'
    | 'failed'
  auth_user_id: string | null
  sent_at: string | null
  created_at: string
  last_error: string | null
}

export type AccessAuditRow = {
  id: number | string
  actor_id: string | null
  target_user_id: string | null
  paper_id: string | null
  event_type:
    | 'audit_enabled'
    | 'viewer_granted'
    | 'viewer_revoked'
    | 'coauthor_granted'
    | 'coauthor_revoked'
    | 'invitation_created'
    | 'invitation_sent'
    | 'invitation_failed'
    | 'invitation_cancelled'
    | 'invitation_accepted'
    | 'account_renamed'
    | 'account_deactivated'
    | 'account_deleted'
  details: Record<string, unknown>
  created_at: string
}
