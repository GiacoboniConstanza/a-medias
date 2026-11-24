import { money } from './format.ts'
import { DEFAULT_ICON } from './icons.ts'
import { amountForMonth, appliesForMonth, type AmountRevision } from './fixed.ts'
import {
  asNumber,
  isFoodSource,
  isMealType,
  normalizeSearch,
  type FoodPortion,
  type FoodSource,
  type MealType,
} from './meals.ts'
import { monthEnd, monthKey } from './month.ts'
import { periodFromDate } from './period.ts'
import { effectiveSalary, visibleSplitNotice, type SalaryPoint } from './salary.ts'
import { sortedTimes, type DailyKind, type ReminderPrefs, DEFAULT_REMINDER_PREFS } from './reminders.ts'
import { supabase } from './supabase.ts'
import { normalizePlanNote, normalizePlanTag, type PartnerPlanStatus, type PlanItem } from './plans.ts'
import { parseYearBalance, type YearReport } from './year.ts'

export type Category = {
  id: string
  name: string
  icon: string
}

export type ExpenseItem = {
  id: string
  title: string | null
  amount: number
  spentOn: string
  period: string
  isShared: boolean
  paidFromBag: boolean
  payerId: string
  ownerId: string
  categoryId: string | null
  notes: string | null
  mpOperationId: string | null
}

export type ExtraItem = {
  id: string
  label: string
  amount: number
  receivedOn: string
  notes: string | null
  mpOperationId: string | null
}

export type FixedPayment = {
  id: string
  paidOn: string
  payerId: string
  amount: number
  expenseId: string | null
}

export type FixedItem = {
  id: string
  title: string
  icon: string
  amount: number
  /** false = «Falta el monto» en el mes visible. */
  hasAmount: boolean
  applies: boolean
  revisions: AmountRevision[]
  dueDay: number
  isShared: boolean
  categoryId: string | null
  ownerId: string | null
  remindDaysBefore: number
  remind: boolean
  pausedAt: string | null
  notes: string | null
  updatedAt: string | null
  updatedBy: string | null
  payment: FixedPayment | null
}

export type SettlementItem = {
  id: string
  amount: number
  expectedAmount: number | null
  settledAt: string
  debtorId: string
  creditorId: string
}

export type SplitNotice = {
  effectiveFrom: string
  myPercent: number
  partnerPercent: number
}

export type SalaryPreview = {
  myOldPercent: number
  myNewPercent: number
  partnerOldPercent: number
  partnerNewPercent: number
  sharedTotal: number
}

export type SavingItem = {
  id: string
  householdId: string
  name: string
  icon: string
  target: number | null
  targetDate: string | null
  isShared: boolean
  ownerId: string | null
  archivedAt: string | null
  openings: { userId: string; amount: number }[]
}

export type SavingMove = {
  id: string
  savingId: string
  householdId: string
  userId: string
  kind: 'aporte' | 'retiro'
  amount: number
  spentOn: string
  period: string
  title: string | null
  notes: string | null
}

export type FinanceData = {
  inviteCode: string
  names: Record<string, string>
  bases: Record<string, number>
  splitPercents: Record<string, number>
  splitEven: boolean
  salaryHistory: SalaryPoint[]
  splitNotice: SplitNotice | null
  categories: Category[]
  monthExpenses: ExpenseItem[]
  lastLoggedOn: string | null
  extrasThisMonth: ExtraItem[]
  savings: SavingItem[]
  savingMoves: SavingMove[]
  fixed: FixedItem[]
  settlement: SettlementItem | null
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export async function loadFinance(householdId: string, userId: string, month: string): Promise<FinanceData> {
  const [
    household,
    profiles,
    salaries,
    percents,
    evenSplit,
    notices,
    extras,
    categories,
    monthExpenses,
    lastExpense,
    fixedExpenses,
    fixedAmounts,
    fixedClears,
    fixedPayments,
    settlement,
    savings,
    savingMoves,
  ] = await Promise.all([
    supabase.from('households').select('invite_code').eq('id', householdId).single(),
    supabase.from('profiles').select('id, display_name').eq('household_id', householdId),
    supabase
      .from('base_salaries')
      .select('id, amount, effective_from, created_at, label')
      .eq('user_id', userId)
      .order('effective_from', { ascending: false }),
    supabase.rpc('household_split_percents', { target_month: month }),
    supabase.rpc('household_split_is_even', { target_month: month }),
    supabase.from('split_notices').select('effective_from, recipient_percent, partner_percent, created_at'),
    supabase.from('income_extras').select('id, amount, label, received_on, notes, mp_operation_id').eq('user_id', userId),
    supabase.from('categories').select('id, name, icon').eq('household_id', householdId).order('name', { ascending: true }),
    supabase
      .from('expenses')
      .select('id, title, amount, spent_on, period, is_shared, paid_from_bag, payer_id, owner_id, category_id, notes, mp_operation_id')
      .eq('period', month)
      .order('spent_on', { ascending: true }),
    supabase
      .from('expenses')
      .select('spent_on')
      .eq('owner_id', userId)
      .eq('paid_from_bag', false)
      .order('spent_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('fixed_expenses')
      .select('id, title, icon, expected_amount, due_day, is_shared, category_id, owner_id, remind_days_before, remind, paused_at, notes, updated_at, updated_by')
      .eq('household_id', householdId)
      .order('due_day', { ascending: true }),
    supabase.from('fixed_expense_amounts').select('fixed_expense_id, amount, effective_from'),
    supabase
      .from('fixed_expense_month_clears')
      .select('fixed_expense_id, month')
      .eq('month', month),
    supabase.from('fixed_payments').select('id, fixed_expense_id, paid_on, payer_id, amount, expense_id').eq('month', month),
    supabase
      .from('settlements')
      .select('id, amount, expected_amount, settled_at, debtor_id, creditor_id')
      .eq('household_id', householdId)
      .eq('month', month)
      .maybeSingle(),
    loadSavings(householdId),
    loadSavingMovesForHousehold(householdId),
  ])

  fail(household.error)
  fail(profiles.error)
  fail(salaries.error)
  fail(percents.error)
  fail(evenSplit.error)
  fail(notices.error)
  fail(extras.error)
  fail(categories.error)
  fail(monthExpenses.error)
  fail(lastExpense.error)
  fail(fixedExpenses.error)
  fail(fixedAmounts.error)
  fail(fixedClears.error)
  fail(fixedPayments.error)
  fail(settlement.error)

  const names: Record<string, string> = {}
  for (const profile of profiles.data ?? []) names[profile.id] = profile.display_name

  const salaryHistory: SalaryPoint[] = (salaries.data ?? []).map((row) => ({
    id: row.id,
    amount: money(row.amount),
    effectiveFrom: row.effective_from.slice(0, 10),
    createdAt: row.created_at,
    label: row.label ?? null,
  }))
  const bases: Record<string, number> = {
    [userId]: effectiveSalary(salaryHistory, month),
  }
  const splitPercents: Record<string, number> = {}
  for (const row of percents.data ?? []) splitPercents[row.user_id] = row.percent
  const noticeRow = visibleSplitNotice(
    (notices.data ?? []).map((row) => ({
      effectiveFrom: row.effective_from.slice(0, 10),
      createdAt: row.created_at,
      myPercent: row.recipient_percent,
      partnerPercent: row.partner_percent,
    })),
    monthKey(),
  )
  const splitNotice: SplitNotice | null = noticeRow
    ? {
        effectiveFrom: noticeRow.effectiveFrom,
        myPercent: noticeRow.myPercent,
        partnerPercent: noticeRow.partnerPercent,
      }
    : null

  const end = monthEnd(month)
  const extrasThisMonth: ExtraItem[] = (extras.data ?? [])
    .filter((extra) => extra.received_on >= month && extra.received_on <= end)
    .sort((a, b) => b.received_on.localeCompare(a.received_on))
    .map((extra) => ({
      id: extra.id,
      label: extra.label,
      amount: money(extra.amount),
      receivedOn: extra.received_on,
      notes: extra.notes,
      mpOperationId: extra.mp_operation_id ?? null,
    }))

  const paymentByFixed = new Map((fixedPayments.data ?? []).map((payment) => [payment.fixed_expense_id, payment]))
  const revisionsByFixed = new Map<string, AmountRevision[]>()
  for (const revision of fixedAmounts.data ?? []) {
    const list = revisionsByFixed.get(revision.fixed_expense_id) ?? []
    list.push({ effectiveFrom: revision.effective_from.slice(0, 10), amount: money(revision.amount) })
    revisionsByFixed.set(revision.fixed_expense_id, list)
  }
  const clearedByFixed = new Map<string, Set<string>>()
  for (const row of fixedClears.data ?? []) {
    const set = clearedByFixed.get(row.fixed_expense_id) ?? new Set<string>()
    set.add(row.month.slice(0, 10))
    clearedByFixed.set(row.fixed_expense_id, set)
  }

  return {
    inviteCode: household.data.invite_code,
    names,
    bases,
    splitPercents,
    splitEven: evenSplit.data ?? false,
    salaryHistory,
    splitNotice,
    categories: (categories.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon || DEFAULT_ICON,
    })),
    monthExpenses: withoutBagExpenses((monthExpenses.data ?? []).map(mapExpense)),
    lastLoggedOn: lastExpense.data?.spent_on ?? null,
    extrasThisMonth,
    savings,
    savingMoves,
    fixed: (fixedExpenses.data ?? []).map((expense) => {
      const payment = paymentByFixed.get(expense.id)
      const revisions = revisionsByFixed.get(expense.id) ?? []
      const cleared = clearedByFixed.get(expense.id) ?? new Set<string>()
      const resolved = amountForMonth(revisions, month, cleared)
      const hasAmount = resolved !== null
      return {
        id: expense.id,
        title: expense.title,
        icon: expense.icon || DEFAULT_ICON,
        amount: resolved ?? 0,
        hasAmount,
        applies: appliesForMonth(revisions, month, cleared),
        revisions,
        dueDay: expense.due_day,
        isShared: expense.is_shared,
        categoryId: expense.category_id,
        ownerId: expense.owner_id,
        remindDaysBefore: expense.remind_days_before,
        remind: expense.remind,
        pausedAt: expense.paused_at,
        notes: expense.notes,
        updatedAt: expense.updated_at,
        updatedBy: expense.updated_by,
        payment: payment
          ? {
              id: payment.id,
              paidOn: payment.paid_on,
              payerId: payment.payer_id,
              amount: money(payment.amount),
              expenseId: payment.expense_id,
            }
          : null,
      }
    }),
    settlement: settlement.data
      ? {
          id: settlement.data.id,
          amount: money(settlement.data.amount),
          expectedAmount:
            settlement.data.expected_amount == null ? null : money(settlement.data.expected_amount),
          settledAt: settlement.data.settled_at,
          debtorId: settlement.data.debtor_id,
          creditorId: settlement.data.creditor_id,
        }
      : null,
  }
}

