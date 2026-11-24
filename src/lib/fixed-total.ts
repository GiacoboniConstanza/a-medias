import { formatMoney, normalizeMoney, toCents } from './format.ts'
import { shareAmounts } from './split.ts'

/** Ancho útil de la nota (~322 px a 14 medium ≈ 46 caracteres). */
export const FIXED_TOTAL_NOTE_MAX_CHARS = 46

export type FixedTotalItem = {
  title: string
  amount: number
  hasAmount: boolean
  isShared: boolean
  payment: { amount: number } | null
}

export type FixedTotalNote = {
  /** Texto visible con « · »; null si no hay nota. */
  text: string
  /** Lectura: pagados y sin monto unidos con coma. */
  ariaLabel: string
  paidLabel: string | null
  missingLabel: string | null
}

export type FixedTotalCard = {
  label: 'Total del mes' | 'Total con estos filtros'
  total: number
  note: FixedTotalNote | null
  showParts: boolean
  myShare: number
  partnerShare: number
  partnerName: string
  partsAriaLabel: string
  showPrivate: boolean
  privateTotal: number
}

function itemAmount(item: FixedTotalItem): number {
  if (item.payment) return normalizeMoney(item.payment.amount)
  return normalizeMoney(item.amount)
}

function missingLabelFor(titles: string[], paidLabel: string | null): string | null {
  if (titles.length === 0) return null
  if (titles.length >= 2) return `${titles.length} sin monto`
  const name = titles[0] ?? ''
  const named = `${name} sin monto`
  const candidate = paidLabel ? `${paidLabel} · ${named}` : named
  if (candidate.length > FIXED_TOTAL_NOTE_MAX_CHARS) return '1 sin monto'
  return named
}

export function fixedTotalNote(
  paidCents: number,
  missingTitles: string[],
): FixedTotalNote | null {
  const paidLabel =
    paidCents > 0 ? `${formatMoney(paidCents / 100)} ya pagados` : null
  const missingLabel = missingLabelFor(missingTitles, paidLabel)
  if (!paidLabel && !missingLabel) return null
  const parts = [paidLabel, missingLabel].filter((part): part is string => Boolean(part))
  return {
    text: parts.join(' · '),
    ariaLabel: parts.join(', '),
    paidLabel,
    missingLabel,
  }
}

/** Total de los fijos visibles. null = no hay tarjeta (nada a la vista). */
export function fixedExpensesTotal(input: {
  items: readonly FixedTotalItem[]
  meId: string
  partnerId: string | null
  partnerName: string
  splitPercents: Readonly<Record<string, number>>
  filtersActive: boolean
}): FixedTotalCard | null {
  const { items, meId, partnerId, partnerName, splitPercents, filtersActive } = input
  if (items.length === 0) return null

  const suman = items.filter((item) => item.payment != null || item.hasAmount)
  const missing = items.filter((item) => !item.hasAmount && item.payment == null)

  let sharedCents = 0
  let privateCents = 0
  let paidCents = 0
  for (const item of suman) {
    const cents = toCents(itemAmount(item))
    if (item.isShared) sharedCents += cents
    else privateCents += cents
    if (item.payment) paidCents += toCents(item.payment.amount)
  }

  const shared = sharedCents / 100
  const privateTotal = privateCents / 100
  const total = normalizeMoney(shared + privateTotal)

  const hasShared = items.some((item) => item.isShared)
  const hasPrivate = items.some((item) => !item.isShared)
  const showPrivate = hasShared && hasPrivate
  const showParts = hasShared && Boolean(partnerId)

  let myShare = 0
  let partnerShare = 0
  let partsAriaLabel = ''
  if (showParts && partnerId) {
    const ids = [meId, partnerId].sort()
    const parts = shareAmounts(
      shared,
      ids.map((id) => splitPercents[id] ?? 0),
    )
    myShare = parts[ids.indexOf(meId)] ?? 0
    partnerShare = parts[ids.indexOf(partnerId)] ?? 0
    const name = partnerName.trim() || 'tu compañera'
    const moneySpoken = (value: number) => formatMoney(value).replace(/^\$\u00a0/, '').replace(/^\$\s*/, '')
    partsAriaLabel = `Vos ${moneySpoken(myShare)} pesos; ${name} ${moneySpoken(partnerShare)} pesos, de los compartidos`
  }

  return {
    label: filtersActive ? 'Total con estos filtros' : 'Total del mes',
    total,
    note: fixedTotalNote(
      paidCents,
      missing.map((item) => item.title),
    ),
    showParts,
    myShare,
    partnerShare,
    partnerName: partnerName.trim() || 'tu compañera',
    partsAriaLabel,
    showPrivate,
    privateTotal,
  }
}
