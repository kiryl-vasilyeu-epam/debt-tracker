import { useEffect, useState } from 'react'
import { PeopleTabs } from './components/PeopleTabs'
import { SettingsModal } from './components/SettingsModal'
import { StartScreen } from './components/StartScreen'
import {
  generatePersonColor,
  getStoredPeople,
  savePeople,
} from './lib/peopleStorage'
import type { Person } from './types/person'
import './App.css'

function App() {
  const [people, setPeople] = useState<Person[]>(getStoredPeople)
  const [activePersonId, setActivePersonId] = useState<string | null>(() => {
    const storedPeople = getStoredPeople()
    return storedPeople[0]?.id ?? null
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    savePeople(people)
  }, [people])

  const addPerson = (name: string): string | null => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return 'Enter person name.'
    }

    if (
      people.some(
        (person) => person.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      return 'This name already exists.'
    }

    const person: Person = {
      id: window.crypto.randomUUID(),
      name: trimmedName,
      color: generatePersonColor(),
    }

    setPeople((prevPeople) => [...prevPeople, person])
    setActivePersonId((currentActiveId) => currentActiveId ?? person.id)
    return null
  }

  const removePerson = (id: string) => {
    setPeople((prevPeople) => {
      const nextPeople = prevPeople.filter((person) => person.id !== id)

      setActivePersonId((currentActiveId) => {
        if (currentActiveId !== id) {
          return currentActiveId
        }

        return nextPeople[0]?.id ?? null
      })

      return nextPeople
    })
  }

  const activePerson = people.find((person) => person.id === activePersonId) ?? null

  return (
    <main className="app">
      <header className="top-bar card">
        <h1>Debt Tracker</h1>
        <button
          type="button"
          className="settings-icon-button"
          aria-label={isSettingsOpen ? 'Close people settings' : 'Open people settings'}
          title={isSettingsOpen ? 'Close settings' : 'People settings'}
          onClick={() => setIsSettingsOpen((isOpen) => !isOpen)}
        >
          <svg
            className="settings-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path
              d="M10.2 2h3.6l.5 2.1a7.8 7.8 0 0 1 1.9.8l1.9-1.1 2.5 2.5-1.1 1.9a7.8 7.8 0 0 1 .8 1.9L22 10.2v3.6l-2.1.5a7.8 7.8 0 0 1-.8 1.9l1.1 1.9-2.5 2.5-1.9-1.1a7.8 7.8 0 0 1-1.9.8l-.5 2.1h-3.6l-.5-2.1a7.8 7.8 0 0 1-1.9-.8l-1.9 1.1-2.5-2.5 1.1-1.9a7.8 7.8 0 0 1-.8-1.9L2 13.8v-3.6l2.1-.5a7.8 7.8 0 0 1 .8-1.9L3.8 5.9l2.5-2.5 1.9 1.1a7.8 7.8 0 0 1 1.9-.8L10.2 2Zm1.8 6.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </header>

      <PeopleTabs
        people={people}
        activePersonId={activePersonId}
        onSelectPerson={setActivePersonId}
      />

      <StartScreen activePerson={activePerson} />

      <SettingsModal
        isOpen={isSettingsOpen}
        people={people}
        onClose={() => setIsSettingsOpen(false)}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
      />
    </main>
  )
}

export default App
