import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from './AppIcon.tsx'
import { inputClass } from './ui.tsx'
import type { DatePreset } from '../lib/expense-range.ts'

export const PERIODS: { id: DatePreset; label: string }[] = [
  { id: 'month', label: 'Todo el mes' },
  { id: 'week1', label: 'Semana 1' },
  { id: 'week2', label: 'Semana 2' },
  { id: 'week3', label: 'Semana 3' },
  { id: 'rest', label: 'Semana 4/5' },
  { id: 'weekends', label: 'Fines de semana' },
  { id: 'custom', label: 'Elegir días' },
]

export type FilterCategory = { id: string; name: string; icon: string }

export type ExpenseFilters = {
  preset: DatePreset
  customFrom: string
  customTo: string
  categoryIds: string[]
}

export function FilterSheet({
  open,
  friendly,
  month,
  end,
  categories,
  initial,
  onClose,
  onApply,
}: {
  open: boolean
  friendly: boolean
  month: string
  end: string
  categories: FilterCategory[]
  initial: ExpenseFilters
  onClose: () => void
  onApply: (filters: ExpenseFilters) => void
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [drag, setDrag] = useState(0)
  const dragStart = useRef(0)
  const dragRef = useRef(0)
  const dragging = useRef(false)
  const initialRef = useRef(initial)
  initialRef.current = initial
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [preset, setPreset] = useState(initial.preset)
  const [customFrom, setCustomFrom] = useState(initial.customFrom)
  const [customTo, setCustomTo] = useState(initial.customTo)
  const [categoryIds, setCategoryIds] = useState(initial.categoryIds)
  const [seenOpen, setSeenOpen] = useState(open)
  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      const current = initialRef.current
      setPreset(current.preset)
      setCustomFrom(current.customFrom)
      setCustomTo(current.customTo)
      setCategoryIds(current.categoryIds)
    }
  }

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timeout = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open || !mounted) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const frame = requestAnimationFrame(() => dialog?.focus())
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null

    function focusable() {
      if (!dialog) return []
      return [...dialog.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter(
        (element) => !element.hasAttribute('disabled'),
      )
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      root?.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      previousFocus?.focus()
    }
  }, [open, mounted])

  if (!mounted) return null

  function choosePreset(next: DatePreset) {
    setPreset(next)
    if (next !== 'custom') return
    setCustomFrom((current) => (current >= month && current <= end ? current : month))
    setCustomTo((current) => (current >= month && current <= end ? current : end))
  }

  function toggleCategory(id: string) {
    setCategoryIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function clearDraft() {
    setPreset('month')
    setCustomFrom(month)
    setCustomTo(end)
    setCategoryIds([])
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = true
    dragStart.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    const next = Math.max(0, event.clientY - dragStart.current)
    dragRef.current = next
    setDrag(next)
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    if (dragRef.current > 72) onCloseRef.current()
    dragRef.current = 0
    setDrag(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Cerrar filtros"
        className={`absolute inset-0 bg-[#202808]/45 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[min(86dvh,760px)] w-full max-w-[430px] flex-col rounded-t-[32px] bg-card shadow-card outline-none transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <div
          className="flex touch-none justify-center pb-1 pt-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1.5 w-12 rounded-full bg-[#E8DCCB]" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pb-2">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            Filtrar gastos
          </h2>
          <button type="button" onClick={clearDraft} className="inline-flex min-h-11 items-center text-sm font-extrabold text-primary">
            Limpiar filtros
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-3">
          <p className="mb-2 font-display text-base font-semibold">¿Cuándo?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
            {PERIODS.map((period) => (
              <SheetChip key={period.id} active={preset === period.id} onClick={() => choosePreset(period.id)}>
                {period.label}
              </SheetChip>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block text-sm font-bold text-muted">
                Desde
                <input
                  type="date"
                  min={month}
                  max={end}
                  value={customFrom || month}
                  onChange={(event) => {
                    const next = event.target.value
                    setCustomFrom(next)
                    setCustomTo((current) => ((current || end) < next ? next : current))
                  }}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="block text-sm font-bold text-muted">
                Hasta
                <input
                  type="date"
                  min={month}
                  max={end}
                  value={customTo || end}
                  onChange={(event) => {
                    const next = event.target.value
                    setCustomTo(next)
                    setCustomFrom((current) => ((current || month) > next ? next : current))
                  }}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </div>
          ) : null}
          {friendly ? null : (
            <>
              <p className="mb-2 mt-5 font-display text-base font-semibold">Categoría</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
                <SheetChip active={categoryIds.length === 0} onClick={() => setCategoryIds([])}>
                  Todas
                </SheetChip>
                {categories.map((category) => (
                  <SheetChip
                    key={category.id}
                    active={categoryIds.includes(category.id)}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <AppIcon name={category.icon} /> {category.name}
                  </SheetChip>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="mt-auto border-t border-line px-5 pb-6 pt-3">
          <button
            type="button"
            onClick={() => onApply({ preset, customFrom, customTo, categoryIds: friendly ? [] : categoryIds })}
            className="block min-h-[52px] w-full rounded-2xl bg-primary text-base font-semibold text-white"
          >
            Ver gastos
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 block min-h-[52px] w-full rounded-2xl border-2 border-primary bg-card text-base font-semibold text-primary"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SheetChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border-2 px-3 text-sm font-semibold text-text ${
        active ? 'border-primary bg-sage-light' : 'border-[#E8DCCB] bg-white'
      }`}
    >
      {active ? <AppIcon name="check" /> : null}
      {children}
    </button>
  )
}
