import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AppIcon } from './AppIcon.tsx'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mb-3 rounded-[22px] bg-white p-3.5 shadow-card ${className}`}>{children}</section>
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'alt' | 'pink' }) {
  const tone = {
    primary: 'bg-brand text-white',
    alt: 'bg-chip text-brand',
    pink: 'bg-pink text-white',
  }[variant]
  return (
    <button
      className={`block min-h-11 w-full rounded-[18px] px-4 py-3 text-center text-base font-semibold disabled:opacity-50 ${tone} ${className}`}
      {...props}
    />
  )
}

export function Chip({
  active = false,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-2xl border-2 px-3 text-sm font-semibold ${
        active ? 'border-active bg-active text-white' : 'border-edge bg-white text-ink'
      }`}
    >
      {active ? <AppIcon name="check" /> : null}
      {children}
    </button>
  )
}

export function Progress({ value, color }: { value: number; color: string }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2.5 overflow-hidden rounded-lg bg-line">
      <div className="h-full rounded-lg" style={{ width: `${width}%`, background: color }} />
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
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-2xl border-2 border-edge bg-white px-3 py-3 text-base font-semibold text-ink"
      />
    </label>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="mt-2 text-center text-sm font-bold text-bad">{children}</p>
}
