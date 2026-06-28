import { useEffect, useState } from 'react'
import { AddTransactionModal } from './components/AddTransactionModal'
import { PeopleTabs } from './components/PeopleTabs'
import { SettingsModal } from './components/SettingsModal'
import { StartScreen } from './components/StartScreen'
import { TransactionHistoryModal } from './components/TransactionHistoryModal'
import { useDebtTrackerData } from './hooks/useDebtTrackerData'
import type { Person } from './types/person'
import type { NewDebtTransaction } from './types/transaction'
import type { PersonScreenTab } from './types/ui'
import './App.css'

const THEME_STORAGE_KEY = 'debt-tracker-theme-v1'

type AppTheme = 'light' | 'dark'

type PendingDeleteRequest =
  | {
      kind: 'person'
      id: string
      label: string
    }
  | {
      kind: 'transaction'
      id: string
      label: string
    }

const getInitialTheme = (): AppTheme => {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function App() {
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [activePersonTab, setActivePersonTab] = useState<PersonScreenTab>('i_owe')
  const [pendingDeleteRequest, setPendingDeleteRequest] =
    useState<PendingDeleteRequest | null>(null)
  const {
    people,
    activePersonId,
    setActivePersonId,
    transactions,
    areTransactionsLoaded,
    isTransactionsLoading,
    balances,
    isInitialLoading,
    isAddingPerson,
    removingPersonId,
    updatingPersonColorId,
    isCreatingTransaction,
    deletingTransactionId,
    updatingTransactionId,
    isBackgroundRefreshing,
    requestError,
    closeRequestError,
    ensureTransactionsLoaded,
    addPerson,
    removePerson,
    updatePersonColor,
    createTransaction,
    deleteTransaction,
    updateTransaction,
  } = useDebtTrackerData({
    activePersonTab,
    isHistoryOpen,
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const activePerson = people.find((person) => person.id === activePersonId) ?? null

  const handleDeleteTransaction = async (transactionId: string) => {
    setPendingDeleteRequest({
      kind: 'transaction',
      id: transactionId,
      label: 'эту операцию',
    })
  }

  const handleRequestRemovePerson = (person: Person) => {
    setPendingDeleteRequest({
      kind: 'person',
      id: person.id,
      label: `человека ${person.name}`,
    })
  }

  const isDeleteConfirmationPending =
    pendingDeleteRequest?.kind === 'person'
      ? removingPersonId === pendingDeleteRequest.id
      : pendingDeleteRequest?.kind === 'transaction'
        ? deletingTransactionId === pendingDeleteRequest.id
        : false

  const handleConfirmDelete = async () => {
    if (!pendingDeleteRequest) {
      return
    }

    try {
      if (pendingDeleteRequest.kind === 'person') {
        await removePerson(pendingDeleteRequest.id)
      } else {
        await deleteTransaction(pendingDeleteRequest.id)
      }

      setPendingDeleteRequest(null)
    } catch {
      // Error overlay is already handled by requestError state.
    }
  }

  const handleUpdateTransaction = async (
    transactionId: string,
    transaction: NewDebtTransaction,
  ) => updateTransaction(transactionId, transaction)

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
            className={`settings-icon-button ${isHistoryOpen ? 'settings-icon-button-active' : ''}`}
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
            className={`settings-icon-button ${isSettingsOpen ? 'settings-icon-button-active' : ''}`}
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
        onDeleteTransaction={handleDeleteTransaction}
        onUpdateTransaction={handleUpdateTransaction}
        deletingTransactionId={deletingTransactionId}
        updatingTransactionId={updatingTransactionId}
        isBackgroundRefreshing={isBackgroundRefreshing}
        onActiveTabChange={setActivePersonTab}
      />

      {requestError ? (
        <div className="error-overlay" role="alertdialog" aria-modal="true">
          <section className="error-overlay-card">
            <h2>Ошибка запроса</h2>
            <p>{requestError}</p>
            <div className="error-overlay-actions">
              <button type="button" onClick={closeRequestError}>
                Понятно
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDeleteRequest ? (
        <div className="error-overlay" role="alertdialog" aria-modal="true">
          <section className="error-overlay-card delete-confirmation-card">
            <h2>Подтвердите удаление</h2>
            <p>Вы уверены, что хотите удалить {pendingDeleteRequest.label}?</p>
            <div className="delete-confirmation-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPendingDeleteRequest(null)}
                disabled={isDeleteConfirmationPending}
              >
                Отмена
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  void handleConfirmDelete()
                }}
                disabled={isDeleteConfirmationPending}
                aria-label="Подтвердить удаление"
                title="Подтвердить удаление"
              >
                {isDeleteConfirmationPending ? (
                  <span className="button-loader-wrap">
                    <span className="loader loader-inline" aria-hidden="true" />
                    Удаление...
                  </span>
                ) : (
                  'Удалить'
                )}
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
        onRequestRemovePerson={handleRequestRemovePerson}
        isAddingPerson={isAddingPerson}
        removingPersonId={removingPersonId}
        updatingPersonColorId={updatingPersonColorId}
        onUpdatePersonColor={updatePersonColor}
      />

      <TransactionHistoryModal
        isOpen={isHistoryOpen}
        people={people}
        transactions={transactions}
        onDeleteTransaction={handleDeleteTransaction}
        onUpdateTransaction={handleUpdateTransaction}
        onClose={() => setIsHistoryOpen(false)}
        deletingTransactionId={deletingTransactionId}
        updatingTransactionId={updatingTransactionId}
        isTransactionsLoading={isTransactionsLoading}
      />

      <AddTransactionModal
        isOpen={isAddTransactionOpen}
        people={people}
        defaultWhoId={activePersonId}
        onClose={() => setIsAddTransactionOpen(false)}
        onCreate={createTransaction}
        isCreating={isCreatingTransaction}
      />
    </main>
  )
}

export default App
