import { Link } from 'react-router'
import { AppIcon } from './AppIcon.tsx'
import { Card } from './ui.tsx'
import {
  budgetAmountLine,
  budgetAriaLabel,
  budgetBarFill,
  budgetStatusLine,
  type BudgetRow,
} from '../lib/budget.ts'
import { iconSurface } from '../lib/icons.ts'
import { isCurrentMonth } from '../lib/month.ts'

export function PrivacyChip() {
  return (
    <span className="inline-flex h-[var(--alto-chip)] items-center gap-1 rounded-full border-[1.5px] border-tinta px-2.5 text-sm font-semibold text-tinta">
      <AppIcon name="lock" /> Solo vos
    </span>
  )
}

function CategoryIcon({ icon }: { icon: string }) {
  const surface = iconSurface(icon)
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-lg"
      style={{ background: surface.background, color: surface.color, borderColor: surface.border }}
    >
      <AppIcon name={icon} />
    </span>
  )
}

function BudgetBar({ row }: { row: BudgetRow }) {
  const width = Math.min(row.percent, 100)
  const fill = budgetBarFill(row.state)
  const atCap = width >= 100
  return (
    <div
      className="mt-2 h-[10px] overflow-hidden rounded-full border-[1.5px] border-tinta bg-tarjeta"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-label={budgetAriaLabel(row)}
    >
      <div
        className={`h-full ${fill} ${atCap ? '' : 'border-r-[1.5px] border-tinta'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

export function BudgetRowView({ row }: { row: BudgetRow }) {
  const status = budgetStatusLine(row)
  const percentTone = row.state === 'pasado' ? 'text-rosa-texto' : 'text-title'
  const statusTone = row.state === 'pasado' ? 'text-rosa-texto' : 'text-tinta'
  return (
    <div className="grid grid-cols-[40px_1fr] gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <CategoryIcon icon={row.icon} />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-display text-lg font-semibold text-title">{row.name}</p>
          <p className={`shrink-0 font-display text-lg font-semibold ${percentTone}`}>{row.percent} %</p>
        </div>
        <BudgetBar row={row} />
        <p className="mt-1.5 text-sm text-gris">{budgetAmountLine(row)}</p>
        {status ? <p className={`mt-1 text-sm font-bold ${statusTone}`}>{status}</p> : null}
      </div>
    </div>
  )
}

export function BudgetCard({
  month,
  rows,
  loading,
  error,
  onRetry,
}: {
  month: string
  rows: BudgetRow[] | null
  loading: boolean
  error: string
  onRetry: () => void
}) {
  const current = isCurrentMonth(month)

  if (loading && rows === null) {
    return (
      <Card>
        <div className="h-40 animate-pulse rounded-2xl bg-tarjeta" aria-busy="true" />
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-title">Tu presupuesto</h2>
          <PrivacyChip />
        </div>
        <p className="mt-3 text-sm font-semibold text-tinta">No pudimos traer tu presupuesto.</p>
        <button type="button" className="mt-2 inline-flex min-h-11 items-center font-bold text-mostaza-ink" onClick={onRetry}>
          Reintentar
        </button>
      </Card>
    )
  }

  if (rows === null) return null

  if (rows.length === 0) {
    if (!current) return null
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-title">Tu presupuesto</h2>
          <PrivacyChip />
        </div>
        <p className="mt-3 text-sm font-semibold text-muted">
          Poné un tope por mes a las categorías que quieras y mirá cuánto llevás.
        </p>
        <Link
          to="/presupuesto"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border-[1.5px] border-azul-ink bg-card px-4 text-base font-semibold text-tinta"
        >
          Armar mi presupuesto
        </Link>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-title">Tu presupuesto</h2>
        <PrivacyChip />
      </div>
      <div className="mt-3">
        {rows.map((row) => (
          <BudgetRowView key={row.categoryId} row={row} />
        ))}
      </div>
      <Link
        to="/presupuesto"
        className="mt-1 flex min-h-12 items-center gap-2 border-t border-dashed border-line pt-3 text-sm font-bold text-mostaza-ink"
      >
        <AppIcon name="sliders" />
        <span className="flex-1">Editar topes</span>
        <AppIcon name="chevron-right" className="text-tinta" />
      </Link>
    </Card>
  )
}

export function BudgetListIcon({ icon }: { icon: string }) {
  return <CategoryIcon icon={icon} />
}
