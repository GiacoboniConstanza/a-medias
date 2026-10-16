import type { ButtonHTMLAttributes, ReactNode } from 'react'

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
      className={`block w-full rounded-[18px] px-4 py-3 text-center text-base font-extrabold disabled:opacity-50 ${tone} ${className}`}
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
      className={`m-0.5 inline-block rounded-2xl px-3 py-1.5 text-[13px] font-bold ${active ? 'bg-brand text-white' : 'bg-chip text-ink'}`}
    >
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
        className="w-full rounded-2xl border border-line bg-white px-3 py-3 text-base font-bold text-ink outline-none focus:border-brand"
      />
    </label>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="mt-2 text-center text-sm font-bold text-bad">{children}</p>
}
