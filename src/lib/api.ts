import type { ContributionMode, ViewMode } from '../types/database.ts'
import { money } from './format.ts'
import { DEFAULT_ICON } from './icons.ts'
import { monthEnd } from './month.ts'
import { supabase } from './supabase.ts'

const PART_COLORS = ['#9ec9ff', '#8fe3b0', '#ffc2d1', '#c9b8ff', '#ffd36e']

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
  isShared: boolean
  payerId: string
  ownerId: string
  categoryId: string
}

export type FundItem = {
  id: string
  name: string
  icon: string
  target: number
  saved: number
}

export type ExtraPart = {
  label: string
  icon: string
  amount: number
  color: string
}

export type ExtraItem = {
  id: string
  label: string
  amount: number
  receivedOn: string
  parts: ExtraPart[]
}

export type GoalItem = {
  id: string
  name: string
  icon: string
  target: number
  targetDate: string | null
  byUser: { userId: string; amount: number }[]
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
  dueDay: number
  isShared: boolean
  categoryId: string | null
  payment: FixedPayment | null
}

export type SettlementItem = {
  id: string
  amount: number
  settledAt: string
  debtorId: string
  creditorId: string
}

export type FinanceData = {
  inviteCode: string
  names: Record<string, string>
  bases: Record<string, number>
  categories: Category[]
  monthExpenses: ExpenseItem[]
  privateSpentAllTime: number
  lastLoggedOn: string | null
  extrasThisMonth: ExtraItem[]
  funds: FundItem[]
  gustosAllocated: number
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
    incomes,
    extras,
    funds,
    allocations,
    categories,
    monthExpenses,
    privateExpenses,
    lastExpense,
    goals,
    contributions,
    fixedExpenses,
    fixedPayments,
    settlement,
  ] = await Promise.all([
    supabase.from('households').select('invite_code').eq('id', householdId).single(),
    supabase.from('profiles').select('id, display_name').eq('household_id', householdId),
    supabase.from('monthly_incomes').select('user_id, base_amount').eq('household_id', householdId).eq('month', month),
    supabase.from('income_extras').select('id, amount, label, received_on').eq('user_id', userId),
    supabase.from('savings_funds').select('id, name, icon, target_amount').eq('user_id', userId),
    supabase.from('extra_allocations').select('extra_id, fund_id, amount').eq('user_id', userId),
    supabase.from('categories').select('id, name, icon, owner_id').eq('household_id', householdId),
    supabase
      .from('expenses')
      .select('id, title, amount, spent_on, is_shared, payer_id, owner_id, category_id')
      .gte('spent_on', month)
      .lte('spent_on', end)
      .order('spent_on', { ascending: true }),
    supabase.from('expenses').select('amount').eq('owner_id', userId).eq('is_shared', false),
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
    supabase.from('goal_contributions').select('goal_id, user_id, amount'),
    supabase
      .from('fixed_expenses')
      .select('id, title, icon, expected_amount, due_day, is_shared, category_id')
      .eq('household_id', householdId)
      .order('due_day', { ascending: true }),
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
  fail(incomes.error)
  fail(extras.error)
  fail(funds.error)
  fail(allocations.error)
  fail(categories.error)
  fail(monthExpenses.error)
  fail(privateExpenses.error)
  fail(lastExpense.error)
  fail(goals.error)
  fail(contributions.error)
  fail(fixedExpenses.error)
  fail(fixedPayments.error)
  fail(settlement.error)

  const fundById = new Map((funds.data ?? []).map((fund) => [fund.id, fund]))
  const names: Record<string, string> = {}
  for (const profile of profiles.data ?? []) names[profile.id] = profile.display_name

  const bases: Record<string, number> = {}
  for (const income of incomes.data ?? []) bases[income.user_id] = money(income.base_amount)

  const extrasThisMonth: ExtraItem[] = (extras.data ?? [])
    .filter((extra) => extra.received_on >= month && extra.received_on <= end)
    .sort((a, b) => b.received_on.localeCompare(a.received_on))
    .map((extra) => {
      const parts = (allocations.data ?? [])
        .filter((allocation) => allocation.extra_id === extra.id)
        .map((allocation, index) => {
          const fund = allocation.fund_id ? fundById.get(allocation.fund_id) : undefined
          return {
            label: fund?.name ?? 'Gustos',
            icon: fund?.icon || 'bag-shopping',
            amount: money(allocation.amount),
            color: PART_COLORS[index % PART_COLORS.length] ?? '#ffc2d1',
          }
        })
      return {
        id: extra.id,
        label: extra.label,
        amount: money(extra.amount),
        receivedOn: extra.received_on,
        parts,
      }
    })

  const savedByFund = new Map<string, number>()
  let gustosAllocated = 0
  for (const allocation of allocations.data ?? []) {
    const amount = money(allocation.amount)
    if (!allocation.fund_id) {
      gustosAllocated += amount
      continue
    }
    savedByFund.set(allocation.fund_id, (savedByFund.get(allocation.fund_id) ?? 0) + amount)
  }

  const goalRow = goals.data?.[0]
  const goal: GoalItem | null = goalRow
    ? {
        id: goalRow.id,
        name: goalRow.name,
        icon: goalRow.icon || DEFAULT_ICON,
        target: money(goalRow.target_amount),
        targetDate: goalRow.target_date,
        byUser: Object.entries(
          (contributions.data ?? [])
            .filter((contribution) => contribution.goal_id === goalRow.id)
            .reduce<Record<string, number>>((totals, contribution) => {
              totals[contribution.user_id] = (totals[contribution.user_id] ?? 0) + money(contribution.amount)
              return totals
            }, {}),
        ).map(([userId, amount]) => ({ userId, amount })),
      }
    : null

  const paymentByFixed = new Map((fixedPayments.data ?? []).map((payment) => [payment.fixed_expense_id, payment]))

  return {
    inviteCode: household.data.invite_code,
    names,
    bases,
    categories: (categories.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon || DEFAULT_ICON,
      ownerId: category.owner_id,
    })),
    monthExpenses: (monthExpenses.data ?? []).map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: money(expense.amount),
      spentOn: expense.spent_on,
      isShared: expense.is_shared,
      payerId: expense.payer_id,
      ownerId: expense.owner_id,
      categoryId: expense.category_id,
    })),
    privateSpentAllTime: (privateExpenses.data ?? []).reduce((sum, expense) => sum + money(expense.amount), 0),
    lastLoggedOn: lastExpense.data?.spent_on ?? null,
    extrasThisMonth,
    funds: (funds.data ?? []).map((fund) => ({
      id: fund.id,
      name: fund.name,
      icon: fund.icon || DEFAULT_ICON,
      target: money(fund.target_amount),
      saved: savedByFund.get(fund.id) ?? 0,
    })),
    gustosAllocated,
    goal,
    fixed: (fixedExpenses.data ?? []).map((expense) => {
      const payment = paymentByFixed.get(expense.id)
      return {
        id: expense.id,
        title: expense.title,
        icon: expense.icon || DEFAULT_ICON,
        amount: money(expense.expected_amount),
        dueDay: expense.due_day,
        isShared: expense.is_shared,
        categoryId: expense.category_id,
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

export async function saveViewMode(userId: string, viewMode: ViewMode): Promise<void> {
  const { error } = await supabase.from('profiles').update({ view_mode: viewMode }).eq('id', userId)
  fail(error)
}

export async function saveBaseSalary(input: {
  userId: string
  householdId: string
  month: string
  amount: number
}): Promise<void> {
  const existing = await supabase
    .from('monthly_incomes')
    .select('id')
    .eq('user_id', input.userId)
    .eq('month', input.month)
    .maybeSingle()
  fail(existing.error)
  if (existing.data) {
    const { error } = await supabase.from('monthly_incomes').update({ base_amount: input.amount }).eq('id', existing.data.id)
    fail(error)
    return
  }
  const { error } = await supabase.from('monthly_incomes').insert({
    user_id: input.userId,
    household_id: input.householdId,
    month: input.month,
    base_amount: input.amount,
  })
  fail(error)
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
      is_shared: input.isShared,
    })
    .select('id')
    .single()
  fail(error)
  return data.id
}

export async function createFund(input: {
  userId: string
  name: string
  icon: string
  target: number
}): Promise<void> {
  const { error } = await supabase.from('savings_funds').insert({
    user_id: input.userId,
    name: input.name.trim(),
    icon: input.icon,
    emoji: input.icon,
    target_amount: input.target,
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
}): Promise<void> {
  const { error } = await supabase.from('fixed_expenses').insert({
    household_id: input.householdId,
    owner_id: input.ownerId,
    category_id: input.categoryId,
    title: input.title.trim(),
    icon: input.icon,
    emoji: input.icon,
    expected_amount: input.amount,
    due_day: input.dueDay,
    is_shared: input.isShared,
  })
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

export async function undoFixedPayment(payment: FixedPayment): Promise<void> {
  const { error } = await supabase.from('fixed_payments').delete().eq('id', payment.id)
  fail(error)
  if (!payment.expenseId) return
  const removed = await supabase.from('expenses').delete().eq('id', payment.expenseId)
  fail(removed.error)
}
