import { useEffect, useState, type ReactNode } from 'react'
import { formatMoney } from '../lib/format.ts'
import { DONUT_MIN_ARC, donutArcs } from '../lib/donut.ts'

export type DonutSlice = {
  id: string
  label: string
  amount: number
  color: string
  percent: string
  marker?: ReactNode
  ink?: string
  detail?: string
  selectable?: boolean
  soft?: boolean
}

export type DonutCenter = {
  kicker: string
  value: string
  hint?: string
}

const radius = 62
const circumference = 2 * Math.PI * radius

export function DonutBreakdown({
  title,
  titleIcon,
  center,
  slices,
  track = '#EDE6F5',
  onSelect,
}: {
  title: string
  titleIcon?: ReactNode
  center: DonutCenter
  slices: DonutSlice[]
  track?: string
  onSelect?: (id: string) => void
}) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const arcs = donutArcs(slices.map((slice) => slice.amount))
  const segments = slices.map((slice, index) => {
    const ratio = arcs[index] ?? 0
    return { slice, ratio }
  })
  let cursor = 0
  const painted = segments.map((segment) => {
    const start = cursor
    cursor += segment.ratio
    return { ...segment, start }
  })

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 font-display text-[17px] font-semibold">
        {titleIcon}
        {title}
      </h2>
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden="true">
          <circle cx="80" cy="80" r={radius} fill="none" stroke={track} strokeWidth="26" />
          {painted.map(({ slice, ratio, start }) => {
            if (ratio <= 0) return null
            const length = drawn ? ratio * circumference + 0.75 : 0
            return (
              <circle
                key={slice.id}
                className="donut-arc"
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="26"
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-start * circumference}
                transform="rotate(-90 80 80)"
              />
            )
          })}
        </svg>
        <div className="pointer-events-none absolute top-1/2 left-1/2 flex w-[6.4rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
          <p className="text-xs font-semibold leading-none text-muted">{center.kicker}</p>
          <p className="mt-1 font-display text-[17px] font-bold leading-none">{center.value}</p>
          {center.hint ? <p className="mt-1 text-[11px] font-semibold leading-none text-muted">{center.hint}</p> : null}
        </div>
      </div>
      <div className="mt-2">
        {slices.map((slice) => (
          <LegendRow key={slice.id} slice={slice} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

export function MonthBars({
  rows,
  color,
}: {
  rows: { key: string; label: string; amount: number }[]
  color: string
}) {
  const max = Math.max(...rows.map((row) => row.amount), 0)
  return (
    <ul>
      {rows.map((row) => {
        const ratio = max > 0 ? row.amount / max : 0
        const width = row.amount > 0 ? Math.max(ratio, DONUT_MIN_ARC) * 100 : 0
        return (
          <li key={row.key} className="flex min-h-11 items-center gap-3">
            <span className="w-28 shrink-0 text-sm font-semibold">{row.label}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EDE6F5]" aria-hidden="true">
              <span className="donut-arc block h-full rounded-full" style={{ width: `${width}%`, background: color }} />
            </span>
            <span className="w-24 shrink-0 text-right font-display text-sm font-semibold">{formatMoney(row.amount)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function LegendRow({ slice, onSelect }: { slice: DonutSlice; onSelect?: (id: string) => void }) {
  const interactive = Boolean(onSelect && slice.selectable !== false)
  const marker = (
    <span
      className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${slice.soft ? 'ring-1 ring-line ring-inset' : ''}`}
      style={{ background: slice.color, color: slice.ink ?? '#fff' }}
      aria-hidden="true"
    >
      {slice.marker}
    </span>
  )
  const body = slice.detail ? (
    <span className="col-span-2 text-right text-xs font-semibold text-muted">{slice.detail}</span>
  ) : (
    <>
      <span className="text-right font-extrabold text-alert-ink">{slice.percent}</span>
      <span className="text-right text-xs font-semibold text-muted">{formatMoney(slice.amount)}</span>
    </>
  )
  const className =
    'grid w-full grid-cols-[1.75rem_minmax(0,1fr)_2.4rem_5.75rem] items-center gap-1.5 border-b border-dashed border-line py-1.5 text-left text-[13px] last:border-b-0'

  if (!interactive) {
    return (
      <div className={`min-h-11 ${className}`}>
        {marker}
        <b className="truncate font-bold">{slice.label}</b>
        {body}
      </div>
    )
  }

  return (
    <button type="button" className={`min-h-11 ${className}`} onClick={() => onSelect?.(slice.id)}>
      {marker}
      <b className="truncate font-bold">{slice.label}</b>
      {body}
    </button>
  )
}
