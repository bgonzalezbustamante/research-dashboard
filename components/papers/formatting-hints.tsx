'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const formattingFieldSelector = [
  'textarea[name="abstract"]',
  '#milestones textarea[name="notes"]',
  '#presentations textarea[name="notes"]',
  '#notes textarea[name="body"]',
].join(', ')

function addFormattingHints() {
  document
    .querySelectorAll<HTMLTextAreaElement>(
      formattingFieldSelector
    )
    .forEach((textarea) => {
      if (
        textarea.dataset.formattingHint ===
        'true'
      ) {
        return
      }

      textarea.dataset.formattingHint =
        'true'

      const hint =
        document.createElement('p')
      hint.dataset.formattingHintText =
        'true'
      hint.className =
        'mt-1 text-xs text-oxford-ash'
      hint.textContent =
        'Supports Markdown and LaTeX-style math: **bold**, lists, `code`, $...$, and $$...$$.'

      textarea.insertAdjacentElement(
        'afterend',
        hint
      )
    })
}

function clearFormattingHints() {
  document
    .querySelectorAll<HTMLElement>(
      '[data-formatting-hint-text="true"]'
    )
    .forEach((hint) => hint.remove())

  document
    .querySelectorAll<HTMLTextAreaElement>(
      '[data-formatting-hint="true"]'
    )
    .forEach((textarea) => {
      delete textarea.dataset.formattingHint
    })
}

export default function FormattingHints() {
  const pathname = usePathname()

  useEffect(() => {
    addFormattingHints()

    const main =
      document.querySelector('main')

    if (!main) {
      return
    }

    const observer =
      new MutationObserver(() => {
        addFormattingHints()
      })

    observer.observe(main, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      clearFormattingHints()
    }
  }, [pathname])

  return null
}
