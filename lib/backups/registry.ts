import 'server-only'

import type {
  BackupAppKey,
} from './core'

export const BACKUP_REPOSITORY = {
  owner: 'bgonzalezbustamante',
  repo: 'apps-backups',
  ref: 'main',
} as const

export const BACKUP_RETENTION = {
  recent: 12,
  monthly: 12,
} as const

export type BackupApplicationConfig = {
  key: BackupAppKey
  label: string
  workflowFile: string
  tagPrefix: string
  scheduleUtc: string
  cronUtc: string
}

export const BACKUP_APPLICATIONS = {
  'research-dashboard': {
    key: 'research-dashboard',
    label: 'Research Dashboard',
    workflowFile:
      'backup-research-dashboard.yml',
    tagPrefix:
      'research-dashboard-',
    scheduleUtc:
      'Sunday 02:10 UTC',
    cronUtc:
      '10 2 * * 0',
  },
  'supervision-portal': {
    key: 'supervision-portal',
    label: 'Supervision Portal',
    workflowFile:
      'backup-supervision-portal.yml',
    tagPrefix:
      'supervision-portal-',
    scheduleUtc:
      'Sunday 02:30 UTC',
    cronUtc:
      '30 2 * * 0',
  },
  'household-finances': {
    key: 'household-finances',
    label: 'Household Finances',
    workflowFile:
      'backup-household-finances.yml',
    tagPrefix:
      'household-finances-',
    scheduleUtc:
      'Sunday 02:50 UTC',
    cronUtc:
      '50 2 * * 0',
  },
} as const satisfies Record<
  BackupAppKey,
  BackupApplicationConfig
>

export const BACKUP_APPLICATION_KEYS =
  Object.keys(
    BACKUP_APPLICATIONS
  ) as BackupAppKey[]

export function isBackupAppKey(
  value: string
): value is BackupAppKey {
  return (
    value in
    BACKUP_APPLICATIONS
  )
}
