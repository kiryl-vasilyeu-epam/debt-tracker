export type TransactionType = 'gave' | 'took' | 'gave_for'

export type DebtTransaction = {
  id: string
  type: TransactionType
  fromPersonId: string
  toPersonId: string
  forPersonId: string | null
  amountHkd: number
  createdAt: string
}

export type NewDebtTransaction = {
  type: TransactionType
  fromPersonId: string
  toPersonId: string
  forPersonId: string | null
  amountHkd: number
}
