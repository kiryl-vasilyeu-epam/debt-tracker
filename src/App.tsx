import { useEffect, useState } from 'react'
import { AddTransactionModal } from './components/AddTransactionModal'
import { PeopleTabs } from './components/PeopleTabs'
import { SettingsModal } from './components/SettingsModal'
import { StartScreen } from './components/StartScreen'
import { TransactionHistoryModal } from './components/TransactionHistoryModal'
import {
  clearLegacyLocalData,
  deletePersonRemote,
  deleteTransactionRemote,
  loadInitialAppState,
  loadTransactions,
  saveBalancesRemote,
  savePersonRemote,
  saveTransactionRemote,
} from './lib/appStorage'
import { generatePersonColor } from './lib/peopleStorage'
import type { DebtBalance } from './types/balance'
import type { Person } from './types/person'
import type { NewDebtTransaction, DebtTransaction } from './types/transaction'
import './App.css'

const ACTIVE_PERSON_STORAGE_KEY = 'debt-tracker-active-person-id-v1'
const THEME_STORAGE_KEY = 'debt-tracker-theme-v1'

type AppTheme = 'light' | 'dark'

const getInitialTheme = (): AppTheme => {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

type Settlement = {
  debtorId: string
  debtorName: string
  creditorId: string
  creditorName: string
  amountHkd: number
}

const balanceKey = (debtorId: string, creditorId: string) =>
  `${debtorId}:${creditorId}`

const applySettlement = (
  map: Map<string, DebtBalance>,
  settlement: Settlement,
) => {
  const forwardKey = balanceKey(settlement.debtorId, settlement.creditorId)
  const reverseKey = balanceKey(settlement.creditorId, settlement.debtorId)

  const reverse = map.get(reverseKey)
  if (reverse) {
    if (reverse.amountHkd > settlement.amountHkd) {
      map.set(reverseKey, {
        ...reverse,
        amountHkd: Number((reverse.amountHkd - settlement.amountHkd).toFixed(2)),
      })
      return
    }

    if (reverse.amountHkd === settlement.amountHkd) {
      map.delete(reverseKey)
      return
    }

    map.delete(reverseKey)
    map.set(forwardKey, {
      id: forwardKey,
      debtorId: settlement.debtorId,
      debtorName: settlement.debtorName,
      creditorId: settlement.creditorId,
      creditorName: settlement.creditorName,
      amountHkd: Number((settlement.amountHkd - reverse.amountHkd).toFixed(2)),
    })
    return
  }

  const currentForward = map.get(forwardKey)
  if (!currentForward) {
    map.set(forwardKey, {
      id: forwardKey,
      debtorId: settlement.debtorId,
      debtorName: settlement.debtorName,
      creditorId: settlement.creditorId,
      creditorName: settlement.creditorName,
      amountHkd: settlement.amountHkd,
    })
    return
  }

  map.set(forwardKey, {
    ...currentForward,
    amountHkd: Number((currentForward.amountHkd + settlement.amountHkd).toFixed(2)),
  })
}

const getSettlements = (transaction: DebtTransaction): Settlement[] => {
  if (transaction.type === 'gave') {
    return [
      {
        debtorId: transaction.toPersonId,
        debtorName: transaction.toPersonName,
        creditorId: transaction.fromPersonId,
        creditorName: transaction.fromPersonName,
        amountHkd: transaction.amountHkd,
      },
    ]
  }

  if (transaction.type === 'took') {
    return [
      {
        debtorId: transaction.fromPersonId,
        debtorName: transaction.fromPersonName,
        creditorId: transaction.toPersonId,
        creditorName: transaction.toPersonName,
        amountHkd: transaction.amountHkd,
      },
    ]
  }

  if (!transaction.forPersonId || !transaction.forPersonName) {
    return []
  }

  return [
    {
      debtorId: transaction.toPersonId,
      debtorName: transaction.toPersonName,
      creditorId: transaction.forPersonId,
      creditorName: transaction.forPersonName,
      amountHkd: transaction.amountHkd,
    },
    {
      debtorId: transaction.forPersonId,
      debtorName: transaction.forPersonName,
      creditorId: transaction.fromPersonId,
      creditorName: transaction.fromPersonName,
      amountHkd: transaction.amountHkd,
    },
  ]
}

const applyTransactionToBalances = (
  currentBalances: DebtBalance[],
  transaction: DebtTransaction,
  direction: 'add' | 'remove',
): DebtBalance[] => {
  const map = new Map(currentBalances.map((balance) => [balance.id, balance]))
  const settlements = getSettlements(transaction)

  for (const settlement of settlements) {
    if (direction === 'add') {
      applySettlement(map, settlement)
      continue
    }

    applySettlement(map, {
      debtorId: settlement.creditorId,
      debtorName: settlement.creditorName,
      creditorId: settlement.debtorId,
      creditorName: settlement.debtorName,
      amountHkd: settlement.amountHkd,
    })
  }

  return [...map.values()].sort((a, b) => b.amountHkd - a.amountHkd)
}

function App() {
  const [people, setPeople] = useState<Person[]>([])
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme)
  const [activePersonId, setActivePersonId] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [transactions, setTransactions] = useState<DebtTransaction[]>([])
  const [areTransactionsLoaded, setAreTransactionsLoaded] = useState(false)
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false)
  const [balances, setBalances] = useState<DebtBalance[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isAddingPerson, setIsAddingPerson] = useState(false)
  const [removingPersonId, setRemovingPersonId] = useState<string | null>(null)
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false)
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(
    null,
  )
  const [requestError, setRequestError] = useState<string | null>(null)

  const closeErrorOverlay = () => {
    setRequestError(null)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const loadState = async () => {
      setIsInitialLoading(true)
      setRequestError(null)

      try {
        clearLegacyLocalData()
        const snapshot = await loadInitialAppState()

        setPeople(snapshot.people)
        setBalances(snapshot.balances)

        const storedActivePersonId = window.localStorage.getItem(
          ACTIVE_PERSON_STORAGE_KEY,
        )
        if (
          storedActivePersonId &&
          snapshot.people.some((person) => person.id === storedActivePersonId)
        ) {
          setActivePersonId(storedActivePersonId)
        } else {
          setActivePersonId(snapshot.people[0]?.id ?? null)
        }
      } catch {
        setRequestError('Не удалось загрузить данные. Попробуйте обновить страницу.')
      } finally {
        setIsInitialLoading(false)
      }
    }

    void loadState()
  }, [])

  useEffect(() => {
    if (!activePersonId) {
      window.localStorage.removeItem(ACTIVE_PERSON_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(ACTIVE_PERSON_STORAGE_KEY, activePersonId)
  }, [activePersonId])

  const ensureTransactionsLoaded = async () => {
    if (areTransactionsLoaded || isTransactionsLoading) {
      return
    }

    setIsTransactionsLoading(true)
    setRequestError(null)

    try {
      const loadedTransactions = await loadTransactions(people)
      setTransactions(loadedTransactions)
      setAreTransactionsLoaded(true)
    } catch {
      setRequestError('Не удалось загрузить историю транзакций.')
    } finally {
      setIsTransactionsLoading(false)
    }
  }

  const addPerson = async (
    name: string,
    selectedColor?: string,
  ): Promise<string | null> => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return 'Введите имя человека.'
    }

    if (
      people.some(
        (person) => person.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      return 'Это имя уже существует.'
    }

    setIsAddingPerson(true)
    setRequestError(null)

    const person: Person = {
      id: window.crypto.randomUUID(),
      name: trimmedName,
      color: selectedColor ?? generatePersonColor(),
    }

    try {
      await savePersonRemote(person)

      const nextPeople = [...people, person]
      const nextActivePersonId = activePersonId ?? person.id

      setPeople(nextPeople)
      setActivePersonId(nextActivePersonId)

      return null
    } catch {
      setRequestError('Не удалось добавить человека.')
      return 'Не удалось добавить человека. Проверьте подключение к базе.'
    } finally {
      setIsAddingPerson(false)
    }
  }

  const removePerson = async (id: string): Promise<void> => {
    setRemovingPersonId(id)
    setRequestError(null)

    try {
      await deletePersonRemote(id)

      const nextPeople = people.filter((person) => person.id !== id)
      const nextActivePersonId =
        activePersonId === id ? (nextPeople[0]?.id ?? null) : activePersonId

      setPeople(nextPeople)
      setActivePersonId(nextActivePersonId)
    } catch {
      setRequestError('Не удалось удалить человека.')
      throw new Error('Не удалось удалить человека')
    } finally {
      setRemovingPersonId(null)
    }
  }

  const createTransaction = async (
    transaction: NewDebtTransaction,
  ): Promise<string | null> => {
    setIsCreatingTransaction(true)
    setRequestError(null)

    const nextTransaction: DebtTransaction = {
      id: window.crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...transaction,
    }

    const nextBalances = applyTransactionToBalances(
      balances,
      nextTransaction,
      'add',
    )

    try {
      await saveTransactionRemote(nextTransaction)
      await saveBalancesRemote(nextBalances, balances)

      if (areTransactionsLoaded) {
        setTransactions((prevTransactions) => [nextTransaction, ...prevTransactions])
      }
      setBalances(nextBalances)

      return null
    } catch {
      setRequestError('Не удалось сохранить операцию.')
      return 'Не удалось сохранить операцию. Проверьте подключение к базе.'
    } finally {
      setIsCreatingTransaction(false)
    }
  }

  const deleteTransaction = async (transactionId: string) => {
    setDeletingTransactionId(transactionId)
    setRequestError(null)

    const transactionToDelete = transactions.find(
      (transaction) => transaction.id === transactionId,
    )
    if (!transactionToDelete) {
      setDeletingTransactionId(null)
      return
    }

    const nextTransactions = transactions.filter(
      (transaction) => transaction.id !== transactionId,
    )
    const nextBalances = applyTransactionToBalances(
      balances,
      transactionToDelete,
      'remove',
    )

    try {
      await deleteTransactionRemote(transactionId)
      await saveBalancesRemote(nextBalances, balances)

      setTransactions(nextTransactions)
      setBalances(nextBalances)
      setAreTransactionsLoaded(true)
    } catch {
      setRequestError('Не удалось удалить операцию.')
      throw new Error('Не удалось удалить операцию')
    } finally {
      setDeletingTransactionId(null)
    }
  }

  const activePerson = people.find((person) => person.id === activePersonId) ?? null

  if (isInitialLoading) {
    return (
      <main className="app">
        <section className="card app-loading-card" aria-live="polite">
          <div className="loader" aria-hidden="true" />
          <p>Загружаем данные...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="top-bar card">
        <h1>Учет долгов</h1>
        <div className="top-bar-actions">
          <button
            type="button"
            className="settings-icon-button"
            aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
            title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
            onClick={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
          >
            <svg
              className="settings-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
            >
              {theme === 'dark' ? (
                <>
                  <circle
                    cx="12"
                    cy="12"
                    r="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

          <button
            type="button"
            className="settings-icon-button"
            aria-label={isHistoryOpen ? 'Закрыть общую историю' : 'Открыть общую историю'}
            title={isHistoryOpen ? 'Закрыть историю' : 'Общая история'}
            onClick={() => {
              setIsSettingsOpen(false)
              setIsHistoryOpen((isOpen) => !isOpen)
              void ensureTransactionsLoaded()
            }}
          >
            <svg
              className="settings-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <path
                d="M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4Zm0 2a7.2 7.2 0 1 1 0 14.4 7.2 7.2 0 0 1 0-14.4Zm-1 2.6v5.1l4 2.4 1-1.7-3-1.8V7.4h-2Z"
                fill="currentColor"
              />
            </svg>
          </button>

          <button
            type="button"
            className="settings-icon-button"
            aria-label={isSettingsOpen ? 'Закрыть настройки людей' : 'Открыть настройки людей'}
            title={isSettingsOpen ? 'Закрыть настройки' : 'Настройки людей'}
            onClick={() => {
              setIsHistoryOpen(false)
              setIsSettingsOpen((isOpen) => !isOpen)
            }}
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
        </div>
      </header>

      <PeopleTabs
        people={people}
        activePersonId={activePersonId}
        onSelectPerson={setActivePersonId}
      />

      <StartScreen
        activePerson={activePerson}
        people={people}
        transactions={transactions}
        balances={balances}
        areTransactionsLoaded={areTransactionsLoaded}
        isTransactionsLoading={isTransactionsLoading}
        onRequestTransactions={ensureTransactionsLoaded}
      />

      {requestError ? (
        <div className="error-overlay" role="alertdialog" aria-modal="true">
          <section className="error-overlay-card">
            <h2>Ошибка запроса</h2>
            <p>{requestError}</p>
            <div className="error-overlay-actions">
              <button type="button" onClick={closeErrorOverlay}>
                Понятно
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {people.length > 0 ? (
        <button
          type="button"
          className="fab-add-transaction"
          aria-label="Добавить операцию"
          title="Добавить операцию"
          onClick={() => setIsAddTransactionOpen(true)}
        >
          +
        </button>
      ) : null}

      <SettingsModal
        isOpen={isSettingsOpen}
        people={people}
        onClose={() => setIsSettingsOpen(false)}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        isAddingPerson={isAddingPerson}
        removingPersonId={removingPersonId}
      />

      {isHistoryOpen ? (
        <TransactionHistoryModal
          isOpen={isHistoryOpen}
          people={people}
          transactions={transactions}
          onDeleteTransaction={deleteTransaction}
          onClose={() => setIsHistoryOpen(false)}
          deletingTransactionId={deletingTransactionId}
          isTransactionsLoading={isTransactionsLoading}
        />
      ) : null}

      {isAddTransactionOpen ? (
        <AddTransactionModal
          isOpen={isAddTransactionOpen}
          people={people}
          defaultWhoId={activePersonId}
          onClose={() => setIsAddTransactionOpen(false)}
          onCreate={createTransaction}
          isCreating={isCreatingTransaction}
        />
      ) : null}
    </main>
  )
}

export default App
