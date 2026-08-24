'use client'

import {
  useEffect,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'

type QuerySectionErrorProps = {
  parameter: string
  targetId: string
}

export default function QuerySectionError({
  parameter,
  targetId,
}: QuerySectionErrorProps) {
  const searchParams =
    useSearchParams()

  const message =
    searchParams
      .get(parameter)
      ?.trim() ?? ''

  const [container, setContainer] =
    useState<HTMLElement | null>(
      null
    )

  useEffect(() => {
    if (!message) {
      setContainer(null)
      return
    }

    const target =
      document.getElementById(
        targetId
      )

    if (!target) {
      setContainer(null)
      return
    }

    const node =
      document.createElement('div')

    node.dataset.querySectionError =
      parameter
    node.className = 'mb-4'

    const insertionPoint =
      target.children[1] ?? null

    target.insertBefore(
      node,
      insertionPoint
    )

    setContainer(node)

    return () => {
      node.remove()
    }
  }, [
    message,
    parameter,
    targetId,
  ])

  if (!message || !container) {
    return null
  }

  return createPortal(
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>,
    container
  )
}
