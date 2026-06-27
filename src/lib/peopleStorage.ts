import type { Person } from '../types/person'

const PEOPLE_STORAGE_KEY = 'debt-tracker-people-v1'

const randomHslColor = () => {
  const hue = Math.floor(Math.random() * 360)
  const saturation = 68 + Math.floor(Math.random() * 18)
  const lightness = 48 + Math.floor(Math.random() * 14)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export const generateRandomPersonColorOptions = (count = 8): string[] => {
  const nextOptions: string[] = []
  const usedHues = new Set<number>()

  while (nextOptions.length < count) {
    const hue = Math.floor(Math.random() * 360)
    if (usedHues.has(hue)) {
      continue
    }

    usedHues.add(hue)

    const saturation = 68 + Math.floor(Math.random() * 18)
    const lightness = 48 + Math.floor(Math.random() * 14)
    nextOptions.push(`hsl(${hue} ${saturation}% ${lightness}%)`)
  }

  return nextOptions
}

export const generatePersonColor = () => {
  return randomHslColor()
}

export const getStoredPeople = (): Person[] => {
  const rawPeople = window.localStorage.getItem(PEOPLE_STORAGE_KEY)
  if (!rawPeople) {
    return []
  }

  try {
    return JSON.parse(rawPeople) as Person[]
  } catch {
    window.localStorage.removeItem(PEOPLE_STORAGE_KEY)
    return []
  }
}

export const savePeople = (people: Person[]) => {
  window.localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people))
}
