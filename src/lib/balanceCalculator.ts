import type { DebtBalance } from '../types/balance'
import type { DebtTransaction } from '../types/transaction'

type Settlement = {
  debtorId: string
  debtorName: string
  creditorId: string
  creditorName: string
  amountHkd: number
}

const balanceKey = (debtorId: string, creditorId: string) =>
  `${debtorId}:${creditorId}`

const applySettlement = (
  map: Map<string, DebtBalance>,
  settlement: Settlement,
) => {
  const forwardKey = balanceKey(settlement.debtorId, settlement.creditorId)
  const reverseKey = balanceKey(settlement.creditorId, settlement.debtorId)

  const reverse = map.get(reverseKey)
  if (reverse) {
    if (reverse.amountHkd > settlement.amountHkd) {
      map.set(reverseKey, {
        ...reverse,
        amountHkd: Number((reverse.amountHkd - settlement.amountHkd).toFixed(2)),
      })
      return
    }

    if (reverse.amountHkd === settlement.amountHkd) {
      map.delete(reverseKey)
      return
    }

    map.delete(reverseKey)
    map.set(forwardKey, {
      id: forwardKey,
      debtorId: settlement.debtorId,
      debtorName: settlement.debtorName,
      creditorId: settlement.creditorId,
      creditorName: settlement.creditorName,
      amountHkd: Number((settlement.amountHkd - reverse.amountHkd).toFixed(2)),
    })
    return
  }

  const currentForward = map.get(forwardKey)
  if (!currentForward) {
    map.set(forwardKey, {
      id: forwardKey,
      debtorId: settlement.debtorId,
      debtorName: settlement.debtorName,
      creditorId: settlement.creditorId,
      creditorName: settlement.creditorName,
      amountHkd: settlement.amountHkd,
    })
    return
  }

  map.set(forwardKey, {
    ...currentForward,
    amountHkd: Number((currentForward.amountHkd + settlement.amountHkd).toFixed(2)),
  })
}

const getSettlements = (transaction: DebtTransaction): Settlement[] => {
  if (transaction.type === 'gave') {
    return [
      {
        debtorId: transaction.toPersonId,
        debtorName: transaction.toPersonName,
        creditorId: transaction.fromPersonId,
        creditorName: transaction.fromPersonName,
        amountHkd: transaction.amountHkd,
      },
    ]
  }

  if (transaction.type === 'took') {
    return [
      {
        debtorId: transaction.fromPersonId,
        debtorName: transaction.fromPersonName,
        creditorId: transaction.toPersonId,
        creditorName: transaction.toPersonName,
        amountHkd: transaction.amountHkd,
      },
    ]
  }

  if (!transaction.forPersonId || !transaction.forPersonName) {
    return []
  }

  return [
    {
      debtorId: transaction.toPersonId,
      debtorName: transaction.toPersonName,
      creditorId: transaction.forPersonId,
      creditorName: transaction.forPersonName,
      amountHkd: transaction.amountHkd,
    },
    {
      debtorId: transaction.forPersonId,
      debtorName: transaction.forPersonName,
      creditorId: transaction.fromPersonId,
      creditorName: transaction.fromPersonName,
      amountHkd: transaction.amountHkd,
    },
  ]
}

export const applyTransactionToBalances = (
  currentBalances: DebtBalance[],
  transaction: DebtTransaction,
  direction: 'add' | 'remove',
): DebtBalance[] => {
  const map = new Map(currentBalances.map((balance) => [balance.id, balance]))
  const settlements = getSettlements(transaction)

  for (const settlement of settlements) {
    if (direction === 'add') {
      applySettlement(map, settlement)
      continue
    }

    applySettlement(map, {
      debtorId: settlement.creditorId,
      debtorName: settlement.creditorName,
      creditorId: settlement.debtorId,
      creditorName: settlement.debtorName,
      amountHkd: settlement.amountHkd,
    })
  }

  return [...map.values()].sort((a, b) => b.amountHkd - a.amountHkd)
}