import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  generatePersonColor,
  generateRandomPersonColorOptions,
} from '../lib/peopleStorage'
import type { Person } from '../types/person'
import './SettingsModal.css'

type SettingsModalProps = {
  isOpen: boolean
  people: Person[]
  onClose: () => void
  onAddPerson: (name: string, color: string) => Promise<string | null>
  onRemovePerson: (id: string) => Promise<void>
  isAddingPerson: boolean
  removingPersonId: string | null
}

export function SettingsModal({
  isOpen,
  people,
  onClose,
  onAddPerson,
  onRemovePerson,
  isAddingPerson,
  removingPersonId,
}: SettingsModalProps) {
  const [newPersonName, setNewPersonName] = useState('')
  const [colorOptions, setColorOptions] = useState<string[]>(() =>
    generateRandomPersonColorOptions(),
  )
  const [selectedColor, setSelectedColor] = useState<string>(() =>
    generatePersonColor(),
  )
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

    const nextColorOptions = generateRandomPersonColorOptions()
    setColorOptions(nextColorOptions)
    setSelectedColor(nextColorOptions[0] ?? generatePersonColor())

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  const handleAddPerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const addError = await onAddPerson(
      newPersonName,
      selectedColor || generatePersonColor(),
    )
    if (addError) {
      setError(addError)
      return
    }

    setError(null)
    setNewPersonName('')
    const nextColorOptions = generateRandomPersonColorOptions()
    setColorOptions(nextColorOptions)
    setSelectedColor(nextColorOptions[0] ?? generatePersonColor())
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
              disabled={isAddingPerson}
            />
            <button type="submit" disabled={isAddingPerson}>
              {isAddingPerson ? 'Добавление...' : 'Добавить человека'}
            </button>
          </div>

          <div className="person-color-picker" role="group" aria-label="Выбор цвета человека">
            {colorOptions.map((color) => {
              const isActive = selectedColor === color

              return (
                <button
                  key={color}
                  type="button"
                  className={`person-color-option ${isActive ? 'person-color-option-active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Цвет ${color}`}
                  aria-pressed={isActive}
                  title={color}
                />
              )
            })}
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
                onClick={() => {
                  void onRemovePerson(person.id)
                }}
                disabled={removingPersonId === person.id}
              >
                {removingPersonId === person.id ? 'Удаление...' : 'Удалить'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
