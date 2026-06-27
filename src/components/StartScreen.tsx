import { useEffect, useMemo, useState } from 'react'
import type { Person } from '../types/person'
import type { DebtTransaction, TransactionType } from '../types/transaction'

type StartScreenProps = {
  activePerson: Person | null
  people: Person[]
  transactions: DebtTransaction[]
}

const transactionTypeLabels: Record<TransactionType, string> = {
  gave: 'Отдал',
  took: 'Взял',
  gave_for: 'Отдал за',
}

type PersonScreenTab = 'i_owe' | 'owe_me' | 'transactions'

const personScreenTabs: Record<PersonScreenTab, string> = {
  i_owe: 'Я должен',
  owe_me: 'Мне должны',
  transactions: 'Транзакции',
}

const ACTIVE_PERSON_SCREEN_TAB_STORAGE_KEY =
  'debt-tracker-active-person-screen-tab-v1'

const isPersonScreenTab = (value: string | null): value is PersonScreenTab =>
  value === 'i_owe' || value === 'owe_me' || value === 'transactions'

const findPerson = (id: string, people: Person[]) =>
  people.find((item) => item.id === id) ?? null

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getTodayDateInputValue = () => toDateInputValue(new Date())

const isSameSelectedDay = (isoDate: string, selectedDate: string) => {
  if (!selectedDate) {
    return true
  }

  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  return toDateInputValue(parsed) === selectedDate
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

type Settlement = {
  debtorId: string
  creditorId: string
  amount: number
}

const getSettlements = (transaction: DebtTransaction): Settlement[] => {
  if (transaction.type === 'gave') {
    return [
      {
        debtorId: transaction.toPersonId,
        creditorId: transaction.fromPersonId,
        amount: transaction.amountHkd,
      },
    ]
  }

  if (transaction.type === 'took') {
    return [
      {
        debtorId: transaction.fromPersonId,
        creditorId: transaction.toPersonId,
        amount: transaction.amountHkd,
      },
    ]
  }

  if (!transaction.forPersonId) {
    return []
  }

  return [
    {
      debtorId: transaction.toPersonId,
      creditorId: transaction.forPersonId,
      amount: transaction.amountHkd,
    },
    {
      debtorId: transaction.forPersonId,
      creditorId: transaction.fromPersonId,
      amount: transaction.amountHkd,
    },
  ]
}

const PersonInline = ({ person }: { person: Person | null }) => {
  if (!person) {
    return (
      <span className="person-inline person-inline-missing">
        <span className="person-color-dot person-color-dot-missing" aria-hidden="true" />
        Удален
      </span>
    )
  }

  return (
    <span className="person-inline">
      <span
        className="person-color-dot"
        style={{ backgroundColor: person.color }}
        aria-hidden="true"
      />
      {person.name}
    </span>
  )
}

export function StartScreen({
  activePerson,
  people,
  transactions,
}: StartScreenProps) {
  const [activeTab, setActiveTab] = useState<PersonScreenTab>(() => {
    const storedTab = window.localStorage.getItem(
      ACTIVE_PERSON_SCREEN_TAB_STORAGE_KEY,
    )
    return isPersonScreenTab(storedTab) ? storedTab : 'transactions'
  })
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>(
    getTodayDateInputValue,
  )
  const [amountSearch, setAmountSearch] = useState('')
  const [amountTolerance, setAmountTolerance] = useState('0')

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_PERSON_SCREEN_TAB_STORAGE_KEY, activeTab)
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
          isSameSelectedDay(transaction.createdAt, selectedHistoryDate) &&
          isAmountWithinTolerance(
            transaction.amountHkd,
            amountSearch,
            amountTolerance,
          ),
      ),
    [activeTransactions, amountSearch, amountTolerance, selectedHistoryDate],
  )

  const balances = useMemo(() => {
    if (!activePerson) {
      return {
        iOwe: [] as Array<{ personId: string; amount: number }>,
        oweMe: [] as Array<{ personId: string; amount: number }>,
      }
    }

    const netByPerson = new Map<string, number>()

    for (const transaction of sortedTransactions) {
      const settlements = getSettlements(transaction)

      for (const settlement of settlements) {
        if (settlement.debtorId === activePerson.id) {
          netByPerson.set(
            settlement.creditorId,
            (netByPerson.get(settlement.creditorId) ?? 0) - settlement.amount,
          )
        }

        if (settlement.creditorId === activePerson.id) {
          netByPerson.set(
            settlement.debtorId,
            (netByPerson.get(settlement.debtorId) ?? 0) + settlement.amount,
          )
        }
      }
    }

    const iOwe = [...netByPerson.entries()]
      .filter(([, netAmount]) => netAmount < 0)
      .map(([personId, netAmount]) => ({ personId, amount: Math.abs(netAmount) }))
      .sort((a, b) => b.amount - a.amount)

    const oweMe = [...netByPerson.entries()]
      .filter(([, netAmount]) => netAmount > 0)
      .map(([personId, netAmount]) => ({ personId, amount: netAmount }))
      .sort((a, b) => b.amount - a.amount)

    return { iOwe, oweMe }
  }, [activePerson, sortedTransactions])

  return (
    <section className="card start-screen">
      {!activePerson ? (
        <>
          <h2>Старт</h2>
          <p>Добавьте хотя бы одного человека в настройках, чтобы начать.</p>
        </>
      ) : (
        <>
          <h2>{activePerson.name}</h2>

          <div className="person-screen-tabs" role="tablist" aria-label="Вкладки человека">
            {(Object.keys(personScreenTabs) as PersonScreenTab[]).map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={activeTab === tabKey}
                className={`person-screen-tab ${
                  activeTab === tabKey ? 'person-screen-tab-active' : ''
                }`}
                onClick={() => setActiveTab(tabKey)}
              >
                {personScreenTabs[tabKey]}
              </button>
            ))}
          </div>

          {activeTab === 'i_owe' ? (
            balances.iOwe.length === 0 ? (
              <p>Сейчас вы никому не должны.</p>
            ) : (
              <ul className="balance-list">
                {balances.iOwe.map((entry) => (
                  <li key={entry.personId} className="balance-item">
                    <PersonInline person={findPerson(entry.personId, people)} />
                    <strong className="transaction-amount">
                      HK$ {entry.amount.toFixed(2)}
                    </strong>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {activeTab === 'owe_me' ? (
            balances.oweMe.length === 0 ? (
              <p>Сейчас вам никто не должен.</p>
            ) : (
              <ul className="balance-list">
                {balances.oweMe.map((entry) => (
                  <li key={entry.personId} className="balance-item">
                    <PersonInline person={findPerson(entry.personId, people)} />
                    <strong className="transaction-amount">
                      HK$ {entry.amount.toFixed(2)}
                    </strong>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {activeTab === 'transactions' ? (
            activeTransactions.length === 0 ? (
              <p>Операций пока нет. Нажмите + справа снизу, чтобы добавить.</p>
            ) : (
              <>
                <div className="history-filters" aria-label="Фильтры истории">
                  <label htmlFor="person-history-day">День</label>
                  <input
                    id="person-history-day"
                    type="date"
                    value={selectedHistoryDate}
                    onChange={(event) => setSelectedHistoryDate(event.target.value)}
                  />

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
                  <p>По выбранному дню и сумме операций не найдено.</p>
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
                            <PersonInline person={fromPerson} />
                            <span className="history-arrow">→</span>
                            <PersonInline person={toPerson} />
                            {transaction.forPersonId ? (
                              <>
                                <span className="history-for-text">за</span>
                                <PersonInline person={forPerson} />
                              </>
                            ) : null}
                          </span>
                        </div>
                        <strong className="transaction-amount">
                          HK$ {transaction.amountHkd.toFixed(2)}
                        </strong>
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
