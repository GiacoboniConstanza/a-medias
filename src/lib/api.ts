import type { ContributionMode, ViewMode } from '../types/database.ts'
import { bagBalances, type BagKind } from './bag.ts'
import { money } from './format.ts'
import { DEFAULT_ICON } from './icons.ts'
import type { ExpenseSpan } from './expense-range.ts'
import { amountForMonth, type AmountRevision } from './fixed.ts'
import { monthEnd, monthKey } from './month.ts'
import { movementInMonth, periodFromDate } from './period.ts'
import { effectiveSalary, visibleSplitNotice, type SalaryPoint } from './salary.ts'
import { sortedTimes, type DailyKind, type ReminderPrefs, DEFAULT_REMINDER_PREFS } from './reminders.ts'
import { supabase } from './supabase.ts'
import { parseYearBalance, type YearReport } from './year.ts'

const FUND_BAR = ['#4F6B57', '#6A784D', '#8FA37A']
const GUSTOS_BAR = '#F4C542'

export type Category = {
  id: string
  name: string
  icon: string
  ownerId: string | null
}

export type ExpenseItem = {
  id: string
  title: string
  amount: number
  spentOn: string
  period: string
  isShared: boolean
  paidFromBag: boolean
  payerId: string
  ownerId: string
  categoryId: string
}

export type FundItem = {
  id: string
  name: string
  icon: string
  target: number
  targetDate: string | null
  saved: number
}

export type ExtraPart = {
  label: string
  icon: string
  amount: number
  color: string
  toGustos: boolean
}

export type BagMovementItem = {
  id: string
  kind: BagKind
  fundId: string | null
  fundName: string
  label: string
  amount: number
  happenedOn: string
}

export type ExtraItem = {
  id: string
  label: string
  amount: number
  receivedOn: string
  parts: ExtraPart[]
}

export type GoalContribution = {
  id: string
  userId: string
  amount: number
  createdAt: string
}

