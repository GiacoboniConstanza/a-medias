import { monthPocket } from './derive.ts'
import { formatMoney, money, normalizeMoney } from './format.ts'
import { supabase } from './supabase.ts'

export type LoanStatus = 'pendiente' | 'parcial' | 'saldado'
export type LoanFilter = 'all' | 'open' | 'settled'

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
}

export type LoanRepayment = {
  id: string
  loanId: string
  amount: number
  paidOn: string
  period: string
  notes: string | null
  createdBy: string
}

export type LoanSide = {
  lenderId: string
  borrowerId: string
  pending: number
  status: LoanStatus
}

/** Positivo: la otra persona te debe. Negativo: vos le debés. */
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

export function matchesLoanFilter(status: LoanStatus, filter: LoanFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'settled') return status === 'saldado'
  return status !== 'saldado'
}

export function balanceSentence(partnerName: string, signed: number): string {
  const amount = normalizeMoney(signed)
  if (amount === 0) return 'Están a mano'
  if (amount > 0) return `${partnerName} te debe ${formatMoney(amount)}`
  return `Le debés ${formatMoney(-amount)} a ${partnerName}`
}

export function friendlyLoanSummary(partnerName: string | null, signed: number): string {
  if (!partnerName) return 'Cuando se sume tu compañera, van a poder prestarse.'
  const amount = normalizeMoney(signed)
  if (amount > 0) return `${partnerName} te debe ${formatMoney(amount)} en préstamos`
  if (amount < 0) return `Le debés ${formatMoney(-amount)} a ${partnerName}`
  return 'No hay préstamos pendientes'
}

export function homeLoanLine(signed: number): string | null {
  const amount = normalizeMoney(signed)
  if (amount > 0) return `Préstamos a cobrar ${formatMoney(amount)}`
  if (amount < 0) return `Préstamos a devolver ${formatMoney(-amount)}`
  return null
}

/** sharedSigned usa el mismo signo: positivo si el gasto compartido queda a tu favor. */
export function sharedLoanNote(
  partnerName: string,
  loanSigned: number,
  sharedSigned: number,
): { pendingLine: string; netLine: string } | null {
  if (normalizeMoney(loanSigned) === 0) return null
  return {
    pendingLine: `Préstamos pendientes: ${balanceSentence(partnerName, loanSigned)}`,
    netLine: balanceSentence(partnerName, normalizeMoney(loanSigned + sharedSigned)),
  }
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

/** El cupo de una devolución nueva es el pendiente. Al editarla, vuelve a sumar su monto. */
export function repaymentRoom(pending: number, currentAmount = 0): number {
  return normalizeMoney(pending + currentAmount)
}

/** Un préstamo no es gasto ni ingreso: el mes sigue igual si no se lo pasás. */
export function pocketIgnoresLoans(input: { base: number; privateSpent: number; myShare: number; extras: number }) {
  return monthPocket(input)
}

function asStatus(value: string): LoanStatus {
  if (value === 'parcial' || value === 'saldado' || value === 'pendiente') return value
  return 'pendiente'
}

function mapLoan(row: {
  id: string
  lender_id: string
  borrower_id: string
  amount: number | string
  repaid: number | string
  pending: number | string
  status: string
  lent_on: string
  period: string
  notes: string | null
}): Loan {
  return {
    id: row.id,
    lenderId: row.lender_id,
    borrowerId: row.borrower_id,
    amount: money(row.amount),
    repaid: money(row.repaid),
    pending: money(row.pending),
    status: asStatus(row.status),
    lentOn: row.lent_on,
    period: row.period,
    notes: row.notes,
  }
}

export async function loadLoanBalances(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loan_balances')
    .select('id, lender_id, borrower_id, amount, repaid, pending, status, lent_on, period, notes')
    .order('lent_on', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLoan(row))
}

export async function loadRepayments(loanId: string): Promise<LoanRepayment[]> {
  const { data, error } = await supabase
    .from('loan_repayments')
    .select('id, loan_id, amount, paid_on, period, notes, created_by')
    .eq('loan_id', loanId)
    .order('paid_on', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    loanId: row.loan_id,
    amount: money(row.amount),
    paidOn: row.paid_on,
    period: row.period,
    notes: row.notes,
    createdBy: row.created_by,
  }))
}

export async function saveLoan(input: {
  id?: string
  borrowerId: string
  amount: number
  lentOn: string
  period: string
  notes: string | null
}) {
  const payload = {
    borrower_id: input.borrowerId,
    amount: input.amount,
    lent_on: input.lentOn,
    period: input.period,
    notes: input.notes,
  }
  const { error } = input.id
    ? await supabase.from('loans').update(payload).eq('id', input.id)
    : await supabase.from('loans').insert({ ...payload, lender_id: (await currentUserId()) })
  if (error) throw new Error(error.message)
}

export async function deleteLoan(id: string) {
  const { error } = await supabase.from('loans').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveRepayment(input: {
  id?: string
  loanId: string
  amount: number
  paidOn: string
  period: string
  notes: string | null
}) {
  const payload = {
    amount: input.amount,
    paid_on: input.paidOn,
    period: input.period,
    notes: input.notes,
  }
  const { error } = input.id
    ? await supabase.from('loan_repayments').update(payload).eq('id', input.id)
    : await supabase.from('loan_repayments').insert({ ...payload, loan_id: input.loanId })
  if (error) throw new Error(error.message)
}

export async function deleteRepayment(id: string) {
  const { error } = await supabase.from('loan_repayments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Tenés que entrar para prestar.')
  return data.user.id
}
