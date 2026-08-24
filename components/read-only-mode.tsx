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

function isMutationForm(
  form: HTMLFormElement
) {
  const method =
    form
      .getAttribute('method')
      ?.toLowerCase()

  return method !== 'get'
}

function isCoauthorEditableForm(
  form: HTMLFormElement
) {
  return (
    form.dataset.coauthorEditable ===
    'true'
  )
}

function shouldHideForm(
  form: HTMLFormElement
) {
  return (
    isMutationForm(form) &&
    !isCoauthorEditableForm(form)
  )
}

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
      if (!shouldHideForm(form)) {
        return
      }

      form.dataset.viewerReadOnly =
        'true'
      form.hidden = true
      form.setAttribute(
        'aria-hidden',
        'true'
      )

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
        })
    })

  main
    .querySelectorAll<HTMLDetailsElement>(
      'details'
    )
    .forEach((details) => {
      const hasHiddenMutationForm =
        Array.from(
          details.querySelectorAll<HTMLFormElement>(
            'form'
          )
        ).some(shouldHideForm)

      if (hasHiddenMutationForm) {
        details.open = false
        details.hidden = true
        details.setAttribute(
          'aria-hidden',
          'true'
        )
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
