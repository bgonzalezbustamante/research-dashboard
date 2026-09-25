'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const firstRowLinks = [
  {
    href: '/papers/authors',
    label: 'Authors',
  },
  {
    href: '/website',
    label: 'Website',
  },
]

const accessLink = {
  href: '/dashboard/access',
  label: 'Access',
}

function utilityLinkClass(
  active: boolean
) {
  return active
    ? 'rounded-md bg-oxford-blue px-3 py-1.5 text-sm font-medium text-white'
    : 'rounded-md px-3 py-1.5 text-sm font-medium text-oxford-ash transition hover:bg-white hover:text-oxford-blue'
}

export default function OwnerUtilityNavigation({
  showOwnerLinks = true,
  accountLabel = 'Account',
}: {
  showOwnerLinks?: boolean
  accountLabel?: string
}) {
  const pathname = usePathname()

  const isActive = (
    href: string
  ) =>
    pathname === href ||
    pathname.startsWith(
      `${href}/`
    )

  return (
    <div className="border-t border-oxford-stone bg-oxford-off-white">
      <div className="mx-auto flex max-w-7xl flex-col items-end gap-1 px-6 py-3">
        {showOwnerLinks && (
          <nav
            className="flex flex-wrap items-center justify-end gap-1"
            aria-label="Owner utility navigation"
          >
            {firstRowLinks.map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={
                    isActive(
                      link.href
                    )
                      ? 'page'
                      : undefined
                  }
                  className={utilityLinkClass(
                    isActive(
                      link.href
                    )
                  )}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        )}

        <nav
          className="flex flex-wrap items-center justify-end gap-1"
          aria-label="Account utility navigation"
        >
          {showOwnerLinks && (
            <Link
              href={accessLink.href}
              aria-current={
                isActive(
                  accessLink.href
                )
                  ? 'page'
                  : undefined
              }
              className={utilityLinkClass(
                isActive(
                  accessLink.href
                )
              )}
            >
              {accessLink.label}
            </Link>
          )}

          <Link
            href="/account"
            aria-current={
              isActive('/account')
                ? 'page'
                : undefined
            }
            className="rounded-md border border-oxford-blue bg-transparent px-3 py-1.5 text-sm font-medium text-oxford-blue transition hover:bg-white"
          >
            {accountLabel}
          </Link>

          <form
            action="/auth/signout"
            method="post"
          >
            <button
              type="submit"
              className="rounded-md border border-oxford-blue bg-oxford-blue px-3 py-1.5 text-sm font-medium text-white transition hover:bg-oxford-blue-dark"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </div>
  )
}
