import { useLayoutEffect, useRef, useState } from 'react'
import { formatMoney } from '../lib/format.ts'
import { abbreviateMoney } from '../lib/year-rows.ts'

/** Monto que abrevia si no entra en el ancho disponible. */
export function FitMoney({ value, className = '' }: { value: number; className?: string }) {
  const full = formatMoney(value)
  const boxRef = useRef<HTMLSpanElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [tight, setTight] = useState(false)

  useLayoutEffect(() => {
    const box = boxRef.current
    const probe = probeRef.current
    if (!box || !probe) return
    const measure = () => setTight(probe.offsetWidth > box.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [full])

  return (
    <span ref={boxRef} className={`relative block min-w-0 truncate tabular-nums ${className}`}>
      <span ref={probeRef} className="invisible absolute top-0 left-0 whitespace-nowrap" aria-hidden="true">
        {full}
      </span>
      <span aria-hidden="true">{tight ? abbreviateMoney(value) : full}</span>
      <span className="sr-only">{full}</span>
    </span>
  )
}
