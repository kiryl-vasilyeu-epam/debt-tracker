import { isSupabaseConfigured, supabase } from './supabase'
import type { DebtBalance } from '../types/balance'
import type { Person } from '../types/person'
import type { DebtTransaction } from '../types/transaction'

const LEGACY_LOCAL_STORAGE_KEYS = [
  'debt-tracker-people-v1',
  'debt-tracker-transactions-v1',
  'debt-tracker-balances-v1',
  'debt-tracker-active-person-screen-tab-v1',
]

type PeopleRow = {
  id: string
  name: string
  color: string
}

type TransactionsRow = {
  id: string
  type: DebtTransaction['type']
  from_person_id: string
  from_person_name: string | null
  to_person_id: string
  to_person_name: string | null
  for_person_id: string | null
  for_person_name: string | null
  amount_hkd: number
  note: string | null
  created_at: string
}

type BalancesRow = {
  id: string
  debtor_id: string
  debtor_name: string | null
  creditor_id: string
  creditor_name: string | null
  amount_hkd: number
}

const toTransaction = (
  row: TransactionsRow,
  peopleById: Map<string, Person>,
): DebtTransaction => ({
  id: row.id,
  type: row.type,
  fromPersonId: row.from_person_id,
  fromPersonName: row.from_person_name ?? peopleById.get(row.from_person_id)?.name ?? 'Удален',
  toPersonId: row.to_person_id,
  toPersonName: row.to_person_name ?? peopleById.get(row.to_person_id)?.name ?? 'Удален',
  forPersonId: row.for_person_id,
  forPersonName:
    row.for_person_name ??
    (row.for_person_id ? (peopleById.get(row.for_person_id)?.name ?? 'Удален') : null),
  amountHkd: Math.round(Number(row.amount_hkd)),
  note: row.note,
  createdAt: row.created_at,
})

const toBalance = (
  row: BalancesRow,
  peopleById: Map<string, Person>,
): DebtBalance => ({
  id: row.id,
  debtorId: row.debtor_id,
  debtorName: row.debtor_name ?? peopleById.get(row.debtor_id)?.name ?? 'Удален',
  creditorId: row.creditor_id,
  creditorName: row.creditor_name ?? peopleById.get(row.creditor_id)?.name ?? 'Удален',
  amountHkd: Math.round(Number(row.amount_hkd)),
})

const assertSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase не настроен')
  }

  return supabase
}

export type AppInitialSnapshot = {
  people: Person[]
  balances: DebtBalance[]
}

export const clearLegacyLocalData = () => {
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key)
  }
}

export const loadInitialAppState = async (): Promise<AppInitialSnapshot> => {
  const db = assertSupabase()

  try {
    const [
      { data: peopleRows, error: peopleError },
      { data: balanceRows, error: balanceError },
    ] = await Promise.all([
      db.from('people').select('id,name,color').order('name', { ascending: true }),
      db
        .from('balances')
        .select('id,debtor_id,debtor_name,creditor_id,creditor_name,amount_hkd'),
    ])

    if (peopleError || balanceError) {
      throw peopleError ?? balanceError
    }

    const peopleRowsSafe = (peopleRows ?? []) as unknown as PeopleRow[]
    const balanceRowsSafe = (balanceRows ?? []) as unknown as BalancesRow[]

    const people = peopleRowsSafe.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
    }))
    const peopleMap = new Map(people.map((person) => [person.id, person]))

    const balances = balanceRowsSafe.map((row) => toBalance(row, peopleMap))

    return {
      people,
      balances,
    }
  } catch {
    throw new Error('Не удалось загрузить людей и балансы')
  }
}

export const loadTransactions = async (
  people: Person[],
): Promise<DebtTransaction[]> => {
  const db = assertSupabase()

  const { data: transactionRows, error } = await db
    .from('transactions')
    .select(
      [
        'id',
        'type',
        'from_person_id',
        'from_person_name',
        'to_person_id',
        'to_person_name',
        'for_person_id',
        'for_person_name',
        'amount_hkd',
        'note',
        'created_at',
      ].join(','),
    )
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Не удалось загрузить транзакции')
  }

  const transactionRowsSafe =
    (transactionRows ?? []) as unknown as TransactionsRow[]
  const peopleMap = new Map(people.map((person) => [person.id, person]))

  return transactionRowsSafe.map((row) => toTransaction(row, peopleMap))
}

