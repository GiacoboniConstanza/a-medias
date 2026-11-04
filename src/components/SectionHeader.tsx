import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ModuleId } from '../lib/modules.ts'
import { AppIcon } from './AppIcon.tsx'
import { ModuleCrumb, ModuleTitle } from './ModulePill.tsx'

export function SectionHeader({
  icon,
  title,
  aside,
  className = '',
  lead,
  name,
  backTo = '/',
  module = 'finanzas',
  screenTitle = false,
}: {
  icon?: string
  title?: string
  aside?: ReactNode
  className?: string
  lead?: 'crumb' | 'title' | 'back' | 'greeting'
  name?: string
  backTo?: string
  module?: ModuleId
  screenTitle?: boolean
}) {
  if (!lead) {
    return (
      <header className={`mb-4 flex items-center justify-between gap-3 ${className}`}>
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold text-muted">
          <AppIcon name={icon ?? 'tag'} className="text-base" />
          {title}
        </h1>
        {aside}
      </header>
    )
  }

  let left: ReactNode
  if (lead === 'crumb') left = <ModuleCrumb module={module} />
  else if (lead === 'title') left = <ModuleTitle module={module} />
  else if (lead === 'greeting') {
    left = (
      <p className="min-w-0 font-display text-xl font-medium text-title">
        <AppIcon name="house" className="mr-1.5 text-tinta" />
        Hola, {name}
      </p>
    )
  } else {
    left = (
      <div className="flex min-w-0 items-center">
        <Link to={backTo} aria-label="Volver" className="grid h-11 w-11 shrink-0 place-items-center text-tinta">
          <AppIcon name="chevron-left" className="text-base" />
        </Link>
        {screenTitle && title ? (
          <h1 className="min-w-0 truncate font-display text-[26px] font-semibold leading-tight text-title">{title}</h1>
        ) : icon && title ? (
          <h1 className="inline-flex min-w-0 items-center gap-1.5 font-display text-xl font-medium text-title">
            <AppIcon name={icon} />
            {title}
          </h1>
        ) : null}
      </div>
    )
  }

  return (
    <header className={`mb-4 flex items-center justify-between gap-1 ${className}`}>
      {left}
      {aside ? <div className="flex shrink-0 items-center">{aside}</div> : null}
    </header>
  )
}

export function AudiencePill({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold leading-normal text-title shadow-soft">
      <AppIcon name={icon} className="text-sm" />
      {children}
    </span>
  )
}
