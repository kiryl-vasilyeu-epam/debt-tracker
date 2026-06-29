import { useCallback, useEffect, useRef, useState } from 'react'
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

const mergeBalancesForPerson = (
  allBalances: DebtBalance[],
  personBalances: DebtBalance[],
  personId: string,
): DebtBalance[] => {
  const balancesWithoutPerson = allBalances.filter(
    (balance) =>
      balance.debtorId !== personId && balance.creditorId !== personId,
  )

  return [...balancesWithoutPerson, ...personBalances].sort(
    (left, right) => right.amountHkd - left.amountHkd,
  )
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
  const [updatingPersonColorId, setUpdatingPersonColorId] = useState<string | null>(
    null,
  )
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false)
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(
    null,
  )
  const [updatingTransactionId, setUpdatingTransactionId] = useState<string | null>(
    null,
  )
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const lastTransactionsMutationAtRef = useRef(0)
  const lastBalancesMutationAtRef = useRef(0)

  const markTransactionsMutation = useCallback(() => {
    lastTransactionsMutationAtRef.current = Date.now()
  }, [])

  const markBalancesMutation = useCallback(() => {
    lastBalancesMutationAtRef.current = Date.now()
  }, [])

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

    const startedAt = Date.now()

    setIsTransactionsLoading(true)
    setRequestError(null)

    try {
      const loadedTransactions = await loadTransactions(people)
      if (startedAt < lastTransactionsMutationAtRef.current) {
        return
      }

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

  const updatePersonColor = useCallback(
    async (personId: string, color: string): Promise<void> => {
      const targetPerson = people.find((person) => person.id === personId)
      if (!targetPerson || targetPerson.color === color) {
        return
      }

      setUpdatingPersonColorId(personId)
      setRequestError(null)

      const nextPerson: Person = {
        ...targetPerson,
        color,
      }

      try {
        await savePersonRemote(nextPerson)
        setPeople((previousPeople) =>
          previousPeople.map((person) =>
            person.id === personId ? nextPerson : person,
          ),
        )
      } catch {
        setRequestError('Не удалось обновить цвет человека.')
      } finally {
        setUpdatingPersonColorId(null)
      }
    },
    [people],
  )

  const createTransaction = useCallback(
    async (transaction: NewDebtTransaction): Promise<string | null> => {
      markTransactionsMutation()
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
        markBalancesMutation()

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
    [
      areTransactionsLoaded,
      balances,
      markBalancesMutation,
      markTransactionsMutation,
    ],
  )

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      markTransactionsMutation()
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
        markBalancesMutation()

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
    [balances, markBalancesMutation, markTransactionsMutation, transactions],
  )

  const updateTransaction = useCallback(
    async (
      transactionId: string,
      transaction: NewDebtTransaction,
    ): Promise<string | null> => {
      const previousTransaction = transactions.find(
        (candidate) => candidate.id === transactionId,
      )

      if (!previousTransaction) {
        return 'Операция не найдена. Обновите страницу и попробуйте снова.'
      }

      markTransactionsMutation()
      setUpdatingTransactionId(transactionId)
      setRequestError(null)

      const nextTransaction: DebtTransaction = {
        ...previousTransaction,
        ...transaction,
      }

      const balancesWithoutPrevious = applyTransactionToBalances(
        balances,
        previousTransaction,
        'remove',
      )
      const nextBalances = applyTransactionToBalances(
        balancesWithoutPrevious,
        nextTransaction,
        'add',
      )
      let isOriginalDeleted = false

      try {
        await deleteTransactionRemote(transactionId)
        isOriginalDeleted = true
        await saveTransactionRemote(nextTransaction)
        await saveBalancesRemote(nextBalances, balances)
        markBalancesMutation()

        setTransactions((prevTransactions) =>
          prevTransactions.map((candidate) =>
            candidate.id === transactionId ? nextTransaction : candidate,
          ),
        )
        setBalances(nextBalances)
        setAreTransactionsLoaded(true)

        return null
      } catch {
        if (isOriginalDeleted) {
          try {
            await saveTransactionRemote(previousTransaction)
          } catch {
            // Best-effort rollback if replacing transaction failed midway.
          }
        }

        setRequestError('Не удалось обновить операцию.')
        return 'Не удалось обновить операцию. Проверьте подключение к базе.'
      } finally {
        setUpdatingTransactionId(null)
      }
    },
    [balances, markBalancesMutation, markTransactionsMutation, transactions],
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
      const startedAt = Date.now()

      try {
        if (isHistoryOpen) {
          const nextTransactions = await loadTransactions(people)
          if (startedAt < lastTransactionsMutationAtRef.current) {
            return
          }

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
          if (startedAt < lastTransactionsMutationAtRef.current) {
            return
          }

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
        if (startedAt < lastBalancesMutationAtRef.current) {
          return
        }

        if (!isDisposed) {
          setBalances((previousBalances) => {
            const nextMergedBalances = mergeBalancesForPerson(
              previousBalances,
              nextBalances,
              activePersonId,
            )

            return areBalancesEqual(previousBalances, nextMergedBalances)
              ? previousBalances
              : nextMergedBalances
          })
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
  }
}
