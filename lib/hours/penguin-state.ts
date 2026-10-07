import {
  buildYearObservances,
  MAX_SUPPORTED_YEAR,
  MIN_SUPPORTED_YEAR,
} from '@bgonzalezbustamante/catholic-calendar'

type WorkBucket =
  | 'zero'
  | 'light'
  | 'normal'
  | 'heavy'
  | 'very-heavy'
  | 'extreme'

type CoffeeBucket =
  | 'zero'
  | 'light'
  | 'normal'
  | 'heavy'
  | 'very-heavy'
  | 'extreme'

type PenguinMode =
  | 'activity'
  | 'sunday'
  | 'saturday'
  | 'teaching'
  | 'working-day'
  | 'winter-holiday'
  | 'summer-holiday'
  | 'trip'
  | 'conference'
  | 'unavailable'

type ConferenceRow = {
  event_short_name: string
  start_date: string
  end_date: string
  personal_attendance: boolean
  involves_trip: boolean
}

type BlockedEventRow = {
  event_type: string
  start_date: string
  end_date: string
}

type ResolveHoursPenguinArgs = {
  date: string
  today: string
  netMinutes: number
  coffeeCount: number
  teachingSeasonActive: boolean
  conferences: ConferenceRow[]
  blockedEvents: BlockedEventRow[]
}

const TIMELINE_BASE =
  'https://timeline.bgonzalezbustamante.com/penguins'

const CATHOLIC_OBSERVANCE_IDS =
  new Set([
    'palm-sunday',
    'holy-thursday',
    'good-friday',
    'holy-saturday',
    'easter-sunday',
    'divine-mercy-sunday',
    'ascension',
    'pentecost',
    'corpus-christi',
    'assumption',
    'all-saints',
    'all-souls',
    'immaculate-conception',
    'christmas',
  ])

const MODE_LABELS: Record<
  PenguinMode,
  string
> = {
  activity: 'working day',
  sunday: 'Sunday or Catholic observance',
  saturday: 'free Saturday',
  teaching: 'Teaching Saturday',
  'working-day': 'future working day',
  'winter-holiday': 'Winter holiday',
  'summer-holiday': 'Summer holiday',
  trip: 'conference travel',
  conference: 'conference',
  unavailable: 'unavailable',
}

function addDays(
  value: string,
  days: number
) {
  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  date.setUTCDate(
    date.getUTCDate() +
      days
  )

  return date
    .toISOString()
    .slice(0, 10)
}

function getWeekday(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  ).getUTCDay()
}

function includesDate(
  startDate: string,
  endDate: string,
  date: string
) {
  return (
    startDate <= date &&
    date <= endDate
  )
}

function resolveWorkBucket(
  minutes: number
): WorkBucket {
  if (minutes === 0) {
    return 'zero'
  }

  if (minutes <= 240) {
    return 'light'
  }

  if (minutes <= 480) {
    return 'normal'
  }

  if (minutes <= 600) {
    return 'heavy'
  }

  if (minutes <= 720) {
    return 'very-heavy'
  }

  return 'extreme'
}

function resolveCoffeeBucket(
  count: number
): CoffeeBucket {
  if (count === 0) {
    return 'zero'
  }

  if (count <= 2) {
    return 'light'
  }

  if (count <= 4) {
    return 'normal'
  }

  if (count <= 7) {
    return 'heavy'
  }

  if (count <= 10) {
    return 'very-heavy'
  }

  return 'extreme'
}

function isCatholicTimelineDate(
  date: string
) {
  const year =
    Number(
      date.slice(
        0,
        4
      )
    )

  if (
    !Number.isInteger(year) ||
    year < MIN_SUPPORTED_YEAR ||
    year > MAX_SUPPORTED_YEAR
  ) {
    return false
  }

  return buildYearObservances(
    year
  ).some(
    (observance) =>
      observance.observedDate ===
        date &&
      CATHOLIC_OBSERVANCE_IDS.has(
        observance.id
      )
  )
}

