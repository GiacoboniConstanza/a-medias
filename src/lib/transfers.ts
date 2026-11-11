import { formatMoney, money, normalizeMoney } from './format.ts'
import { supabase } from './supabase.ts'

/** Transferencia entre las dos. from = quien manda, to = quien recibe. */
export type Transfer = {
  id: string
  fromId: string
  toId: string
  amount: number
  transferredOn: string
  period: string
  notes: string | null
}

/** Forma legada usada por loanMonthEffect y pantallas hasta renombrar. */
export type PeriodLoan = {
  lenderId: string
  borrowerId: string
  amount: number
  period: string
}

export type PeriodTransfer = {
  fromId: string
  toId: string
  amount: number
  period: string
}

export type PeriodRepayment = {
  lenderId: string
  borrowerId: string
  amount: number
  period: string
}

export type LoanMonthEffect = {
  given: number
  collected: number
  received: number
  paid: number
  net: number
}

export function monthIsSettled(period: string, settledMonths: readonly string[]): boolean {
  const month = period.slice(0, 10)
  return settledMonths.some((settled) => settled.slice(0, 10) === month)
}

export function sharedSignedBalance(
  meId: string,
  split: { creditorId: string | null; debtorId: string | null; amount: number },
): number {
  if (split.amount === 0 || !split.creditorId) return 0
  if (split.creditorId === meId) return normalizeMoney(split.amount)
  if (split.debtorId === meId) return normalizeMoney(-split.amount)
  return 0
}

function asTransfers(
  loans: readonly PeriodLoan[] | readonly PeriodTransfer[],
  repayments: readonly PeriodRepayment[] = [],
): PeriodTransfer[] {
  const fromLoans: PeriodTransfer[] = loans.map((row) => {
    if ('fromId' in row) return { fromId: row.fromId, toId: row.toId, amount: row.amount, period: row.period }
    return { fromId: row.lenderId, toId: row.borrowerId, amount: row.amount, period: row.period }
  })
  // Devoluciones legadas en tests: quien debía (borrower) le pasa a quien prestó (lender).
  const fromRepayments: PeriodTransfer[] = repayments.map((row) => ({
    fromId: row.borrowerId,
    toId: row.lenderId,
    amount: row.amount,
    period: row.period,
  }))
  return [...fromLoans, ...fromRepayments]
}

/**
 * Efecto del mes en Te quedan (P1): mandar resta, recibir suma.
 * Acepta transferencias o la forma legada préstamo+devolución (la devolución es la transferencia al revés).
 */
export function loanMonthEffect(
  meId: string,
  period: string,
  loans: readonly PeriodLoan[] | readonly PeriodTransfer[] = [],
  repayments: readonly PeriodRepayment[] = [],
): LoanMonthEffect {
  let given = 0
  let received = 0
  for (const transfer of asTransfers(loans, repayments)) {
    if (transfer.period !== period) continue
    if (transfer.fromId === meId) given += transfer.amount
    else if (transfer.toId === meId) received += transfer.amount
  }
  return {
    given: normalizeMoney(given),
    collected: 0,
    received: normalizeMoney(received),
    paid: 0,
    net: normalizeMoney(-given + received),
  }
}

export function hasLoanMovement(effect: LoanMonthEffect): boolean {
  return effect.given !== 0 || effect.collected !== 0 || effect.received !== 0 || effect.paid !== 0
}

/** Te quedan = ingresos − gastos pagados + neto de transferencias del mes. El reparto no entra. */
export function remainingAfterLoans(income: number, spent: number, loanNet: number): number {
  return normalizeMoney(income - spent + loanNet)
}

export function formatSignedMoney(value: number): string {
  const amount = normalizeMoney(value)
  if (amount > 0) return `+${formatMoney(amount)}`
  return formatMoney(amount)
}

/** Plata que entró y plata que salió en el mes. */
export function loanEffectLines(partnerName: string, effect: LoanMonthEffect): { label: string; amount: number }[] {
  return [
    { label: `${partnerName} te pasó`, amount: normalizeMoney(effect.received + effect.collected) },
    { label: `Le pasaste a ${partnerName}`, amount: normalizeMoney(effect.given + effect.paid) },
  ]
}

function mapTransfer(row: {
  id: string
  from_id: string
  to_id: string
  amount: number | string
  transferred_on: string
  period: string
  notes: string | null
}): Transfer {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    amount: money(row.amount),
    transferredOn: row.transferred_on,
    period: row.period,
    notes: row.notes,
  }
}

/** Carga transferencias para Te quedan. repayments queda vacío: las devoluciones ya migraron. */
export async function loadLoanMovements(): Promise<{ loans: PeriodLoan[]; repayments: PeriodRepayment[] }> {
  const { data, error } = await supabase.from('transfers').select('id, from_id, to_id, amount, period')
  if (error) throw new Error(error.message)
  return {
    loans: (data ?? []).map((row) => ({
      lenderId: row.from_id,
      borrowerId: row.to_id,
      amount: money(row.amount),
      period: row.period,
    })),
    repayments: [],
  }
}

export async function loadTransfers(): Promise<Transfer[]> {
  const { data, error } = await supabase
    .from('transfers')
    .select('id, from_id, to_id, amount, transferred_on, period, notes')
    .order('transferred_on', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapTransfer)
}

export async function saveTransfer(input: {
  id?: string
  fromId: string
  toId: string
  amount: number
  transferredOn: string
  period: string
  notes: string | null
}) {
  const editable = {
    amount: input.amount,
    transferred_on: input.transferredOn,
    period: input.period,
    notes: input.notes,
  }
  const { error } = input.id
    ? await supabase.from('transfers').update(editable).eq('id', input.id)
    : await supabase.from('transfers').insert({
        ...editable,
        from_id: input.fromId,
        to_id: input.toId,
      })
  if (error) throw new Error(error.message)
}

export async function deleteLoan(id: string) {
  const { error } = await supabase.from('transfers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
