import { useEffect, useRef, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { formatMoney } from '../lib/format.ts'

const COLORS = ['#F7B7C4', '#C7DDAE', '#DEC59E', '#F4C542', '#A79BCB', '#C4866D']

export type BubbleItem = {
  id: string
  icon: string
  label: string
  amount: number
}

type Spot = { left: number; top: number; size: number }

/** Agrupa círculos alrededor del más grande, con un solapado chico. */
function packBubbles(sizes: number[], width: number): Spot[] {
  const spots: Spot[] = []
  sizes.forEach((size, index) => {
    if (index === 0) {
      spots.push({ left: Math.max(0, (width - size) / 2 - width * 0.06), top: 6, size })
      return
    }
    const origin = spots[0]
    const angle = -0.9 + index * 1.18
    const overlap = 14 + (index % 3) * 4
    const distance = origin.size / 2 + size / 2 - overlap
    let left = origin.left + origin.size / 2 + Math.cos(angle) * distance - size / 2
    let top = origin.top + origin.size / 2 + Math.sin(angle) * distance * 0.82 - size / 2
    if (index > 5) top += (index - 5) * 28
    left += ((index % 2) * 2 - 1) * 8
    left = Math.max(-6, Math.min(width - size + 6, left))
    top = Math.max(0, top)
    spots.push({ left, top, size })
  })
  const shift = Math.min(0, ...spots.map((spot) => spot.left))
  if (shift < 0) {
    for (const spot of spots) spot.left -= shift
  }
  return spots
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
  const [width, setWidth] = useState(340)

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
  const max = sorted[0]?.amount ?? 1
  const sizes = sorted.map((item) => Math.round(124 + Math.sqrt(item.amount / max) * 52))
  const spots = packBubbles(sizes, width)
  const height = spots.reduce((tallest, spot) => Math.max(tallest, spot.top + spot.size), 0) + 12

  return (
    <div ref={frame} className="relative mx-auto w-full" style={{ height }}>
      {sorted.map((item, index) => {
        const spot = spots[index]
        if (!spot) return null
        const picked = activeId === item.id
        const dimmed = activeId !== null && !picked
        return (
          <div
            key={item.id}
            className="absolute transition-transform duration-300 ease-out"
            style={{
              left: spot.left,
              top: spot.top,
              width: spot.size,
              height: spot.size,
              zIndex: picked ? 30 : sorted.length - index,
              transform: picked ? 'scale(1.08)' : undefined,
              opacity: dimmed ? 0.4 : 1,
            }}
          >
            <button
              type="button"
              onClick={() => onPick(item.id)}
              aria-pressed={picked}
              aria-label={`${item.label}, ${formatMoney(item.amount)}`}
              className={`bubble-motion flex h-full w-full flex-col items-center justify-center rounded-full px-3 text-center font-extrabold text-text shadow-soft ${
                picked ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg' : ''
              }`}
              style={{
                background: COLORS[index % COLORS.length],
                animationDelay: `${index * 70}ms, ${index * 0.35}s`,
                animationDuration: `0.45s, ${4 + (index % 3) * 0.8}s`,
              }}
            >
              <span className="text-xl leading-none">
                <AppIcon name={item.icon} />
              </span>
              <span className="mt-1 line-clamp-2 text-sm leading-tight">{item.label}</span>
              <span className={picked ? 'text-base font-extrabold leading-tight' : 'text-sm font-semibold'}>
                {formatMoney(item.amount)}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
