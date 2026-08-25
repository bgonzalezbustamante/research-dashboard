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
