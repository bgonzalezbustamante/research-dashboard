import { createHash } from 'node:crypto'
import Link from 'next/link'
import {
  redirect,
} from 'next/navigation'

import RunBackupButton from '@/components/backups/run-backup-button'
import PageHeader from '@/components/page-header'
import Card from '@/components/ui/card'
import type {
  BackupState,
  BackupStatus,
} from '@/lib/backups/core'
import {
  BackupIntegrationError,
  getBackupStatuses,
} from '@/lib/backups/github'
import {
  BACKUP_APPLICATIONS,
} from '@/lib/backups/registry'
import {
  requireDashboardAccess,
} from '@/lib/auth/dashboard-access'

export const dynamic =
  'force-dynamic'

function stateLabel(
  state: BackupState
) {
  switch (state) {
    case 'healthy':
      return 'Healthy'
    case 'running':
      return 'Running'
    case 'attention':
      return 'Attention'
    case 'stale':
      return 'Stale'
  }
}

function stateClass(
  state: BackupState
) {
  switch (state) {
    case 'healthy':
      return 'border-green-200 bg-green-50 text-green-800'
    case 'running':
      return 'border-sky-200 bg-sky-50 text-sky-900'
    case 'attention':
      return 'border-red-200 bg-red-50 text-red-800'
    case 'stale':
      return 'border-amber-200 bg-amber-50 text-amber-800'
  }
}

function getRuntimeTokenFingerprint() {
  const token =
    process.env
      .APPS_BACKUPS_GITHUB_TOKEN
      ?.trim()

  if (!token) {
    return null
  }

  return {
    length: token.length,
    sha256Prefix:
      createHash('sha256')
        .update(token, 'utf8')
        .digest('hex')
        .slice(0, 12),
  }
}

function formatTimestamp(
  value: string
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone:
        'Europe/Amsterdam',
      timeZoneName: 'short',
    }
  ).format(
    new Date(value)
  )
}

function formatAge(
  value: string
) {
  const milliseconds =
    Math.max(
      0,
      Date.now() -
        Date.parse(value)
    )

  const hours =
    Math.floor(
      milliseconds /
        (60 * 60 * 1000)
    )

  if (hours < 1) {
    const minutes =
      Math.max(
        1,
        Math.floor(
          milliseconds /
            (60 * 1000)
        )
      )

    return `${minutes} min`
  }

  if (hours < 24) {
    return `${hours} h`
  }

  const days =
    Math.floor(
      hours / 24
    )

  const remainingHours =
    hours % 24

  return remainingHours > 0
    ? `${days} d ${remainingHours} h`
    : `${days} d`
}

