export type PlanningLoadPresentation = {
  label: string
  container: string
  text: string
  secondary: string
  bar: string
  calendar: string
}

export function getPlanningLoadPresentation(
  totalDays: number
): PlanningLoadPresentation {
  if (totalDays === 0) {
    return {
      label: 'Open',
      container:
        'border-green-200 bg-green-50',
      text: 'text-green-900',
      secondary:
        'text-green-800',
      bar: 'bg-green-500',
      calendar:
        'bg-green-50 text-green-900',
    }
  }

  if (totalDays <= 5) {
    return {
      label: 'Light commitment',
      container:
        'border-green-200 bg-green-50',
      text: 'text-green-900',
      secondary:
        'text-green-800',
      bar: 'bg-green-500',
      calendar:
        'bg-green-100 text-green-950',
    }
  }

  if (totalDays <= 10) {
    return {
      label: 'Moderate commitment',
      container:
        'border-yellow-200 bg-yellow-50',
      text: 'text-yellow-900',
      secondary:
        'text-yellow-800',
      bar: 'bg-yellow-500',
      calendar:
        'bg-yellow-100 text-yellow-950',
    }
  }

  if (totalDays <= 15) {
    return {
      label: 'Full commitment',
      container:
        'border-orange-200 bg-orange-50',
      text: 'text-orange-900',
      secondary:
        'text-orange-800',
      bar: 'bg-orange-500',
      calendar:
        'bg-orange-100 text-orange-950',
    }
  }

  return {
    label: 'Overcommitted',
    container:
      'border-orange-300 bg-orange-100',
    text: 'text-orange-950',
    secondary:
      'text-orange-900',
    bar: 'bg-orange-700',
    calendar:
      'bg-orange-200 font-semibold text-orange-950',
  }
}
