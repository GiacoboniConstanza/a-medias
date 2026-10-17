import { AppIcon } from './AppIcon.tsx'
import { formatMoney } from '../lib/format.ts'

const COLORS = ['#F7B7C4', '#C7DDAE', '#DEC59E', '#F4C542', '#A79BCB', '#C4866D']

export type BubbleItem = {
  id: string
  icon: string
  label: string
  amount: number
}

export function Bubbles({
  items,
  activeIds,
  onPick,
}: {
  items: BubbleItem[]
  activeIds: string[]
  onPick: (id: string) => void
}) {
  const sorted = [...items].sort((a, b) => b.amount - a.amount)
  const max = sorted[0]?.amount ?? 1
  const filtering = activeIds.length > 0
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {sorted.map((item, index) => {
        const picked = activeIds.includes(item.id)
        const dimmed = filtering && !picked
        const size = 120 + Math.round(Math.sqrt(item.amount / max) * 28)
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            aria-pressed={picked}
            aria-label={`${item.label}, ${formatMoney(item.amount)}`}
            className={`relative flex shrink-0 flex-col items-center justify-center rounded-full px-3 text-center font-extrabold text-text ${
              dimmed ? 'after:absolute after:inset-0 after:rounded-full after:bg-card/55' : 'shadow-soft'
            } ${picked ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
            style={{ width: size, height: size, background: COLORS[index % COLORS.length], minWidth: 120, minHeight: 120 }}
          >
            <span className="relative z-10 text-xl leading-none">
              <AppIcon name={item.icon} />
            </span>
            <span className="relative z-10 mt-1 line-clamp-2 text-sm leading-tight">{item.label}</span>
            <span className="relative z-10 text-sm font-semibold">{formatMoney(item.amount)}</span>
          </button>
        )
      })}
    </div>
  )
}
