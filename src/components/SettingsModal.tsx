import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useModalBehavior } from '../hooks/useModalBehavior'
import { TrashIcon } from './ActionIcons'
import type { Person } from '../types/person'
import './SettingsModal.css'

type SettingsModalProps = {
  isOpen: boolean
  people: Person[]
  onClose: () => void
  onAddPerson: (name: string, color: string) => Promise<string | null>
  onUpdatePersonColor: (personId: string, color: string) => Promise<void>
  onRequestRemovePerson: (person: Person) => void
  isAddingPerson: boolean
  removingPersonId: string | null
  updatingPersonColorId: string | null
}

const FALLBACK_HEX_COLOR = '#3b82f6'

const hueRanges: Array<[number, number]> = [
  [0, 20],
  [24, 42],
  [72, 96],
  [108, 138],
  [160, 190],
  [200, 230],
  [248, 284],
  [300, 334],
  [340, 358],
]

const hslToRgb = (
  hue: number,
  saturationPercent: number,
  lightnessPercent: number,
): [number, number, number] => {
  const saturation = saturationPercent / 100
  const lightness = lightnessPercent / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const huePrime = hue / 60
  const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1))

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (huePrime >= 0 && huePrime < 1) {
    r1 = chroma
    g1 = secondComponent
  } else if (huePrime >= 1 && huePrime < 2) {
    r1 = secondComponent
    g1 = chroma
  } else if (huePrime >= 2 && huePrime < 3) {
    g1 = chroma
    b1 = secondComponent
  } else if (huePrime >= 3 && huePrime < 4) {
    g1 = secondComponent
    b1 = chroma
  } else if (huePrime >= 4 && huePrime < 5) {
    r1 = secondComponent
    b1 = chroma
  } else {
    r1 = chroma
    b1 = secondComponent
  }

  const match = lightness - chroma / 2
  return [
    Math.round((r1 + match) * 255),
    Math.round((g1 + match) * 255),
    Math.round((b1 + match) * 255),
  ]
}

const randomHexColor = () => {
  const randomRange = hueRanges[Math.floor(Math.random() * hueRanges.length)]
  const hue = Math.floor(
    randomRange[0] + Math.random() * (randomRange[1] - randomRange[0]),
  )
  const saturation = 66 + Math.floor(Math.random() * 18)
  const lightness = 46 + Math.floor(Math.random() * 12)

  const [r, g, b] = hslToRgb(hue, saturation, lightness)
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const rgbStringToHex = (colorValue: string): string | null => {
  const rgbMatch = colorValue.match(/rgba?\(([^)]+)\)/i)
  if (!rgbMatch) {
    return null
  }

  const parts = rgbMatch[1]
    .split(/[\s,/]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)

  if (parts.length !== 3) {
    return null
  }

  const toChannel = (rawValue: string) => {
    if (rawValue.endsWith('%')) {
      const parsedPercent = Number(rawValue.slice(0, -1))
      if (!Number.isFinite(parsedPercent)) {
        return NaN
      }

      return Math.round((parsedPercent / 100) * 255)
    }

    return Math.round(Number(rawValue))
  }

  const channels = parts.map(toChannel)
  if (!channels.every((channel) => Number.isFinite(channel))) {
    return null
  }

  const clamp = (channel: number) => Math.max(0, Math.min(255, channel))
  const toHex = (channel: number) => clamp(channel).toString(16).padStart(2, '0')

  return `#${toHex(channels[0])}${toHex(channels[1])}${toHex(channels[2])}`
}

const normalizeColorToHex = (colorValue: string): string => {
  const directHexMatch = colorValue.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (directHexMatch) {
    const normalized = directHexMatch[1]
    if (normalized.length === 3) {
      return `#${normalized
        .split('')
        .map((char) => char + char)
        .join('')}`.toLowerCase()
    }

    return `#${normalized.toLowerCase()}`
  }

  const directRgbHex = rgbStringToHex(colorValue)
  if (directRgbHex) {
    return directRgbHex
  }

  if (typeof document === 'undefined') {
    return FALLBACK_HEX_COLOR
  }

  const context = document.createElement('canvas').getContext('2d')
  if (!context) {
    return FALLBACK_HEX_COLOR
  }

  context.fillStyle = '#000000'
  context.fillStyle = colorValue

  return rgbStringToHex(context.fillStyle) ?? FALLBACK_HEX_COLOR
}

