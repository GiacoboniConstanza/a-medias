import { AppIcon } from './AppIcon.tsx'
import type { ExpenseItem } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { iconSurface } from '../lib/icons.ts'
import { shortDate } from '../lib/month.ts'
import { shortPeriodLabel } from '../lib/period.ts'
import { useMonth } from '../context/MonthProvider.tsx'

export function PeriodTag({ expense }: { expense: Pick<ExpenseItem, 'period'> }) {
  const { month } = useMonth()
  if (expense.period.slice(0, 7) === month.slice(0, 7)) return null
  return (
    <span className="inline-flex h-[var(--alto-chip)] items-center rounded-full bg-azul-claro px-2.5 text-sm font-semibold text-azul-ink">
      {shortPeriodLabel(expense.period)}
    </span>
  )
}

export function ExpenseLine({
  expense,
  categoryName,
  categoryIcon,
  whoPaid = null,
  personName = '',
  showPrivate = false,
  onOpen,
}: {
  expense: ExpenseItem
  categoryName: string
  categoryIcon: string
  whoPaid?: 'me' | 'partner' | null
  personName?: string
  showPrivate?: boolean
  onOpen: () => void
}) {
  const surface = iconSurface(categoryIcon)
  const markPrivate = showPrivate && !expense.isShared
  const payer =
    whoPaid === 'me' ? (
      <span className={`font-bold ${personTone(personName)}`}>Pagaste vos</span>
    ) : whoPaid === 'partner' ? (
      <span>
        Pagó <span className={`font-bold ${personTone(personName)}`}>{personName}</span>
      </span>
    ) : null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid min-h-[62px] w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-0 py-2.5 text-left"
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-full border-2 text-lg text-tinta"
        style={{ background: surface.background, borderColor: surface.border }}
        aria-hidden="true"
      >
        <AppIcon name={categoryIcon} />
      </span>
      <span className="min-w-0 pr-2">
        <span className="flex min-h-[26px] flex-wrap items-center gap-1.5">
          <span className="font-display text-lg font-semibold text-tinta">{expense.title ?? 'Gasto'}</span>
          <PeriodTag expense={expense} />
          {markPrivate ? (
            <span className="inline-flex h-[var(--alto-chip)] items-center rounded-full bg-ciruela-claro px-2.5 text-sm font-semibold text-tinta">
              Privado
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-sm font-medium leading-snug text-gris">
          {payer}
          {payer ? ' · ' : null}
          {shortDate(expense.spentOn)} · {categoryName}
        </span>
      </span>
      <span className="whitespace-nowrap pl-2 font-display text-lg font-semibold leading-[26px] text-tinta">{formatMoney(expense.amount)}</span>
    </button>
  )
}

function personTone(name: string): string {
  const key = name.trim().toLowerCase()
  if (key === 'maru') return 'text-salvia-ink'
  if (key === 'coty' || key === 'vos') return 'text-rosa-texto'
  return 'text-tinta'
}
