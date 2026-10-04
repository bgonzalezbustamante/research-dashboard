export type BackupAppKey =
  | 'research-dashboard'
  | 'supervision-portal'
  | 'household-finances'

export type BackupState =
  | 'healthy'
  | 'running'
  | 'attention'
  | 'stale'

export type BackupLatestSuccess = {
  tag: string
  publishedAt: string
  archiveSize: number | null
  releaseUrl: string
}

export type BackupLatestAttempt = {
  runId: number
  event: string
  status: string
  conclusion: string | null
  createdAt: string
  runUrl: string
}

export type BackupStatus = {
  app: BackupAppKey
  state: BackupState
  latestSuccess: BackupLatestSuccess | null
  latestAttempt: BackupLatestAttempt | null
  scheduleUtc: string
  retention: {
    recent: 12
    monthly: 12
  }
}

const STALE_AFTER_MS =
  8 * 24 * 60 * 60 * 1000

const ATTENTION_CONCLUSIONS =
  new Set([
    'failure',
    'cancelled',
  ])

export function deriveBackupState({
  latestSuccess,
  latestAttempt,
  now = Date.now(),
}: {
  latestSuccess:
    | BackupLatestSuccess
    | null
  latestAttempt:
    | BackupLatestAttempt
    | null
  now?: number
}): BackupState {
  if (
    latestAttempt &&
    (
      latestAttempt.status ===
        'queued' ||
      latestAttempt.status ===
        'in_progress'
    )
  ) {
    return 'running'
  }

  if (!latestSuccess) {
    return 'attention'
  }

  if (
    latestAttempt &&
    latestAttempt.conclusion &&
    ATTENTION_CONCLUSIONS.has(
      latestAttempt.conclusion
    ) &&
    Date.parse(
      latestAttempt.createdAt
    ) >
      Date.parse(
        latestSuccess.publishedAt
      )
  ) {
    return 'attention'
  }

  if (
    now -
      Date.parse(
        latestSuccess.publishedAt
      ) >
    STALE_AFTER_MS
  ) {
    return 'stale'
  }

  return 'healthy'
}

export function parseBackupTagTimestamp(
  tag: string,
  prefix: string
) {
  if (!tag.startsWith(prefix)) {
    return null
  }

  const stamp =
    tag.slice(prefix.length)

  const match =
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(
      stamp
    )

  if (!match) {
    return null
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
  ] = match

  const iso =
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`

  const parsed =
    new Date(iso)

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null
  }

  return parsed.toISOString()
}

export function getBackupAgeMs(
  publishedAt: string,
  now = Date.now()
) {
  return Math.max(
    0,
    now -
      Date.parse(publishedAt)
  )
}
