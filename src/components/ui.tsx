import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AppIcon } from './AppIcon.tsx'

export const inputClass =
  'min-h-11 w-full rounded-2xl border border-line bg-sand-soft px-3 py-2 text-base font-semibold text-title placeholder:text-muted'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mb-3 rounded-3xl bg-card p-4 shadow-card ${className}`}>{children}</section>
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'alt' | 'pink' }) {
  const tone = {
    primary: 'bg-primary text-on-primary',
    alt: 'bg-sand text-primary',
    pink: 'bg-primary text-on-primary',
  }[variant]
  return (
    <button
      className={`block min-h-11 w-full rounded-2xl px-4 py-3 text-center text-base font-semibold disabled:opacity-50 ${tone} ${className}`}
      {...props}
    />
  )
}

export function FilterBar({
  options,
  value,
  onChange,
  label = 'Filtro',
}: {
  options: readonly { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto" role="group" aria-label={label}>
      {options.map((option) => (
        <Chip key={option.id} active={value === option.id} onClick={() => onChange(option.id)}>
          {option.label}
        </Chip>
      ))}
    </div>
  )
}

export function Chip({
  active = false,
  children,
  onClick,
  className = '',
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-semibold ${
        active ? 'bg-primary text-on-primary' : 'border border-line bg-card text-title'
      } ${className}`}
    >
      {active ? <AppIcon name="check" /> : null}
      {children}
    </button>
  )
}

export function Progress({ value, color }: { value: number; color: string }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-sand">
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
    </div>
  )
}

export function NotesField({
  value,
  onChange,
  readOnly = false,
}: {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
}) {
  return (
    <label className="mb-3 block text-base font-bold text-muted">
      Observaciones
      <textarea
        value={value}
        readOnly={readOnly}
        rows={3}
        maxLength={500}
        onChange={(event) => onChange?.(event.target.value.slice(0, 500))}
        placeholder="Opcional"
        className={`mt-1 ${inputClass} resize-none`}
      />
    </label>
  )
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="mb-3 block text-sm font-bold">
      <span className="mb-1 block text-muted">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </label>
  )
}

export function Toggle({
  checked,
  labelledBy,
  onClick,
  disabled,
}: {
  checked: boolean
  labelledBy: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-11 w-16 shrink-0 rounded-full border border-line disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-sand'}`}
    >
      <span
        className={`absolute left-1 top-1.5 h-8 w-8 rounded-full bg-sand-soft shadow-soft transition-transform motion-reduce:transition-none ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export function Toast({
  children,
  onUndo,
  onDone,
  aboveFab = false,
}: {
  children: string
  onUndo?: () => void | boolean | Promise<void | boolean>
  onDone?: () => void
  aboveFab?: boolean
}) {
  const [followup, setFollowup] = useState('')
  const [hidden, setHidden] = useState(false)
  const [paused, setPaused] = useState(false)
  const onDoneRef = useRef(onDone)
  const onUndoRef = useRef(onUndo)
  const left = useRef(6000)
  const started = useRef(0)
  onDoneRef.current = onDone
  onUndoRef.current = onUndo
  const shown = hidden ? '' : followup || children

  useEffect(() => {
    if (followup) return
    setHidden(false)
  }, [children, followup])

  useEffect(() => {
    left.current = 6000
  }, [shown])

  useEffect(() => {
    if (!shown || paused) return
    started.current = Date.now()
    const timeout = window.setTimeout(() => {
      setFollowup('')
      setHidden(true)
      onDoneRef.current?.()
    }, left.current)
    return () => {
      left.current = Math.max(0, left.current - (Date.now() - started.current))
      window.clearTimeout(timeout)
    }
  }, [shown, paused])

  if (!shown) return null

  async function undo() {
    const result = await onUndoRef.current?.()
    if (result !== false) setFollowup('Listo, lo deshicimos')
  }

  return (
    <div
      role="status"
      aria-live="polite"
      tabIndex={-1}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`fixed left-1/2 z-50 flex w-[min(398px,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-2xl bg-title py-1 pl-4 pr-1.5 text-card shadow-toast ${
        aboveFab ? 'bottom-40' : 'bottom-[86px]'
      }`}
    >
      <AppIcon name="circle-check" className="shrink-0" />
      <p className="min-w-0 flex-1 text-base font-semibold">{shown}</p>
      {onUndo && !followup ? (
        <button type="button" className="min-h-11 shrink-0 px-2 text-base font-bold text-sage-soft" onClick={() => void undo()}>
          Deshacer
        </button>
      ) : null}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="mt-2 text-center text-sm font-bold text-alert-ink">{children}</p>
}

export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="mt-1 flex items-start gap-1.5 text-sm font-bold text-alert-ink">
      <AppIcon name="triangle-exclamation" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