const EXPENSE_COLUMNS = 'id, title, amount, spent_on, period, is_shared, paid_from_bag, payer_id, owner_id, category_id, notes, created_at, mp_operation_id'


function mapExpense(expense: {
  id: string
  title: string | null
  amount: number
  spent_on: string
  period: string
  is_shared: boolean
  paid_from_bag: boolean
  payer_id: string
  owner_id: string
  category_id: string | null
  notes: string | null
  mp_operation_id?: string | null
}): ExpenseItem {
  return {
    id: expense.id,
    title: expense.title,
    amount: money(expense.amount),
    spentOn: expense.spent_on,
    period: expense.period.slice(0, 10),
    isShared: expense.is_shared,
    paidFromBag: expense.paid_from_bag,
    payerId: expense.payer_id,
    ownerId: expense.owner_id,
    categoryId: expense.category_id,
    notes: expense.notes,
    mpOperationId: expense.mp_operation_id ?? null,
  }
}

/** Los gastos viejos de la bolsa no cuentan en Movimientos, Te quedan ni totales. */
export function withoutBagExpenses(items: readonly ExpenseItem[]): ExpenseItem[] {
  return items.filter((item) => !item.paidFromBag)
}

export async function loadSettledMonths(): Promise<string[]> {
  const { data, error } = await supabase.from('settlements').select('month')
  fail(error)
  return (data ?? []).map((row) => String(row.month).slice(0, 10))
}

export async function loadCategoryYearExpenses(categoryId: string, year: number): Promise<ExpenseItem[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_COLUMNS)
    .eq('category_id', categoryId)
    .gte('period', `${year}-01-01`)
    .lt('period', `${year + 1}-01-01`)
    .order('spent_on', { ascending: true })
    .order('created_at', { ascending: true })
  fail(error)
  return withoutBagExpenses((data ?? []).map(mapExpense))
}


export type HouseholdSplitSetting = {
  mode: 'proportional' | 'even' | 'manual'
  percentByUser: Record<string, number>
  effectiveFrom: string | null
}

export async function loadHouseholdSplitSetting(month: string): Promise<HouseholdSplitSetting> {
  const { data, error } = await supabase.rpc('household_split_setting', { target_month: month })
  fail(error)
  const row = data?.[0]
  if (!row?.mode) {
    return { mode: 'proportional', percentByUser: {}, effectiveFrom: null }
  }
  const raw = (row.percent_by_user ?? {}) as Record<string, number>
  const percentByUser: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw)) percentByUser[id] = Number(value)
  return {
    mode: row.mode as HouseholdSplitSetting['mode'],
    percentByUser,
    effectiveFrom: row.effective_from ? String(row.effective_from).slice(0, 10) : null,
  }
}

export async function saveHouseholdSplitSetting(input: {
  mode: 'proportional' | 'even' | 'manual'
  myPercent?: number
  effectiveFrom?: string
}): Promise<void> {
  const { error } = await supabase.rpc('save_household_split_setting', {
    p_mode: input.mode,
    p_my_percent: input.myPercent ?? null,
    p_effective_from: input.effectiveFrom ?? null,
  })
  fail(error)
}

export async function loadHouseholdSalaries(householdId: string): Promise<Record<string, SalaryPoint[]>> {
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id').eq('household_id', householdId)
  fail(profileError)
  const ids = (profiles ?? []).map((row) => row.id)
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('base_salaries')
    .select('id, user_id, amount, effective_from, created_at, label')
    .in('user_id', ids)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: true })
  fail(error)
  const byUser: Record<string, SalaryPoint[]> = {}
  for (const id of ids) byUser[id] = []
  for (const row of data ?? []) {
    const point: SalaryPoint = {
      id: row.id,
      amount: money(row.amount),
      effectiveFrom: row.effective_from.slice(0, 10),
      createdAt: row.created_at,
      label: row.label ?? null,
    }
    byUser[row.user_id].push(point)
  }
  return byUser
}

export async function saveSalaryRevision(input: {
  id: string | null
  userId: string
  amount: number
  effectiveFrom: string
  label?: string | null
}): Promise<void> {
  const label = input.label?.trim() || null
  if (input.id) {
    const { error } = await supabase
      .from('base_salaries')
      .update({ amount: input.amount, effective_from: input.effectiveFrom, label })
      .eq('id', input.id)
    fail(error)
    return
  }
  const { error } = await supabase.from('base_salaries').insert({
    user_id: input.userId,
    amount: input.amount,
    effective_from: input.effectiveFrom,
    label,
  })
  fail(error)
}

export async function deleteSalaryRevision(id: string): Promise<void> {
  const { error } = await supabase.from('base_salaries').delete().eq('id', id)
  fail(error)
}

export async function previewSalarySplit(input: {
  amount: number
  effectiveFrom: string
  replacing: boolean
}): Promise<SalaryPreview> {
  const { data, error } = await supabase.rpc('preview_salary_split', {
    new_amount: input.amount,
    effective_from: input.effectiveFrom,
    replacing: input.replacing,
  })
  fail(error)
  const row = data?.[0]
  if (!row) throw new Error('No pude calcular el reparto.')
  return {
    myOldPercent: row.my_old_percent,
    myNewPercent: row.my_new_percent,
    partnerOldPercent: row.partner_old_percent,
    partnerNewPercent: row.partner_new_percent,
    sharedTotal: money(row.shared_total),
  }
}

export async function createCategory(input: {
  householdId: string
  name: string
  icon: string
}): Promise<string> {
  const name = input.name.trim().slice(0, 24)
  if (!name) throw new Error('Escribí un nombre.')
  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: input.householdId,
      name,
      icon: input.icon,
      emoji: input.icon,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Ya hay una con ese nombre.')
    throw new Error(error.message)
  }
  return data.id
}

export async function updateCategory(input: {
  id: string
  name: string
  icon: string
}): Promise<void> {
  const name = input.name.trim().slice(0, 24)
  if (!name) throw new Error('Escribí un nombre.')
  const { error } = await supabase
    .from('categories')
    .update({ name, icon: input.icon, emoji: input.icon })
    .eq('id', input.id)
  if (error) {
    if (error.code === '23505') throw new Error('Ya hay una con ese nombre.')
    throw new Error(error.message)
  }
}

export async function deleteCategory(id: string, moveTo: string | null): Promise<void> {
  const { error } = await supabase.rpc('delete_category', { p_id: id, p_move_to: moveTo })
  fail(error)
}

export type CategoryUsageRow = { categoryId: string; uses: number; hasLinks: boolean }

export async function loadCategoryUsage(): Promise<CategoryUsageRow[]> {
  const { data, error } = await supabase.rpc('category_usage')
  fail(error)
  return (data ?? []).map((row) => ({
    categoryId: row.category_id,
    uses: Number(row.uses),
    hasLinks: Boolean(row.has_links),
  }))
}

function optionalTitle(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

export async function createExpense(input: {
  householdId: string
  ownerId: string
  payerId: string
  categoryId: string | null
  title: string | null
  amount: number
  spentOn: string
  period: string
  isShared: boolean
  notes: string | null
}): Promise<string> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      household_id: input.householdId,
      owner_id: input.ownerId,
      payer_id: input.payerId,
      category_id: input.categoryId,
      title: optionalTitle(input.title),
      amount: input.amount,
      spent_on: input.spentOn,
      period: input.period,
      is_shared: input.isShared,
      notes: input.notes,
    })
    .select('id')
    .single()
  fail(error)
  return data.id
}

