import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AppIcon } from './AppIcon.tsx'

export const inputClass =
  'min-h-11 w-full rounded-2xl border border-line bg-sand px-3 py-2 text-base font-semibold text-text placeholder:text-muted'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mb-3 rounded-3xl bg-card p-4 shadow-card ${className}`}>{children}</section>
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'alt' | 'pink' }) {
  const tone = {
    primary: 'bg-primary text-white',
    alt: 'bg-sand text-primary',
    pink: 'bg-primary text-white',
  }[variant]
  return (
    <button
      className={`block min-h-11 w-full rounded-2xl px-4 py-3 text-center text-base font-semibold disabled:opacity-50 ${tone} ${className}`}
      {...props}
    />
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
        active ? 'bg-primary text-white' : 'border border-line bg-card text-text'
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

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="mt-2 text-center text-sm font-bold text-alert-ink">{children}</p>
}
