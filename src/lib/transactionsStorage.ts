import type { DebtTransaction } from '../types/transaction'

const TRANSACTIONS_STORAGE_KEY = 'debt-tracker-transactions-v1'

export const getStoredTransactions = (): DebtTransaction[] => {
  const rawTransactions = window.localStorage.getItem(TRANSACTIONS_STORAGE_KEY)
  if (!rawTransactions) {
    return []
  }

  try {
    return JSON.parse(rawTransactions) as DebtTransaction[]
  } catch {
    window.localStorage.removeItem(TRANSACTIONS_STORAGE_KEY)
    return []
  }
}

export const saveTransactions = (transactions: DebtTransaction[]) => {
  window.localStorage.setItem(
    TRANSACTIONS_STORAGE_KEY,
    JSON.stringify(transactions),
  )
}
