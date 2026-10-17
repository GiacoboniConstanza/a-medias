import type { ReactNode } from 'react'
import { AppIcon } from './AppIcon.tsx'

export function SectionHeader({
  icon,
  title,
  aside,
  className = '',
}: {
  icon: string
  title: string
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={`flex items-baseline justify-between gap-3 ${className}`}>
      <h1 className="inline-flex items-baseline gap-1.5 text-[15px] font-semibold text-muted">
        <AppIcon name={icon} className="text-[13px]" />
        {title}
      </h1>
      {aside}
    </header>
  )
}

export function AudiencePill({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-px text-xs font-semibold leading-none text-text shadow-soft">
      <AppIcon name={icon} className="text-[10px]" />
      {children}
    </span>
  )
}