export async function updateExpense(input: {
  id: string
  payerId: string
  categoryId: string | null
  title: string | null
  amount: number
  spentOn: string
  period: string
  isShared: boolean
  notes: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      payer_id: input.payerId,
      category_id: input.categoryId,
      title: optionalTitle(input.title),
      amount: input.amount,
      spent_on: input.spentOn,
      period: input.period,
      is_shared: input.isShared,
      notes: input.notes,
    })
    .eq('id', input.id)
  fail(error)
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  fail(error)
}

export async function deleteExtra(id: string): Promise<void> {
  const { error } = await supabase.from('income_extras').delete().eq('id', id)
  fail(error)
}

export async function deleteMovements(input: {
  month: string
  expenseIds?: readonly string[]
  extraIds?: readonly string[]
  transferIds?: readonly string[]
  savingMoveIds?: readonly string[]
}): Promise<{ deleted: number }> {
  const { data, error } = await supabase.rpc('delete_movements', {
    p_month: input.month.slice(0, 10),
    expense_ids: [...(input.expenseIds ?? [])],
    extra_ids: [...(input.extraIds ?? [])],
    transfer_ids: [...(input.transferIds ?? [])],
    saving_move_ids: [...(input.savingMoveIds ?? [])],
  })
  fail(error)
  const payload = (data ?? {}) as { deleted?: number }
  return { deleted: Number(payload.deleted ?? 0) }
}

export async function createExtra(input: {
  userId: string
  householdId: string
  label: string
  amount: number
  receivedOn: string
  notes: string | null
}): Promise<void> {
  const { error } = await supabase.from('income_extras').insert({
    user_id: input.userId,
    household_id: input.householdId,
    label: input.label.trim(),
    amount: input.amount,
    received_on: input.receivedOn,
    notes: input.notes,
  })
  fail(error)
}

