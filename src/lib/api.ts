import { money } from './format.ts'
import { DEFAULT_ICON } from './icons.ts'
import { amountForMonth, type AmountRevision } from './fixed.ts'
import { monthEnd, monthKey } from './month.ts'
import { periodFromDate } from './period.ts'
import { effectiveSalary, visibleSplitNotice, type SalaryPoint } from './salary.ts'
import { sortedTimes, type DailyKind, type ReminderPrefs, DEFAULT_REMINDER_PREFS } from './reminders.ts'
import { supabase } from './supabase.ts'
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
    fixedPayments,
    settlement,
    savings,
    savingMoves,
  ] = await Promise.all([
    supabase.from('households').select('invite_code').eq('id', householdId).single(),
    supabase.from('profiles').select('id, display_name').eq('household_id', householdId),
    supabase
      .from('base_salaries')
      .select('id, amount, effective_from, created_at')
      .eq('user_id', userId)
      .order('effective_from', { ascending: false }),
    supabase.rpc('household_split_percents', { target_month: month }),
    supabase.rpc('household_split_is_even', { target_month: month }),
    supabase.from('split_notices').select('effective_from, recipient_percent, partner_percent, created_at'),
    supabase.from('income_extras').select('id, amount, label, received_on, notes, mp_operation_id').eq('user_id', userId),
    supabase.from('categories').select('id, name, icon').eq('household_id', householdId),
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
    supabase.from('fixed_payments').select('id, fixed_expense_id, paid_on, payer_id, amount, expense_id').eq('month', month),
    supabase
      .from('settlements')
      .select('id, amount, settled_at, debtor_id, creditor_id')
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
  fail(fixedPayments.error)
  fail(settlement.error)

  const names: Record<string, string> = {}
  for (const profile of profiles.data ?? []) names[profile.id] = profile.display_name

  const salaryHistory: SalaryPoint[] = (salaries.data ?? []).map((row) => ({
    id: row.id,
    amount: money(row.amount),
    effectiveFrom: row.effective_from.slice(0, 10),
    createdAt: row.created_at,
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
      const resolved = amountForMonth(revisions, month)
      return {
        id: expense.id,
        title: expense.title,
        icon: expense.icon || DEFAULT_ICON,
        amount: resolved ?? money(expense.expected_amount),
        applies: resolved !== null,
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


export async function saveSalaryRevision(input: {
  id: string | null
  userId: string
  amount: number
  effectiveFrom: string
}): Promise<void> {
  if (input.id) {
    const { error } = await supabase
      .from('base_salaries')
      .update({ amount: input.amount, effective_from: input.effectiveFrom })
      .eq('id', input.id)
    fail(error)
    return
  }
  const { error } = await supabase.from('base_salaries').insert({
    user_id: input.userId,
    amount: input.amount,
    effective_from: input.effectiveFrom,
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
  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: input.householdId,
      name: input.name.trim(),
      icon: input.icon,
      emoji: input.icon,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Esa categoría ya está en el hogar.')
    throw new Error(error.message)
  }
  return data.id
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
}): Promise<void> {
  const { error } = await supabase.rpc('settle_shared_month', {
    p_month: input.month,
    p_debtor: input.debtorId,
    p_creditor: input.creditorId,
    p_amount: input.amount,
    p_expense_amount: input.expenseAmount,
    p_expense_debtor: input.expenseDebtorId,
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
    .select('enabled, first_time, second_time, ask_times, due_lead_days, notify_shared, sunday_summary, push_enabled, reviewed_on, hidden_until')
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
      push_enabled: prefs.pushEnabled,
      reviewed_on: prefs.reviewedOn,
      hidden_until: prefs.hiddenUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
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
  categoryId: string
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
