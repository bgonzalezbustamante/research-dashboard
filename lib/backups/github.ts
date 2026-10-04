import 'server-only'

import {
  deriveBackupState,
  parseBackupTagTimestamp,
  type BackupAppKey,
  type BackupLatestAttempt,
  type BackupLatestSuccess,
  type BackupStatus,
} from './core'
import {
  BACKUP_APPLICATIONS,
  BACKUP_APPLICATION_KEYS,
  BACKUP_REPOSITORY,
  BACKUP_RETENTION,
} from './registry'

type GitHubAsset = {
  name: string
  size: number
}

type GitHubRelease = {
  tag_name: string
  published_at: string | null
  html_url: string
  draft: boolean
  assets: GitHubAsset[]
}

type GitHubWorkflowRun = {
  id: number
  event: string
  status: string
  conclusion: string | null
  created_at: string
  html_url: string
  head_branch: string | null
}

type GitHubWorkflowRunsResponse = {
  workflow_runs: GitHubWorkflowRun[]
}

export class BackupIntegrationError extends Error {
  code:
    | 'not_configured'
    | 'duplicate_run'
    | 'github_request_failed'

  constructor(
    code:
      | 'not_configured'
      | 'duplicate_run'
      | 'github_request_failed',
    message: string
  ) {
    super(message)
    this.name =
      'BackupIntegrationError'
    this.code = code
  }
}

function getGitHubToken() {
  const token =
    process.env
      .APPS_BACKUPS_GITHUB_TOKEN
      ?.trim()

  if (!token) {
    throw new BackupIntegrationError(
      'not_configured',
      'Backup GitHub integration is not configured.'
    )
  }

  return token
}

function githubUrl(
  path: string
) {
  return (
    'https://api.github.com' +
    path
  )
}

async function githubRequest<T>(
  path: string,
  {
    label,
    ...init
  }: RequestInit & {
    label: string
  }
): Promise<T> {
  const token =
    getGitHubToken()

  const headers =
    new Headers(
      init.headers
    )

  headers.set(
    'Accept',
    'application/vnd.github+json'
  )
  headers.set(
    'Authorization',
    `Bearer ${token}`
  )
  headers.set(
    'X-GitHub-Api-Version',
    '2022-11-28'
  )
  headers.set(
    'User-Agent',
    'research-dashboard-backup-integration'
  )

  const response =
    await fetch(
      githubUrl(path),
      {
        ...init,
        cache: 'no-store',
        headers,
      }
    )

  if (!response.ok) {
    throw new BackupIntegrationError(
      'github_request_failed',
      `GitHub ${label} request failed with status ${response.status}.`
    )
  }

  if (
    response.status === 204
  ) {
    return undefined as T
  }

  return await response.json() as T
}

function repositoryPath(
  suffix: string
) {
  return `/repos/${BACKUP_REPOSITORY.owner}/${BACKUP_REPOSITORY.repo}${suffix}`
}

async function fetchReleases() {
  return githubRequest<
    GitHubRelease[]
  >(
    repositoryPath(
      '/releases?per_page=100'
    ),
    {
      label: 'releases',
    }
  )
}

async function fetchWorkflowRuns(
  app: BackupAppKey,
  perPage = 20
) {
  const config =
    BACKUP_APPLICATIONS[app]

  return githubRequest<
    GitHubWorkflowRunsResponse
  >(
    repositoryPath(
      `/actions/workflows/${encodeURIComponent(
        config.workflowFile
      )}/runs?branch=${BACKUP_REPOSITORY.ref}&per_page=${perPage}`
    ),
    {
      label:
        `${config.label} workflow runs`,
    }
  )
}

