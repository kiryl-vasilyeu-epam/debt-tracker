import { useCallback, useEffect, useState } from 'react'
import {
  clearLegacyLocalData,
  deletePersonRemote,
  deleteTransactionRemote,
  loadBalancesForPerson,
  loadInitialAppState,
  loadTransactions,
  loadTransactionsForPerson,
  saveBalancesRemote,
  savePersonRemote,
  saveTransactionRemote,
} from '../lib/appStorage'
import { applyTransactionToBalances } from '../lib/balanceCalculator'
import { generatePersonColor } from '../lib/peopleStorage'
import type { DebtBalance } from '../types/balance'
import type { Person } from '../types/person'
import type { DebtTransaction, NewDebtTransaction } from '../types/transaction'
import type { PersonScreenTab } from '../types/ui'

const ACTIVE_PERSON_STORAGE_KEY = 'debt-tracker-active-person-id-v1'
const DATA_POLL_INTERVAL_MS = 5000

const getStoredActivePersonId = (): string | null =>
  window.localStorage.getItem(ACTIVE_PERSON_STORAGE_KEY)

const areBalancesEqual = (
  left: DebtBalance[],
  right: DebtBalance[],
): boolean => {
  if (left.length !== right.length) {
    return false
  }

  return left.every((balance, index) => {
    const candidate = right[index]

    return (
      balance.id === candidate.id &&
      balance.debtorId === candidate.debtorId &&
      balance.debtorName === candidate.debtorName &&
      balance.creditorId === candidate.creditorId &&
      balance.creditorName === candidate.creditorName &&
      balance.amountHkd === candidate.amountHkd
    )
  })
}

const areTransactionsEqual = (
  left: DebtTransaction[],
  right: DebtTransaction[],
): boolean => {
  if (left.length !== right.length) {
    return false
  }

  return left.every((transaction, index) => {
    const candidate = right[index]

    return (
      transaction.id === candidate.id &&
      transaction.type === candidate.type &&
      transaction.fromPersonId === candidate.fromPersonId &&
      transaction.fromPersonName === candidate.fromPersonName &&
      transaction.toPersonId === candidate.toPersonId &&
      transaction.toPersonName === candidate.toPersonName &&
      transaction.forPersonId === candidate.forPersonId &&
      transaction.forPersonName === candidate.forPersonName &&
      transaction.amountHkd === candidate.amountHkd &&
      transaction.note === candidate.note &&
      transaction.createdAt === candidate.createdAt
    )
  })
}

type UseDebtTrackerDataOptions = {
  activePersonTab: PersonScreenTab
  isHistoryOpen: boolean
}

export const useDebtTrackerData = ({
  activePersonTab,
  isHistoryOpen,
}: UseDebtTrackerDataOptions) => {
  const [people, setPeople] = useState<Person[]>([])
  const [activePersonId, setActivePersonId] = useState<string | null>(
    getStoredActivePersonId,
  )
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
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const closeRequestError = useCallback(() => {
    setRequestError(null)
  }, [])

  useEffect(() => {
    const loadState = async () => {
      setIsInitialLoading(true)
      setRequestError(null)

      try {
        clearLegacyLocalData()
        const snapshot = await loadInitialAppState()

        setPeople(snapshot.people)
        setBalances(snapshot.balances)

        const storedActivePersonId = getStoredActivePersonId()
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

  const ensureTransactionsLoaded = useCallback(async () => {
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
  }, [areTransactionsLoaded, isTransactionsLoading, people])

  const addPerson = useCallback(
    async (name: string, selectedColor?: string): Promise<string | null> => {
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
    },
    [activePersonId, people],
  )

  const removePerson = useCallback(
    async (id: string): Promise<void> => {
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
    },
    [activePersonId, people],
  )

  const createTransaction = useCallback(
    async (transaction: NewDebtTransaction): Promise<string | null> => {
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
    },
    [areTransactionsLoaded, balances],
  )

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
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
    },
    [balances, transactions],
  )

  useEffect(() => {
    if (isInitialLoading || !activePersonId) {
      return
    }

    let isDisposed = false
    let isPolling = false

    const syncVisibleData = async () => {
      if (isDisposed || isPolling || document.hidden) {
        return
      }

      isPolling = true
      setIsBackgroundRefreshing(true)

      try {
        if (isHistoryOpen) {
          const nextTransactions = await loadTransactions(people)

          if (!isDisposed) {
            setTransactions((previousTransactions) =>
              areTransactionsEqual(previousTransactions, nextTransactions)
                ? previousTransactions
                : nextTransactions,
            )
            setAreTransactionsLoaded(true)
          }

          return
        }

        if (activePersonTab === 'transactions') {
          const nextTransactions = await loadTransactionsForPerson(
            activePersonId,
            people,
          )

          if (!isDisposed) {
            setTransactions((previousTransactions) =>
              areTransactionsEqual(previousTransactions, nextTransactions)
                ? previousTransactions
                : nextTransactions,
            )
            setAreTransactionsLoaded(true)
          }

          return
        }

        const nextBalances = await loadBalancesForPerson(activePersonId, people)

        if (!isDisposed) {
          setBalances((previousBalances) =>
            areBalancesEqual(previousBalances, nextBalances)
              ? previousBalances
              : nextBalances,
          )
        }
      } catch {
        // Keep polling silently; request errors are shown for explicit user actions.
      } finally {
        if (!isDisposed) {
          setIsBackgroundRefreshing(false)
        }
        isPolling = false
      }
    }

    const intervalId = window.setInterval(() => {
      void syncVisibleData()
    }, DATA_POLL_INTERVAL_MS)

    void syncVisibleData()

    return () => {
      isDisposed = true
      setIsBackgroundRefreshing(false)
      window.clearInterval(intervalId)
    }
  }, [activePersonId, activePersonTab, isHistoryOpen, isInitialLoading, people])

  return {
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
    isCreatingTransaction,
    deletingTransactionId,
    isBackgroundRefreshing,
    requestError,
    closeRequestError,
    ensureTransactionsLoaded,
    addPerson,
    removePerson,
    createTransaction,
    deleteTransaction,
  }
}