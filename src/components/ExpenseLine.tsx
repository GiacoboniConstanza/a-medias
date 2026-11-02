import { AppIcon } from './AppIcon.tsx'
import type { ExpenseItem } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { shortDate } from '../lib/month.ts'
import { periodDiffersFromDate, shortPeriodLabel } from '../lib/period.ts'

export function PeriodTag({
  expense,
  readable = false,
}: {
  expense: Pick<ExpenseItem, 'spentOn' | 'period'>
  readable?: boolean
}) {
  if (!periodDiffersFromDate(expense.spentOn, expense.period)) return null
  const size = readable
    ? 'px-2 py-0.5 text-base font-bold'
    : 'px-2 py-0.5 text-sm font-bold leading-none'
  return (
    <span className={`ml-1 inline-flex items-center rounded-full bg-lavender-light text-lavender-ink ${size}`}>
      {shortPeriodLabel(expense.period)}
    </span>
  )
}

export function ExpenseLine({
  expense,
  categoryName,
  categoryIcon,
  payerName,
  onOpen,
}: {
  expense: ExpenseItem
  categoryName: string
  categoryIcon: string
  payerName?: string
  onOpen: () => void
}) {
  return (
    <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-start justify-between gap-3 py-3 text-left">
      <span className="min-w-0">
        <span className="block font-extrabold">
          {expense.title}
          <PeriodTag expense={expense} />
          {expense.notes ? <AppIcon name="note-sticky" className="ml-1.5 text-sm text-muted" /> : null}
        </span>
        <span className="mt-0.5 block font-semibold text-muted">
          {shortDate(expense.spentOn)} · <AppIcon name={categoryIcon || DEFAULT_ICON} /> {categoryName}
          {payerName ? ` · Pagó ${payerName}` : expense.isShared ? ' · Compartido' : expense.paidFromBag ? ' · Privado, pagado con la bolsa' : ' · Privado'}
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap font-extrabold">{formatMoney(expense.amount)}</span>
    </button>
  )
}
