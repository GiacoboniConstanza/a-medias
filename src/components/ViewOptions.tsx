import { useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { Sheet } from './Sheet.tsx'
import { ViewToggle } from './ViewToggle.tsx'
import type { ViewMode } from '../types/database.ts'

export function ViewOptions({
  mode,
  onChange,
  onHelp,
}: {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
  onHelp?: () => void
}) {
  const [open, setOpen] = useState(false)
  const friendly = mode === 'friendly'
  const short = friendly ? 'Amigable' : 'Contable'
  const width = friendly ? 'min-[360px]:w-[117px]' : 'min-[360px]:w-[113px]'
  return (
    <>
      <button
        type="button"
        aria-label={`Opciones de vista, modo ${short}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`inline-flex h-11 items-center justify-center gap-[5px] rounded-full border border-line bg-card px-2 max-[359px]:w-[50px] max-[359px]:px-0 ${width}`}
      >
        <span aria-hidden="true" className="inline-flex items-center gap-[5px]">
          <AppIcon name={friendly ? 'seedling' : 'table-list'} className="text-sm text-mostaza-ink" />
          <span className="text-sm font-semibold text-title max-[359px]:hidden">{short}</span>
        </span>
        <span aria-hidden="true">
          <AppIcon name="ellipsis" className="text-sm text-muted" />
        </span>
      </button>
      <Sheet open={open} title="Opciones de vista" onClose={() => setOpen(false)}>
        <p className="text-sm font-bold text-muted">Ver como</p>
        <ViewToggle mode={mode} onChange={onChange} className="mt-2" />
        {onHelp ? (
          <button
            type="button"
            className="mt-3 flex min-h-14 w-full items-center gap-2 rounded-2xl bg-sand-soft px-3 text-left"
            onClick={() => {
              setOpen(false)
              onHelp()
            }}
          >
            <AppIcon name="circle-question" className="text-mostaza-ink" />
            <span className="min-w-0 flex-1 text-base font-bold text-title">Cómo se lee esta pantalla</span>
            <AppIcon name="chevron-right" className="text-muted" />
          </button>
        ) : null}
      </Sheet>
    </>
  )
}