export type GoalItem = {
  id: string
  name: string
  icon: string
  target: number
  targetDate: string | null
  byUser: { userId: string; amount: number }[]
  contributions: GoalContribution[]
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
  movementsThisMonth: BagMovementItem[]
  funds: FundItem[]
  gustosFree: number
  gustosPool: number
  goal: GoalItem | null
  fixed: FixedItem[]
  settlement: SettlementItem | null
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export async function loadFinance(householdId: string, userId: string, month: string): Promise<FinanceData> {
  const end = monthEnd(month)
  const [
    household,
    profiles,
    salaries,
    percents,
    evenSplit,
    notices,
    extras,
    funds,
    allocations,
    movements,
    categories,
    monthExpenses,
    lastExpense,
    goals,
    contributions,
    fixedExpenses,
    fixedAmounts,
    fixedPayments,
    settlement,
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
    supabase.from('income_extras').select('id, amount, label, received_on').eq('user_id', userId),
    supabase.from('savings_funds').select('id, name, icon, target_amount, target_date').eq('user_id', userId),
    supabase.from('extra_allocations').select('extra_id, fund_id, amount').eq('user_id', userId),
    supabase.from('bag_movements').select('id, kind, fund_id, expense_id, amount, label, happened_on').eq('user_id', userId),
    supabase.from('categories').select('id, name, icon, owner_id').eq('household_id', householdId),
    supabase
      .from('expenses')
      .select('id, title, amount, spent_on, period, is_shared, paid_from_bag, payer_id, owner_id, category_id')
      .eq('period', month)
      .order('spent_on', { ascending: true }),
    supabase
      .from('expenses')
      .select('spent_on')
      .eq('owner_id', userId)
      .order('spent_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('shared_goals')
      .select('id, name, icon, target_amount, target_date')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('goal_contributions').select('id, goal_id, user_id, amount, created_at'),
    supabase
      .from('fixed_expenses')
      .select('id, title, icon, expected_amount, due_day, is_shared, category_id, owner_id, remind_days_before, remind, paused_at, updated_at, updated_by')
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
  ])

  fail(household.error)
  fail(profiles.error)
  fail(salaries.error)
  fail(percents.error)
  fail(evenSplit.error)
  fail(notices.error)
  fail(extras.error)
  fail(funds.error)
  fail(allocations.error)
  fail(movements.error)
  fail(categories.error)
  fail(monthExpenses.error)
  fail(lastExpense.error)
  fail(goals.error)
  fail(contributions.error)
  fail(fixedExpenses.error)
  fail(fixedAmounts.error)
  fail(fixedPayments.error)
  fail(settlement.error)

  const fundById = new Map((funds.data ?? []).map((fund) => [fund.id, fund]))
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

  const balance = bagBalances(
    (allocations.data ?? []).map((allocation) => ({
      fundId: allocation.fund_id,
      amount: money(allocation.amount),
    })),
    (movements.data ?? []).flatMap((movement) => {
      if (!isBagKind(movement.kind)) return []
      return [{ kind: movement.kind, fundId: movement.fund_id, amount: money(movement.amount) }]
    }),
  )

  const extrasThisMonth: ExtraItem[] = (extras.data ?? [])
    .filter((extra) => extra.received_on >= month && extra.received_on <= end)
    .sort((a, b) => b.received_on.localeCompare(a.received_on))
    .map((extra) => {
      const parts = (allocations.data ?? [])
        .filter((allocation) => allocation.extra_id === extra.id)
        .map((allocation) => {
          const fund = allocation.fund_id ? fundById.get(allocation.fund_id) : undefined
          const toGustos = !allocation.fund_id
          return {
            label: fund?.name ?? 'Gustos',
            icon: fund?.icon || 'bag-shopping',
            amount: money(allocation.amount),
            color: toGustos ? GUSTOS_BAR : '#4F6B57',
            toGustos,
          }
        })
      let fundShade = 0
      for (const part of parts) {
        if (part.toGustos) continue
        part.color = FUND_BAR[fundShade % FUND_BAR.length] ?? '#4F6B57'
        fundShade += 1
      }
      return {
        id: extra.id,
        label: extra.label,
        amount: money(extra.amount),
        receivedOn: extra.received_on,
        parts,
      }
    })

  const periodExpenseIds = new Set((monthExpenses.data ?? []).map((expense) => expense.id))
  const movementsThisMonth: BagMovementItem[] = (movements.data ?? [])
    .flatMap((movement) => {
      const inMonth = movementInMonth(
        {
          kind: movement.kind,
          happenedOn: movement.happened_on,
          linkedToPeriod: movement.expense_id != null && periodExpenseIds.has(movement.expense_id),
        },
        month,
      )
      if (!isBagKind(movement.kind) || !inMonth) return []
      return [
        {
          id: movement.id,
          kind: movement.kind,
          fundId: movement.fund_id,
          fundName: movement.fund_id ? (fundById.get(movement.fund_id)?.name ?? 'Fondo') : 'Gustos',
          label: movement.label,
          amount: money(movement.amount),
          happenedOn: movement.happened_on,
        },
      ]
    })
    .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn))

  const goalRow = goals.data?.[0]
  const goalContributions = (contributions.data ?? []).filter((contribution) => contribution.goal_id === goalRow?.id)
  const goal: GoalItem | null = goalRow
    ? {
        id: goalRow.id,
        name: goalRow.name,
        icon: goalRow.icon || DEFAULT_ICON,
        target: money(goalRow.target_amount),
        targetDate: goalRow.target_date,
        byUser: Object.entries(
          goalContributions.reduce<Record<string, number>>((totals, contribution) => {
            totals[contribution.user_id] = (totals[contribution.user_id] ?? 0) + money(contribution.amount)
            return totals
          }, {}),
        ).map(([userId, amount]) => ({ userId, amount })),
        contributions: goalContributions
          .map((contribution) => ({
            id: contribution.id,
            userId: contribution.user_id,
            amount: money(contribution.amount),
            createdAt: contribution.created_at,
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }
    : null

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
      ownerId: category.owner_id,
    })),
    monthExpenses: (monthExpenses.data ?? []).map(mapExpense),
    lastLoggedOn: lastExpense.data?.spent_on ?? null,
    extrasThisMonth,
    movementsThisMonth,
    funds: (funds.data ?? []).map((fund) => ({
      id: fund.id,
      name: fund.name,
      icon: fund.icon || DEFAULT_ICON,
      target: money(fund.target_amount),
      targetDate: fund.target_date,
      saved: balance.savedByFund.get(fund.id) ?? 0,
    })),
    gustosFree: balance.gustosFree,
    gustosPool: balance.gustosPool,
    goal,
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

