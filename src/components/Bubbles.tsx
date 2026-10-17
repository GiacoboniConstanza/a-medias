import { AppIcon } from './AppIcon.tsx'
import { formatMoney } from '../lib/format.ts'

const SLOTS = [
  { left: 8, top: 12, color: '#ffd6e0' },
  { left: 188, top: 28, color: '#d9ecff' },
  { left: 28, top: 214, color: '#e6f9ee' },
  { left: 168, top: 196, color: '#fff1c9' },
  { left: 250, top: 188, color: '#eee8ff' },
  { left: 196, top: 300, color: '#ffe3cc' },
]

export type BubbleItem = {
  id: string
  icon: string
  label: string
  amount: number
}

export function Bubbles({ items }: { items: BubbleItem[] }) {
  const sorted = [...items].sort((a, b) => b.amount - a.amount).slice(0, SLOTS.length)
  const max = sorted[0]?.amount ?? 1
  if (sorted.length === 0) {
    return <p className="py-16 text-center font-bold text-muted">Todavía no anotaste gastos este mes.</p>
  }
  return (
    <div className="relative h-[430px]">
      {sorted.map((item, index) => {
        const slot = SLOTS[index]
        if (!slot) return null
        const size = 68 + Math.sqrt(item.amount / max) * 122
        return (
          <div
            key={item.id}
            className="absolute flex flex-col items-center justify-center rounded-full text-center font-extrabold"
            style={{
              width: size,
              height: size,
              left: slot.left,
              top: slot.top,
              background: slot.color,
              fontSize: Math.max(11, size / 11),
            }}
          >
            <span style={{ fontSize: Math.max(18, size / 4.2) }}>
              <AppIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
            <small className="text-[11px] font-semibold text-ink/70">{formatMoney(item.amount)}</small>
          </div>
        )
      })}
    </div>
  )
}
