import { useCallback, useEffect, useState } from 'react'
import {
  clearLegacyLocalData,
  deletePersonRemote,
  deleteTransactionRemote,
  loadInitialAppState,
  loadTransactions,
  saveBalancesRemote,
  savePersonRemote,
  saveTransactionRemote,
} from '../lib/appStorage'
import { applyTransactionToBalances } from '../lib/balanceCalculator'
import { generatePersonColor } from '../lib/peopleStorage'
import type { DebtBalance } from '../types/balance'
import type { Person } from '../types/person'
import type { DebtTransaction, NewDebtTransaction } from '../types/transaction'

const ACTIVE_PERSON_STORAGE_KEY = 'debt-tracker-active-person-id-v1'

export const useDebtTrackerData = () => {
  const [people, setPeople] = useState<Person[]>([])
  const [activePersonId, setActivePersonId] = useState<string | null>(null)
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
    requestError,
    closeRequestError,
    ensureTransactionsLoaded,
    addPerson,
    removePerson,
    createTransaction,
    deleteTransaction,
  }
}