export async function settleMonth(input: {
  month: string
  debtorId: string
  creditorId: string
  amount: number
  expenseAmount: number
  expenseDebtorId: string | null
  registerTransfer?: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('settle_shared_month', {
    p_month: input.month,
    p_debtor: input.debtorId,
    p_creditor: input.creditorId,
    p_amount: input.amount,
    p_expense_amount: input.expenseAmount,
    p_expense_debtor: input.expenseDebtorId,
    p_register_transfer: input.registerTransfer ?? true,
  })
  fail(error)
}

export async function undoSettlement(id: string): Promise<void> {
  const { error } = await supabase.rpc('undo_shared_month', { p_settlement: id })
  fail(error)
}

export async function createFixedExpense(input: {
  householdId: string
  ownerId: string | null
  categoryId: string | null
  title: string
  icon: string
  amount: number
  dueDay: number
  isShared: boolean
  remindDaysBefore: number
  remind: boolean
  notes: string | null
  effectiveFrom: string
  createdBy: string
}): Promise<void> {
  const created = await supabase
    .from('fixed_expenses')
    .insert({
      household_id: input.householdId,
      owner_id: input.ownerId,
      category_id: input.categoryId,
      title: input.title.trim(),
      icon: input.icon,
      emoji: input.icon,
      expected_amount: input.amount,
      due_day: input.dueDay,
      is_shared: input.isShared,
      remind_days_before: input.remindDaysBefore,
      remind: input.remind,
      notes: input.notes,
    })
    .select('id')
    .single()
  fail(created.error)
  const revision = await supabase.from('fixed_expense_amounts').insert({
    fixed_expense_id: created.data.id,
    amount: input.amount,
    effective_from: input.effectiveFrom,
    created_by: input.createdBy,
  })
  if (revision.error) {
    await supabase.from('fixed_expenses').delete().eq('id', created.data.id)
    fail(revision.error)
  }
}

export async function updateFixedExpense(input: {
  id: string
  ownerId: string | null
  categoryId: string | null
  title: string
  icon: string
  dueDay: number
  isShared: boolean
  remindDaysBefore: number
  remind: boolean
  notes: string | null
  expectedAmount: number
  updatedBy: string
  revision: { amount: number; effectiveFrom: string; createdBy: string } | null
}): Promise<void> {
  const { error } = await supabase
    .from('fixed_expenses')
    .update({
      owner_id: input.ownerId,
      category_id: input.categoryId,
      title: input.title.trim(),
      icon: input.icon,
      emoji: input.icon,
      due_day: input.dueDay,
      is_shared: input.isShared,
      remind_days_before: input.remindDaysBefore,
      remind: input.remind,
      notes: input.notes,
      expected_amount: input.expectedAmount,
      updated_by: input.updatedBy,
    })
    .eq('id', input.id)
  fail(error)
  if (!input.revision) return
  const revision = await supabase.from('fixed_expense_amounts').upsert(
    {
      fixed_expense_id: input.id,
      amount: input.revision.amount,
      effective_from: input.revision.effectiveFrom,
      created_by: input.revision.createdBy,
    },
    { onConflict: 'fixed_expense_id,effective_from' },
  )
  fail(revision.error)
}

export async function setFixedExpensePaused(id: string, paused: boolean, userId: string): Promise<void> {
  const { error } = await supabase
    .from('fixed_expenses')
    .update({
      paused_at: paused ? new Date().toISOString() : null,
      updated_by: userId,
    })
    .eq('id', id)
  fail(error)
}

export async function deleteFixedExpense(id: string): Promise<void> {
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
  fail(error)
}

export async function loadReminderPreferences(userId: string): Promise<ReminderPrefs> {
  const { data, error } = await supabase
    .from('reminder_preferences')
    .select(
      'enabled, first_time, second_time, ask_times, due_lead_days, notify_shared, sunday_summary, silence_enabled, budget_enabled, push_enabled, reviewed_on, hidden_until',
    )
    .eq('user_id', userId)
    .maybeSingle()
  fail(error)
  if (!data) return { ...DEFAULT_REMINDER_PREFS, times: [...DEFAULT_REMINDER_PREFS.times] }
  const times = sortedTimes(data.ask_times?.length ? data.ask_times : [data.first_time, data.second_time])
  return {
    enabled: data.enabled,
    times: times.length > 0 ? times : [...DEFAULT_REMINDER_PREFS.times],
    reviewedOn: data.reviewed_on?.slice(0, 10) ?? null,
    hiddenUntil: data.hidden_until,
    dueLeadDays: data.due_lead_days,
    notifyShared: data.notify_shared,
    sundaySummary: data.sunday_summary,
    silenceEnabled: data.silence_enabled ?? true,
    budgetEnabled: data.budget_enabled ?? true,
    pushEnabled: data.push_enabled,
  }
}

export async function saveReminderPreferences(userId: string, prefs: ReminderPrefs): Promise<void> {
  const times = sortedTimes(prefs.times)
  const first = times[0] ?? DEFAULT_REMINDER_PREFS.times[0] ?? '14:00'
  const last = times[times.length - 1] ?? first
  const { error } = await supabase.from('reminder_preferences').upsert(
    {
      user_id: userId,
      enabled: prefs.enabled,
      first_time: first,
      second_time: last,
      ask_times: times.length > 0 ? times : [first],
      due_lead_days: prefs.dueLeadDays,
      notify_shared: prefs.notifyShared,
      sunday_summary: prefs.sundaySummary,
      silence_enabled: prefs.silenceEnabled,
      budget_enabled: prefs.budgetEnabled,
      push_enabled: prefs.pushEnabled,
      reviewed_on: prefs.reviewedOn,
      hidden_until: prefs.hiddenUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  fail(error)
}

export type BudgetCap = {
  categoryId: string
  amount: number
}

/** Topes vigentes en el mes (sin filas con amount null). */
export async function loadBudgets(userId: string, month: string): Promise<BudgetCap[]> {
  const { data, error } = await supabase
    .from('category_budgets')
    .select('category_id, amount, effective_from')
    .eq('user_id', userId)
    .lte('effective_from', month)
    .order('effective_from', { ascending: false })
  fail(error)
  const latest = new Map<string, number | null>()
  for (const row of data ?? []) {
    if (latest.has(row.category_id)) continue
    latest.set(row.category_id, row.amount == null ? null : money(row.amount))
  }
  return [...latest.entries()]
    .filter((entry): entry is [string, number] => entry[1] != null && entry[1] > 0)
    .map(([categoryId, amount]) => ({ categoryId, amount }))
}

export async function saveBudget(
  userId: string,
  input: { categoryId: string; amount: number },
): Promise<void> {
  const effectiveFrom = monthKey()
  const { data: existing, error: readError } = await supabase
    .from('category_budgets')
    .select('id')
    .eq('user_id', userId)
    .eq('category_id', input.categoryId)
    .eq('effective_from', effectiveFrom)
    .maybeSingle()
  fail(readError)
  if (existing) {
    const { error } = await supabase
      .from('category_budgets')
      .update({ amount: input.amount })
      .eq('id', existing.id)
    fail(error)
    return
  }
  const { error } = await supabase.from('category_budgets').insert({
    user_id: userId,
    category_id: input.categoryId,
    amount: input.amount,
    effective_from: effectiveFrom,
  })
  fail(error)
}

export async function removeBudget(userId: string, categoryId: string): Promise<void> {
  const effectiveFrom = monthKey()
  const { data: existing, error: readError } = await supabase
    .from('category_budgets')
    .select('id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('effective_from', effectiveFrom)
    .maybeSingle()
  fail(readError)
  if (existing) {
    const { error } = await supabase
      .from('category_budgets')
      .update({ amount: null })
      .eq('id', existing.id)
    fail(error)
    return
  }
  const { error } = await supabase.from('category_budgets').insert({
    user_id: userId,
    category_id: categoryId,
    amount: null,
    effective_from: effectiveFrom,
  })
  fail(error)
}

export async function loadDailyStatuses(userId: string, since: string): Promise<{ day: string; kind: DailyKind }[]> {
  const { data, error } = await supabase
    .from('daily_statuses')
    .select('day, kind')
    .eq('user_id', userId)
    .gte('day', since)
    .order('day', { ascending: false })
  fail(error)
  return (data ?? []).map((row) => ({
    day: row.day.slice(0, 10),
    kind: row.kind === 'clear' ? 'clear' : 'logged',
  }))
}

export async function markDayClear(userId: string, day: string): Promise<void> {
  const existing = await supabase.from('daily_statuses').select('kind').eq('user_id', userId).eq('day', day).maybeSingle()
  fail(existing.error)
  if (existing.data?.kind === 'logged') return
  const { error } = await supabase.from('daily_statuses').upsert(
    {
      user_id: userId,
      day,
      kind: 'clear',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,day' },
  )
  fail(error)
}

export async function markFixedPaid(input: {
  fixed: FixedItem
  householdId: string
  ownerId: string
  payerId: string
  month: string
  paidOn: string
  categoryId: string | null
}): Promise<void> {
  const expenseId = await createExpense({
    householdId: input.householdId,
    ownerId: input.ownerId,
    payerId: input.payerId,
    categoryId: input.categoryId,
    title: input.fixed.title,
    amount: input.fixed.amount,
    spentOn: input.paidOn,
    period: periodFromDate(input.paidOn),
    isShared: input.fixed.isShared,
    notes: input.fixed.notes,
  })
  const { error } = await supabase.from('fixed_payments').insert({
    fixed_expense_id: input.fixed.id,
    month: input.month,
    paid_on: input.paidOn,
    payer_id: input.payerId,
    amount: input.fixed.amount,
    expense_id: expenseId,
  })
  fail(error)
}

export async function loadYearBalance(year: number): Promise<YearReport> {
  const { data, error } = await supabase.rpc('year_balance', { target_year: year })
  fail(error)
  return parseYearBalance(data)
}

function mapSaving(
  row: {
    id: string
    household_id: string
    name: string
    icon: string
    target_amount: number | null
    target_date: string | null
    is_shared: boolean
    owner_id: string | null
    archived_at: string | null
  },
  openings: { user_id: string; amount: number }[],
): SavingItem {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    icon: row.icon || DEFAULT_ICON,
    target: row.target_amount == null ? null : money(row.target_amount),
    targetDate: row.target_date,
    isShared: row.is_shared,
    ownerId: row.owner_id,
    archivedAt: row.archived_at,
    openings: openings.map((opening) => ({
      userId: opening.user_id,
      amount: money(opening.amount),
    })),
  }
}

function mapSavingMove(row: {
  id: string
  saving_id: string
  household_id: string
  user_id: string
  kind: 'aporte' | 'retiro'
  amount: number
  spent_on: string
  period: string
  title: string | null
  notes: string | null
}): SavingMove {
  return {
    id: row.id,
    savingId: row.saving_id,
    householdId: row.household_id,
    userId: row.user_id,
    kind: row.kind,
    amount: money(row.amount),
    spentOn: row.spent_on,
    period: row.period,
    title: row.title,
    notes: row.notes,
  }
}

export async function loadSavings(householdId: string): Promise<SavingItem[]> {
  const [savings, openings] = await Promise.all([
    supabase
      .from('savings')
      .select('id, household_id, name, icon, target_amount, target_date, is_shared, owner_id, archived_at')
      .eq('household_id', householdId)
      .order('created_at'),
    supabase.from('saving_opening_balances').select('saving_id, user_id, amount'),
  ])
  fail(savings.error)
  fail(openings.error)
  const bySaving = new Map<string, { user_id: string; amount: number }[]>()
  for (const opening of openings.data ?? []) {
    const list = bySaving.get(opening.saving_id) ?? []
    list.push(opening)
    bySaving.set(opening.saving_id, list)
  }
  return (savings.data ?? []).map((row) => mapSaving(row, bySaving.get(row.id) ?? []))
}

export async function loadSavingMoves(savingId: string): Promise<SavingMove[]> {
  const { data, error } = await supabase
    .from('saving_moves')
    .select('id, saving_id, household_id, user_id, kind, amount, spent_on, period, title, notes')
    .eq('saving_id', savingId)
    .order('spent_on', { ascending: false })
  fail(error)
  return (data ?? []).map(mapSavingMove)
}

export async function loadSavingMovesForHousehold(householdId: string): Promise<SavingMove[]> {
  const { data, error } = await supabase
    .from('saving_moves')
    .select('id, saving_id, household_id, user_id, kind, amount, spent_on, period, title, notes')
    .eq('household_id', householdId)
    .order('spent_on', { ascending: false })
  fail(error)
  return (data ?? []).map(mapSavingMove)
}

export async function createSaving(input: {
  householdId: string
  name: string
  icon: string
  target: number | null
  targetDate: string | null
  isShared: boolean
  ownerId: string | null
}): Promise<string> {
  const { data, error } = await supabase
    .from('savings')
    .insert({
      household_id: input.householdId,
      name: input.name.trim(),
      emoji: input.icon,
      icon: input.icon,
      target_amount: input.target,
      target_date: input.targetDate,
      is_shared: input.isShared,
      owner_id: input.isShared ? null : input.ownerId,
    })
    .select('id')
    .single()
  fail(error)
  return data.id
}

export async function updateSaving(input: {
  id: string
  name: string
  icon: string
  target: number | null
  targetDate: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('savings')
    .update({
      name: input.name.trim(),
      emoji: input.icon,
      icon: input.icon,
      target_amount: input.target,
      target_date: input.targetDate,
    })
    .eq('id', input.id)
  fail(error)
}

export async function setSavingArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('savings')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  fail(error)
}

export async function createSavingMove(input: {
  savingId: string
  householdId: string
  userId: string
  kind: 'aporte' | 'retiro'
  amount: number
  spentOn: string
  period: string
  title: string | null
  notes: string | null
}): Promise<string> {
  const { data, error } = await supabase
    .from('saving_moves')
    .insert({
      saving_id: input.savingId,
      household_id: input.householdId,
      user_id: input.userId,
      kind: input.kind,
      amount: input.amount,
      spent_on: input.spentOn,
      period: input.period,
      title: optionalTitle(input.title),
      notes: input.notes,
    })
    .select('id')
    .single()
  fail(error)
  return data.id
}

export async function updateSavingMove(input: {
  id: string
  savingId: string
  amount: number
  spentOn: string
  period: string
  title: string | null
  notes: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('saving_moves')
    .update({
      saving_id: input.savingId,
      amount: input.amount,
      spent_on: input.spentOn,
      period: input.period,
      title: optionalTitle(input.title),
      notes: input.notes,
    })
    .eq('id', input.id)
  fail(error)
}

export async function deleteSavingMove(id: string): Promise<void> {
  const { error } = await supabase.from('saving_moves').delete().eq('id', id)
  fail(error)
}

export async function clearFixedAmountsForMonth(month: string): Promise<number> {
  const { data, error } = await supabase.rpc('clear_fixed_amounts_for_month', { p_month: month })
  fail(error)
  return typeof data === 'number' ? data : Number(data ?? 0)
}

export async function undoFixedPayment(payment: FixedPayment): Promise<void> {
  if (payment.expenseId) {
    const removed = await supabase.from('expenses').delete().eq('id', payment.expenseId)
    fail(removed.error)
  }
  const { error } = await supabase.from('fixed_payments').delete().eq('id', payment.id)
  fail(error)
}

export type MpImportRow = {
  type: 'expense' | 'income' | 'transfer' | 'credito_mp'
  date: string
  amount: number
  title: string
  categoryId: string | null
  isShared: boolean
  mpOperationId: string
  transferDirection?: 'sent' | 'received' | null
}

export type MpImportResult = {
  inserted: number
  skipped: number
}

export type MpCounterpartAlias = {
  normalizedName: string
  /** null = "no es la compañera". */
  userId: string | null
}

export type MpMerchantPrefRow = {
  merchantKey: string
  categoryId: string | null
  isShared: boolean
  title: string | null
}

/** Llama a import_mp_movements con las filas tildadas y opcionales alias/prefs. */
export async function importMpMovements(input: {
  rows: readonly MpImportRow[]
  aliases?: readonly MpCounterpartAlias[]
  merchantPrefs?: readonly MpMerchantPrefRow[]
  createCreditoMp?: boolean
}): Promise<MpImportResult> {
  const { data, error } = await supabase.rpc('import_mp_movements', {
    rows: input.rows.map((row) => ({
      type: row.type,
      date: row.date,
      amount: row.amount,
      title: row.title,
      category_id: row.categoryId,
      is_shared: row.isShared,
      mp_operation_id: row.mpOperationId,
      transfer_direction: row.transferDirection ?? null,
    })),
    aliases: (input.aliases ?? []).map((alias) => ({
      normalized_name: alias.normalizedName,
      user_id: alias.userId,
    })),
    merchant_prefs: (input.merchantPrefs ?? []).map((pref) => ({
      merchant_key: pref.merchantKey,
      category_id: pref.categoryId,
      is_shared: pref.isShared,
      title: pref.title,
    })),
    create_credito_mp: Boolean(input.createCreditoMp),
  })
  fail(error)
  const payload = (data ?? {}) as { inserted?: number; skipped?: number }
  return {
    inserted: Number(payload.inserted ?? 0),
    skipped: Number(payload.skipped ?? 0),
  }
}

export async function loadMpCounterpartAliases(): Promise<MpCounterpartAlias[]> {
  const { data, error } = await supabase
    .from('mp_counterpart_aliases')
    .select('normalized_name, user_id')
  fail(error)
  return (data ?? []).map((row) => ({
    normalizedName: row.normalized_name,
    userId: row.user_id,
  }))
}

export async function loadMpMerchantPrefs(): Promise<MpMerchantPrefRow[]> {
  const { data, error } = await supabase
    .from('mp_merchant_prefs')
    .select('merchant_key, category_id, is_shared, title')
  fail(error)
  return (data ?? []).map((row) => ({
    merchantKey: row.merchant_key,
    categoryId: row.category_id,
    isShared: row.is_shared,
    title: row.title ?? null,
  }))
}

export type MpImportedRecordRow = {
  operationId: string
  kind: 'expense' | 'income' | 'transfer'
  title: string
  categoryId: string | null
  categoryName: string | null
  isShared: boolean
  date: string
}

/** Movimientos ya importados (con tipo/categoría/compartido) en el rango de fechas. */
export async function loadMpImportedIds(
  fromDate: string,
  toDate: string,
): Promise<Map<string, MpImportedRecordRow>> {
  const [expenses, extras, transfers, categories] = await Promise.all([
    supabase
      .from('expenses')
      .select('mp_operation_id, title, category_id, is_shared, spent_on')
      .not('mp_operation_id', 'is', null)
      .gte('spent_on', fromDate)
      .lte('spent_on', toDate),
    supabase
      .from('income_extras')
      .select('mp_operation_id, label, received_on')
      .not('mp_operation_id', 'is', null)
      .gte('received_on', fromDate)
      .lte('received_on', toDate),
    supabase
      .from('transfers')
      .select('mp_operation_id, transferred_on')
      .not('mp_operation_id', 'is', null)
      .gte('transferred_on', fromDate)
      .lte('transferred_on', toDate),
    supabase.from('categories').select('id, name'),
  ])
  fail(expenses.error)
  fail(extras.error)
  fail(transfers.error)
  fail(categories.error)
  const catNames = new Map((categories.data ?? []).map((row) => [row.id, row.name]))
  const map = new Map<string, MpImportedRecordRow>()
  for (const row of expenses.data ?? []) {
    if (!row.mp_operation_id) continue
    map.set(row.mp_operation_id, {
      operationId: row.mp_operation_id,
      kind: 'expense',
      title: row.title ?? '',
      categoryId: row.category_id,
      categoryName: row.category_id ? (catNames.get(row.category_id) ?? null) : null,
      isShared: row.is_shared,
      date: row.spent_on,
    })
  }
  for (const row of extras.data ?? []) {
    if (!row.mp_operation_id) continue
    map.set(row.mp_operation_id, {
      operationId: row.mp_operation_id,
      kind: 'income',
      title: row.label,
      categoryId: null,
      categoryName: null,
      isShared: false,
      date: row.received_on,
    })
  }
  for (const row of transfers.data ?? []) {
    if (!row.mp_operation_id) continue
    map.set(row.mp_operation_id, {
      operationId: row.mp_operation_id,
      kind: 'transfer',
      title: 'Transferencia',
      categoryId: null,
      categoryName: null,
      isShared: false,
      date: row.transferred_on,
    })
  }
  return map
}

export async function loadMpCreditoFixedExists(): Promise<boolean> {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('id')
    .eq('mp_source', 'credito_mp')
    .limit(1)
  fail(error)
  return (data ?? []).length > 0
}

export type MealRow = {
  id: string
  eatenOn: string
  mealType: MealType
  name: string
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
  portionLabel: string | null
  portionQty: number | null
  portionGrams: number | null
  foodSource: FoodSource | null
  foodRef: string | null
  brand: string | null
  createdAt: string
}

export type SavedFoodRow = {
  id: string
  name: string
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
  portionLabel: string | null
  portionQty: number | null
  portionGrams: number | null
  foodSource: FoodSource | null
  foodRef: string | null
  brand: string | null
  proteinPer100: number | null
  carbsPer100: number | null
  fatPer100: number | null
  kcalPer100: number | null
  portions: FoodPortion[]
}

export type NutritionGoalsRow = {
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
}

export type CommonFoodRow = {
  id: string
  name: string
  proteinPer100: number | null
  carbsPer100: number | null
  fatPer100: number | null
  kcalPer100: number | null
  portions: FoodPortion[]
  source: string
}

const MEAL_SELECT =
  'id, eaten_on, meal_type, name, protein_g, carbs_g, fat_g, kcal, portion_label, portion_qty, portion_grams, food_source, food_ref, brand, created_at'

const SAVED_SELECT =
  'id, name, protein_g, carbs_g, fat_g, kcal, portion_label, portion_qty, portion_grams, food_source, food_ref, brand, protein_per_100g, carbs_per_100g, fat_per_100g, kcal_per_100g, portions'

function parsePortions(value: unknown): FoodPortion[] {
  if (!Array.isArray(value)) return []
  const out: FoodPortion[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as { label?: unknown; grams?: unknown; suggested?: unknown }
    if (typeof row.label !== 'string' || typeof row.grams !== 'number') continue
    out.push({
      label: row.label,
      grams: row.grams,
      ...(row.suggested === true ? { suggested: true } : {}),
    })
  }
  return out
}

function mealFromDb(row: {
  id: string
  eaten_on: string
  meal_type: string
  name: string
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  kcal: number | null
  portion_label: string | null
  portion_qty: number | null
  portion_grams: number | null
  food_source: string | null
  food_ref: string | null
  brand: string | null
  created_at: string
}): MealRow {
  return {
    id: row.id,
    eatenOn: row.eaten_on,
    mealType: isMealType(row.meal_type) ? row.meal_type : 'snack',
    name: row.name,
    proteinG: asNumber(row.protein_g),
    carbsG: asNumber(row.carbs_g),
    fatG: asNumber(row.fat_g),
    kcal: asNumber(row.kcal),
    portionLabel: row.portion_label,
    portionQty: asNumber(row.portion_qty),
    portionGrams: asNumber(row.portion_grams),
    foodSource: isFoodSource(row.food_source) ? row.food_source : null,
    foodRef: row.food_ref,
    brand: row.brand,
    createdAt: row.created_at,
  }
}

function savedFromDb(row: {
  id: string
  name: string
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  kcal: number | null
  portion_label: string | null
  portion_qty: number | null
  portion_grams: number | null
  food_source: string | null
  food_ref: string | null
  brand: string | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  kcal_per_100g: number | null
  portions: unknown
}): SavedFoodRow {
  return {
    id: row.id,
    name: row.name,
    proteinG: asNumber(row.protein_g),
    carbsG: asNumber(row.carbs_g),
    fatG: asNumber(row.fat_g),
    kcal: asNumber(row.kcal),
    portionLabel: row.portion_label,
    portionQty: asNumber(row.portion_qty),
    portionGrams: asNumber(row.portion_grams),
    foodSource: isFoodSource(row.food_source) ? row.food_source : null,
    foodRef: row.food_ref,
    brand: row.brand,
    proteinPer100: asNumber(row.protein_per_100g),
    carbsPer100: asNumber(row.carbs_per_100g),
    fatPer100: asNumber(row.fat_per_100g),
    kcalPer100: asNumber(row.kcal_per_100g),
    portions: parsePortions(row.portions),
  }
}

export async function loadNutritionGoals(): Promise<NutritionGoalsRow> {
  const { data, error } = await supabase.from('nutrition_goals').select('protein_g, carbs_g, fat_g, kcal').maybeSingle()
  fail(error)
  return {
    proteinG: asNumber(data?.protein_g ?? null),
    carbsG: asNumber(data?.carbs_g ?? null),
    fatG: asNumber(data?.fat_g ?? null),
    kcal: asNumber(data?.kcal ?? null),
  }
}

export async function saveProteinGoal(ownerId: string, proteinG: number | null): Promise<void> {
  const { error } = await supabase.from('nutrition_goals').upsert({
    owner_id: ownerId,
    protein_g: proteinG,
  })
  fail(error)
}

export async function loadMealsForDay(eatenOn: string): Promise<MealRow[]> {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_SELECT)
    .eq('eaten_on', eatenOn)
    .order('created_at')
  fail(error)
  return (data ?? []).map(mealFromDb)
}

export async function loadRecentMeals(limit = 60): Promise<MealRow[]> {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
  fail(error)
  return (data ?? []).map(mealFromDb)
}

export async function loadSavedFoods(): Promise<SavedFoodRow[]> {
  const { data, error } = await supabase.from('saved_foods').select(SAVED_SELECT).order('name')
  fail(error)
  return (data ?? []).map(savedFromDb)
}

export async function searchCommonFoods(query: string, limit = 30): Promise<CommonFoodRow[]> {
  const needle = normalizeSearch(query)
  if (!needle) return []
  const { data, error } = await supabase
    .from('common_foods')
    .select('id, name, protein_per_100g, carbs_per_100g, fat_per_100g, kcal_per_100g, portions, source')
    .or(`search_name.ilike.%${needle}%,name.ilike.%${query.trim()}%`)
    .limit(limit)
  fail(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    proteinPer100: asNumber(row.protein_per_100g),
    carbsPer100: asNumber(row.carbs_per_100g),
    fatPer100: asNumber(row.fat_per_100g),
    kcalPer100: asNumber(row.kcal_per_100g),
    portions: parsePortions(row.portions),
    source: row.source,
  }))
}

export type MealWriteInput = {
  ownerId: string
  eatenOn: string
  mealType: MealType
  name: string
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
  portionLabel: string | null
  portionQty: number | null
  portionGrams: number | null
  foodSource: FoodSource | null
  foodRef: string | null
  brand: string | null
}

export async function createMeal(input: MealWriteInput): Promise<MealRow> {
  const { data, error } = await supabase
    .from('meals')
    .insert({
      owner_id: input.ownerId,
      eaten_on: input.eatenOn,
      meal_type: input.mealType,
      name: input.name,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
      kcal: input.kcal,
      portion_label: input.portionLabel,
      portion_qty: input.portionQty,
      portion_grams: input.portionGrams,
      food_source: input.foodSource,
      food_ref: input.foodRef,
      brand: input.brand,
    })
    .select(MEAL_SELECT)
    .single()
  fail(error)
  return mealFromDb(data)
}

export async function updateMeal(
  id: string,
  input: Omit<MealWriteInput, 'ownerId' | 'eatenOn' | 'mealType' | 'name'> & {
    name?: string
    mealType?: MealType
  },
): Promise<MealRow> {
  const { data, error } = await supabase
    .from('meals')
    .update({
      name: input.name,
      meal_type: input.mealType,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
      kcal: input.kcal,
      portion_label: input.portionLabel,
      portion_qty: input.portionQty,
      portion_grams: input.portionGrams,
      food_source: input.foodSource,
      food_ref: input.foodRef,
      brand: input.brand,
    })
    .eq('id', id)
    .select(MEAL_SELECT)
    .single()
  fail(error)
  return mealFromDb(data)
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  fail(error)
}

export type SavedFoodWriteInput = {
  ownerId: string
  name: string
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
  portionLabel: string | null
  portionQty: number | null
  portionGrams: number | null
  foodSource: FoodSource | null
  foodRef: string | null
  brand: string | null
  proteinPer100?: number | null
  carbsPer100?: number | null
  fatPer100?: number | null
  kcalPer100?: number | null
  portions?: FoodPortion[]
}

export async function upsertSavedFood(input: SavedFoodWriteInput): Promise<SavedFoodRow> {
  const existing = await supabase
    .from('saved_foods')
    .select('id')
    .eq('owner_id', input.ownerId)
    .ilike('name', input.name)
    .maybeSingle()
  fail(existing.error)
  if (existing.data?.id) {
    const { data, error } = await supabase
      .from('saved_foods')
      .update({
        name: input.name,
        protein_g: input.proteinG,
        carbs_g: input.carbsG,
        fat_g: input.fatG,
        kcal: input.kcal,
        portion_label: input.portionLabel,
        portion_qty: input.portionQty,
        portion_grams: input.portionGrams,
        food_source: input.foodSource,
        food_ref: input.foodRef,
        brand: input.brand,
        protein_per_100g: input.proteinPer100 ?? null,
        carbs_per_100g: input.carbsPer100 ?? null,
        fat_per_100g: input.fatPer100 ?? null,
        kcal_per_100g: input.kcalPer100 ?? null,
        portions: input.portions ?? [],
      })
      .eq('id', existing.data.id)
      .select(SAVED_SELECT)
      .single()
    fail(error)
    return savedFromDb(data)
  }
  const { data, error } = await supabase
    .from('saved_foods')
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
      kcal: input.kcal,
      portion_label: input.portionLabel,
      portion_qty: input.portionQty,
      portion_grams: input.portionGrams,
      food_source: input.foodSource,
      food_ref: input.foodRef,
      brand: input.brand,
      protein_per_100g: input.proteinPer100 ?? null,
      carbs_per_100g: input.carbsPer100 ?? null,
      fat_per_100g: input.fatPer100 ?? null,
      kcal_per_100g: input.kcalPer100 ?? null,
      portions: input.portions ?? [],
    })
    .select(SAVED_SELECT)
    .single()
  fail(error)
  return savedFromDb(data)
}

