import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveBackupState,
  parseBackupTagTimestamp,
} from '../../node_modules/.cache/backups-core/core.js'

const NOW =
  Date.parse(
    '2026-10-04T20:00:00Z'
  )

function success(
  publishedAt
) {
  return {
    tag:
      'research-dashboard-20261004T180119Z',
    publishedAt,
    archiveSize: 123,
    releaseUrl:
      'https://github.com/example/release',
  }
}

function attempt(
  overrides = {}
) {
  return {
    runId: 1,
    event:
      'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    createdAt:
      '2026-10-04T18:00:00Z',
    runUrl:
      'https://github.com/example/run',
    ...overrides,
  }
}

test('backup health prioritises running attempts', () => {
  assert.equal(
    deriveBackupState({
      latestSuccess:
        success(
          '2026-09-01T00:00:00Z'
        ),
      latestAttempt:
        attempt({
          status:
            'in_progress',
          conclusion: null,
        }),
      now: NOW,
    }),
    'running'
  )
})

test('newer failed or cancelled attempts require attention', () => {
  for (const conclusion of [
    'failure',
    'cancelled',
  ]) {
    assert.equal(
      deriveBackupState({
        latestSuccess:
          success(
            '2026-10-04T17:00:00Z'
          ),
        latestAttempt:
          attempt({
            conclusion,
            createdAt:
              '2026-10-04T19:00:00Z',
          }),
        now: NOW,
      }),
      'attention'
    )
  }
})

test('successful backups older than eight days are stale', () => {
  assert.equal(
    deriveBackupState({
      latestSuccess:
        success(
          '2026-09-26T19:59:59Z'
        ),
      latestAttempt: null,
      now: NOW,
    }),
    'stale'
  )

  assert.equal(
    deriveBackupState({
      latestSuccess:
        success(
          '2026-09-26T20:00:00Z'
        ),
      latestAttempt: null,
      now: NOW,
    }),
    'healthy'
  )
})

test('missing successful backup requires attention', () => {
  assert.equal(
    deriveBackupState({
      latestSuccess: null,
      latestAttempt: null,
      now: NOW,
    }),
    'attention'
  )
})

test('backup tags parse the configured UTC timestamp', () => {
  assert.equal(
    parseBackupTagTimestamp(
      'research-dashboard-20261004T180119Z',
      'research-dashboard-'
    ),
    '2026-10-04T18:01:19.000Z'
  )

  assert.equal(
    parseBackupTagTimestamp(
      'supervision-portal-20261004T180809Z',
      'research-dashboard-'
    ),
    null
  )
})
