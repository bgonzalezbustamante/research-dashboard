import { withSupabase } from 'npm:@supabase/server'

type InviteRequest = {
  invitation_id?: string
  redirect_to?: string
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req, ctx) => {
      if (req.method !== 'POST') {
        return jsonResponse(
          { error: 'Method not allowed' },
          405
        )
      }

      let body: InviteRequest

      try {
        body = await req.json()
      } catch {
        return jsonResponse(
          { error: 'Invalid request body' },
          400
        )
      }

      const invitationId =
        body.invitation_id?.trim() ?? ''

      const redirectTo =
        body.redirect_to?.trim() ?? ''

      if (!invitationId || !redirectTo) {
        return jsonResponse(
          {
            error:
              'Invitation ID and redirect URL are required',
          },
          400
        )
      }

      let redirectUrl: URL

      try {
        redirectUrl = new URL(
          redirectTo
        )
      } catch {
        return jsonResponse(
          { error: 'Invalid redirect URL' },
          400
        )
      }

      const isProductionRedirect =
        redirectUrl.origin ===
          'https://dashboard.bgonzalezbustamante.com' &&
        redirectUrl.pathname ===
          '/auth/invite'

      const isLocalRedirect =
        (
          redirectUrl.origin ===
            'http://127.0.0.1:3000' ||
          redirectUrl.origin ===
            'http://localhost:3000'
        ) &&
        redirectUrl.pathname ===
          '/auth/invite'

      if (
        !isProductionRedirect &&
        !isLocalRedirect
      ) {
        return jsonResponse(
          {
            error:
              'Redirect URL is not allowed',
          },
          400
        )
      }

      const fallbackSubject =
        ctx.jwtClaims?.sub

      const callerId =
        ctx.userClaims?.id ??
        (
          typeof fallbackSubject === 'string'
            ? fallbackSubject
            : null
        )

      if (!callerId) {
        return jsonResponse(
          { error: 'Authentication required' },
          401
        )
      }

      const {
        data: invitation,
        error: invitationError,
      } = await ctx.supabase
        .from('access_invitations')
        .select(
          'id, owner_id, email, status'
        )
        .eq('id', invitationId)
        .maybeSingle()

      if (
        invitationError ||
        !invitation
      ) {
        return jsonResponse(
          { error: 'Invitation not found' },
          404
        )
      }

      const {
        data: ownerMembership,
        error: ownerError,
      } = await ctx.supabase
        .from('dashboard_members')
        .select('owner_id')
        .eq(
          'owner_id',
          invitation.owner_id
        )
        .eq('user_id', callerId)
        .eq('role', 'owner')
        .maybeSingle()

      if (
        ownerError ||
        !ownerMembership
      ) {
        return jsonResponse(
          {
            error:
              'Dashboard owner access required',
          },
          403
        )
      }

      if (
        invitation.status !== 'pending' &&
        invitation.status !== 'failed'
      ) {
        return jsonResponse(
          {
            error:
              'Invitation has already been processed',
          },
          409
        )
      }

      const {
        data: existingProfile,
        error: existingProfileError,
      } = await ctx.supabase
        .from('profiles')
        .select('id')
        .ilike(
          'email',
          invitation.email
        )
        .maybeSingle()

      if (existingProfileError) {
        return jsonResponse(
          {
            error:
              'Existing account status could not be checked',
          },
          500
        )
      }

      if (existingProfile) {
        const {
          data: existingAuthData,
          error: existingAuthError,
        } =
          await ctx.supabaseAdmin.auth.admin
            .getUserById(
              existingProfile.id
            )

        if (
          existingAuthError ||
          !existingAuthData.user
        ) {
          return jsonResponse(
            {
              error:
                'Existing account status could not be checked',
            },
            500
          )
        }

        const existingAuthUser =
          existingAuthData.user

        const isUnacceptedInvite =
          !existingAuthUser.confirmed_at &&
          Boolean(
            existingAuthUser.invited_at
          )

        if (!isUnacceptedInvite) {
          const {
            error: markFailedError,
          } = await ctx.supabase.rpc(
            'mark_access_invitation_failed',
            {
              p_invitation_id:
                invitation.id,
              p_error:
                'An account already exists for this email address.',
            }
          )

          if (markFailedError) {
            return jsonResponse(
              {
                error:
                  'An account already exists for this email address, and the invitation record could not be updated.',
              },
              500
            )
          }

          return jsonResponse(
            {
              error:
                'An account already exists for this email address',
            },
            409
          )
        }
      }

      const {
        data: invitedUser,
        error: inviteError,
      } =
        await ctx.supabaseAdmin.auth.admin
          .inviteUserByEmail(
            invitation.email,
            {
              redirectTo,
              data: {
                dashboard_invitation_id:
                  invitation.id,
              },
            }
          )

      if (
        inviteError ||
        !invitedUser.user
      ) {
        const message =
          inviteError?.message ??
          'The invitation email could not be sent.'

        const {
          error: markFailedError,
        } = await ctx.supabase.rpc(
          'mark_access_invitation_failed',
          {
            p_invitation_id:
              invitation.id,
            p_error:
              message.slice(0, 500),
          }
        )

        if (markFailedError) {
          return jsonResponse(
            {
              error:
                `${message} The invitation record could not be updated.`,
            },
            500
          )
        }

        return jsonResponse(
          { error: message },
          400
        )
      }

      const {
        error: finalizeError,
      } = await ctx.supabase.rpc(
        'mark_access_invitation_sent',
        {
          p_invitation_id:
            invitation.id,
          p_auth_user_id:
            invitedUser.user.id,
        }
      )

      if (finalizeError) {
        return jsonResponse(
          {
            error:
              'Invitation email was sent, but its dashboard record could not be finalised.',
          },
          500
        )
      }

      return jsonResponse({
        ok: true,
        invitation_id:
          invitation.id,
        user_id:
          invitedUser.user.id,
      })
    }
  ),
}