export async function deleteSavedFood(id: string): Promise<void> {
  const { error } = await supabase.from('saved_foods').delete().eq('id', id)
  fail(error)
}

export async function deleteSavedFoodByName(ownerId: string, name: string): Promise<void> {
  const { error } = await supabase.from('saved_foods').delete().eq('owner_id', ownerId).ilike('name', name)
  fail(error)
}

export type RecipeIngredientRow = {
  id: string
  recipeId: string
  name: string
  grams: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
  foodSource: Extract<FoodSource, 'common' | 'off' | 'manual'> | null
  foodRef: string | null
  brand: string | null
  position: number
}

export type RecipeRow = {
  id: string
  householdId: string
  createdBy: string
  updatedBy: string | null
  name: string
  servings: number
  notes: string | null
  createdAt: string
  updatedAt: string
  ingredients: RecipeIngredientRow[]
}

const RECIPE_SELECT =
  'id, household_id, created_by, updated_by, name, servings, notes, created_at, updated_at'
const RECIPE_INGREDIENT_SELECT =
  'id, recipe_id, name, grams, protein_g, carbs_g, fat_g, kcal, food_source, food_ref, brand, position, created_at'

function ingredientFromDb(row: {
  id: string
  recipe_id: string
  name: string
  grams: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  kcal: number | null
  food_source: string | null
  food_ref: string | null
  brand: string | null
  position: number
}): RecipeIngredientRow {
  const source =
    row.food_source === 'common' || row.food_source === 'off' || row.food_source === 'manual'
      ? row.food_source
      : null
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    grams: asNumber(row.grams) ?? 0,
    proteinG: asNumber(row.protein_g),
    carbsG: asNumber(row.carbs_g),
    fatG: asNumber(row.fat_g),
    kcal: asNumber(row.kcal),
    foodSource: source,
    foodRef: row.food_ref,
    brand: row.brand,
    position: row.position,
  }
}

