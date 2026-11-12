import { settledSharedHelp, sharedMonthSettled } from './period.ts'
import type { MpClassifiedRow } from './mpStatement.ts'
import { creditoMpDueDay } from './mpStatement.ts'

export { settledSharedHelp as settledMonthHelp }

export type MpReviewRow = MpClassifiedRow & {
  /** Id estable en la lista (operationId + índice si hay duplicados de par). */
  id: string
  checked: boolean
  /** Gasto compartido en mes saldado. */
  settledBlocked: boolean
}

export type MpDayGroup = {
  date: string
  label: string
  rows: MpReviewRow[]
}

/** ¿La fila se puede tildar? */
export function rowIsToggleable(row: MpReviewRow): boolean {
  return row.status === 'ready' || row.status === 'needs_partner_alias'
}

export function rowIsDimmed(row: MpReviewRow): boolean {
  return row.status === 'already_imported' || row.status === 'refund_pair' || row.status === 'refund_notice'
}

export function buildReviewRows(
  classified: readonly MpClassifiedRow[],
  settledMonths: readonly string[],
): MpReviewRow[] {
  const seen = new Map<string, number>()
  return classified.map((row) => {
    const count = (seen.get(row.operationId) ?? 0) + 1
    seen.set(row.operationId, count)
    const period = `${row.date.slice(0, 7)}-01`
    const settledBlocked =
      row.kind === 'expense' &&
      !row.creditoMp &&
      row.status === 'ready' &&
      sharedMonthSettled(row.isShared, period, settledMonths)
    return {
      ...row,
      id: count === 1 ? row.operationId : `${row.operationId}:${count}`,
      settledBlocked,
    }
  })
}

export function groupRowsByDay(rows: readonly MpReviewRow[]): MpDayGroup[] {
  const byDay = new Map<string, MpReviewRow[]>()
  for (const row of rows) {
    const list = byDay.get(row.date) ?? []
    list.push(row)
    byDay.set(row.date, list)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) => ({
      date,
      label: dayHeaderLabel(date),
      rows: dayRows,
    }))
}

export function dayHeaderLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  const date = new Date(year, month - 1, day)
  const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(date)
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day}`
}

export function longDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  const date = new Date(year, month - 1, day)
  const label = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function periodRangeLabel(fromDate: string, toDate: string): string {
  const from = Number(fromDate.slice(8, 10))
  const to = Number(toDate.slice(8, 10))
  const [year, month] = fromDate.split('-').map(Number)
  if (!year || !month) return ''
  const monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date(year, month - 1, 1))
  if (fromDate.slice(0, 7) === toDate.slice(0, 7)) {
    return `Del ${from} al ${to} de ${monthLabel} de ${year}`
  }
  return `Del ${fromDate} al ${toDate}`
}

/** Bajada de una fila según §3.3. */
export function rowSubtitle(
  row: MpReviewRow,
  partnerNick: string,
  opts?: { createCreditoMp?: boolean; categoryName?: string | null },
): string {
  if (row.status === 'refund_pair') return row.statusLabel ?? 'Te lo devolvieron: no se carga'
  if (row.status === 'refund_notice') return row.statusLabel ?? ''
  if (row.status === 'already_imported') {
    return alreadyImportedSubtitle(row, opts?.categoryName ?? row.categoryName)
  }
  if (row.kind === 'transfer') {
    return row.transferDirection === 'received'
      ? `${partnerNick} te pasó`
      : `Le pasaste a ${partnerNick}`
  }
  if (row.creditoMp) {
    return opts?.createCreditoMp === false ? 'Gasto · Privado' : 'Gasto fijo · Privado'
  }
  if (row.kind === 'income') {
    if (/^rendimientos$/i.test(row.title)) return 'Ingreso · Rendimientos'
    if (row.transferDirection === 'received') return 'Posible ingreso'
    if (/^devoluci[oó]n de /i.test(row.title)) return 'Posible ingreso'
    return 'Ingreso'
  }
  if (row.kind === 'expense') {
    if (row.transferDirection === 'sent') {
      return row.isShared ? 'Posible gasto · Compartido' : 'Posible gasto · Privado'
    }
    const cat = opts?.categoryName ?? row.categoryName
    const scope = row.isShared ? 'Compartido' : 'Privado'
    if (cat) return `Gasto · ${cat} · ${scope}`
    return `Gasto · ${scope}`
  }
  return ''
}

function alreadyImportedSubtitle(row: MpReviewRow, categoryName: string | null): string {
  if (row.kind === 'transfer') return 'Transferencia'
  if (row.kind === 'income') {
    if (/^rendimientos$/i.test(row.title)) return 'Ingreso · Rendimientos'
    return 'Ingreso'
  }
  const scope = row.isShared ? 'Compartido' : 'Privado'
  if (categoryName) return `Gasto · ${categoryName} · ${scope}`
  return `Gasto · ${scope}`
}

export function reviewCounts(rows: readonly MpReviewRow[]) {
  let already = 0
  let unchecked = 0
  let refunds = 0
  let blocked = 0
  let loadable = 0
  let checkedLoadable = 0
  let out = 0
  let inn = 0
  for (const row of rows) {
    if (row.status === 'already_imported') already += 1
    if (row.status === 'refund_notice') refunds += 1
    if (rowIsToggleable(row) && !row.checked) unchecked += 1
    if (row.settledBlocked && row.checked) blocked += 1
    if (rowIsToggleable(row) && !row.settledBlocked) {
      loadable += 1
      if (row.checked) {
        checkedLoadable += 1
        if (row.signedAmount < 0) out += row.amount
        else inn += row.amount
      }
    }
  }
  return {
    total: rows.length,
    already,
    unchecked,
    refunds,
    blocked,
    loadable,
    checkedLoadable,
    out,
    inn,
  }
}

export function summaryCountsLine(counts: ReturnType<typeof reviewCounts>): string {
  if (counts.already === counts.total && counts.total > 0) return 'Este resumen ya está cargado'
  const parts: string[] = []
  if (counts.blocked > 0) parts.push(`${counts.blocked} bloqueados`)
  if (counts.already > 0) parts.push(`${counts.already} ya cargados`)
  if (counts.unchecked > 0) parts.push(`${counts.unchecked} sin tildar`)
  if (counts.refunds > 0) {
    parts.push(counts.refunds === 1 ? '1 devolución' : `${counts.refunds} devoluciones`)
  }
  return parts.join(' · ')
}

export function creditoOfferText(firstDebitDate: string, monthSum: number, debitCount: number): {
  dueDay: number
  checked: string
  unchecked: string
} {
  const dueDay = creditoMpDueDay(firstDebitDate)
  const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(
    new Date(Number(firstDebitDate.slice(0, 4)), Number(firstDebitDate.slice(5, 7)) - 1, 1),
  )
  const sumLabel = monthSum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return {
    dueDay,
    checked: `Es la primera vez que aparece. Lo creo privado, vence el ${dueDay} y es de $ ${sumLabel}, la suma de ${monthName}.`,
    unchecked: `No lo creo: los ${debitCount} débitos se cargan como gastos privados.`,
  }
}

