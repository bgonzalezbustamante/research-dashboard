import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-oxford-blue text-white hover:bg-oxford-blue-dark border border-oxford-blue',
  secondary:
    'bg-white text-oxford-blue hover:bg-oxford-shell border border-oxford-blue',
  ghost:
    'bg-transparent text-oxford-charcoal hover:bg-oxford-shell border border-transparent',
  danger:
    'bg-red-700 text-white hover:bg-red-800 border border-red-700',
}

export default function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxford-blue disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
}