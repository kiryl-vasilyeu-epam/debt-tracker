export type TransactionType = 'gave' | 'took' | 'gave_for'

export type DebtTransaction = {
  id: string
  type: TransactionType
  fromPersonId: string
  fromPersonName: string
  toPersonId: string
  toPersonName: string
  forPersonId: string | null
  forPersonName: string | null
  amountHkd: number
  note: string | null
  createdAt: string
}

export type NewDebtTransaction = {
  type: TransactionType
  fromPersonId: string
  fromPersonName: string
  toPersonId: string
  toPersonName: string
  forPersonId: string | null
  forPersonName: string | null
  amountHkd: number
  note: string | null
}
