import { formatMoney, money, normalizeMoney } from './format.ts'
import { debtSentence, type SplitResult } from './split.ts'
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

export type SettlementPhrases = {
  expenseLine: string
  loanLine: string | null
  totalLine: string
  breakdown: string | null
}

/** Frases del paso 3. Los montos salen del reparto y del saldo de préstamos, sin recalcular. */
export function settlementPhrases(meId: string, result: SplitResult, loanSigned: number): SettlementPhrases {
  const loans = normalizeMoney(loanSigned)
  const partner = result.rows.find((row) => row.id !== meId) ?? null
  const sharedSigned = sharedSignedBalance(meId, result)
  const net = normalizeMoney(sharedSigned + loans)
  const expenseLine = expenseDebtLine(meId, result)
  if (!partner || result.rows.length < 2) {
    return { expenseLine, loanLine: null, totalLine: expenseLine, breakdown: null }
  }
  return {
    expenseLine,
    loanLine: loanPendingLine(loans),
    totalLine: balanceSentence(partner.name, net),
    breakdown: settlementBreakdown(sharedSigned, loans),
  }
}

function expenseDebtLine(meId: string, result: SplitResult): string {
  if (result.rows.length < 2) return debtSentence(meId, result)
  if (result.amount === 0 || !result.debtorId || !result.creditorId) return 'Están a mano'
  const debtor = result.rows.find((row) => row.id === result.debtorId)
  const creditor = result.rows.find((row) => row.id === result.creditorId)
  if (!debtor || !creditor) return 'Están a mano'
  const paid = formatMoney(debtor.paid)
  const share = formatMoney(debtor.share)
  const owed = formatMoney(result.amount)
  if (meId === creditor.id) return `${debtor.name} pagó ${paid} y le tocaba ${share}, así que te debe ${owed}.`
  if (meId === debtor.id) return `Pagaste ${paid} y te tocaba ${share}, así que le debés ${owed} a ${creditor.name}.`
  return `${debtor.name} pagó ${paid} y le tocaba ${share}, así que le debe ${owed} a ${creditor.name}.`
}

function loanPendingLine(loanSigned: number): string | null {
  if (loanSigned === 0) return null
  if (loanSigned > 0) return `Además, tiene préstamos pendientes por ${formatMoney(loanSigned)}.`
  return `Además, tenés préstamos pendientes por ${formatMoney(-loanSigned)}.`
}

function settlementBreakdown(sharedSigned: number, loanSigned: number): string | null {
  if (sharedSigned === 0 || loanSigned === 0) return null
  const sharedAbs = Math.abs(sharedSigned)
  const loanAbs = Math.abs(loanSigned)
  if ((sharedSigned > 0) === (loanSigned > 0)) return `${formatMoney(sharedAbs)} + ${formatMoney(loanAbs)}`
  const [larger, smaller] = sharedAbs >= loanAbs ? [sharedAbs, loanAbs] : [loanAbs, sharedAbs]
  return `${formatMoney(larger)} - ${formatMoney(smaller)}`
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

/** Efecto del mes: prestar resta, recibir suma; devolver hace lo inverso en el período de la devolución. */
export function loanMonthEffect(
  meId: string,
  period: string,
  loans: readonly PeriodLoan[],
  repayments: readonly PeriodRepayment[],
): LoanMonthEffect {
  let given = 0
  let collected = 0
  let received = 0
  let paid = 0
  for (const loan of loans) {
    if (loan.period !== period) continue
    if (loan.lenderId === meId) given += loan.amount
    else if (loan.borrowerId === meId) received += loan.amount
  }
  for (const repayment of repayments) {
    if (repayment.period !== period) continue
    if (repayment.lenderId === meId) collected += repayment.amount
    else if (repayment.borrowerId === meId) paid += repayment.amount
  }
  return {
    given: normalizeMoney(given),
    collected: normalizeMoney(collected),
    received: normalizeMoney(received),
    paid: normalizeMoney(paid),
    net: normalizeMoney(-given + collected + received - paid),
  }
}

export function hasLoanMovement(effect: LoanMonthEffect): boolean {
  return effect.given !== 0 || effect.collected !== 0 || effect.received !== 0 || effect.paid !== 0
}

/** Me queda = ingresos − gastos del mes + neto de préstamos. Ingresos y gastos no se tocan. */
export function remainingAfterLoans(income: number, spent: number, loanNet: number): number {
  return normalizeMoney(income - spent + loanNet)
}

export function formatSignedMoney(value: number): string {
  const amount = normalizeMoney(value)
  if (amount > 0) return `+${formatMoney(amount)}`
  return formatMoney(amount)
}

export function loanEffectLines(effect: LoanMonthEffect): { label: string; amount: number }[] {
  const lines: { label: string; amount: number }[] = []
  if (effect.given !== 0) lines.push({ label: 'Préstamos dados', amount: -effect.given })
  if (effect.collected !== 0) lines.push({ label: 'Devoluciones cobradas', amount: effect.collected })
  if (effect.received !== 0) lines.push({ label: 'Préstamos recibidos', amount: effect.received })
  if (effect.paid !== 0) lines.push({ label: 'Devoluciones pagadas', amount: -effect.paid })
  return lines
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
  lock_month?: string | null
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
    lockMonth: row.lock_month ? String(row.lock_month).slice(0, 10) : null,
  }
}

