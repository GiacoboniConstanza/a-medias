import { AppIcon } from './AppIcon.tsx'
import type { ExpenseItem } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { shortDate } from '../lib/month.ts'
import { periodDiffersFromDate, shortPeriodLabel } from '../lib/period.ts'

export function PeriodTag({ expense }: { expense: Pick<ExpenseItem, 'spentOn' | 'period'> }) {
  if (!periodDiffersFromDate(expense.spentOn, expense.period)) return null
  return (
    <span className="ml-1 inline-flex rounded-full bg-[#A79BCB] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-[#2C2440]">
      {shortPeriodLabel(expense.period)}
    </span>
  )
}

export function ExpenseLine({
  expense,
  categoryName,
  categoryIcon,
  onOpen,
}: {
  expense: ExpenseItem
  categoryName: string
  categoryIcon: string
  onOpen: () => void
}) {
  return (
    <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-start justify-between gap-3 py-3 text-left">
      <span className="min-w-0">
        <span className="block font-extrabold">
          {expense.title}
          <PeriodTag expense={expense} />
        </span>
        <span className="mt-0.5 block font-semibold text-muted">
          {shortDate(expense.spentOn)} · <AppIcon name={categoryIcon || DEFAULT_ICON} /> {categoryName}
          {expense.isShared ? ' · Compartido' : expense.paidFromBag ? ' · Privado, pagado con la bolsa' : ' · Privado'}
        </span>
      </span>
      <span className="shrink-0 font-extrabold">{formatMoney(expense.amount)}</span>
    </button>
  )
}
