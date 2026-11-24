import { withSupabase } from 'npm:@supabase/server@1.9.2'

type DeleteRequest = {
  user_id?: string
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

const handler = {
  fetch: withSupabase(
    { auth: 'user' },
    async (req, ctx) => {
      if (req.method !== 'POST') {
        return jsonResponse(
          { error: 'Method not allowed' },
          405
        )
      }

      let body: DeleteRequest

      try {
        body = await req.json()
      } catch {
        return jsonResponse(
          { error: 'Invalid request body' },
          400
        )
      }

      const userId =
        body.user_id?.trim() ?? ''

      if (!userId) {
        return jsonResponse(
          { error: 'User ID is required' },
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
        data: plan,
        error: planError,
      } = await ctx.supabase.rpc(
        'get_managed_account_deletion_plan',
        {
          p_user_id: userId,
        }
      )

      // Details go to the function log; responses carry generic text only.
      if (planError || !plan) {
        console.error(
          'Account deletion plan refused:',
          planError?.message ?? 'no plan'
        )

        return jsonResponse(
          {
            error:
              'The account cannot be deleted.',
          },
          403
        )
      }

      const {
        error: authDeleteError,
      } = await ctx.supabaseAdmin.auth.admin
        .deleteUser(userId)

      if (
        authDeleteError &&
        authDeleteError.status !== 404
      ) {
        console.error(
          'Authentication account deletion failed:',
          authDeleteError.message
        )

        return jsonResponse(
          {
            error:
              'The authentication account could not be deleted.',
          },
          500
        )
      }

      const {
        data: result,
        error: finalizeError,
      } = await ctx.supabase.rpc(
        'finalize_managed_account_deletion',
        {
          p_user_id: userId,
        }
      )

      if (finalizeError || !result) {
        console.error(
          'Dashboard cleanup after deletion failed:',
          finalizeError?.message ?? 'no result'
        )

        return jsonResponse(
          {
            error:
              'The login was deleted, but dashboard cleanup could not be completed.',
          },
          500
        )
      }

      return jsonResponse({
        ok: true,
        user_id: userId,
        profile_preserved:
          Boolean(
            result.profile_preserved
          ),
        note_count:
          Number(result.note_count ?? 0),
        author_count:
          Number(result.author_count ?? 0),
      })
    }
  ),
}

export default handler