function recipeFromDb(
  row: {
    id: string
    household_id: string
    created_by: string
    updated_by?: string | null
    name: string
    servings: number
    notes: string | null
    created_at: string
    updated_at: string
  },
  ingredients: RecipeIngredientRow[] = [],
): RecipeRow {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by ?? null,
    name: row.name,
    servings: asNumber(row.servings) ?? 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ingredients,
  }
}

async function attachIngredients(recipes: Parameters<typeof recipeFromDb>[0][]): Promise<RecipeRow[]> {
  if (recipes.length === 0) return []
  const ids = recipes.map((row) => row.id)
  const ingredients = await supabase
    .from('recipe_ingredients')
    .select(RECIPE_INGREDIENT_SELECT)
    .in('recipe_id', ids)
    .order('position')
    .order('created_at')
  fail(ingredients.error)
  const byRecipe = new Map<string, RecipeIngredientRow[]>()
  for (const row of ingredients.data ?? []) {
    const list = byRecipe.get(row.recipe_id) ?? []
    list.push(ingredientFromDb(row))
    byRecipe.set(row.recipe_id, list)
  }
  return recipes.map((row) => recipeFromDb(row, byRecipe.get(row.id) ?? []))
}

export async function loadRecipes(): Promise<RecipeRow[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .order('name')
  fail(error)
  return attachIngredients(data ?? [])
}

export async function searchRecipes(query: string, limit = 20): Promise<RecipeRow[]> {
  const needle = query.trim()
  if (!needle) return []
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .ilike('name', `%${needle}%`)
    .order('name')
    .limit(limit)
  fail(error)
  return attachIngredients(data ?? [])
}

export async function recipeExists(id: string): Promise<boolean> {
  const { data, error } = await supabase.from('recipes').select('id').eq('id', id).maybeSingle()
  fail(error)
  return Boolean(data?.id)
}

export async function loadRecipe(id: string): Promise<RecipeRow | null> {
  const { data, error } = await supabase.from('recipes').select(RECIPE_SELECT).eq('id', id).maybeSingle()
  fail(error)
  if (!data) return null
  const ingredients = await supabase
    .from('recipe_ingredients')
    .select(RECIPE_INGREDIENT_SELECT)
    .eq('recipe_id', id)
    .order('position')
    .order('created_at')
  fail(ingredients.error)
  return recipeFromDb(data, (ingredients.data ?? []).map(ingredientFromDb))
}

