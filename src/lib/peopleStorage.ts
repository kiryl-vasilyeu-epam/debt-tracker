import type { Person } from '../types/person'

const PEOPLE_STORAGE_KEY = 'debt-tracker-people-v1'

export const generatePersonColor = () => {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue} 70% 55%)`
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
