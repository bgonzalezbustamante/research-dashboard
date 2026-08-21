import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export default function Card({
  children,
  className = '',
}: CardProps) {
  return (
    <section
      className={`rounded-lg border border-oxford-stone bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </section>
  )
}