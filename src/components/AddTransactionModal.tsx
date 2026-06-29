import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useModalBehavior } from '../hooks/useModalBehavior'
import type { Person } from '../types/person'
import type { NewDebtTransaction, TransactionType } from '../types/transaction'
import './AddTransactionModal.css'

type AddTransactionModalProps = {
  isOpen: boolean
  people: Person[]
  defaultWhoId: string | null
  onClose: () => void
  onCreate: (transaction: NewDebtTransaction) => Promise<string | null>
  isCreating: boolean
}

const transactionTypeLabels: Record<TransactionType, string> = {
  took: 'Взял',
  gave: 'Отдал',
  gave_for: 'Отдал за',
  transfer: 'Перенос',
}

const transactionTypeOrder: TransactionType[] = ['took', 'transfer', 'gave', 'gave_for']

const transactionTypeToneClass: Record<TransactionType, string> = {
  took: 'add-transaction-modal-tone-took',
  gave: 'add-transaction-modal-tone-gave',
  gave_for: 'add-transaction-modal-tone-gave-for',
  transfer: 'add-transaction-modal-tone-transfer',
}

const CLOSE_ANIMATION_DURATION_MS = 180

const formatPersonName = (personId: string, people: Person[]) => {
  const person = people.find((item) => item.id === personId)
  return person ? person.name : ''
}

const getPersonById = (personId: string, people: Person[]) =>
  people.find((person) => person.id === personId) ?? null

