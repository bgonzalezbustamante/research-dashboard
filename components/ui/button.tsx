import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning'

type ButtonSize =
  | 'default'
  | 'compact'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
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
  success:
    'border border-green-300 bg-green-50 text-green-800 hover:bg-green-100',
  warning:
    'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
}

const sizeClasses: Record<ButtonSize, string> = {
  default:
    'px-4 py-2 text-sm',
  compact:
    'px-2.5 py-1 text-xs',
}

export default function Button({
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxford-blue disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
}