export async function loadLoanMovements(): Promise<{ loans: PeriodLoan[]; repayments: PeriodRepayment[] }> {
  const [loansResult, repaymentsResult] = await Promise.all([
    supabase.from('loans').select('id, lender_id, borrower_id, amount, period'),
    supabase.from('loan_repayments').select('loan_id, amount, period'),
  ])
  if (loansResult.error) throw new Error(loansResult.error.message)
  if (repaymentsResult.error) throw new Error(repaymentsResult.error.message)
  const parties = new Map((loansResult.data ?? []).map((loan) => [loan.id, { lenderId: loan.lender_id, borrowerId: loan.borrower_id }]))
  return {
    loans: (loansResult.data ?? []).map((loan) => ({
      lenderId: loan.lender_id,
      borrowerId: loan.borrower_id,
      amount: money(loan.amount),
      period: loan.period,
    })),
    repayments: (repaymentsResult.data ?? []).flatMap((repayment) => {
      const loan = parties.get(repayment.loan_id)
      if (!loan) return []
      return [{ ...loan, amount: money(repayment.amount), period: repayment.period }]
    }),
  }
}

export async function loadLoanBalances(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loan_balances')
    .select('id, lender_id, borrower_id, amount, repaid, pending, status, lent_on, period, notes, lock_month')
    .order('lent_on', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLoan(row))
}

export async function loadRepayments(loanId: string): Promise<LoanRepayment[]> {
  const { data, error } = await supabase
    .from('loan_repayments')
    .select('id, loan_id, amount, paid_on, period, notes, created_by, settlement_id')
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
    settlementId: row.settlement_id,
  }))
}

export async function loadSettlementRepayments(settlementId: string): Promise<{ loanId: string; lenderId: string; borrowerId: string; amount: number }[]> {
  const [repayments, loans] = await Promise.all([
    supabase.from('loan_repayments').select('loan_id, amount').eq('settlement_id', settlementId),
    supabase.from('loans').select('id, lender_id, borrower_id'),
  ])
  if (repayments.error) throw new Error(repayments.error.message)
  if (loans.error) throw new Error(loans.error.message)
  const parties = new Map((loans.data ?? []).map((loan) => [loan.id, { lenderId: loan.lender_id, borrowerId: loan.borrower_id }]))
  return (repayments.data ?? []).flatMap((row) => {
    const loan = parties.get(row.loan_id)
    if (!loan) return []
    return [{ loanId: row.loan_id, ...loan, amount: money(row.amount) }]
  })
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
