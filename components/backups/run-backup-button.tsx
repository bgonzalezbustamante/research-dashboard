'use client'

import {
  useState,
} from 'react'
import {
  useRouter,
} from 'next/navigation'

import Button from '@/components/ui/button'
import type {
  BackupAppKey,
} from '@/lib/backups/core'

type RunBackupButtonProps = {
  app: BackupAppKey
  disabled?: boolean
}

export default function RunBackupButton({
  app,
  disabled = false,
}: RunBackupButtonProps) {
  const router = useRouter()

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] = useState<
    string | null
  >(null)

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null)

  async function runBackup() {
    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const response =
        await fetch(
          `/api/backups/${app}/run`,
          {
            method: 'POST',
          }
        )

      const payload =
        await response.json() as {
          ok?: boolean
          discovered?: boolean
          error?: string
        }

      if (!response.ok) {
        setError(
          payload.error ??
            'Backup could not be started.'
        )
        return
      }

      setMessage(
        payload.discovered
          ? 'Backup started. Status refreshed.'
          : 'Backup requested. The workflow may take a moment to appear.'
      )

      router.refresh()
    } catch {
      setError(
        'Backup could not be started.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        onClick={runBackup}
        disabled={
          disabled ||
          submitting
        }
      >
        {submitting
          ? 'Starting…'
          : 'Run backup'}
      </Button>

      {message && (
        <p
          aria-live="polite"
          className="mt-2 text-xs text-green-800"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          aria-live="polite"
          className="mt-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  )
}