export const loadTransactionsForPerson = async (
  personId: string,
  people: Person[],
): Promise<DebtTransaction[]> => {
  const db = assertSupabase()

  const { data: transactionRows, error } = await db
    .from('transactions')
    .select(
      [
        'id',
        'type',
        'from_person_id',
        'from_person_name',
        'to_person_id',
        'to_person_name',
        'for_person_id',
        'for_person_name',
        'amount_hkd',
        'note',
        'created_at',
      ].join(','),
    )
    .or(
      `from_person_id.eq.${personId},to_person_id.eq.${personId},for_person_id.eq.${personId}`,
    )
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Не удалось загрузить транзакции человека')
  }

  const transactionRowsSafe =
    (transactionRows ?? []) as unknown as TransactionsRow[]
  const peopleMap = new Map(people.map((person) => [person.id, person]))

  return transactionRowsSafe.map((row) => toTransaction(row, peopleMap))
}

export const loadBalancesForPerson = async (
  personId: string,
  people: Person[],
): Promise<DebtBalance[]> => {
  const db = assertSupabase()

  const { data: balanceRows, error } = await db
    .from('balances')
    .select('id,debtor_id,debtor_name,creditor_id,creditor_name,amount_hkd')
    .or(`debtor_id.eq.${personId},creditor_id.eq.${personId}`)

  if (error) {
    throw new Error('Не удалось загрузить балансы человека')
  }

  const balanceRowsSafe = (balanceRows ?? []) as unknown as BalancesRow[]
  const peopleMap = new Map(people.map((person) => [person.id, person]))

  return balanceRowsSafe
    .map((row) => toBalance(row, peopleMap))
    .sort((a, b) => b.amountHkd - a.amountHkd)
}

export const savePersonRemote = async (person: Person) => {
  const db = assertSupabase()

  const { error } = await db.from('people').upsert(
    {
      id: person.id,
      name: person.name,
      color: person.color,
    },
    { onConflict: 'id' },
  )

  if (error) {
    throw error
  }
}

export const deletePersonRemote = async (personId: string) => {
  const db = assertSupabase()

  const { error } = await db.from('people').delete().eq('id', personId)
  if (error) {
    throw error
  }
}

export const saveTransactionRemote = async (transaction: DebtTransaction) => {
  const db = assertSupabase()

  const { error } = await db.from('transactions').insert({
    id: transaction.id,
    type: transaction.type,
    from_person_id: transaction.fromPersonId,
    from_person_name: transaction.fromPersonName,
    to_person_id: transaction.toPersonId,
    to_person_name: transaction.toPersonName,
    for_person_id: transaction.forPersonId,
    for_person_name: transaction.forPersonName,
    amount_hkd: transaction.amountHkd,
    note: transaction.note,
    created_at: transaction.createdAt,
  })

  if (error) {
    throw error
  }
}

export const deleteTransactionRemote = async (transactionId: string) => {
  const db = assertSupabase()

  const { error } = await db
    .from('transactions')
    .delete()
    .eq('id', transactionId)
  if (error) {
    throw error
  }
}

export const updateTransactionRemote = async (transaction: DebtTransaction) => {
  const db = assertSupabase()

  const { error } = await db
    .from('transactions')
    .update({
      type: transaction.type,
      from_person_id: transaction.fromPersonId,
      from_person_name: transaction.fromPersonName,
      to_person_id: transaction.toPersonId,
      to_person_name: transaction.toPersonName,
      for_person_id: transaction.forPersonId,
      for_person_name: transaction.forPersonName,
      amount_hkd: transaction.amountHkd,
      note: transaction.note,
    })
    .eq('id', transaction.id)

  if (error) {
    throw error
  }
}

export const saveBalancesRemote = async (
  balances: DebtBalance[],
  previousBalances: DebtBalance[],
) => {
  const db = assertSupabase()

  const rows = balances.map((balance) => ({
    id: balance.id,
    debtor_id: balance.debtorId,
    debtor_name: balance.debtorName,
    creditor_id: balance.creditorId,
    creditor_name: balance.creditorName,
    amount_hkd: Math.round(balance.amountHkd),
  }))

  if (rows.length > 0) {
    const { error: upsertError } = await db
      .from('balances')
      .upsert(rows, { onConflict: 'id' })
    if (upsertError) {
      throw upsertError
    }
  }

  const nextIds = new Set(balances.map((balance) => balance.id))
  const removedIds = previousBalances
    .map((balance) => balance.id)
    .filter((id) => !nextIds.has(id))

  if (removedIds.length > 0) {
    const { error: deleteError } = await db
      .from('balances')
      .delete()
      .in('id', removedIds)

    if (deleteError) {
      throw deleteError
    }
  }
}
