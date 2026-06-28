import { useEffect, useMemo, useRef, useState } from 'react'
import type { DebtBalance } from '../types/balance'
import type { Person } from '../types/person'
import type { DebtTransaction, TransactionType } from '../types/transaction'
import type { PersonScreenTab } from '../types/ui'

type StartScreenProps = {
  activePerson: Person | null
  people: Person[]
  transactions: DebtTransaction[]
  balances: DebtBalance[]
  areTransactionsLoaded: boolean
  isTransactionsLoading: boolean
  onRequestTransactions: () => Promise<void>
  onDeleteTransaction: (transactionId: string) => Promise<void>
  deletingTransactionId: string | null
  isBackgroundRefreshing: boolean
  onActiveTabChange?: (tab: PersonScreenTab) => void
}

const transactionTypeLabels: Record<TransactionType, string> = {
  took: 'Взял',
  gave: 'Отдал',
  gave_for: 'Отдал за',
}

const betweenPeopleLabel: Record<TransactionType, string> = {
  gave: '→',
  took: 'у',
  gave_for: '→',
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

const personScreenTabs: Record<PersonScreenTab, string> = {
  i_owe: 'Я должен',
  owe_me: 'Мне должны',
  transactions: 'Транзакции',
}

const formatAmount = (amount: number) => `HK$ ${amount.toFixed(2)}`

const ACTIVE_PERSON_SCREEN_TAB_STORAGE_KEY =
  'debt-tracker-active-person-screen-tab-by-person-v1'

const isPersonScreenTab = (value: string | null): value is PersonScreenTab =>
  value === 'i_owe' || value === 'owe_me' || value === 'transactions'

const getStoredPersonTabs = (): Record<string, PersonScreenTab> => {
  const rawValue = window.localStorage.getItem(ACTIVE_PERSON_SCREEN_TAB_STORAGE_KEY)
  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, string>
    const next: Record<string, PersonScreenTab> = {}

    for (const [personId, tab] of Object.entries(parsed)) {
      if (isPersonScreenTab(tab)) {
        next[personId] = tab
      }
    }

    return next
  } catch {
    window.localStorage.removeItem(ACTIVE_PERSON_SCREEN_TAB_STORAGE_KEY)
    return {}
  }
}

const findPerson = (id: string, people: Person[]) =>
  people.find((item) => item.id === id) ?? null

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

