import type { ReactNode } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { Sheet } from './Sheet.tsx'
import { Button } from './ui.tsx'

export function ConfirmSheet({
  open,
  title,
  onClose,
  children,
  note,
  confirmLabel,
  onConfirm,
  disabled = false,
  busy = false,
  variant = 'primary',
  error,
  describedById,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  note?: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  busy?: boolean
  variant?: 'primary' | 'danger'
  error?: string | null
  describedById?: string
}) {
  return (
    <Sheet
      open={open}
      layer="confirm"
      title={title}
      onClose={busy ? () => undefined : onClose}
      footer={
        <div className="space-y-2">
          {error ? (
            <p className="text-sm font-bold text-tinta" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            variant={variant}
            tall={variant === 'danger'}
            onClick={onConfirm}
            disabled={disabled || busy}
            aria-busy={busy || undefined}
          >
            {confirmLabel}
          </Button>
          <Button type="button" variant="alt" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
        </div>
      }
    >
      {children}
      {note ? (
        <p
          id={describedById}
          className="mt-3 flex items-start gap-2 text-base font-semibold text-tinta"
        >
          <AppIcon name="circle-info" className="mt-1 shrink-0" />
          <span>{note}</span>
        </p>
      ) : null}
    </Sheet>
  )
}
