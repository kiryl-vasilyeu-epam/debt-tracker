import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Person } from '../types/person'
import './SettingsModal.css'

type SettingsModalProps = {
  isOpen: boolean
  people: Person[]
  onClose: () => void
  onAddPerson: (name: string) => string | null
  onRemovePerson: (id: string) => void
}

export function SettingsModal({
  isOpen,
  people,
  onClose,
  onAddPerson,
  onRemovePerson,
}: SettingsModalProps) {
  const [newPersonName, setNewPersonName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  const handleAddPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const addError = onAddPerson(newPersonName)
    if (addError) {
      setError(addError)
      return
    }

    setError(null)
    setNewPersonName('')
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-label="Настройки людей">
        <header className="modal-header">
          <h2>Настройки людей</h2>
          <button type="button" className="modal-close-button" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <form className="settings-form" onSubmit={handleAddPerson}>
          <label htmlFor="new-person-name">Имя</label>
          <div className="settings-actions">
            <input
              id="new-person-name"
              value={newPersonName}
              onChange={(event) => setNewPersonName(event.target.value)}
              placeholder="Имя"
            />
            <button type="submit">Добавить человека</button>
          </div>
        </form>

        {error ? <p className="error">{error}</p> : null}

        <ul className="people-list">
          {people.map((person) => (
            <li key={person.id}>
              <div className="person-meta">
                <span
                  className="person-color-dot"
                  style={{ backgroundColor: person.color }}
                  aria-hidden="true"
                />
                <span>{person.name}</span>
              </div>
              <button
                type="button"
                className="danger-button"
                onClick={() => onRemovePerson(person.id)}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
