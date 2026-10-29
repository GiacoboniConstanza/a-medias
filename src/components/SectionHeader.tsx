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
    <header className={`mb-4 flex items-center justify-between gap-3 ${className}`}>
      <h1 className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-muted">
        <AppIcon name={icon} className="text-[13px]" />
        {title}
      </h1>
      {aside}
    </header>
  )
}

export function AudiencePill({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border border-[#E8DCCB] bg-card px-3 py-1.5 text-[13px] font-semibold leading-normal text-text shadow-[0_1px_2px_#c4866d18]">
      <AppIcon name={icon} className="text-[12px]" />
      {children}
    </span>
  )
}
