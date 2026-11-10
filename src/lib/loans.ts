import { formatMoney, money, normalizeMoney } from './format.ts'
import { debtSentence, type SplitResult } from './split.ts'
import { supabase } from './supabase.ts'

export type LoanStatus = 'pendiente' | 'parcial' | 'saldado'
export type LoanFilter = 'all' | 'open' | 'settled'

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

/** Forma legada usada por la pantalla de préstamos hasta que se borre. */
export type Loan = {
  id: string
  lenderId: string
  borrowerId: string
  amount: number
  repaid: number
  pending: number
  status: LoanStatus
  lentOn: string
  period: string
  notes: string | null
  lockMonth: string | null
}

export type LoanRepayment = {
  id: string
  loanId: string
  amount: number
  paidOn: string
  period: string
  notes: string | null
  createdBy: string
  settlementId: string | null
}

export type LoanSide = {
  lenderId: string
  borrowerId: string
  pending: number
  status: LoanStatus
}

/** Positivo: la otra persona te debe. Negativo: vos le debés. Tras P2 no hay pendiente. */
export function signedLoanBalance(meId: string, loans: readonly LoanSide[]): number {
  let signed = 0
  for (const loan of loans) {
    if (loan.status === 'saldado' || loan.pending <= 0) continue
    if (loan.lenderId === meId) signed += loan.pending
    else if (loan.borrowerId === meId) signed -= loan.pending
  }
  return normalizeMoney(signed)
}

export function loanState(amount: number, repaid: number): { repaid: number; pending: number; status: LoanStatus } {
  const paid = normalizeMoney(Math.max(0, repaid))
  const pending = normalizeMoney(amount - paid)
  if (paid <= 0) return { repaid: 0, pending: normalizeMoney(amount), status: 'pendiente' }
  if (pending <= 0) return { repaid: normalizeMoney(amount), pending: 0, status: 'saldado' }
  return { repaid: paid, pending, status: 'parcial' }
}

export function monthIsSettled(period: string, settledMonths: readonly string[]): boolean {
  const month = period.slice(0, 10)
  return settledMonths.some((settled) => settled.slice(0, 10) === month)
}

export function repaymentIsLocked(
  repayment: { settlementId: string | null; period: string },
  settledMonths: readonly string[],
): boolean {
  return repayment.settlementId != null || monthIsSettled(repayment.period, settledMonths)
}

export function matchesLoanFilter(status: LoanStatus, filter: LoanFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'settled') return status === 'saldado'
  return status !== 'saldado'
}

export function balanceSentence(partnerName: string, signed: number): string {
  const amount = normalizeMoney(signed)
  if (amount === 0) return 'Están a mano'
  if (amount > 0) return `${partnerName} tiene que devolver ${formatMoney(amount)}`
  return `Tenés que devolver ${formatMoney(-amount)}`
}

export function friendlyLoanSummary(partnerName: string | null, signed: number): string {
  if (!partnerName) return 'Cuando se sume tu compañera, van a poder pasarse plata.'
  const amount = normalizeMoney(signed)
  if (amount > 0) return `${partnerName} tiene que devolver ${formatMoney(amount)}`
  if (amount < 0) return `Tenés que devolver ${formatMoney(-amount)}`
  return 'Están a mano.'
}

export function homeLoanLine(signed: number): string | null {
  const amount = normalizeMoney(signed)
  if (amount > 0) return `Tiene que devolver ${formatMoney(amount)}`
  if (amount < 0) return `Tenés que devolver ${formatMoney(-amount)}`
  return null
}

/** El pendiente de devolución no se suma al reparto de gastos. */
export function sharedLoanNote(partnerName: string, loanSigned: number): { pendingLine: string } | null {
  if (normalizeMoney(loanSigned) === 0) return null
  return { pendingLine: balanceSentence(partnerName, loanSigned) }
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

export type SettlementPhrases = {
  expenseLine: string
  loanLine: string | null
}

/** El reparto y el pendiente de devolución van en frases distintas. No se suman. */
export function settlementPhrases(meId: string, result: SplitResult, loanSigned: number): SettlementPhrases {
  const partner = result.rows.find((row) => row.id !== meId) ?? null
  const expenseLine = debtSentence(meId, result)
  const loans = normalizeMoney(loanSigned)
  if (!partner || result.rows.length < 2 || loans === 0) return { expenseLine, loanLine: null }
  return { expenseLine, loanLine: balanceSentence(partner.name, loans) }
}

/** El cupo de una devolución nueva es el pendiente. Al editarla, vuelve a sumar su monto. */
export function repaymentRoom(pending: number, currentAmount = 0): number {
  return normalizeMoney(pending + currentAmount)
}

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

/** Compat: la lista vieja de préstamos muestra transferencias como saldadas. */
export async function loadLoanBalances(): Promise<Loan[]> {
  const rows = await loadTransfers()
  return rows.map((row) => ({
    id: row.id,
    lenderId: row.fromId,
    borrowerId: row.toId,
    amount: row.amount,
    repaid: row.amount,
    pending: 0,
    status: 'saldado' as const,
    lentOn: row.transferredOn,
    period: row.period,
    notes: row.notes,
    lockMonth: null,
  }))
}

export async function loadRepayments(_loanId: string): Promise<LoanRepayment[]> {
  return []
}

export async function loadSettlementRepayments(
  _settlementId: string,
): Promise<{ loanId: string; lenderId: string; borrowerId: string; amount: number }[]> {
  return []
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

/** Compat con el editor viejo: quien presta manda la plata. */
export async function saveLoan(input: {
  id?: string
  borrowerId: string
  amount: number
  lentOn: string
  period: string
  notes: string | null
}) {
  await saveTransfer({
    id: input.id,
    fromId: await currentUserId(),
    toId: input.borrowerId,
    amount: input.amount,
    transferredOn: input.lentOn,
    period: input.period,
    notes: input.notes,
  })
}

export async function deleteLoan(id: string) {
  const { error } = await supabase.from('transfers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveRepayment(_input: {
  id?: string
  loanId: string
  amount: number
  paidOn: string
  period: string
  notes: string | null
}) {
  throw new Error('Las devoluciones pasaron a ser transferencias. Cargá una transferencia nueva.')
}

export async function deleteRepayment(_id: string) {
  throw new Error('Las devoluciones pasaron a ser transferencias.')
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Tenés que entrar para transferir.')
  return data.user.id
}