function resolveSpecialMode({
  date,
  conferences,
  blockedEvents,
}: {
  date: string
  conferences: ConferenceRow[]
  blockedEvents: BlockedEventRow[]
}): PenguinMode | null {
  if (
    date.endsWith(
      '-12-24'
    )
  ) {
    return 'sunday'
  }

  if (
    isCatholicTimelineDate(
      date
    )
  ) {
    return 'sunday'
  }

  const unavailable =
    blockedEvents.some(
      (event) =>
        event.event_type ===
          'sick' &&
        includesDate(
          event.start_date,
          event.end_date,
          date
        )
    )

  if (unavailable) {
    return 'unavailable'
  }

  const attended =
    conferences.filter(
      (conference) =>
        conference.personal_attendance
    )

  const atConference =
    attended.some(
      (conference) =>
        includesDate(
          conference.start_date,
          conference.end_date,
          date
        )
    )

  if (atConference) {
    return 'conference'
  }

  const travelling =
    attended.some(
      (conference) =>
        conference.involves_trip &&
        (
          addDays(
            conference.start_date,
            -1
          ) === date ||
          addDays(
            conference.end_date,
            1
          ) === date
        )
    )

  if (travelling) {
    return 'trip'
  }

  const holiday =
    blockedEvents.find(
      (event) =>
        (
          event.event_type ===
            'winter_holiday' ||
          event.event_type ===
            'summer_holiday'
        ) &&
        includesDate(
          event.start_date,
          event.end_date,
          date
        )
    )

  if (
    holiday?.event_type ===
    'winter_holiday'
  ) {
    return 'winter-holiday'
  }

  if (
    holiday?.event_type ===
    'summer_holiday'
  ) {
    return 'summer-holiday'
  }

  return null
}

function resolveAsset(
  mode: PenguinMode,
  workBucket: WorkBucket,
  coffeeBucket: CoffeeBucket
) {
  const stateBase =
    `${TIMELINE_BASE}/states/webp`

  switch (mode) {
    case 'saturday':
      return `${stateBase}/canonical-couple.webp`

    case 'teaching':
      return `${stateBase}/teaching.webp`

    case 'working-day':
      return `${stateBase}/working-day.webp`

    case 'sunday':
      return `${stateBase}/sunday.webp`

    case 'winter-holiday':
      return `${stateBase}/winter-holiday.webp`

    case 'summer-holiday':
      return `${stateBase}/summer-holiday.webp`

    case 'trip':
      return `${stateBase}/trip.webp`

    case 'conference':
      return `${stateBase}/conference.webp`

    case 'unavailable':
      return `${stateBase}/sick.webp`

    case 'activity':
      if (
        workBucket ===
          'zero' &&
        coffeeBucket ===
          'zero'
      ) {
        return `${TIMELINE_BASE}/canonical-baseline.webp`
      }

      return `${stateBase}/work-${workBucket}__coffee-${coffeeBucket}.webp`
  }
}

export function resolveHoursPenguin({
  date,
  today,
  netMinutes,
  coffeeCount,
  teachingSeasonActive,
  conferences,
  blockedEvents,
}: ResolveHoursPenguinArgs) {
  const safeNetMinutes =
    Math.max(
      0,
      Math.round(
        netMinutes
      )
    )

  const safeCoffeeCount =
    Math.max(
      0,
      Math.round(
        coffeeCount
      )
    )

  const workBucket =
    resolveWorkBucket(
      safeNetMinutes
    )

  const coffeeBucket =
    resolveCoffeeBucket(
      safeCoffeeCount
    )

  const specialMode =
    resolveSpecialMode({
      date,
      conferences,
      blockedEvents,
    })

  let mode:
    PenguinMode

  if (specialMode) {
    mode = specialMode
  } else {
    const weekday =
      getWeekday(
        date
      )

    const isFuture =
      date > today

    if (weekday === 0) {
      mode = 'sunday'
    } else if (
      weekday === 6
    ) {
      if (
        !isFuture &&
        (
          workBucket !==
            'zero' ||
          coffeeBucket !==
            'zero'
        )
      ) {
        mode = 'activity'
      } else if (
        (
          date === today ||
          isFuture
        ) &&
        teachingSeasonActive
      ) {
        mode = 'teaching'
      } else {
        mode = 'saturday'
      }
    } else if (isFuture) {
      mode = 'working-day'
    } else {
      mode = 'activity'
    }
  }

  return {
    src:
      resolveAsset(
        mode,
        workBucket,
        coffeeBucket
      ),
    label:
      `Penguin Timeline state for ${date}: ${MODE_LABELS[mode]}`,
  }
}