function toLatestSuccess(
  app: BackupAppKey,
  releases: GitHubRelease[]
): BackupLatestSuccess | null {
  const config =
    BACKUP_APPLICATIONS[app]

  const matching =
    releases
      .filter(
        (release) => {
          if (
            release.draft ||
            !release.tag_name.startsWith(
              config.tagPrefix
            )
          ) {
            return false
          }

          const expectedArchive =
            `${release.tag_name}.tar.gz.age`

          return release.assets.some(
            (asset) =>
              asset.name ===
                expectedArchive ||
              asset.name.endsWith(
                '.tar.gz.age'
              )
          )
        }
      )
      .map((release) => ({
        release,
        successAt:
          parseBackupTagTimestamp(
            release.tag_name,
            config.tagPrefix
          ) ??
          release.published_at,
      }))
      .filter(
        (
          item
        ): item is {
          release: GitHubRelease
          successAt: string
        } =>
          Boolean(item.successAt)
      )
      .sort(
        (a, b) =>
          Date.parse(
            b.successAt
          ) -
          Date.parse(
            a.successAt
          )
      )

  const latest =
    matching[0]

  if (!latest) {
    return null
  }

  const expectedArchiveName =
    `${latest.release.tag_name}.tar.gz.age`

  const archive =
    latest.release.assets.find(
      (asset) =>
        asset.name ===
        expectedArchiveName
    ) ??
    latest.release.assets.find(
      (asset) =>
        asset.name.endsWith(
          '.tar.gz.age'
        )
    )

  return {
    tag:
      latest.release.tag_name,
    publishedAt:
      latest.successAt,
    archiveSize:
      archive?.size ?? null,
    releaseUrl:
      latest.release.html_url,
  }
}

function toLatestAttempt(
  run:
    | GitHubWorkflowRun
    | undefined
): BackupLatestAttempt | null {
  if (!run) {
    return null
  }

  return {
    runId: run.id,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    createdAt:
      run.created_at,
    runUrl:
      run.html_url,
  }
}

function isActiveRun(
  run: GitHubWorkflowRun
) {
  return (
    run.status === 'queued' ||
    run.status === 'in_progress'
  )
}

export async function getBackupStatuses(): Promise<
  BackupStatus[]
> {
  const [
    releases,
    runResponses,
  ] = await Promise.all([
    fetchReleases(),
    Promise.all(
      BACKUP_APPLICATION_KEYS.map(
        (app) =>
          fetchWorkflowRuns(
            app,
            10
          )
      )
    ),
  ])

  return BACKUP_APPLICATION_KEYS.map(
    (app, index) => {
      const runs =
        runResponses[index]
          ?.workflow_runs ??
        []

      const latestSuccess =
        toLatestSuccess(
          app,
          releases
        )

      const latestAttempt =
        toLatestAttempt(
          runs[0]
        )

      return {
        app,
        state:
          deriveBackupState({
            latestSuccess,
            latestAttempt,
          }),
        latestSuccess,
        latestAttempt,
        scheduleUtc:
          BACKUP_APPLICATIONS[
            app
          ].scheduleUtc,
        retention:
          BACKUP_RETENTION,
      }
    }
  )
}

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      )
    }
  )
}

export async function dispatchBackupWorkflow(
  app: BackupAppKey
) {
  const existingRuns =
    (
      await fetchWorkflowRuns(
        app,
        20
      )
    ).workflow_runs

  if (
    existingRuns.some(
      isActiveRun
    )
  ) {
    throw new BackupIntegrationError(
      'duplicate_run',
      'A backup for this application is already queued or in progress.'
    )
  }

  const config =
    BACKUP_APPLICATIONS[app]

  const dispatchedAfter =
    Date.now() - 5000

  await githubRequest<void>(
    repositoryPath(
      `/actions/workflows/${encodeURIComponent(
        config.workflowFile
      )}/dispatches`
    ),
    {
      label:
        `${config.label} workflow dispatch`,
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        ref:
          BACKUP_REPOSITORY.ref,
      }),
    }
  )

  let discovered:
    | BackupLatestAttempt
    | null = null

  for (
    let attempt = 0;
    attempt < 8;
    attempt += 1
  ) {
    const runs =
      (
        await fetchWorkflowRuns(
          app,
          20
        )
      ).workflow_runs

    const run =
      runs.find(
        (candidate) =>
          candidate.event ===
            'workflow_dispatch' &&
          Date.parse(
            candidate.created_at
          ) >=
            dispatchedAfter
      )

    if (run) {
      discovered =
        toLatestAttempt(run)

      if (
        run.status !== 'queued'
      ) {
        break
      }
    }

    if (attempt < 7) {
      await sleep(750)
    }
  }

  return discovered
}
