import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { PencilIcon, TrashIcon } from './ActionIcons'
import { EditTransactionModal } from './EditTransactionModal'
import { useModalBehavior } from '../hooks/useModalBehavior'
import type { Person } from '../types/person'
import type {
  DebtTransaction,
  NewDebtTransaction,
  TransactionType,
} from '../types/transaction'
import './TransactionHistoryModal.css'

type TransactionHistoryModalProps = {
  isOpen: boolean
  people: Person[]
  transactions: DebtTransaction[]
  onDeleteTransaction: (transactionId: string) => Promise<void>
  onUpdateTransaction: (
    transactionId: string,
    transaction: NewDebtTransaction,
  ) => Promise<string | null>
  onClose: () => void
  deletingTransactionId: string | null
  updatingTransactionId: string | null
  isTransactionsLoading: boolean
}

const transactionTypeLabels: Record<TransactionType, string> = {
  took: 'Взял',
  gave: 'Отдал',
  gave_for: 'Отдал за',
  transfer: 'Перенос',
}

const betweenPeopleLabel: Record<TransactionType, string> = {
  gave: '→',
  took: 'у',
  gave_for: '→',
  transfer: '→',
}

const forPersonPrefixLabel: Partial<Record<TransactionType, string>> = {
  gave_for: 'за',
  transfer: 'долг',
}

const formatDate = (isoDate: string) => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const findPerson = (personId: string, people: Person[]) =>
  people.find((person) => person.id === personId) ?? null

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getTodayDateInputValue = () => toDateInputValue(new Date())

const isWithinSelectedDateRange = (
  isoDate: string,
  startDate: string,
  endDate: string,
  isPeriodEnabled: boolean,
) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  const dateValue = toDateInputValue(parsed)

  if (!isPeriodEnabled) {
    if (!startDate) {
      return true
    }

    return dateValue === startDate
  }

  if (!startDate && !endDate) {
    return true
  }

  const normalizedStartDate =
    startDate && endDate && startDate > endDate ? endDate : startDate
  const normalizedEndDate =
    startDate && endDate && startDate > endDate ? startDate : endDate

  if (normalizedStartDate && dateValue < normalizedStartDate) {
    return false
  }

  if (normalizedEndDate && dateValue > normalizedEndDate) {
    return false
  }

  return true
}

const isAmountWithinTolerance = (
  amount: number,
  targetAmountText: string,
  toleranceText: string,
) => {
  if (targetAmountText.trim() === '') {
    return true
  }

  const targetAmount = Number(targetAmountText)
  if (!Number.isFinite(targetAmount)) {
    return false
  }

  const rawTolerance = Number(toleranceText)
  const tolerance =
    Number.isFinite(rawTolerance) && rawTolerance >= 0 ? rawTolerance : 0

  return Math.abs(amount - targetAmount) <= tolerance
}

const PersonInline = ({
  person,
  fallbackName,
}: {
  person: Person | null
  fallbackName?: string
}) => {
  if (!person && !fallbackName) {
    return (
      <span className="person-inline person-inline-missing">
        <span className="person-color-dot person-color-dot-missing" aria-hidden="true" />
        Удален
      </span>
    )
  }

  return (
    <span className="person-inline">
      {person ? (
        <span
          className="person-color-dot"
          style={{ backgroundColor: person.color }}
          aria-hidden="true"
        />
      ) : (
        <span className="person-color-dot person-color-dot-missing" aria-hidden="true" />
      )}
      {person?.name ?? fallbackName}
    </span>
  )
}

