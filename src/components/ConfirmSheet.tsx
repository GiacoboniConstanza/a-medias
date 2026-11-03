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
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  note?: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
}) {
  return (
    <Sheet
      open={open}
      layer="confirm"
      title={title}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <Button type="button" onClick={onConfirm} disabled={disabled}>
            {confirmLabel}
          </Button>
          <Button type="button" variant="alt" onClick={onClose} disabled={disabled}>
            Cancelar
          </Button>
        </div>
      }
    >
      {children}
      {note ? (
        <p className="mt-3 flex items-start gap-2 text-base font-semibold text-muted">
          <AppIcon name="circle-info" className="mt-1 shrink-0" />
          <span>{note}</span>
        </p>
      ) : null}
    </Sheet>
  )
}
