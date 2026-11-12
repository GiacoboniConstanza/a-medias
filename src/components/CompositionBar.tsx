import {
  compositionAriaLabel,
  formatAmount,
  type CompositionShares,
} from '../lib/meals.ts'

export function CompositionBar({
  shares,
  scope = 'tu día',
  className = '',
}: {
  shares: CompositionShares
  scope?: string
  className?: string
}) {
  const parts = [
    { key: 'proteína', pct: shares.proteinPct, className: 'comp-bar-proteina' },
    { key: 'hidratos', pct: shares.carbsPct, className: 'comp-bar-hidratos' },
    { key: 'grasas', pct: shares.fatPct, className: 'comp-bar-grasas' },
  ].filter((part) => part.pct > 0)

  return (
    <div
      role="img"
      aria-label={compositionAriaLabel(shares, scope)}
      className={`comp-bar ${className}`}
    >
      {parts.map((part) => (
        <span key={part.key} className={part.className} style={{ width: `${part.pct}%` }} />
      ))}
    </div>
  )
}

export function CompositionSwatch({ part }: { part: 'proteína' | 'hidratos' | 'grasas' }) {
  const className =
    part === 'proteína'
      ? 'comp-swatch-proteina'
      : part === 'hidratos'
        ? 'comp-swatch-hidratos'
        : 'comp-swatch-grasas'
  return <span aria-hidden="true" className={`comp-swatch ${className}`} />
}

export function CompositionLegendShort({ shares }: { shares: CompositionShares }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <CompositionSwatch part="proteína" />
        Proteína {formatAmount(shares.proteinG)} g
      </span>
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <CompositionSwatch part="hidratos" />
        Hidratos {formatAmount(shares.carbsG)} g
      </span>
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <CompositionSwatch part="grasas" />
        Grasas {formatAmount(shares.fatG)} g
      </span>
    </div>
  )
}
