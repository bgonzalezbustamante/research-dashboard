'use client'

import { useEffect } from 'react'

type ReadOnlyModeProps = {
  enabled: boolean
}

type FormControl =
  | HTMLButtonElement
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement

function applyReadOnlyMode() {
  const main =
    document.querySelector('main')

  if (!main) {
    return
  }

  main
    .querySelectorAll<HTMLFormElement>(
      'form'
    )
    .forEach((form) => {
      if (
        form.method.toLowerCase() !==
        'post'
      ) {
        return
      }

      form.dataset.viewerReadOnly =
        'true'

      form
        .querySelectorAll<FormControl>(
          'button, input, select, textarea'
        )
        .forEach((control) => {
          control.disabled = true
          control.setAttribute(
            'aria-disabled',
            'true'
          )

          if (
            control instanceof
            HTMLButtonElement
          ) {
            control.hidden = true
          }
        })
    })

  main
    .querySelectorAll<HTMLDetailsElement>(
      'details'
    )
    .forEach((details) => {
      const hasMutationForm =
        Array.from(
          details.querySelectorAll<HTMLFormElement>(
            'form'
          )
        ).some(
          (form) =>
            form.method.toLowerCase() ===
            'post'
        )

      if (hasMutationForm) {
        details.open = false
        details.hidden = true
      }
    })

  main
    .querySelectorAll<HTMLAnchorElement>(
      'a[href]'
    )
    .forEach((anchor) => {
      const href =
        anchor.getAttribute('href') ??
        ''

      const ownerOnlyPaperLink =
        href === '/papers/new' ||
        /^\/papers\/[^/?#]+\/edit(?:[/?#].*)?$/.test(
          href
        )

      if (ownerOnlyPaperLink) {
        anchor.hidden = true
        anchor.setAttribute(
          'aria-hidden',
          'true'
        )
      }
    })
}

export default function ReadOnlyMode({
  enabled,
}: ReadOnlyModeProps) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    applyReadOnlyMode()

    const main =
      document.querySelector('main')

    if (!main) {
      return
    }

    const observer =
      new MutationObserver(
        applyReadOnlyMode
      )

    observer.observe(main, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [enabled])

  return null
}