export function SettingsModal({
  isOpen,
  people,
  onClose,
  onAddPerson,
  onUpdatePersonColor,
  onRequestRemovePerson,
  isAddingPerson,
  removingPersonId,
  updatingPersonColorId,
}: SettingsModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [selectedColor, setSelectedColor] = useState<string>(() => randomHexColor())
  const [error, setError] = useState<string | null>(null)
  const selectedColorHex = normalizeColorToHex(selectedColor)

  useModalBehavior(isOpen, onClose)

  useEffect(() => {
    if (isOpen) {
      const openTimeoutId = window.setTimeout(() => {
        setIsRendered(true)
        setIsClosing(false)
        setSelectedColor(randomHexColor())
      }, 0)

      return () => {
        window.clearTimeout(openTimeoutId)
      }
    }

    if (!isRendered) {
      return
    }

    const closeStartTimeoutId = window.setTimeout(() => {
      setIsClosing(true)
    }, 0)
    const timeoutId = window.setTimeout(() => {
      setIsRendered(false)
      setIsClosing(false)
    }, 180)

    return () => {
      window.clearTimeout(closeStartTimeoutId)
      window.clearTimeout(timeoutId)
    }
  }, [isOpen, isRendered])

  const handleAddPerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const addError = await onAddPerson(
      newPersonName,
      selectedColor || randomHexColor(),
    )
    if (addError) {
      setError(addError)
      return
    }

    setError(null)
    setNewPersonName('')
    setSelectedColor(randomHexColor())
  }

  if (!isRendered) {
    return null
  }

  const modalStateClass = isOpen && !isClosing ? 'modal-state-open' : 'modal-state-closing'

  return (
    <div
      className={`modal-overlay ${modalStateClass}`}
      onMouseDown={(event) => {
        if (isOpen && event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className={`modal ${modalStateClass}`}
        role="dialog"
        aria-modal="true"
        aria-label="Настройки людей"
      >
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

            <div className="custom-color-input-wrap">
              <input
                id="new-person-color"
                type="color"
                value={selectedColorHex}
                onChange={(event) => setSelectedColor(event.target.value)}
                disabled={isAddingPerson}
                aria-label="Выбрать точный цвет"
                title="Выбрать цвет"
              />
              <label htmlFor="new-person-color" className="custom-color-value">
                {selectedColorHex.toUpperCase()}
              </label>
            </div>

            <button type="submit" disabled={isAddingPerson}>
              {isAddingPerson ? 'Добавление...' : 'Добавить человека'}
            </button>
          </div>
        </form>

        {error ? <p className="error">{error}</p> : null}

        <ul className="people-list">
          {people.map((person) => {
            const personColorHex = normalizeColorToHex(person.color)
            const personColorInputId = `person-color-${person.id}`

            return (
            <li key={person.id}>
              <div className="person-meta">
                <input
                  id={personColorInputId}
                  type="color"
                  className="person-color-dot-picker"
                  value={personColorHex}
                  onChange={(event) => {
                    void onUpdatePersonColor(person.id, event.target.value)
                  }}
                  disabled={
                    removingPersonId === person.id ||
                    updatingPersonColorId === person.id
                  }
                  aria-label={`Изменить цвет для ${person.name}`}
                  title={`Изменить цвет для ${person.name}`}
                />
                <label htmlFor={personColorInputId} className="person-color-label">
                  <span>{person.name}</span>
                </label>
              </div>
              <button
                type="button"
                className="danger-button icon-action-button"
                onClick={() => {
                  onRequestRemovePerson(person)
                }}
                disabled={removingPersonId === person.id}
                aria-label="Удалить человека"
                title="Удалить человека"
              >
                {removingPersonId === person.id ? (
                  <span className="loader loader-inline" aria-hidden="true" />
                ) : (
                  <TrashIcon />
                )}
              </button>
            </li>
          )})}
        </ul>
      </section>
    </div>
  )
}
