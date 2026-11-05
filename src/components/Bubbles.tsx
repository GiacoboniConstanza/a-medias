import { useEffect, useRef, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { formatMoney } from '../lib/format.ts'
import { iconSurface } from '../lib/icons.ts'

export type BubbleItem = {
  id: string
  icon: string
  label: string
  amount: number
  fill?: string
  border?: string
}

export function Bubbles({
  items,
  activeId,
  onPick,
}: {
  items: BubbleItem[]
  activeId: string | null
  onPick: (id: string) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(358)

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width
      if (next > 0) setWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const sorted = [...items].sort((a, b) => b.amount - a.amount)
  const narrow = width <= 328
  const amounts = sorted.map((item) => formatMoney(item.amount))
  const widest = amounts.reduce((max, label) => Math.max(max, label.length * 7.2), 0)
  const gap = narrow ? 6 : 8
  let columns = 3
  let dMax = Math.floor((width - (columns - 1) * gap) / columns)
  if (narrow && widest > dMax - 8) {
    columns = 2
    dMax = Math.floor((width - gap) / columns)
  }
  const dMin = narrow ? dMax - 2 : dMax - 6
  const max = sorted[0]?.amount ?? 0
  const min = sorted[sorted.length - 1]?.amount ?? 0
  const sizeOf = (amount: number) => {
    if (sorted.length <= 1 || max === min) return dMax
    return Math.round(dMin + (dMax - dMin) * Math.sqrt((amount - min) / (max - min)))
  }

  return (
    <div ref={frame} className="mx-auto flex w-full flex-wrap items-start justify-center" style={{ gap }}>
      {sorted.map((item) => {
        const size = sizeOf(item.amount)
        const surface = iconSurface(item.icon)
        const picked = activeId === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            aria-pressed={picked}
            aria-label={`${item.label}, ${formatMoney(item.amount)}`}
            className="bubble-motion flex flex-col items-center justify-center rounded-full px-2 text-center text-tinta"
            style={{
              width: size,
              height: size,
              background: item.fill ?? surface.background,
              border: `${picked ? 3 : 2}px solid ${picked ? 'var(--color-tinta)' : (item.border ?? surface.border)}`,
              paddingBottom: narrow ? 0 : 26,
            }}
          >
            {narrow ? null : (
              <span className="text-lg leading-none">
                <AppIcon name={item.icon} />
              </span>
            )}
            <span className="text-sm font-semibold leading-tight">{item.label}</span>
            <span className="whitespace-nowrap font-display text-sm font-semibold leading-tight">{formatMoney(item.amount)}</span>
          </button>
        )
      })}
    </div>
  )
}
