export type BagKind = 'gusto' | 'to_fund' | 'to_gustos' | 'use'

export type BagAllocation = {
  fundId: string | null
  amount: number
}

export type BagMovementInput = {
  kind: BagKind
  fundId: string | null
  amount: number
}

export type BagBalance = {
  gustosFree: number
  gustosPool: number
  savedByFund: Map<string, number>
}

/** Misma cuenta que private.gustos_free y private.fund_saved. */
export function bagBalances(allocations: BagAllocation[], movements: BagMovementInput[]): BagBalance {
  const savedByFund = new Map<string, number>()
  let gustosPool = 0
  let gustosOut = 0

  for (const allocation of allocations) {
    if (!allocation.fundId) {
      gustosPool += allocation.amount
      continue
    }
    savedByFund.set(allocation.fundId, (savedByFund.get(allocation.fundId) ?? 0) + allocation.amount)
  }

  for (const movement of movements) {
    if (movement.kind === 'gusto') {
      gustosOut += movement.amount
      continue
    }
    if (!movement.fundId) continue
    const current = savedByFund.get(movement.fundId) ?? 0
    if (movement.kind === 'to_fund') {
      gustosOut += movement.amount
      savedByFund.set(movement.fundId, current + movement.amount)
    } else if (movement.kind === 'to_gustos') {
      gustosPool += movement.amount
      savedByFund.set(movement.fundId, current - movement.amount)
    } else if (movement.kind === 'use') {
      savedByFund.set(movement.fundId, current - movement.amount)
    }
  }

  return {
    gustosFree: gustosPool - gustosOut,
    gustosPool,
    savedByFund,
  }
}

export function monthBagSplit(extras: { amount: number; parts: { amount: number; toGustos: boolean }[] }[]) {
  let funds = 0
  let gustos = 0
  let total = 0
  for (const extra of extras) {
    total += extra.amount
    let assigned = 0
    for (const part of extra.parts) {
      assigned += part.amount
      if (part.toGustos) gustos += part.amount
      else funds += part.amount
    }
    if (extra.amount > assigned) gustos += extra.amount - assigned
  }
  return { funds, gustos, total }
}
