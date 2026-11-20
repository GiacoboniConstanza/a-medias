import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AppIcon } from './AppIcon.tsx'

export const inputClass =
  'min-h-11 w-full rounded-2xl border border-line bg-sand-soft px-3 py-2 text-base font-semibold text-title placeholder:text-muted'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mb-3 rounded-2xl bg-card p-4 border-2 border-azul-ink ${className}`}>{children}</section>
}

export function Button({
  variant = 'primary',
  tall = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'alt' | 'secondary' | 'pink' | 'danger'
  tall?: boolean
}) {
  const off = Boolean(props.disabled || props['aria-disabled'])
  const tone = off
    ? 'border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado text-gris'
    : {
        primary: 'border-[1.5px] border-tinta bg-mostaza text-tinta',
        alt: 'border-[1.5px] border-azul-ink bg-card text-tinta',
        secondary: 'border-[1.5px] border-mostaza-ink bg-card text-mostaza-ink',
        pink: 'border-[1.5px] border-tinta bg-mostaza text-tinta',
        danger: 'border-[1.5px] border-tinta bg-card text-tinta',
      }[variant]
  const main = variant === 'primary' || variant === 'pink'
  const height = main || tall ? 'min-h-[52px]' : 'min-h-11'
  return (
    <button
      className={`block w-full rounded-full px-4 py-3 text-center font-semibold ${main ? 'text-lg' : 'text-base'} ${height} ${tone} ${className}`}
      {...props}
    />
  )
}

export function Chip({
  active = false,
  children,
  onClick,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm ${
        active ? 'border-[1.5px] border-azul-ink bg-azul-claro font-bold text-tinta' : 'border-[1.5px] border-azul bg-card font-semibold text-tinta'
      } ${className}`}
      {...props}
    >
      {active ? <AppIcon name="check" /> : null}
      {children}
    </button>
  )
}

export function Progress({ value, color }: { value: number; color: string }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div className="h-3 overflow-hidden rounded-full border-[1.5px] border-tinta bg-azul-claro">
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

/** Switch de Finanzas: pista h-10 w-16, perilla tinta con check (como «¿Es compartido?»). */
export function Toggle({
  checked,
  labelledBy,
  label,
  onClick,
  disabled,
  className = '',
}: {
  checked: boolean
  labelledBy?: string
  /** Si hay label, el control ocupa el ancho y el texto va a la izquierda. */
  label?: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  const track = (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-10 w-16 shrink-0 items-center rounded-full border-[1.5px] px-1 ${
        checked ? 'justify-end border-tinta bg-mostaza' : 'justify-start border-gris bg-tarjeta'
      }`}
    >
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
          checked ? 'bg-tinta text-mostaza' : 'bg-gris text-tarjeta'
        }`}
      >
        {checked ? <AppIcon name="check" className="text-[14px]" /> : null}
      </span>
    </span>
  )
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        label
          ? `flex min-h-[52px] w-full items-center justify-between gap-3 disabled:opacity-50 ${className}`
          : `shrink-0 disabled:opacity-50 ${className}`
      }
    >
      {label ? <span className="text-left text-lg font-medium text-tinta">{label}</span> : null}
      {track}
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
      className={`fixed left-1/2 z-50 flex w-[min(398px,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-2xl bg-aviso py-1 pl-4 pr-1.5 text-base text-aviso-texto shadow-toast ${
        aboveFab ? 'bottom-[var(--espacio-aviso-abajo-con-fab)]' : 'bottom-[var(--espacio-aviso-abajo,86px)]'
      }`}
    >
      <AppIcon name="circle-check" className="shrink-0" />
      <p className="min-w-0 flex-1 text-base font-semibold">{shown}</p>
      {onUndo && !followup ? (
        <button type="button" className="min-h-11 shrink-0 px-2 text-base font-bold text-aviso-accion" onClick={() => void undo()}>
          Deshacer
        </button>
      ) : null}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="mt-2 text-center text-sm font-bold text-tinta">{children}</p>
}

export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="mt-1 flex items-start gap-1.5 text-sm font-bold text-tinta">
      <AppIcon name="triangle-exclamation" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
