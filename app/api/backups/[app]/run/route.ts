import {
  revalidatePath,
} from 'next/cache'
import {
  NextResponse,
} from 'next/server'

import {
  dispatchBackupWorkflow,
  BackupIntegrationError,
} from '@/lib/backups/github'
import {
  isBackupAppKey,
} from '@/lib/backups/registry'
import {
  requireDashboardAccess,
} from '@/lib/auth/dashboard-access'

export const dynamic =
  'force-dynamic'

type RunBackupRouteProps = {
  params: Promise<{
    app: string
  }>
}

export async function POST(
  request: Request,
  {
    params,
  }: RunBackupRouteProps
) {
  const origin =
    request.headers.get(
      'origin'
    )

  if (
    !origin ||
    origin !==
      new URL(
        request.url
      ).origin
  ) {
    return NextResponse.json(
      {
        error:
          'Backup requests must originate from Research Dashboard.',
      },
      {
        status: 403,
      }
    )
  }

  const {
    app,
  } = await params

  if (!isBackupAppKey(app)) {
    return NextResponse.json(
      {
        error:
          'Unknown backup application.',
      },
      {
        status: 404,
      }
    )
  }

  const access =
    await requireDashboardAccess()

  if (!access.canEdit) {
    return NextResponse.json(
      {
        error:
          'Backup operations require Owner or administrative edit access.',
      },
      {
        status: 403,
      }
    )
  }

  try {
    const run =
      await dispatchBackupWorkflow(
        app
      )

    revalidatePath(
      '/backups'
    )

    return NextResponse.json(
      {
        ok: true,
        discovered:
          run !== null,
      }
    )
  } catch (error) {
    if (
      error instanceof
      BackupIntegrationError
    ) {
      if (
        error.code ===
        'duplicate_run'
      ) {
        return NextResponse.json(
          {
            error:
              'A backup for this application is already queued or in progress.',
          },
          {
            status: 409,
          }
        )
      }

      if (
        error.code ===
        'not_configured'
      ) {
        return NextResponse.json(
          {
            error:
              'Backup integration is not configured on the server.',
          },
          {
            status: 503,
          }
        )
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof
          BackupIntegrationError
            ? error.message
            : 'GitHub could not start the backup workflow.',
      },
      {
        status: 502,
      }
    )
  }
}
