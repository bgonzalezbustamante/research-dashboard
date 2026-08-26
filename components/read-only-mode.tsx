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

function isSelfServiceForm(
  form: HTMLFormElement
) {
  return (
    form.dataset.selfService ===
    'true'
  )
}

function shouldHideForm(
  form: HTMLFormElement
) {
  return (
    isMutationForm(form) &&
    !isCoauthorEditableForm(form) &&
    !isSelfServiceForm(form)
  )
}

function setControlReadOnly(
  control: FormControl
) {
  if (!control.disabled) {
    control.dataset.viewerReadOnly =
      'true'
    control.disabled = true
    control.setAttribute(
      'aria-disabled',
      'true'
    )
  }
}

function restoreControl(
  control: FormControl
) {
  if (
    control.dataset.viewerReadOnly !==
    'true'
  ) {
    return
  }

  delete control.dataset.viewerReadOnly
  control.disabled = false
  control.removeAttribute(
    'aria-disabled'
  )
}

function hideForm(
  form: HTMLFormElement
) {
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
    .forEach(setControlReadOnly)
}

function restoreForm(
  form: HTMLFormElement
) {
  if (
    form.dataset.viewerReadOnly !==
    'true'
  ) {
    return
  }

  delete form.dataset.viewerReadOnly
  form.hidden = false
  form.removeAttribute(
    'aria-hidden'
  )

  form
    .querySelectorAll<FormControl>(
      'button, input, select, textarea'
    )
    .forEach(restoreControl)
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
      if (shouldHideForm(form)) {
        hideForm(form)
        return
      }

      restoreForm(form)
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
        details.dataset.viewerReadOnly =
          'true'
        details.open = false
        details.hidden = true
        details.setAttribute(
          'aria-hidden',
          'true'
        )
        return
      }

      if (
        details.dataset.viewerReadOnly ===
        'true'
      ) {
        delete details.dataset.viewerReadOnly
        details.hidden = false
        details.removeAttribute(
          'aria-hidden'
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
      attributes: true,
      attributeFilter: [
        'data-coauthor-editable',
        'data-self-service',
      ],
    })

    return () => {
      observer.disconnect()
    }
  }, [enabled])

  return null
}