function formatSize(
  bytes: number | null
) {
  if (bytes === null) {
    return 'Unknown'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kib =
    bytes / 1024

  if (kib < 1024) {
    return `${kib.toFixed(
      1
    )} KiB`
  }

  return `${(
    kib / 1024
  ).toFixed(1)} MiB`
}

function attemptEventLabel(
  event: string
) {
  if (event === 'schedule') {
    return 'Scheduled'
  }

  if (
    event ===
    'workflow_dispatch'
  ) {
    return 'Manual'
  }

  return event
}

function attemptStatusLabel(
  status: BackupStatus
) {
  const attempt =
    status.latestAttempt

  if (!attempt) {
    return 'No workflow attempt found'
  }

  if (
    attempt.status ===
    'completed'
  ) {
    return attempt.conclusion
      ? `Completed · ${attempt.conclusion}`
      : 'Completed'
  }

  return attempt.status.replace(
    '_',
    ' '
  )
}

function SummaryPill({
  label,
  count,
  className,
}: {
  label: string
  count: number
  className: string
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${className}`}
    >
      {label}: {count}
    </span>
  )
}

export default async function BackupsPage() {
  const access =
    await requireDashboardAccess()

  if (!access.canEdit) {
    redirect('/dashboard')
  }

  let statuses:
    | BackupStatus[]
    | null = null

  let integrationError:
    | string
    | null = null

  try {
    statuses =
      await getBackupStatuses()
  } catch (error) {
    if (
      error instanceof
      BackupIntegrationError
    ) {
      integrationError =
        error.message
    } else {
      integrationError =
        'Backup metadata could not be loaded because of an unexpected server-side error.'
    }
  }

  const runtimeTokenFingerprint =
    integrationError
      ? getRuntimeTokenFingerprint()
      : null

  const counts = {
    healthy:
      statuses?.filter(
        (status) =>
          status.state ===
          'healthy'
      ).length ?? 0,
    running:
      statuses?.filter(
        (status) =>
          status.state ===
          'running'
      ).length ?? 0,
    attention:
      statuses?.filter(
        (status) =>
          status.state ===
          'attention'
      ).length ?? 0,
    stale:
      statuses?.filter(
        (status) =>
          status.state ===
          'stale'
      ).length ?? 0,
  }

  return (
    <div>
      <PageHeader
        title="Backups"
        description="Operational status and manual dispatch controls for encrypted application backups managed by the private apps-backups repository."
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
              Backup health
            </div>

            <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
              Three managed applications
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-oxford-ash">
              Healthy backups are no
              more than eight days old.
              Running attempts take
              precedence; failed or
              cancelled attempts newer
              than the last successful
              release require attention.
            </p>
          </div>

          {statuses && (
            <div className="flex flex-wrap gap-2">
              <SummaryPill
                label="Healthy"
                count={
                  counts.healthy
                }
                className="border-green-200 bg-green-50 text-green-800"
              />

              <SummaryPill
                label="Running"
                count={
                  counts.running
                }
                className="border-sky-200 bg-sky-50 text-sky-900"
              />

              <SummaryPill
                label="Attention"
                count={
                  counts.attention
                }
                className="border-red-200 bg-red-50 text-red-800"
              />

              <SummaryPill
                label="Stale"
                count={
                  counts.stale
                }
                className="border-amber-200 bg-amber-50 text-amber-800"
              />
            </div>
          )}
        </div>
      </Card>

      {integrationError ? (
        <Card className="border-red-200 bg-red-50">
          <h2 className="font-serif text-xl font-semibold text-red-900">
            Backup integration unavailable
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-800">
            {integrationError}
          </p>

          <p className="mt-3 text-xs leading-5 text-red-700">
            The token must remain
            server-only and should be a
            fine-grained GitHub token
            restricted to
            bgonzalezbustamante/apps-backups
            with Actions read/write and
            Contents read permissions.
          </p>

          <div className="mt-4 rounded-lg border border-red-200 bg-white/60 px-3 py-2 text-xs leading-5 text-red-900">
            <div className="font-medium">
              Temporary runtime token diagnostic
            </div>

            {runtimeTokenFingerprint ? (
              <div className="mt-1 font-mono">
                Length:{' '}
                {
                  runtimeTokenFingerprint.length
                }
                {' · '}
                SHA-256 prefix:{' '}
                {
                  runtimeTokenFingerprint.sha256Prefix
                }
              </div>
            ) : (
              <div className="mt-1">
                APPS_BACKUPS_GITHUB_TOKEN
                is not available to this
                runtime.
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {statuses?.map(
            (status) => {
              const config =
                BACKUP_APPLICATIONS[
                  status.app
                ]

              return (
                <Card
                  key={
                    status.app
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                        Application
                      </div>

                      <h2 className="mt-1 font-serif text-xl font-semibold text-oxford-blue">
                        {
                          config.label
                        }
                      </h2>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stateClass(
                        status.state
                      )}`}
                    >
                      {stateLabel(
                        status.state
                      )}
                    </span>
                  </div>

                  <dl className="mt-5 space-y-4 text-sm">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                        Latest successful
                        backup
                      </dt>

                      <dd className="mt-1 text-oxford-charcoal">
                        {status.latestSuccess ? (
                          <>
                            <span className="font-medium">
                              {formatTimestamp(
                                status
                                  .latestSuccess
                                  .publishedAt
                              )}
                            </span>
                            <span className="text-oxford-ash">
                              {' '}
                              ·{' '}
                              {formatAge(
                                status
                                  .latestSuccess
                                  .publishedAt
                              )}{' '}
                              ago
                            </span>
                          </>
                        ) : (
                          'No successful release found'
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                        Encrypted archive
                      </dt>

                      <dd className="mt-1 text-oxford-charcoal">
                        {status.latestSuccess
                          ? formatSize(
                              status
                                .latestSuccess
                                .archiveSize
                            )
                          : '—'}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                        Latest workflow
                        attempt
                      </dt>

                      <dd className="mt-1 text-oxford-charcoal">
                        {attemptStatusLabel(
                          status
                        )}
                      </dd>

                      {status.latestAttempt && (
                        <dd className="mt-1 text-xs text-oxford-ash">
                          {attemptEventLabel(
                            status
                              .latestAttempt
                              .event
                          )}
                          {' · '}
                          {formatTimestamp(
                            status
                              .latestAttempt
                              .createdAt
                          )}
                        </dd>
                      )}
                    </div>

                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                        Weekly schedule
                      </dt>

                      <dd className="mt-1 text-oxford-charcoal">
                        {
                          status.scheduleUtc
                        }
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-oxford-ash">
                        Retention
                      </dt>

                      <dd className="mt-1 text-oxford-charcoal">
                        {
                          status
                            .retention
                            .recent
                        }{' '}
                        recent releases ·{' '}
                        {
                          status
                            .retention
                            .monthly
                        }{' '}
                        monthly anchors ·
                        protected milestone
                        tags retained
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-oxford-stone pt-4 text-sm">
                    {status.latestSuccess && (
                      <Link
                        href={
                          status
                            .latestSuccess
                            .releaseUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-oxford-blue underline-offset-4 hover:underline"
                      >
                        Private release
                      </Link>
                    )}

                    {status.latestAttempt && (
                      <Link
                        href={
                          status
                            .latestAttempt
                            .runUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-oxford-blue underline-offset-4 hover:underline"
                      >
                        Workflow run
                      </Link>
                    )}
                  </div>

                  <div className="mt-5">
                    <RunBackupButton
                      app={
                        status.app
                      }
                      disabled={
                        status.state ===
                        'running'
                      }
                    />
                  </div>
                </Card>
              )
            }
          )}
        </div>
      )}

      <Card className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-oxford-blue">
          Operations boundary
        </h2>

        <p className="mt-2 text-sm leading-6 text-oxford-ash">
          Research Dashboard reads
          release and workflow metadata
          and may dispatch an allow-listed
          backup workflow. It does not
          download, decrypt, restore,
          delete, or prune backup
          archives. Retention remains
          owned by the private
          apps-backups repository.
        </p>
      </Card>
    </div>
  )
}
