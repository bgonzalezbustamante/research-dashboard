import Link from 'next/link'
import type { ReactNode } from 'react'

type ButtonLinkVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'

type ButtonLinkProps = {
  href: string
  children: ReactNode
  variant?: ButtonLinkVariant
  className?: string
}

const variantClasses: Record<ButtonLinkVariant, string> = {
  primary:
    'border border-oxford-blue bg-oxford-blue text-white hover:bg-oxford-blue-dark',
  secondary:
    'border border-oxford-blue bg-white text-oxford-blue hover:bg-oxford-shell',
  ghost:
    'border border-transparent bg-transparent text-oxford-charcoal hover:bg-oxford-shell',
}

export default function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxford-blue ${variantClasses[variant]} ${className}`}
    >
      {children}
    </Link>
  )
}