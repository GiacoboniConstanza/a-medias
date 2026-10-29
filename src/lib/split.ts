import { formatMoney } from './format.ts'

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
  const roundedTotal = Math.round(total)
  if (weights.length === 0) return []
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const ratios =
    weightSum > 0 ? weights.map((weight) => weight / weightSum) : weights.map(() => 1 / weights.length)
  const shares = ratios.map((ratio) => Math.round(roundedTotal * ratio))
  const drift = roundedTotal - shares.reduce((sum, share) => sum + share, 0)
  shares[0] = (shares[0] ?? 0) + drift
  return shares
}

export function splitShared(total: number, people: SplitPerson[]): SplitResult {
  const missingBase = people.length > 0 && people.some((person) => person.base <= 0)
  const weights = missingBase ? people.map(() => 1) : people.map((person) => person.base)
  const shares = shareAmounts(total, weights)
  const rows = people.map((person, index) => {
    const share = shares[index] ?? 0
    const ratioBase = weights.reduce((sum, weight) => sum + weight, 0)
    const percent =
      Math.round(total) === 0
        ? Math.round(((weights[index] ?? 0) / ratioBase) * 100)
        : Math.round((share / Math.round(total)) * 100)
    return {
      id: person.id,
      name: person.name,
      percent,
      share,
      paid: Math.round(person.paid),
      balance: Math.round(person.paid) - share,
    }
  })

  const percentDrift = 100 - rows.reduce((sum, row) => sum + row.percent, 0)
  if (rows[0] && total !== 0) rows[0].percent += percentDrift

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
    return {
      id: person.id,
      name: person.name,
      percent: person.percent,
      share,
      paid: Math.round(person.paid),
      balance: Math.round(person.paid) - share,
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

  return { total: Math.round(total), rows, debtorId, creditorId, amount, usedEvenSplit }
}

export function debtSentence(meId: string, result: SplitResult): string {
  if (result.rows.length < 2) return 'Cuando se sume tu compañera, calculamos el reparto.'
  if (result.amount === 0 || !result.debtorId || !result.creditorId) return 'Están a mano este mes.'
  const debtor = result.rows.find((row) => row.id === result.debtorId)
  const creditor = result.rows.find((row) => row.id === result.creditorId)
  if (!debtor || !creditor) return 'Están a mano este mes.'
  const money = formatMoney(result.amount)
  if (meId === creditor.id) return `${debtor.name} te debe ${money}`
  if (meId === debtor.id) return `Le debés ${money} a ${creditor.name}`
  return `${debtor.name} le debe ${money} a ${creditor.name}`
}
