'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AppNavigationProps = {
  showDashboardModules?: boolean
  showAccessManagement?: boolean
  showAuthorDirectory?: boolean
}

const dashboardLinks = [
  {
    href: '/dashboard',
    label: 'Dashboard',
  },
  {
    href: '/hours',
    label: 'Hours',
  },
  {
    href: '/planning',
    label: 'Planning',
  },
]

const papersLink = {
  href: '/papers',
  label: 'Papers',
}

const authorsLink = {
  href: '/papers/authors',
  label: 'Authors',
}

const accessLink = {
  href: '/dashboard/access',
  label: 'Access',
}

function isActiveLink(
  pathname: string,
  href: string
) {
  if (pathname === href) {
    return true
  }

  if (href === '/dashboard') {
    return false
  }

  if (href === '/papers') {
    return (
      pathname.startsWith('/papers/') &&
      !pathname.startsWith('/papers/authors')
    )
  }

  return pathname.startsWith(
    `${href}/`
  )
}

export default function AppNavigation({
  showDashboardModules = true,
  showAccessManagement = false,
  showAuthorDirectory = false,
}: AppNavigationProps) {
  const pathname = usePathname()

  const links =
    showDashboardModules
      ? [
          ...dashboardLinks,
          papersLink,
          ...(showAuthorDirectory
            ? [authorsLink]
            : []),
          ...(showAccessManagement
            ? [accessLink]
            : []),
        ]
      : [papersLink]

  return (
    <nav
      className="flex flex-wrap items-center gap-1"
      aria-label="Main navigation"
    >
      {links.map((link) => {
        const active =
          isActiveLink(
            pathname,
            link.href
          )

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-md bg-oxford-blue px-3 py-2 text-sm font-medium text-white'
                : 'rounded-md px-3 py-2 text-sm font-medium text-oxford-charcoal transition hover:bg-oxford-shell hover:text-oxford-blue'
            }
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
