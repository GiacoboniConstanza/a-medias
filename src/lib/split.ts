import { formatMoney, fromCents, normalizeMoney, toCents } from './format.ts'

export type SplitPerson = {
  id: string
  name: string
  base: number
  paid: number
}

export type SplitRow = {
  id: string
  name: string
  percent: number
  share: number
  paid: number
  balance: number
}

export type SplitResult = {
  total: number
  rows: SplitRow[]
  debtorId: string | null
  creditorId: string | null
  amount: number
  usedEvenSplit: boolean
}

export function shareAmounts(total: number, weights: number[]): number[] {
  const totalCents = toCents(total)
  if (weights.length === 0) return []
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const ratios =
    weightSum > 0 ? weights.map((weight) => weight / weightSum) : weights.map(() => 1 / weights.length)
  const shares = ratios.map((ratio) => Math.round(totalCents * ratio))
  const drift = totalCents - shares.reduce((sum, share) => sum + share, 0)
  shares[0] = (shares[0] ?? 0) + drift
  return shares.map(fromCents)
}

export function splitShared(total: number, people: SplitPerson[]): SplitResult {
  const missingBase = people.length > 0 && people.some((person) => person.base <= 0)
  const weights = missingBase ? people.map(() => 1) : people.map((person) => person.base)
  const shares = shareAmounts(total, weights)
  const totalCents = toCents(total)
  const rows = people.map((person, index) => {
    const share = shares[index] ?? 0
    const ratioBase = weights.reduce((sum, weight) => sum + weight, 0)
    const paid = normalizeMoney(person.paid)
    const percent =
      totalCents === 0
        ? Math.round(((weights[index] ?? 0) / ratioBase) * 100)
        : Math.round((toCents(share) / totalCents) * 100)
    return {
      id: person.id,
      name: person.name,
      percent,
      share,
      paid,
      balance: normalizeMoney(paid - share),
    }
  })

  const percentDrift = 100 - rows.reduce((sum, row) => sum + row.percent, 0)
  if (rows[0] && totalCents !== 0) rows[0].percent += percentDrift

  return finishSplit(total, rows, missingBase)
}

export function splitByPercents(
  total: number,
  people: { id: string; name: string; percent: number; paid: number }[],
  usedEvenSplit: boolean,
): SplitResult {
  const shares = shareAmounts(
    total,
    people.map((person) => person.percent),
  )
  const rows = people.map((person, index) => {
    const share = shares[index] ?? 0
    const paid = normalizeMoney(person.paid)
    return {
      id: person.id,
      name: person.name,
      percent: person.percent,
      share,
      paid,
      balance: normalizeMoney(paid - share),
    }
  })
  return finishSplit(total, rows, usedEvenSplit)
}

function finishSplit(total: number, rows: SplitRow[], usedEvenSplit: boolean): SplitResult {
  let debtorId: string | null = null
  let creditorId: string | null = null
  let amount = 0
  if (rows.length === 2) {
    const [first, second] = rows
    if (first && second && first.balance !== 0) {
      amount = Math.abs(first.balance)
      if (first.balance > 0) {
        creditorId = first.id
        debtorId = second.id
      } else {
        creditorId = second.id
        debtorId = first.id
      }
    }
  }

  return { total: normalizeMoney(total), rows, debtorId, creditorId, amount, usedEvenSplit }
}

export function debtSentence(meId: string, result: SplitResult): string {
  if (result.rows.length < 2) return 'Cuando se sume tu compañera, calculamos el reparto.'
  const partner = result.rows.find((row) => row.id !== meId)
  if (!partner) return 'Cuando se sume tu compañera, calculamos el reparto.'
  const gap = normalizeMoney(partner.balance)
  if (gap === 0) return 'Están a mano este mes.'
  const money = formatMoney(Math.abs(gap))
  if (gap > 0) return `${partner.name} puso de más ${money}`
  return `${partner.name} puso de menos ${money}`
}

export type PairBalance = {
  even: boolean
  sentence: string
  myPaid: number
  partnerPaid: number
  partnerName: string | null
}

/** Lo que cada una pagó y la frase del saldo, a partir del mismo reparto. */
export function pairBalance(meId: string, result: SplitResult): PairBalance {
  const mine = result.rows.find((row) => row.id === meId) ?? null
  const partner = result.rows.find((row) => row.id !== meId) ?? null
  const even = result.rows.length >= 2 && result.amount === 0
  return {
    even,
    sentence: even ? 'Están a mano' : debtSentence(meId, result),
    myPaid: mine?.paid ?? 0,
    partnerPaid: partner?.paid ?? 0,
    partnerName: partner?.name ?? null,
  }
}

/** Parte de quien pagó en un 50/50. El centavo impar queda en quien pagó. */
export function sharedHalf(amount: number): number {
  const cents = toCents(amount)
  const other = Math.floor(cents / 2)
  return fromCents(cents - other)
}

export function paidHalfCaption(payerName: string, amount: number): string {
  return `Pagó ${payerName}, mitad: ${formatMoney(sharedHalf(amount))}`
}
