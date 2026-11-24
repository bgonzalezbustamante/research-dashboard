'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { useFormStatus } from 'react-dom'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import {
  readRegistrationFragment,
  verifyOrigin,
} from '@/lib/documents/manifest'

import { registerSignedDocument } from './actions'

// The signing tool's "Register on the Dashboard" button opens
// /documents#register=<manifest>. The fragment stays in the browser; this
// card shows what it carries and submits the manifest text to the same
// server action as the upload form, which validates it again.

function subscribe(
  onChange: () => void
) {
  window.addEventListener(
    'hashchange',
    onChange
  )

  return () =>
    window.removeEventListener(
      'hashchange',
      onChange
    )
}

function currentHash() {
  return window.location.hash
}

function serverHash() {
  return ''
}

function dismiss() {
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname +
      window.location.search
  )

  window.dispatchEvent(
    new HashChangeEvent(
      'hashchange'
    )
  )
}

function formatUtc(
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
      timeZone: 'UTC',
    }
  ).format(
    new Date(value)
  ) + ' UTC'
}

function RegisterButton() {
  const { pending } =
    useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
    >
      {pending
        ? 'Registering…'
        : 'Register document'}
    </Button>
  )
}

export default function RegisterFromLink() {
  const hash =
    useSyncExternalStore(
      subscribe,
      currentHash,
      serverHash
    )

  const result = useMemo(
    () =>
      readRegistrationFragment(
        hash
      ),
    [hash]
  )

  if (!result) {
    return null
  }

  if (!result.ok) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <span>
          {result.error}
        </span>

        <Button
          variant="ghost"
          size="compact"
          onClick={dismiss}
        >
          Dismiss
        </Button>
      </div>
    )
  }

  const record =
    result.value.value

  return (
    <Card className="mb-6 ring-2 ring-oxford-blue/30">
      <h2 className="font-serif text-xl font-semibold text-oxford-blue">
        Register this document?
      </h2>

      <p className="mt-2 text-sm leading-6 text-oxford-ash">
        The signing tool sent these details in the link. Once registered,
        the title, issue time and SHA-256 are visible on the verification
        site to anyone who has the document&apos;s code.
      </p>

      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm text-oxford-charcoal sm:grid-cols-[max-content_1fr]">
        <dt className="text-oxford-ash">
          Title
        </dt>
        <dd className="font-medium">
          {record.title}
        </dd>

        <dt className="text-oxford-ash">
          Code
        </dt>
        <dd className="break-all font-mono text-xs">
          {record.code}
        </dd>

        <dt className="text-oxford-ash">
          Issued
        </dt>
        <dd>
          {formatUtc(
            record.issuedAt
          )}
        </dd>

        <dt className="text-oxford-ash">
          SHA-256
        </dt>
        <dd className="break-all font-mono text-xs">
          {record.sha256}
        </dd>

        <dt className="text-oxford-ash">
          QR address
        </dt>
        <dd className="break-all font-mono text-xs">
          {`${verifyOrigin}/?id=${record.code}`}
        </dd>
      </dl>

      <form
        action={registerSignedDocument}
        className="mt-5 flex flex-wrap gap-3"
      >
        <input
          type="hidden"
          name="manifest"
          value={result.value.text}
        />

        <RegisterButton />

        <Button
          variant="secondary"
          onClick={dismiss}
        >
          Dismiss
        </Button>
      </form>
    </Card>
  )
}