export function AddTransactionModal({
  isOpen,
  people,
  defaultWhoId,
  onClose,
  onCreate,
  isCreating,
}: AddTransactionModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  const initialWhoId =
    defaultWhoId && people.some((person) => person.id === defaultWhoId)
      ? defaultWhoId
      : people[0]?.id ?? ''

  const initialToWhomId = ''

  const initialForWhomId = ''

  const [type, setType] = useState<TransactionType>('took')
  const [whoId, setWhoId] = useState<string>(initialWhoId)
  const [toWhomId, setToWhomId] = useState<string>(initialToWhomId)
  const [forWhomId, setForWhomId] = useState<string>(initialForWhomId)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const typeGroupRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const syncTimeoutId = window.setTimeout(() => {
      setWhoId(initialWhoId)
    }, 0)

    return () => {
      window.clearTimeout(syncTimeoutId)
    }
  }, [initialWhoId, isOpen])

  const availableToPeople = useMemo(
    () => people.filter((person) => person.id !== whoId),
    [people, whoId],
  )

  const availableForPeople = useMemo(
    () =>
      people.filter(
        (person) => person.id !== whoId && (type !== 'transfer' || person.id !== toWhomId),
      ),
    [people, toWhomId, type, whoId],
  )

  const selectedWho = getPersonById(whoId, people)
  const selectedTo = getPersonById(toWhomId, people)
  const selectedFor = getPersonById(forWhomId, people)
  const isForWhomVisible = type === 'gave_for' || type === 'transfer'
  const whoLabel = type === 'transfer' ? 'С кого перенести' : 'Кто'
  const toWhomLabel = type === 'took' ? 'У кого' : type === 'transfer' ? 'На кого перенести' : 'Кому'
  const forWhomLabel = type === 'transfer' ? 'Долг кому' : 'За кого'

  useModalBehavior(isOpen, onClose)

  const resetFormFieldsPreservingWho = () => {
    setType('took')
    setToWhomId('')
    setForWhomId('')
    setAmount('')
    setNote('')
    setError(null)
  }

  useEffect(() => {
    if (isOpen) {
      const openTimeoutId = window.setTimeout(() => {
        setIsRendered(true)
        setIsClosing(false)
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
    }, CLOSE_ANIMATION_DURATION_MS)

    return () => {
      window.clearTimeout(closeStartTimeoutId)
      window.clearTimeout(timeoutId)
    }
  }, [isOpen, isRendered])

  useEffect(() => {
    if (isOpen) {
      return
    }

    const resetTimeoutId = window.setTimeout(() => {
      resetFormFieldsPreservingWho()
    }, CLOSE_ANIMATION_DURATION_MS)

    return () => {
      window.clearTimeout(resetTimeoutId)
    }
  }, [isOpen])

  useEffect(() => {
    const typeGroupNode = typeGroupRef.current
    if (!typeGroupNode) {
      return
    }

    const activeTypeButton = typeGroupNode.querySelector<HTMLButtonElement>(
      '.transaction-type-button-active',
    )
    if (!activeTypeButton) {
      return
    }

    const maxScrollLeft = typeGroupNode.scrollWidth - typeGroupNode.clientWidth
    if (maxScrollLeft <= 0) {
      return
    }

    const nextScrollLeft =
      activeTypeButton.offsetLeft -
      (typeGroupNode.clientWidth - activeTypeButton.clientWidth) / 2

    const clampedScrollLeft = Math.max(0, Math.min(nextScrollLeft, maxScrollLeft))

    typeGroupNode.scrollTo({
      left: clampedScrollLeft,
      behavior: 'auto',
    })
  }, [type])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (people.length < 2) {
      setError('Добавьте минимум двух людей в настройках.')
      return
    }

    if (!whoId || !toWhomId) {
      setError(`Заполните поля Кто и ${toWhomLabel}.`)
      return
    }

    if (whoId === toWhomId) {
      setError(`Кто и ${toWhomLabel} не могут совпадать.`)
      return
    }

    if ((type === 'gave_for' || type === 'transfer') && !forWhomId) {
      setError(
        type === 'transfer'
          ? 'Для операции Перенос нужно указать поле Долг кому.'
          : 'Для операции Отдал за нужно указать За кого.',
      )
      return
    }

    if (type === 'gave_for' && forWhomId === whoId) {
      setError('Поле За кого не может совпадать с полем Кто.')
      return
    }

    if (type === 'transfer' && forWhomId === whoId) {
      setError('Поле Долг кому не может совпадать с полем С кого.')
      return
    }

    if (type === 'transfer' && forWhomId === toWhomId) {
      setError('Поле Долг кому не может совпадать с полем На кого.')
      return
    }

    const numericAmount = Number(amount)
    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      setError('Сумма должна быть целым числом больше 0.')
      return
    }

    const whoName = formatPersonName(whoId, people)
    const toName = formatPersonName(toWhomId, people)
    const resolvedForName =
      type === 'gave_for' || type === 'transfer'
        ? formatPersonName(forWhomId, people)
        : null

    const createError = await onCreate({
      type,
      fromPersonId: whoId,
      fromPersonName: whoName || 'Удален',
      toPersonId: toWhomId,
      toPersonName: toName || 'Удален',
      forPersonId: type === 'gave_for' || type === 'transfer' ? forWhomId : null,
      forPersonName:
        type === 'gave_for' || type === 'transfer'
          ? resolvedForName || 'Удален'
          : null,
      amountHkd: numericAmount,
      note: note.trim() ? note.trim().slice(0, 280) : null,
    })

    if (createError) {
      setError(createError)
      return
    }

    resetFormFieldsPreservingWho()

    if (whoName && toName) {
      onClose()
    }
  }

  const handleWhoChange = (nextWhoId: string) => {
    setWhoId(nextWhoId)

    if (toWhomId === nextWhoId) {
      const nextToWhom =
        people.find((person) => person.id !== nextWhoId)?.id ?? ''
      setToWhomId(nextToWhom)
    }

    if (forWhomId === nextWhoId) {
      const nextForWhom =
        people.find((person) => person.id !== nextWhoId)?.id ?? ''
      setForWhomId(nextForWhom)
    }
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
        className={`modal add-transaction-modal ${transactionTypeToneClass[type]} ${modalStateClass}`}
        role="dialog"
        aria-modal="true"
        aria-label="Новая операция"
      >
        <header className="modal-header">
          <h2>Новая операция</h2>
          <button type="button" className="modal-close-button" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <form className="add-transaction-form" onSubmit={handleSubmit}>
          <span className="form-label">Тип</span>
          <div
            ref={typeGroupRef}
            className="transaction-type-group"
            role="radiogroup"
            aria-label="Тип операции"
          >
            {transactionTypeOrder.map(
              (transactionType) => (
                <button
                  key={transactionType}
                  type="button"
                  role="radio"
                  aria-checked={type === transactionType}
                  className={`transaction-type-button ${
                    type === transactionType ? 'transaction-type-button-active' : ''
                  }`}
                  onClick={() => setType(transactionType)}
                >
                  {transactionTypeLabels[transactionType]}
                </button>
              ),
            )}
          </div>

          <label htmlFor="transaction-who">{whoLabel}</label>
          <div className="person-select-row">
            <span
              className={`person-color-dot ${selectedWho ? '' : 'person-color-dot-placeholder'}`}
              style={selectedWho ? { backgroundColor: selectedWho.color } : undefined}
              aria-hidden="true"
            />
            <select
              id="transaction-who"
              value={whoId}
              onChange={(event) => handleWhoChange(event.target.value)}
              disabled={isCreating}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="transaction-to">{toWhomLabel}</label>
          <div className="person-select-row">
            <span
              className={`person-color-dot ${selectedTo ? '' : 'person-color-dot-placeholder'}`}
              style={selectedTo ? { backgroundColor: selectedTo.color } : undefined}
              aria-hidden="true"
            />
            <select
              id="transaction-to"
              value={toWhomId}
              onChange={(event) => setToWhomId(event.target.value)}
              disabled={isCreating}
            >
              <option value="" disabled hidden>
                Выберите человека
              </option>
              {availableToPeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`optional-person-field ${isForWhomVisible ? 'optional-person-field-visible' : ''}`}
            aria-hidden={!isForWhomVisible}
          >
            <>
              <label htmlFor="transaction-for">{forWhomLabel}</label>
              <div className="person-select-row">
                <span
                  className={`person-color-dot ${selectedFor ? '' : 'person-color-dot-placeholder'}`}
                  style={selectedFor ? { backgroundColor: selectedFor.color } : undefined}
                  aria-hidden="true"
                />
                <select
                  id="transaction-for"
                  value={forWhomId}
                  onChange={(event) => setForWhomId(event.target.value)}
                  disabled={isCreating || !isForWhomVisible}
                >
                  <option value="" disabled hidden>
                    Выберите человека
                  </option>
                  {availableForPeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          </div>

          <label htmlFor="transaction-amount">Сумма (HKD)</label>
          <div className="amount-input-wrap">
            <span aria-hidden="true">HK$</span>
            <input
              id="transaction-amount"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              disabled={isCreating}
            />
          </div>

          <label htmlFor="transaction-note">Заметка (необязательно)</label>
          <textarea
            id="transaction-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Короткий комментарий"
            disabled={isCreating}
          />

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" className="save-transaction-button" disabled={isCreating}>
            {isCreating ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </section>
    </div>
  )
}
