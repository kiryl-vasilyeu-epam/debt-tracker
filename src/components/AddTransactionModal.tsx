import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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
  gave: 'Отдал',
  took: 'Взял',
  gave_for: 'Отдал за',
}

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
  const initialWhoId =
    defaultWhoId && people.some((person) => person.id === defaultWhoId)
      ? defaultWhoId
      : people[0]?.id ?? ''

  const initialToWhomId = ''

  const initialForWhomId = people.find((person) => person.id !== initialWhoId)?.id ?? ''

  const [type, setType] = useState<TransactionType>('gave')
  const [whoId, setWhoId] = useState<string>(initialWhoId)
  const [toWhomId, setToWhomId] = useState<string>(initialToWhomId)
  const [forWhomId, setForWhomId] = useState<string>(initialForWhomId)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const availableToPeople = useMemo(
    () => people.filter((person) => person.id !== whoId),
    [people, whoId],
  )

  const availableForPeople = useMemo(
    () => people.filter((person) => person.id !== whoId),
    [people, whoId],
  )

  const selectedWho = getPersonById(whoId, people)
  const selectedTo = getPersonById(toWhomId, people)
  const selectedFor = getPersonById(forWhomId, people)

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (people.length < 2) {
      setError('Добавьте минимум двух людей в настройках.')
      return
    }

    if (!whoId || !toWhomId) {
      setError('Заполните поля Кто и Кому.')
      return
    }

    if (whoId === toWhomId) {
      setError('Кто и Кому не могут совпадать.')
      return
    }

    if (type === 'gave_for' && !forWhomId) {
      setError('Для операции Отдал за нужно указать За кого.')
      return
    }

    if (type === 'gave_for' && forWhomId === whoId) {
      setError('Поле За кого не может совпадать с полем Кто.')
      return
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Сумма должна быть больше 0.')
      return
    }

    const whoName = formatPersonName(whoId, people)
    const toName = formatPersonName(toWhomId, people)
    const resolvedForName =
      type === 'gave_for' ? formatPersonName(forWhomId, people) : null

    const createError = await onCreate({
      type,
      fromPersonId: whoId,
      fromPersonName: whoName || 'Удален',
      toPersonId: toWhomId,
      toPersonName: toName || 'Удален',
      forPersonId: type === 'gave_for' ? forWhomId : null,
      forPersonName: type === 'gave_for' ? resolvedForName || 'Удален' : null,
      amountHkd: Number(numericAmount.toFixed(2)),
      note: note.trim() ? note.trim().slice(0, 280) : null,
    })

    if (createError) {
      setError(createError)
      return
    }

    setError(null)
    setAmount('')
    setNote('')

    if (type !== 'gave_for') {
      setForWhomId(toWhomId)
    }

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
      <section className="modal add-transaction-modal" role="dialog" aria-modal="true" aria-label="Новая операция">
        <header className="modal-header">
          <h2>Новая операция</h2>
          <button type="button" className="modal-close-button" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <form className="add-transaction-form" onSubmit={handleSubmit}>
          <span className="form-label">Тип</span>
          <div
            className="transaction-type-group"
            role="radiogroup"
            aria-label="Тип операции"
          >
            {(Object.keys(transactionTypeLabels) as TransactionType[]).map(
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

          <label htmlFor="transaction-who">Кто</label>
          <div className="person-select-row">
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
            {selectedWho ? (
              <span
                className="person-color-dot"
                style={{ backgroundColor: selectedWho.color }}
                aria-hidden="true"
              />
            ) : null}
          </div>

          <label htmlFor="transaction-to">Кому</label>
          <div className="person-select-row">
            <select
              id="transaction-to"
              value={toWhomId}
              onChange={(event) => setToWhomId(event.target.value)}
              disabled={isCreating}
            >
              <option value="">Выберите человека</option>
              {availableToPeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            {selectedTo ? (
              <span
                className="person-color-dot"
                style={{ backgroundColor: selectedTo.color }}
                aria-hidden="true"
              />
            ) : null}
          </div>

          {type === 'gave_for' ? (
            <>
              <label htmlFor="transaction-for">За кого</label>
              <div className="person-select-row">
                <select
                  id="transaction-for"
                  value={forWhomId}
                  onChange={(event) => setForWhomId(event.target.value)}
                  disabled={isCreating}
                >
                  {availableForPeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                {selectedFor ? (
                  <span
                    className="person-color-dot"
                    style={{ backgroundColor: selectedFor.color }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </>
          ) : null}

          <label htmlFor="transaction-amount">Сумма (HKD)</label>
          <div className="amount-input-wrap">
            <span aria-hidden="true">HK$</span>
            <input
              id="transaction-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
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