export type RecipeIngredientWrite = {
  name: string
  grams: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
  foodSource: Extract<FoodSource, 'common' | 'off' | 'manual'> | null
  foodRef: string | null
  brand: string | null
  position?: number
}

export type RecipeWriteInput = {
  householdId: string
  name: string
  servings: number
  notes?: string | null
  ingredients: readonly RecipeIngredientWrite[]
}

export async function createRecipe(input: RecipeWriteInput): Promise<RecipeRow> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      household_id: input.householdId,
      name: input.name.trim(),
      servings: input.servings,
      notes: input.notes?.trim() || null,
    })
    .select(RECIPE_SELECT)
    .single()
  fail(error)
  if (input.ingredients.length > 0) {
    const { error: ingredientError } = await supabase.from('recipe_ingredients').insert(
      input.ingredients.map((item, index) => ({
        recipe_id: data.id,
        name: item.name.trim(),
        grams: item.grams,
        protein_g: item.proteinG,
        carbs_g: item.carbsG,
        fat_g: item.fatG,
        kcal: item.kcal,
        food_source: item.foodSource,
        food_ref: item.foodRef,
        brand: item.brand,
        position: item.position ?? index,
      })),
    )
    fail(ingredientError)
  }
  const full = await loadRecipe(data.id)
  if (!full) throw new Error('No se pudo cargar la receta.')
  return full
}

export class RecipeConflictError extends Error {
  readonly recipe: RecipeRow
  constructor(recipe: RecipeRow) {
    super('conflict')
    this.name = 'RecipeConflictError'
    this.recipe = recipe
  }
}

export class RecipeDeletedConflictError extends Error {
  constructor() {
    super('deleted')
    this.name = 'RecipeDeletedConflictError'
  }
}

export async function updateRecipe(
  id: string,
  input: {
    name: string
    servings: number
    notes?: string | null
    ingredients: readonly RecipeIngredientWrite[]
    expectedUpdatedAt: string
    force?: boolean
  },
): Promise<RecipeRow> {
  let query = supabase
    .from('recipes')
    .update({
      name: input.name.trim(),
      servings: input.servings,
      notes: input.notes?.trim() || null,
    })
    .eq('id', id)
  if (!input.force) {
    query = query.eq('updated_at', input.expectedUpdatedAt)
  }
  const { data, error } = await query.select(RECIPE_SELECT).maybeSingle()
  fail(error)
  if (!data) {
    const current = await loadRecipe(id)
    if (!current) throw new RecipeDeletedConflictError()
    throw new RecipeConflictError(current)
  }
  const { error: clearError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', id)
  fail(clearError)
  if (input.ingredients.length > 0) {
    const { error: ingredientError } = await supabase.from('recipe_ingredients').insert(
      input.ingredients.map((item, index) => ({
        recipe_id: id,
        name: item.name.trim(),
        grams: item.grams,
        protein_g: item.proteinG,
        carbs_g: item.carbsG,
        fat_g: item.fatG,
        kcal: item.kcal,
        food_source: item.foodSource,
        food_ref: item.foodRef,
        brand: item.brand,
        position: item.position ?? index,
      })),
    )
    fail(ingredientError)
  }
  const full = await loadRecipe(data.id)
  if (!full) throw new Error('No se pudo cargar la receta.')
  return full
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  fail(error)
}

export async function loadHouseholdPartnerName(
  householdId: string,
  selfId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('household_id', householdId)
  fail(error)
  const other = (data ?? []).find((row) => row.id !== selfId)
  return other?.display_name ?? null
}

export type MedicationRow = {
  id: string
  name: string
  doseNotes: string | null
  archivedAt: string | null
  stockQty: number | null
  unitsPerDose: number
}

export type MedicationPeriodRow = {
  id: string
  medicationId: string
  startsOn: string
  endsOn: string | null
  startedAt: string
  endedAt: string | null
}

export type MedicationScheduleRow = {
  id: string
  medicationId: string
  localTime: string
}

export type MedicationDoseRow = {
  id: string
  medicationId: string
  doseOn: string
  scheduledTime: string
  status: 'taken' | 'skipped'
  recordedAt: string
  nameSnapshot: string
  doseSnapshot: string | null
  unitsDeducted: number
}

const MEDICATION_SELECT = 'id, name, dose_notes, archived_at, stock_qty, units_per_dose'
const MEDICATION_PERIOD_SELECT = 'id, medication_id, starts_on, ends_on, started_at, ended_at'
const MEDICATION_SCHEDULE_SELECT = 'id, medication_id, local_time'
const MEDICATION_DOSE_SELECT =
  'id, medication_id, dose_on, scheduled_time, status, recorded_at, name_snapshot, dose_snapshot, units_deducted'

function medicationFromDb(row: {
  id: string
  name: string
  dose_notes: string | null
  archived_at: string | null
  stock_qty: number | null
  units_per_dose: number
}): MedicationRow {
  return {
    id: row.id,
    name: row.name,
    doseNotes: row.dose_notes,
    archivedAt: row.archived_at,
    stockQty: row.stock_qty,
    unitsPerDose: row.units_per_dose,
  }
}

function medicationPeriodFromDb(row: {
  id: string
  medication_id: string
  starts_on: string
  ends_on: string | null
  started_at: string
  ended_at: string | null
}): MedicationPeriodRow {
  return {
    id: row.id,
    medicationId: row.medication_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

function medicationScheduleFromDb(row: {
  id: string
  medication_id: string
  local_time: string
}): MedicationScheduleRow {
  return {
    id: row.id,
    medicationId: row.medication_id,
    localTime: row.local_time,
  }
}

function medicationDoseFromDb(row: {
  id: string
  medication_id: string
  dose_on: string
  scheduled_time: string
  status: 'taken' | 'skipped'
  recorded_at: string
  name_snapshot: string
  dose_snapshot: string | null
  units_deducted?: number | null
}): MedicationDoseRow {
  return {
    id: row.id,
    medicationId: row.medication_id,
    doseOn: row.dose_on,
    scheduledTime: row.scheduled_time,
    status: row.status,
    recordedAt: row.recorded_at,
    nameSnapshot: row.name_snapshot,
    doseSnapshot: row.dose_snapshot,
    unitsDeducted: row.units_deducted ?? 0,
  }
}

export async function loadMedications(userId: string): Promise<MedicationRow[]> {
  const { data, error } = await supabase
    .from('medications')
    .select(MEDICATION_SELECT)
    .eq('user_id', userId)
    .order('name')
  fail(error)
  return (data ?? []).map(medicationFromDb)
}

export async function loadMedicationPeriods(userId: string): Promise<MedicationPeriodRow[]> {
  const { data, error } = await supabase
    .from('medication_periods')
    .select(MEDICATION_PERIOD_SELECT)
    .eq('user_id', userId)
    .order('starts_on')
  fail(error)
  return (data ?? []).map(medicationPeriodFromDb)
}

export async function loadMedicationSchedules(userId: string): Promise<MedicationScheduleRow[]> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select(MEDICATION_SCHEDULE_SELECT)
    .eq('user_id', userId)
    .order('local_time')
  fail(error)
  return (data ?? []).map(medicationScheduleFromDb)
}

export async function loadMedicationDosesForDay(userId: string, day: string): Promise<MedicationDoseRow[]> {
  const { data, error } = await supabase
    .from('medication_doses')
    .select(MEDICATION_DOSE_SELECT)
    .eq('user_id', userId)
    .eq('dose_on', day)
  fail(error)
  return (data ?? []).map(medicationDoseFromDb)
}

export async function loadMedicationDosesBetween(
  userId: string,
  fromDay: string,
  toDay: string,
): Promise<MedicationDoseRow[]> {
  const { data, error } = await supabase
    .from('medication_doses')
    .select(MEDICATION_DOSE_SELECT)
    .eq('user_id', userId)
    .gte('dose_on', fromDay)
    .lte('dose_on', toDay)
  fail(error)
  return (data ?? []).map(medicationDoseFromDb)
}

export async function createMedication(input: {
  userId: string
  name: string
  doseNotes?: string | null
  startsOn: string
  endsOn?: string | null
  times: string[]
  stockQty?: number | null
  unitsPerDose?: number
}): Promise<MedicationRow> {
  const { data, error } = await supabase
    .from('medications')
    .insert({
      user_id: input.userId,
      name: input.name,
      dose_notes: input.doseNotes ?? null,
      stock_qty: input.stockQty ?? null,
      units_per_dose: input.unitsPerDose ?? 1,
    })
    .select(MEDICATION_SELECT)
    .single()
  fail(error)

  const { error: periodError } = await supabase.from('medication_periods').insert({
    medication_id: data.id,
    user_id: input.userId,
    starts_on: input.startsOn,
    ends_on: input.endsOn ?? null,
    started_at: new Date().toISOString(),
  })
  fail(periodError)

  if (input.times.length > 0) {
    const { error: scheduleError } = await supabase.from('medication_schedules').insert(
      input.times.map((localTime) => ({
        medication_id: data.id,
        user_id: input.userId,
        local_time: localTime,
      })),
    )
    fail(scheduleError)
  }

  return medicationFromDb(data)
}

export async function updateMedication(input: {
  id: string
  userId: string
  name: string
  doseNotes?: string | null
  times: string[]
  endsOn?: string | null
  periodId: string
  stockQty?: number | null
  unitsPerDose?: number
}): Promise<void> {
  const patch: {
    name: string
    dose_notes: string | null
    stock_qty?: number | null
    units_per_dose?: number
  } = { name: input.name, dose_notes: input.doseNotes ?? null }
  if (input.stockQty !== undefined) patch.stock_qty = input.stockQty
  if (input.unitsPerDose !== undefined) patch.units_per_dose = input.unitsPerDose
  const { error } = await supabase.from('medications').update(patch).eq('id', input.id)
  fail(error)

  const { error: periodError } = await supabase
    .from('medication_periods')
    .update({ ends_on: input.endsOn ?? null })
    .eq('id', input.periodId)
  fail(periodError)

  const { error: deleteError } = await supabase.from('medication_schedules').delete().eq('medication_id', input.id)
  fail(deleteError)

  if (input.times.length > 0) {
    const { error: scheduleError } = await supabase.from('medication_schedules').insert(
      input.times.map((localTime) => ({
        medication_id: input.id,
        user_id: input.userId,
        local_time: localTime,
      })),
    )
    fail(scheduleError)
  }
}

export async function archiveMedication(input: {
  id: string
  userId: string
  periodId: string
}): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('medications').update({ archived_at: now }).eq('id', input.id)
  fail(error)
  const { error: periodError } = await supabase
    .from('medication_periods')
    .update({ ended_at: now })
    .eq('id', input.periodId)
  fail(periodError)
}

export async function reactivateMedication(input: {
  id: string
  userId: string
  startsOn: string
  endsOn?: string | null
}): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('medications').update({ archived_at: null }).eq('id', input.id)
  fail(error)
  const { error: periodError } = await supabase.from('medication_periods').insert({
    medication_id: input.id,
    user_id: input.userId,
    starts_on: input.startsOn,
    ends_on: input.endsOn ?? null,
    started_at: now,
  })
  fail(periodError)
}

