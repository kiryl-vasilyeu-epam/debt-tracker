import { useEffect, useState } from 'react'
import { AddTransactionModal } from './components/AddTransactionModal'
import { PeopleTabs } from './components/PeopleTabs'
import { SettingsModal } from './components/SettingsModal'
import { StartScreen } from './components/StartScreen'
import { TransactionHistoryModal } from './components/TransactionHistoryModal'
import {
  generatePersonColor,
  getStoredPeople,
  savePeople,
} from './lib/peopleStorage'
import {
  getStoredTransactions,
  saveTransactions,
} from './lib/transactionsStorage'
import type { Person } from './types/person'
import type { NewDebtTransaction, DebtTransaction } from './types/transaction'
import './App.css'

const ACTIVE_PERSON_STORAGE_KEY = 'debt-tracker-active-person-id-v1'

function App() {
  const [people, setPeople] = useState<Person[]>(getStoredPeople)
  const [activePersonId, setActivePersonId] = useState<string | null>(() => {
    const storedPeople = getStoredPeople()
    const storedActivePersonId = window.localStorage.getItem(
      ACTIVE_PERSON_STORAGE_KEY,
    )

    if (
      storedActivePersonId &&
      storedPeople.some((person) => person.id === storedActivePersonId)
    ) {
      return storedActivePersonId
    }

    return storedPeople[0]?.id ?? null
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [transactions, setTransactions] = useState<DebtTransaction[]>(
    getStoredTransactions,
  )

  useEffect(() => {
    savePeople(people)
  }, [people])

  useEffect(() => {
    saveTransactions(transactions)
  }, [transactions])

  useEffect(() => {
    if (!activePersonId) {
      window.localStorage.removeItem(ACTIVE_PERSON_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(ACTIVE_PERSON_STORAGE_KEY, activePersonId)
  }, [activePersonId])

  const addPerson = (name: string): string | null => {
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

  const createTransaction = (transaction: NewDebtTransaction) => {
    const nextTransaction: DebtTransaction = {
      id: window.crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...transaction,
    }

    setTransactions((prevTransactions) => [nextTransaction, ...prevTransactions])
  }

  const deleteTransaction = (transactionId: string) => {
    setTransactions((prevTransactions) =>
      prevTransactions.filter((transaction) => transaction.id !== transactionId),
    )
  }

  const activePerson = people.find((person) => person.id === activePersonId) ?? null

  return (
    <main className="app">
      <header className="top-bar card">
        <h1>Учет долгов</h1>
        <div className="top-bar-actions">
          <button
            type="button"
            className="settings-icon-button"
            aria-label={isHistoryOpen ? 'Закрыть общую историю' : 'Открыть общую историю'}
            title={isHistoryOpen ? 'Закрыть историю' : 'Общая история'}
            onClick={() => {
              setIsSettingsOpen(false)
              setIsHistoryOpen((isOpen) => !isOpen)
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
      />

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
      />

      {isHistoryOpen ? (
        <TransactionHistoryModal
          isOpen={isHistoryOpen}
          people={people}
          transactions={transactions}
          onDeleteTransaction={deleteTransaction}
          onClose={() => setIsHistoryOpen(false)}
        />
      ) : null}

      {isAddTransactionOpen ? (
        <AddTransactionModal
          isOpen={isAddTransactionOpen}
          people={people}
          defaultWhoId={activePersonId}
          onClose={() => setIsAddTransactionOpen(false)}
          onCreate={createTransaction}
        />
      ) : null}
    </main>
  )
}

export default App
