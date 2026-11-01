import ButtonLink from '@/components/ui/button-link'

type ListPaginationProps = {
  label: string
  position: 'top' | 'bottom'
  currentPage: number
  totalPages: number
  getPageHref: (pageNumber: number) => string
}

export default function ListPagination({
  label,
  position,
  currentPage,
  totalPages,
  getPageHref,
}: ListPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav
      aria-label={`${label} pagination (${position})`}
      className="flex flex-col gap-3 rounded-lg border border-oxford-stone bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="text-sm text-oxford-ash">
        Page <strong className="font-medium text-oxford-charcoal">{currentPage}</strong> of{' '}
        <strong className="font-medium text-oxford-charcoal">{totalPages}</strong>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {currentPage > 1 && (
          <>
            <ButtonLink href={getPageHref(1)} variant="secondary">
              First
            </ButtonLink>
            <ButtonLink href={getPageHref(currentPage - 1)} variant="secondary">
              Previous
            </ButtonLink>
          </>
        )}
        {currentPage < totalPages && (
          <>
            <ButtonLink href={getPageHref(currentPage + 1)} variant="secondary">
              Next
            </ButtonLink>
            <ButtonLink href={getPageHref(totalPages)} variant="secondary">
              Last
            </ButtonLink>
          </>
        )}
      </div>
    </nav>
  )
}