export function StartScreen({
  activePerson,
  people,
  transactions,
  balances,
  areTransactionsLoaded,
  isTransactionsLoading,
  onRequestTransactions,
  onDeleteTransaction,
  deletingTransactionId,
  isBackgroundRefreshing,
  onActiveTabChange,
}: StartScreenProps) {
  const [personTabs, setPersonTabs] = useState<Record<string, PersonScreenTab>>(
    getStoredPersonTabs,
  )
  const [selectedHistoryDateFrom, setSelectedHistoryDateFrom] = useState<string>(
    getTodayDateInputValue,
  )
  const [selectedHistoryDateTo, setSelectedHistoryDateTo] = useState<string>('')
  const [isHistoryDatePeriodEnabled, setIsHistoryDatePeriodEnabled] =
    useState(false)
  const [amountSearch, setAmountSearch] = useState('')
  const [amountTolerance, setAmountTolerance] = useState('0')
  const personTabsRef = useRef<HTMLDivElement | null>(null)

  const activeTab = activePerson ? (personTabs[activePerson.id] ?? 'i_owe') : 'i_owe'

  useEffect(() => {
    window.localStorage.setItem(
      ACTIVE_PERSON_SCREEN_TAB_STORAGE_KEY,
      JSON.stringify(personTabs),
    )
  }, [personTabs])

  const handleTabSelect = (nextTab: PersonScreenTab) => {
    if (!activePerson) {
      return
    }

    setPersonTabs((prevTabs) => ({
      ...prevTabs,
      [activePerson.id]: nextTab,
    }))
  }

  useEffect(() => {
    if (activeTab !== 'transactions' || areTransactionsLoaded) {
      return
    }

    void onRequestTransactions()
  }, [activeTab, areTransactionsLoaded, onRequestTransactions])

  useEffect(() => {
    onActiveTabChange?.(activeTab)
  }, [activeTab, onActiveTabChange])

  useEffect(() => {
    const tabsNode = personTabsRef.current
    if (!tabsNode) {
      return
    }

    const activeTabNode = tabsNode.querySelector<HTMLButtonElement>(
      '.person-screen-tab-active',
    )
    activeTabNode?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [activeTab])

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [transactions],
  )

  const activeTransactions = useMemo(
    () =>
      activePerson
        ? sortedTransactions.filter(
            (transaction) =>
              transaction.fromPersonId === activePerson.id ||
              transaction.toPersonId === activePerson.id ||
              transaction.forPersonId === activePerson.id,
          )
        : [],
    [activePerson, sortedTransactions],
  )

  const filteredActiveTransactions = useMemo(
    () =>
      activeTransactions.filter(
        (transaction) =>
          isWithinSelectedDateRange(
            transaction.createdAt,
            selectedHistoryDateFrom,
            selectedHistoryDateTo,
            isHistoryDatePeriodEnabled,
          ) &&
          isAmountWithinTolerance(
            transaction.amountHkd,
            amountSearch,
            amountTolerance,
          ),
      ),
    [
      activeTransactions,
      amountSearch,
      amountTolerance,
      isHistoryDatePeriodEnabled,
      selectedHistoryDateFrom,
      selectedHistoryDateTo,
    ],
  )

  const balancesForActivePerson = useMemo(() => {
    if (!activePerson) {
      return {
        iOwe: [] as Array<{ personId: string; personName: string; amount: number }>,
        oweMe: [] as Array<{ personId: string; personName: string; amount: number }>,
      }
    }

    const iOwe = balances
      .filter((balance) => balance.debtorId === activePerson.id)
      .map((balance) => ({
        personId: balance.creditorId,
        personName: balance.creditorName,
        amount: balance.amountHkd,
      }))
      .sort((a, b) => b.amount - a.amount)

    const oweMe = balances
      .filter((balance) => balance.creditorId === activePerson.id)
      .map((balance) => ({
        personId: balance.debtorId,
        personName: balance.debtorName,
        amount: balance.amountHkd,
      }))
      .sort((a, b) => b.amount - a.amount)

    return {
      iOwe,
      oweMe,
    }
  }, [activePerson, balances])

  const iOweTotalAmount = useMemo(
    () => balancesForActivePerson.iOwe.reduce((sum, entry) => sum + entry.amount, 0),
    [balancesForActivePerson.iOwe],
  )

  const oweMeTotalAmount = useMemo(
    () => balancesForActivePerson.oweMe.reduce((sum, entry) => sum + entry.amount, 0),
    [balancesForActivePerson.oweMe],
  )

  return (
    <section className="card start-screen">
      {!activePerson ? (
        <>
          <h2>Старт</h2>
          <p>Добавьте хотя бы одного человека в настройках, чтобы начать.</p>
        </>
      ) : (
        <>
          <div className="start-screen-title-row">
            <h2>{activePerson.name}</h2>
            {isBackgroundRefreshing ? (
              <span
                className="start-screen-sync-loader"
                aria-label="Идет фоновая подзагрузка данных"
                title="Идет фоновая подзагрузка данных"
              />
            ) : null}
          </div>

          <div
            ref={personTabsRef}
            className="person-screen-tabs"
            role="tablist"
            aria-label="Вкладки человека"
          >
            {(Object.keys(personScreenTabs) as PersonScreenTab[]).map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={activeTab === tabKey}
                className={`person-screen-tab ${
                  activeTab === tabKey ? 'person-screen-tab-active' : ''
                }`}
                onClick={() => handleTabSelect(tabKey)}
              >
                {personScreenTabs[tabKey]}
              </button>
            ))}
          </div>

          {activeTab !== 'transactions' && (
            <p>Итого: {formatAmount(activeTab === 'owe_me' ? oweMeTotalAmount : iOweTotalAmount)}</p>
          )}

          {activeTab === 'i_owe' ? (
            balancesForActivePerson.iOwe.length === 0 ? (
              <p>Сейчас вы никому не должны.</p>
            ) : (
              <ul className="balance-list">
                {balancesForActivePerson.iOwe.map((entry) => (
                  <li key={entry.personId} className="balance-item">
                    <PersonInline
                      person={findPerson(entry.personId, people)}
                      fallbackName={entry.personName}
                    />
                    <strong className="transaction-amount">
                      HK$ {entry.amount.toFixed(2)}
                    </strong>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {activeTab === 'owe_me' ? (
            balancesForActivePerson.oweMe.length === 0 ? (
              <p>Сейчас вам никто не должен.</p>
            ) : (
              <ul className="balance-list">
                {balancesForActivePerson.oweMe.map((entry) => (
                  <li key={entry.personId} className="balance-item">
                    <PersonInline
                      person={findPerson(entry.personId, people)}
                      fallbackName={entry.personName}
                    />
                    <strong className="transaction-amount">
                      HK$ {entry.amount.toFixed(2)}
                    </strong>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {activeTab === 'transactions' ? (
            isTransactionsLoading ? (
              <div className="transactions-loading-state" aria-live="polite">
                <div className="loader" aria-hidden="true" />
                <p>Загружаем историю транзакций...</p>
              </div>
            ) : !areTransactionsLoaded ? (
              <p>История пока не загружена.</p>
            ) :
            activeTransactions.length === 0 ? (
              <p>Операций пока нет. Нажмите + справа снизу, чтобы добавить.</p>
            ) : (
              <>
                <div className="history-filters" aria-label="Фильтры истории">
                  <label htmlFor="person-history-date-from">День</label>
                  <input
                    id="person-history-date-from"
                    type="date"
                    value={selectedHistoryDateFrom}
                    onChange={(event) => setSelectedHistoryDateFrom(event.target.value)}
                  />

                  <label className="history-period-toggle">
                    <input
                      type="checkbox"
                      checked={isHistoryDatePeriodEnabled}
                      onChange={(event) => {
                        const isEnabled = event.target.checked
                        setIsHistoryDatePeriodEnabled(isEnabled)

                        if (isEnabled) {
                          setSelectedHistoryDateTo(selectedHistoryDateFrom)
                        } else {
                          setSelectedHistoryDateTo('')
                        }
                      }}
                    />
                    Период
                  </label>

                  {isHistoryDatePeriodEnabled ? (
                    <>
                      <label htmlFor="person-history-date-to">Период: по</label>
                      <input
                        id="person-history-date-to"
                        type="date"
                        value={selectedHistoryDateTo}
                        onChange={(event) => setSelectedHistoryDateTo(event.target.value)}
                      />
                    </>
                  ) : null}

                  <label htmlFor="person-history-amount">Сумма</label>
                  <div className="history-amount-filter-row">
                    <input
                      id="person-history-amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
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
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={amountTolerance}
                      onChange={(event) => setAmountTolerance(event.target.value)}
                    />
                  </div>
                </div>

                {filteredActiveTransactions.length === 0 ? (
                  <p>По выбранному периоду и сумме операций не найдено.</p>
                ) : (
                  <ul className="transactions-list">
                    {filteredActiveTransactions.map((transaction) => {
                      const fromPerson = findPerson(transaction.fromPersonId, people)
                      const toPerson = findPerson(transaction.toPersonId, people)
                      const forPerson = transaction.forPersonId
                        ? findPerson(transaction.forPersonId, people)
                        : null

                      return (
                      <li key={transaction.id} className="transaction-item">
                        <div className="transaction-meta">
                          <strong>{transactionTypeLabels[transaction.type]}</strong>
                          <span className="transaction-people-line">
                            <PersonInline
                              person={fromPerson}
                              fallbackName={transaction.fromPersonName}
                            />
                            <span className="history-arrow">{betweenPeopleLabel[transaction.type]}</span>
                            <PersonInline
                              person={toPerson}
                              fallbackName={transaction.toPersonName}
                            />
                            {transaction.forPersonId ? (
                              <>
                                <span className="history-for-text">за</span>
                                <PersonInline
                                  person={forPerson}
                                  fallbackName={transaction.forPersonName ?? 'Удален'}
                                />
                              </>
                            ) : null}
                          </span>
                          {transaction.note ? (
                            <p className="transaction-note">{transaction.note}</p>
                          ) : null}
                        </div>
                        <div className="transaction-side">
                          <strong className="transaction-amount">
                            HK$ {transaction.amountHkd.toFixed(2)}
                          </strong>
                          <span className="history-date">{formatDate(transaction.createdAt)}</span>
                          <button
                            type="button"
                            className="history-delete-button"
                            onClick={() => {
                              void onDeleteTransaction(transaction.id)
                            }}
                            aria-label="Удалить операцию"
                            title="Удалить операцию"
                            disabled={deletingTransactionId === transaction.id}
                          >
                            {deletingTransactionId === transaction.id
                              ? 'Удаление...'
                              : 'Удалить'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                  </ul>
                )}
              </>
            )
          ) : null}
        </>
      )}
    </section>
  )
}
