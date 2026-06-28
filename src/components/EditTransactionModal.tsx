import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useModalBehavior } from '../hooks/useModalBehavior'
import type { Person } from '../types/person'
import type {
  DebtTransaction,
  NewDebtTransaction,
  TransactionType,
} from '../types/transaction'
import './AddTransactionModal.css'

type EditTransactionModalProps = {
  isOpen: boolean
  people: Person[]
  transaction: DebtTransaction | null
  onClose: () => void
  onUpdate: (
    transactionId: string,
    transaction: NewDebtTransaction,
  ) => Promise<string | null>
  updatingTransactionId: string | null
}

const transactionTypeLabels: Record<TransactionType, string> = {
  took: 'Взял',
  gave: 'Отдал',
  gave_for: 'Отдал за',
}

const transactionTypeOrder: TransactionType[] = ['took', 'gave', 'gave_for']

const transactionTypeToneClass: Record<TransactionType, string> = {
  took: 'add-transaction-modal-tone-took',
  gave: 'add-transaction-modal-tone-gave',
  gave_for: 'add-transaction-modal-tone-gave-for',
}

const formatPersonName = (personId: string, people: Person[]) => {
  const person = people.find((item) => item.id === personId)
  return person ? person.name : ''
}

const getPersonById = (personId: string, people: Person[]) =>
  people.find((person) => person.id === personId) ?? null

export function EditTransactionModal({
  isOpen,
  people,
  transaction,
  onClose,
  onUpdate,
  updatingTransactionId,
}: EditTransactionModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'took')
  const [whoId, setWhoId] = useState<string>(transaction?.fromPersonId ?? '')
  const [toWhomId, setToWhomId] = useState<string>(transaction?.toPersonId ?? '')
  const [forWhomId, setForWhomId] = useState<string>(transaction?.forPersonId ?? '')
  const [amount, setAmount] = useState(String(Math.round(transaction?.amountHkd ?? 0)))
  const [note, setNote] = useState(transaction?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const typeGroupRef = useRef<HTMLDivElement | null>(null)

  useModalBehavior(isOpen, onClose)

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
    }, 180)

    return () => {
      window.clearTimeout(closeStartTimeoutId)
      window.clearTimeout(timeoutId)
    }
  }, [isOpen, isRendered])

  useEffect(() => {
    if (!transaction || !isOpen) {
      return
    }

    const syncTimeoutId = window.setTimeout(() => {
      setType(transaction.type)
      setWhoId(transaction.fromPersonId)
      setToWhomId(transaction.toPersonId)
      setForWhomId(transaction.forPersonId ?? '')
      setAmount(String(Math.round(transaction.amountHkd)))
      setNote(transaction.note ?? '')
      setError(null)
    }, 0)

    return () => {
      window.clearTimeout(syncTimeoutId)
    }
  }, [isOpen, transaction])

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
  const toWhomLabel = type === 'took' ? 'У кого' : 'Кому'
  const isUpdatingCurrentTransaction =
    transaction ? updatingTransactionId === transaction.id : false

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

    if (type === 'gave_for' && !forWhomId) {
      setError('Для операции Отдал за нужно указать За кого.')
      return
    }

    if (type === 'gave_for' && forWhomId === whoId) {
      setError('Поле За кого не может совпадать с полем Кто.')
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
      type === 'gave_for' ? formatPersonName(forWhomId, people) : null

    if (!transaction) {
      return
    }

    const updateError = await onUpdate(transaction.id, {
      type,
      fromPersonId: whoId,
      fromPersonName: whoName || 'Удален',
      toPersonId: toWhomId,
      toPersonName: toName || 'Удален',
      forPersonId: type === 'gave_for' ? forWhomId : null,
      forPersonName: type === 'gave_for' ? resolvedForName || 'Удален' : null,
      amountHkd: numericAmount,
      note: note.trim() ? note.trim().slice(0, 280) : null,
    })

    if (updateError) {
      setError(updateError)
      return
    }

    setError(null)
    onClose()
  }

  if (!isRendered || !transaction) {
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
        aria-label="Редактирование операции"
      >
        <header className="modal-header">
          <h2>Редактирование операции</h2>
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
            {transactionTypeOrder.map((transactionType) => (
              <button
                key={transactionType}
                type="button"
                role="radio"
                aria-checked={type === transactionType}
                className={`transaction-type-button ${
                  type === transactionType ? 'transaction-type-button-active' : ''
                }`}
                onClick={() => setType(transactionType)}
                disabled={isUpdatingCurrentTransaction}
              >
                {transactionTypeLabels[transactionType]}
              </button>
            ))}
          </div>

          <label htmlFor="edit-transaction-who">Кто</label>
          <div className="person-select-row">
            <span
              className={`person-color-dot ${selectedWho ? '' : 'person-color-dot-placeholder'}`}
              style={selectedWho ? { backgroundColor: selectedWho.color } : undefined}
              aria-hidden="true"
            />
            <select
              id="edit-transaction-who"
              value={whoId}
              onChange={(event) => handleWhoChange(event.target.value)}
              disabled={isUpdatingCurrentTransaction}
            >
              <option value="" disabled hidden>
                Выберите человека
              </option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="edit-transaction-to">{toWhomLabel}</label>
          <div className="person-select-row">
            <span
              className={`person-color-dot ${selectedTo ? '' : 'person-color-dot-placeholder'}`}
              style={selectedTo ? { backgroundColor: selectedTo.color } : undefined}
              aria-hidden="true"
            />
            <select
              id="edit-transaction-to"
              value={toWhomId}
              onChange={(event) => setToWhomId(event.target.value)}
              disabled={isUpdatingCurrentTransaction}
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

          {type === 'gave_for' ? (
            <>
              <label htmlFor="edit-transaction-for">За кого</label>
              <div className="person-select-row">
                <span
                  className={`person-color-dot ${selectedFor ? '' : 'person-color-dot-placeholder'}`}
                  style={selectedFor ? { backgroundColor: selectedFor.color } : undefined}
                  aria-hidden="true"
                />
                <select
                  id="edit-transaction-for"
                  value={forWhomId}
                  onChange={(event) => setForWhomId(event.target.value)}
                  disabled={isUpdatingCurrentTransaction}
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
          ) : null}

          <label htmlFor="edit-transaction-amount">Сумма (HKD)</label>
          <div className="amount-input-wrap">
            <span aria-hidden="true">HK$</span>
            <input
              id="edit-transaction-amount"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              disabled={isUpdatingCurrentTransaction}
            />
          </div>

          <label htmlFor="edit-transaction-note">Заметка (необязательно)</label>
          <textarea
            id="edit-transaction-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Короткий комментарий"
            disabled={isUpdatingCurrentTransaction}
          />

          {error ? <p className="error">{error}</p> : null}

          <button
            type="submit"
            className="save-transaction-button"
            disabled={isUpdatingCurrentTransaction}
          >
            {isUpdatingCurrentTransaction ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </section>
    </div>
  )
}