const EXPENSE_COLUMNS = 'id, title, amount, spent_on, period, is_shared, paid_from_bag, payer_id, owner_id, category_id, created_at'

function isBagKind(kind: string): kind is BagKind {
  return kind === 'gusto' || kind === 'to_fund' || kind === 'to_gustos' || kind === 'use'
}

function mapExpense(expense: {
  id: string
  title: string
  amount: number
  spent_on: string
  period: string
  is_shared: boolean
  paid_from_bag: boolean
  payer_id: string
  owner_id: string
  category_id: string
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
  }
}

/** Gastos que pagó esta persona en el mes de `period`. Un recorte de días usa la fecha real. */
export async function loadPayerExpenses(payerId: string, span: ExpenseSpan, period: string): Promise<ExpenseItem[]> {
  if (span.kind === 'dates' && span.dates.length === 0) return []

  const ranked = supabase
    .from('expenses')
    .select(EXPENSE_COLUMNS)
    .eq('payer_id', payerId)
    .eq('period', period)
    .order('spent_on', { ascending: true })
    .order('created_at', { ascending: true })

  const fullMonth = span.kind === 'range' && span.from === period && span.to === monthEnd(period)
  const filtered = fullMonth
    ? ranked
    : span.kind === 'dates'
      ? ranked.in('spent_on', span.dates)
      : ranked.gte('spent_on', span.from).lte('spent_on', span.to)

  const { data, error } = await filtered
  fail(error)
  return (data ?? []).map(mapExpense)
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
  return (data ?? []).map(mapExpense)
}

export async function saveViewMode(userId: string, viewMode: ViewMode): Promise<void> {
  const { error } = await supabase.from('profiles').update({ view_mode: viewMode }).eq('id', userId)
  fail(error)
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
  ownerId: string | null
  name: string
  icon: string
}): Promise<string> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: input.householdId,
      owner_id: input.ownerId,
      name: input.name.trim(),
      icon: input.icon,
      emoji: input.icon,
    })
    .select('id')
    .single()
  fail(error)
  return data.id
}

export async function createExpense(input: {
  householdId: string
  ownerId: string
  payerId: string
  categoryId: string
  title: string
  amount: number
  spentOn: string
  period: string
  isShared: boolean
}): Promise<string> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      household_id: input.householdId,
      owner_id: input.ownerId,
      payer_id: input.payerId,
      category_id: input.categoryId,
      title: input.title.trim(),
      amount: input.amount,
      spent_on: input.spentOn,
      period: input.period,
      is_shared: input.isShared,
    })
    .select('id')
    .single()
  fail(error)
  return data.id
}

export async function updateExpense(input: {
  id: string
  payerId: string
  categoryId: string
  title: string
  amount: number
  spentOn: string
  period: string
  isShared: boolean
}): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      payer_id: input.payerId,
      category_id: input.categoryId,
      title: input.title.trim(),
      amount: input.amount,
      spent_on: input.spentOn,
      period: input.period,
      is_shared: input.isShared,
    })
    .eq('id', input.id)
  fail(error)
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  fail(error)
}

