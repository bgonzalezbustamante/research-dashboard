type PaperStatus =
  | 'writing'
  | 'under-review'
  | 'revise-round'
  | 'published'
  | 'standby'
  | 'deprecated'

type StatusBadgeProps = {
  status: PaperStatus
}

const statusStyles: Record<
  PaperStatus,
  {
    label: string
    className: string
  }
> = {
  writing: {
    label: 'Writing',
    className:
      'bg-oxford-cool-grey text-oxford-blue border-oxford-sky-blue',
  },
  'under-review': {
    label: 'Under review',
    className:
      'bg-blue-50 text-blue-900 border-blue-200',
  },
  'revise-round': {
    label: 'Revise round',
    className:
      'bg-amber-50 text-amber-900 border-amber-200',
  },
  published: {
    label: 'Published',
    className:
      'bg-green-50 text-green-900 border-green-200',
  },
  standby: {
    label: 'Standby',
    className:
      'bg-gray-100 text-gray-700 border-gray-300',
  },
  deprecated: {
    label: 'Deprecated',
    className:
      'bg-red-50 text-red-800 border-red-200',
  },
}

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const style = statusStyles[status]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  )
}