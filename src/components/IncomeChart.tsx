import { useEffect, useState } from 'react'
import { MONTH_INITIALS, isFutureMonth, salaryChanges, type YearMonth } from '../lib/year.ts'

const width = 366
const height = 214
const baseline = 176
const top = 28
const left = 4
const slot = (width - 8) / 12

function yFor(value: number, max: number): number {
  if (max <= 0) return baseline
  return baseline - (value / max) * (baseline - top)
}

export function IncomeChart({
  year,
  months,
  caption,
  today = new Date(),
}: {
  year: number
  months: YearMonth[]
  caption: string
  today?: Date
}) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setDrawn(true)
      return
    }
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [year])

  const max = Math.max(
    ...months.map((month) => (month.base ?? 0) + (month.extras ?? 0)),
    1,
  )
  const changes = new Set(salaryChanges(months).map((change) => change.month))
  const runs: { x0: number; x1: number; y: number }[][] = []
  let run: { x0: number; x1: number; y: number }[] = []

  months.forEach((month, index) => {
    const future = isFutureMonth(year, month.month, today)
    if (future || month.base === null) {
      if (run.length > 0) runs.push(run)
      run = []
      return
    }
    const x0 = left + slot * index
    run.push({ x0, x1: x0 + slot, y: yFor(month.base, max) })
  })
  if (run.length > 0) runs.push(run)

  const futureRun = months.flatMap((month, index) => {
    if (!isFutureMonth(year, month.month, today) || month.base === null) return []
    const x0 = left + slot * index
    return [{ x0, x1: x0 + slot, y: yFor(month.base, max) }]
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={caption}>
      {runs.map((segments) => {
        const first = segments[0]
        const last = segments[segments.length - 1]
        if (!first || !last) return null
        const line = segments
          .map((segment, index) =>
            index === 0 ? `M ${segment.x0} ${segment.y} L ${segment.x1} ${segment.y}` : `L ${segment.x0} ${segment.y} L ${segment.x1} ${segment.y}`,
          )
          .join(' ')
        const fill = `${line} L ${last.x1} ${baseline} L ${first.x0} ${baseline} Z`
        return (
          <g key={first.x0} className={`year-line ${drawn ? 'opacity-100' : 'opacity-0'}`}>
            <path d={fill} fill="#C7DDAE" opacity="0.55" />
            <path d={line} fill="none" stroke="#4F6B57" strokeWidth="3.5" strokeLinejoin="round" />
          </g>
        )
      })}
      {futureRun.length > 0 ? (
        <path
          d={`${futureRun
            .map((segment, index) =>
              index === 0
                ? `M ${segment.x0} ${segment.y} L ${segment.x1} ${segment.y}`
                : `L ${segment.x0} ${segment.y} L ${segment.x1} ${segment.y}`,
            )
            .join(' ')} L ${futureRun[futureRun.length - 1]?.x1} ${baseline} L ${futureRun[0]?.x0} ${baseline} Z`}
          fill="#C7DDAE"
          opacity="0.25"
          stroke="#C7DDAE"
          strokeDasharray="4 4"
        />
      ) : null}
      <line x1={left} y1={baseline} x2={width - left} y2={baseline} stroke="#EADCCB" strokeWidth="2" />
      {months.map((month, index) => {
        const future = isFutureMonth(year, month.month, today)
        const center = left + slot * index + slot / 2
        const base = month.base ?? 0
        const extra = month.extras
        const showBar = !future && extra !== null && extra > 0
        const barHeight = showBar ? yFor(base, max) - yFor(base + extra, max) : 0
        const change = changes.has(month.month)
        return (
          <g key={month.month}>
            {showBar ? (
              <rect
                className="year-bar"
                x={center - 6}
                y={yFor(base + (extra ?? 0), max)}
                width="12"
                height={Math.max(barHeight, 4)}
                rx="5"
                fill="#F4C542"
                style={{ animationDelay: `${index * 40}ms` }}
              />
            ) : null}
            {change && month.base !== null ? (
              <g>
                <line
                  x1={left + slot * index}
                  y1={yFor(month.base, max)}
                  x2={left + slot * index}
                  y2={Math.max(yFor(month.base, max) - 36, 8)}
                  stroke="#4F6B57"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <g transform={`translate(${Math.min(left + slot * index - 28, width - 64)}, ${Math.max(yFor(month.base, max) - 52, 4)})`}>
                  <rect width="56" height="20" rx="10" fill="#4F6B57" />
                  <text x="28" y="14" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#ffffff">
                    Aumento
                  </text>
                </g>
              </g>
            ) : null}
            <text
              x={center}
              y="198"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill={future ? '#6B6656' : '#202808'}
            >
              {MONTH_INITIALS[index]}
              {future ? <title>aún no</title> : null}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
