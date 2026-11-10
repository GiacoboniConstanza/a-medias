export type SavingMoveKind = 'aporte' | 'retiro'

export type SavingBalanceMove = {
  userId: string
  kind: SavingMoveKind
  amount: number
}

export type SavingOpening = {
  userId: string
  amount: number
}

export type SavingBalances = {
  total: number
  byUser: Record<string, number>
}

/** Saldo = saldo inicial + aportes − retiros (total y por persona). */
export function savingBalances(
  openings: readonly SavingOpening[],
  moves: readonly SavingBalanceMove[],
): SavingBalances {
  const byUser: Record<string, number> = {}
  for (const opening of openings) {
    byUser[opening.userId] = (byUser[opening.userId] ?? 0) + opening.amount
  }
  for (const move of moves) {
    const delta = move.kind === 'aporte' ? move.amount : -move.amount
    byUser[move.userId] = (byUser[move.userId] ?? 0) + delta
  }
  let total = 0
  for (const amount of Object.values(byUser)) total += amount
  return { total, byUser }
}

/** Cuánto puede retirar una persona: su saldo (inicial + aportes − retiros), nunca negativo. */
export function withdrawableByUser(balances: SavingBalances, userId: string): number {
  return Math.max(0, balances.byUser[userId] ?? 0)
}