export function TransactionHistoryModal({
  isOpen,
  people,
  transactions,
  onDeleteTransaction,
  onUpdateTransaction,
  onClose,
  deletingTransactionId,
  updatingTransactionId,
  isTransactionsLoading,
}: TransactionHistoryModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  const [selectedDateFrom, setSelectedDateFrom] = useState<string>(
    getTodayDateInputValue,
  )
  const [selectedDateTo, setSelectedDateTo] = useState<string>('')
  const [isDatePeriodEnabled, setIsDatePeriodEnabled] = useState(false)
  const [amountSearch, setAmountSearch] = useState('')
  const [amountTolerance, setAmountTolerance] = useState('0')
  const [editingTransaction, setEditingTransaction] =
    useState<DebtTransaction | null>(null)

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

  if (!isRendered) {
    return null
  }

  const modalStateClass = isOpen && !isClosing ? 'modal-state-open' : 'modal-state-closing'

  const sortedTransactions = [...transactions].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const filteredTransactions = sortedTransactions.filter(
    (transaction) =>
      isWithinSelectedDateRange(
        transaction.createdAt,
        selectedDateFrom,
        selectedDateTo,
        isDatePeriodEnabled,
      ) &&
      isAmountWithinTolerance(
        transaction.amountHkd,
        amountSearch,
        amountTolerance,
      ),
  )

  return (
    <>
      <div
        className={`modal-overlay ${modalStateClass}`}
        onMouseDown={(event) => {
          if (isOpen && event.target === event.currentTarget) {
            onClose()
          }
        }}
      >
        <section
          className={`modal history-modal ${modalStateClass}`}
          role="dialog"
          aria-modal="true"
          aria-label="История операций"
        >
          <header className="modal-header">
            <h2>История операций</h2>
            <button type="button" className="modal-close-button" onClick={onClose}>
              Закрыть
            </button>
          </header>

        <div className="history-filters" aria-label="Фильтры общей истории">
          <label htmlFor="global-history-date-from">День</label>
          <input
            id="global-history-date-from"
            type="date"
            value={selectedDateFrom}
            onChange={(event) => setSelectedDateFrom(event.target.value)}
          />

          <label className="history-period-toggle">
            <input
              type="checkbox"
              checked={isDatePeriodEnabled}
              onChange={(event) => {
                const isEnabled = event.target.checked
                setIsDatePeriodEnabled(isEnabled)

                if (isEnabled) {
                  setSelectedDateTo(selectedDateFrom)
                } else {
                  setSelectedDateTo('')
                }
              }}
            />
            Период
          </label>

          {isDatePeriodEnabled ? (
            <>
              <label htmlFor="global-history-date-to">Период: по</label>
              <input
                id="global-history-date-to"
                type="date"
                value={selectedDateTo}
                onChange={(event) => setSelectedDateTo(event.target.value)}
              />
            </>
          ) : null}

          <label htmlFor="global-history-amount">Сумма</label>
          <div className="history-amount-filter-row">
            <input
              id="global-history-amount"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={amountSearch}
              onChange={(event) => setAmountSearch(event.target.value)}
              placeholder="Например, 100"
            />
            <span className="history-amount-plusminus" aria-hidden="true">
              ±
            </span>
            <input
              aria-label="Допуск суммы"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={amountTolerance}
              onChange={(event) => setAmountTolerance(event.target.value)}
            />
          </div>
        </div>

          {isTransactionsLoading ? (
            <div className="transactions-loading-state" aria-live="polite">
              <div className="loader" aria-hidden="true" />
              <p>Загружаем историю транзакций...</p>
            </div>
          ) : sortedTransactions.length === 0 ? (
            <p>Операций пока нет.</p>
          ) : filteredTransactions.length === 0 ? (
            <p>По выбранному периоду и сумме операций не найдено.</p>
          ) : (
            <ul className="history-list">
              {filteredTransactions.map((transaction, index) => {
                const from = findPerson(transaction.fromPersonId, people)
                const to = findPerson(transaction.toPersonId, people)
                const forPerson = transaction.forPersonId
                  ? findPerson(transaction.forPersonId, people)
                  : null

                return (
                  <li
                    key={transaction.id}
                    className="history-item"
                    style={{ '--enter-index': index } as CSSProperties}
                  >
                    <strong>{transactionTypeLabels[transaction.type]}</strong>
                    <p className="history-people-line">
                      <PersonInline person={from} fallbackName={transaction.fromPersonName} />
                      <span className="history-arrow">{betweenPeopleLabel[transaction.type]}</span>
                      <PersonInline person={to} fallbackName={transaction.toPersonName} />
                      {transaction.forPersonId && forPersonPrefixLabel[transaction.type] ? (
                        <>
                          <span className="history-for-text">
                            {forPersonPrefixLabel[transaction.type]}
                          </span>
                          <PersonInline
                            person={forPerson}
                            fallbackName={transaction.forPersonName ?? 'Удален'}
                          />
                        </>
                      ) : null}
                    </p>
                    {transaction.note ? <p className="transaction-note">{transaction.note}</p> : null}
                    <strong className="transaction-amount">HK$ {Math.round(transaction.amountHkd)}</strong>
                    <div className="history-item-actions">
                      <span className="history-date">{formatDate(transaction.createdAt)}</span>
                      <div className="history-item-buttons">
                        <button
                          type="button"
                          className="history-edit-button icon-action-button"
                          onClick={() => setEditingTransaction(transaction)}
                          aria-label="Редактировать операцию"
                          title="Редактировать операцию"
                          disabled={
                            deletingTransactionId === transaction.id ||
                            updatingTransactionId === transaction.id
                          }
                        >
                          {updatingTransactionId === transaction.id
                            ? <span className="loader loader-inline" aria-hidden="true" />
                            : <PencilIcon />}
                        </button>
                        <button
                          type="button"
                          className="history-delete-button icon-action-button"
                          onClick={() => {
                            void onDeleteTransaction(transaction.id)
                          }}
                          aria-label="Удалить операцию"
                          title="Удалить операцию"
                          disabled={
                            deletingTransactionId === transaction.id ||
                            updatingTransactionId === transaction.id
                          }
                        >
                          {deletingTransactionId === transaction.id
                            ? <span className="loader loader-inline" aria-hidden="true" />
                            : <TrashIcon />}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <EditTransactionModal
        isOpen={Boolean(editingTransaction)}
        people={people}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onUpdate={onUpdateTransaction}
        updatingTransactionId={updatingTransactionId}
      />
    </>
  )
}
