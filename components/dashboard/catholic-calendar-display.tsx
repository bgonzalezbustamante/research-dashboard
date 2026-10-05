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
      <p className="relative z-10 font-serif text-base font-semibold text-oxford-blue">
        No selected observance or active period
      </p>
    )
  }

  return (
    <p className="relative z-10 m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-serif text-[clamp(1rem,1.8vw,1.25rem)] font-semibold leading-snug text-oxford-blue">
      {items.map(
        (
          item,
          index
        ) => (
          <span
            className="inline-flex items-center gap-1.5"
            key={
              item.id
            }
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className="font-sans font-normal text-oxford-stone"
              >
                ·
              </span>
            )}

            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-[18px] w-[18px] shrink-0 bg-oxford-ash"
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
          </span>
        )
      )}
    </p>
  )
}