export async function setMedicationDose(input: {
  userId: string
  medicationId: string
  doseOn: string
  scheduledTime: string
  status: 'taken' | 'skipped'
  nameSnapshot: string
  doseSnapshot?: string | null
}): Promise<MedicationDoseRow & { stockQty: number | null }> {
  void input.userId
  const { data, error } = await supabase.rpc('set_medication_dose_with_stock', {
    p_medication_id: input.medicationId,
    p_dose_on: input.doseOn,
    p_scheduled_time: input.scheduledTime,
    p_status: input.status,
    p_name_snapshot: input.nameSnapshot,
    p_dose_snapshot: input.doseSnapshot ?? null,
  })
  fail(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.dose_id || !row.status || !row.recorded_at || !row.name_snapshot) {
    throw new Error('No pude guardar la toma.')
  }
  if (row.status !== 'taken' && row.status !== 'skipped') {
    throw new Error('No pude guardar la toma.')
  }
  return {
    id: row.dose_id,
    medicationId: row.medication_id,
    doseOn: row.dose_on,
    scheduledTime: row.scheduled_time,
    status: row.status,
    recordedAt: row.recorded_at,
    nameSnapshot: row.name_snapshot,
    doseSnapshot: row.dose_snapshot,
    unitsDeducted: row.units_deducted ?? 0,
    stockQty: row.stock_qty ?? null,
  }
}

export async function clearMedicationDose(input: {
  userId: string
  medicationId: string
  doseOn: string
  scheduledTime: string
}): Promise<void> {
  void input.userId
  const { error } = await supabase.rpc('set_medication_dose_with_stock', {
    p_medication_id: input.medicationId,
    p_dose_on: input.doseOn,
    p_scheduled_time: input.scheduledTime,
    p_status: null,
    p_name_snapshot: '',
    p_dose_snapshot: null,
  })
  fail(error)
}

export async function addMedicationStock(input: {
  medicationId: string
  units: number
}): Promise<{ medicationId: string; stockQty: number }> {
  const { data, error } = await supabase.rpc('add_medication_stock', {
    p_medication_id: input.medicationId,
    p_units: input.units,
  })
  fail(error)
  const row = Array.isArray(data) ? data[0] : data
  return { medicationId: row.medication_id, stockQty: row.stock_qty }
}

export async function adjustMedicationStock(input: {
  medicationId: string
  units: number | null
}): Promise<{ medicationId: string; stockQty: number | null }> {
  const { data, error } = await supabase.rpc('adjust_medication_stock', {
    p_medication_id: input.medicationId,
    p_units: input.units,
  })
  fail(error)
  const row = Array.isArray(data) ? data[0] : data
  return { medicationId: row.medication_id, stockQty: row.stock_qty }
}

export async function loadModuleNotificationPrefs(
  userId: string,
): Promise<{ module: string; enabled: boolean }[]> {
  const { data, error } = await supabase
    .from('module_notification_prefs')
    .select('module, enabled')
    .eq('user_id', userId)
  fail(error)
  return data ?? []
}

/** Sin fila: Medicamentos asume prendido; Finanzas es opt-in (apagado). */
export function modulePrefEnabled(
  prefs: readonly { module: string; enabled: boolean }[],
  module: string,
  fallbackWhenMissing: boolean,
): boolean {
  const row = prefs.find((item) => item.module === module)
  return row ? row.enabled : fallbackWhenMissing
}

export async function setModuleNotificationPref(input: {
  userId: string
  module: string
  enabled: boolean
}): Promise<void> {
  const { error } = await supabase.from('module_notification_prefs').upsert(
    {
      user_id: input.userId,
      module: input.module,
      enabled: input.enabled,
    },
    { onConflict: 'user_id,module' },
  )
  fail(error)
}

export async function loadPlanItems(householdId: string): Promise<PlanItem[]> {
  const { data, error } = await supabase
    .from('plan_items')
    .select('id, title, amount, note, tag, is_private, owner_id, chosen, expense_id')
    .eq('household_id', householdId)
    .order('amount', { ascending: true })
  fail(error)
  const rows = data ?? []
  const expenseIds = rows.map((row) => row.expense_id).filter((id): id is string => Boolean(id))
  const expenseById = new Map<string, { amount: number; period: string }>()
  if (expenseIds.length > 0) {
    const expenses = await supabase.from('expenses').select('id, amount, period').in('id', expenseIds)
    fail(expenses.error)
    for (const expense of expenses.data ?? []) {
      expenseById.set(expense.id, { amount: money(expense.amount), period: expense.period.slice(0, 10) })
    }
  }
  return rows.map((row) => {
    const expense = row.expense_id ? expenseById.get(row.expense_id) : undefined
    return {
      id: row.id,
      title: row.title,
      amount: money(row.amount),
      note: row.note,
      tag: row.tag,
      isPrivate: row.is_private,
      ownerId: row.owner_id,
      chosen: row.chosen,
      expenseId: row.expense_id,
      expenseAmount: expense?.amount ?? null,
      expensePeriod: expense?.period ?? null,
    }
  })
}

export async function createPlanItem(input: {
  householdId: string
  createdBy: string
  title: string
  amount: number
  note: string | null
  tag: string | null
  isPrivate: boolean
}): Promise<void> {
  const { error } = await supabase.from('plan_items').insert({
    household_id: input.householdId,
    title: input.title.trim(),
    amount: input.amount,
    note: normalizePlanNote(input.note ?? ''),
    tag: normalizePlanTag(input.tag ?? ''),
    is_private: input.isPrivate,
    owner_id: input.isPrivate ? input.createdBy : null,
    created_by: input.createdBy,
    updated_by: input.createdBy,
  })
  fail(error)
}

export async function updatePlanItem(input: {
  id: string
  updatedBy: string
  title: string
  amount: number
  note: string | null
  tag: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('plan_items')
    .update({
      title: input.title.trim(),
      amount: input.amount,
      note: normalizePlanNote(input.note ?? ''),
      tag: normalizePlanTag(input.tag ?? ''),
      updated_by: input.updatedBy,
    })
    .eq('id', input.id)
  fail(error)
}

export async function setPlanItemChosen(id: string, chosen: boolean, updatedBy: string): Promise<void> {
  const { error } = await supabase
    .from('plan_items')
    .update({ chosen, updated_by: updatedBy })
    .eq('id', id)
  fail(error)
}

export async function linkPlanItemExpense(id: string, expenseId: string, updatedBy: string): Promise<void> {
  const { error } = await supabase
    .from('plan_items')
    .update({ expense_id: expenseId, updated_by: updatedBy })
    .eq('id', id)
  fail(error)
}

export async function deletePlanItem(id: string): Promise<void> {
  const { error } = await supabase.from('plan_items').delete().eq('id', id)
  fail(error)
}

export async function loadPlanPartnerStatus(): Promise<PartnerPlanStatus | null> {
  const { data, error } = await supabase.rpc('plan_partner_status')
  fail(error)
  if (data === 'alcanza' || data === 'no_alcanza' || data === 'falta_sueldo') return data
  return null
}
