import type {
  CalendarDisplayItem,
} from '@bgonzalezbustamante/catholic-calendar'

export default function CatholicCalendarDisplay({
  items,
}: {
  items: CalendarDisplayItem[]
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-oxford-charcoal">
        No selected observance or active period
      </p>
    )
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-2 text-sm text-oxford-charcoal">
        {items.map(
          (
            item,
            index
          ) => (
            <span
              className="flex items-center gap-2 whitespace-nowrap"
              key={
                item.id
              }
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="text-oxford-ash"
                >
                  ·
                </span>
              )}

              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 bg-oxford-blue"
                style={{
                  WebkitMaskImage:
                    `url("/catholic-calendar/${item.icon}.svg")`,
                  maskImage:
                    `url("/catholic-calendar/${item.icon}.svg")`,
                  WebkitMaskRepeat:
                    'no-repeat',
                  maskRepeat:
                    'no-repeat',
                  WebkitMaskPosition:
                    'center',
                  maskPosition:
                    'center',
                  WebkitMaskSize:
                    'contain',
                  maskSize:
                    'contain',
                }}
              />

              <span>
                {
                  item.label
                }
              </span>
            </span>
          )
        )}
      </div>
    </div>
  )
}