export async function createFund(input: {
  userId: string
  name: string
  icon: string
  target: number
  targetDate: string | null
}): Promise<void> {
  const { error } = await supabase.from('savings_funds').insert({
    user_id: input.userId,
    name: input.name.trim(),
    icon: input.icon,
    emoji: input.icon,
    target_amount: input.target,
    target_date: input.targetDate,
  })
  fail(error)
}

export async function updateFund(input: {
  id: string
  name: string
  icon: string
  target: number
  targetDate: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('savings_funds')
    .update({
      name: input.name.trim(),
      icon: input.icon,
      emoji: input.icon,
      target_amount: input.target,
      target_date: input.targetDate,
    })
    .eq('id', input.id)
  fail(error)
}

export async function spendFromGustos(input: {
  title: string
  categoryId: string
  amount: number
  spentOn: string
}): Promise<void> {
  const { error } = await supabase.rpc('spend_from_gustos', {
    expense_title: input.title.trim(),
    category_id: input.categoryId,
    expense_amount: input.amount,
    spent_on: input.spentOn,
  })
  fail(error)
}

export async function moveBagMoney(input: {
  kind: Exclude<BagKind, 'gusto'>
  fundId: string
  amount: number
  happenedOn: string
  label: string
}): Promise<void> {
  const { error } = await supabase.rpc('move_bag_money', {
    movement_kind: input.kind,
    target_fund: input.fundId,
    movement_amount: input.amount,
    happened_on: input.happenedOn,
    movement_label: input.label.trim(),
  })
  fail(error)
}

export async function createExtra(input: {
  userId: string
  householdId: string
  label: string
  amount: number
  receivedOn: string
  allocations: { fundId: string | null; amount: number }[]
}): Promise<void> {
  const { data, error } = await supabase
    .from('income_extras')
    .insert({
      user_id: input.userId,
      household_id: input.householdId,
      label: input.label.trim(),
      amount: input.amount,
      received_on: input.receivedOn,
    })
    .select('id')
    .single()
  fail(error)
  if (input.allocations.length === 0) return
  const { error: allocationError } = await supabase.from('extra_allocations').insert(
    input.allocations.map((allocation) => ({
      extra_id: data.id,
      user_id: input.userId,
      fund_id: allocation.fundId,
      amount: allocation.amount,
    })),
  )
  fail(allocationError)
}

export async function createGoal(input: {
  householdId: string
  name: string
  icon: string
  target: number
  targetDate: string | null
}): Promise<void> {
  const { error } = await supabase.from('shared_goals').insert({
    household_id: input.householdId,
    name: input.name.trim(),
    icon: input.icon,
    emoji: input.icon,
    target_amount: input.target,
    target_date: input.targetDate,
  })
  fail(error)
}

export async function contributeToGoal(input: {
  goalId: string
  userId: string
  amount: number
  mode: ContributionMode
}): Promise<void> {
  const { error } = await supabase.from('goal_contributions').insert({
    goal_id: input.goalId,
    user_id: input.userId,
    amount: input.amount,
    mode: input.mode,
  })
  fail(error)
}

export async function settleMonth(input: {
  householdId: string
  month: string
  debtorId: string
  creditorId: string
  amount: number
  settledBy: string
}): Promise<void> {
  const { error } = await supabase.from('settlements').insert({
    household_id: input.householdId,
    month: input.month,
    debtor_id: input.debtorId,
    creditor_id: input.creditorId,
    amount: input.amount,
    settled_by: input.settledBy,
  })
  fail(error)
}

export async function undoSettlement(id: string): Promise<void> {
  const { error } = await supabase.from('settlements').delete().eq('id', id)
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

export async function undoFixedPayment(payment: FixedPayment): Promise<void> {
  const { error } = await supabase.from('fixed_payments').delete().eq('id', payment.id)
  fail(error)
  if (!payment.expenseId) return
  const removed = await supabase.from('expenses').delete().eq('id', payment.expenseId)
  fail(removed.error)
}
