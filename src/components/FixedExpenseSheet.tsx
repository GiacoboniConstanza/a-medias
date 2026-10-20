import { useEffect, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { IconPicker } from './IconPicker.tsx'
import { amountFromDigits, applyKey, Keypad } from './Keypad.tsx'
import { Sheet } from './Sheet.tsx'
import { Chip, ErrorText, inputClass } from './ui.tsx'
import type { FixedItem } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'

const primaryButton = 'block min-h-[52px] w-full rounded-2xl bg-primary text-base font-semibold text-white disabled:opacity-50'
const quietButton = 'block min-h-[52px] w-full rounded-2xl bg-sand text-base font-semibold text-primary disabled:opacity-50'
const dangerButton = 'block min-h-[52px] w-full rounded-2xl bg-alert-ink text-base font-semibold text-white disabled:opacity-50'

export type FixedDraft = {
  title: string
  icon: string
  amount: number
  dueDay: number
  shared: boolean
  remindDaysBefore: number
  amountChanged: boolean
  applies: 'this' | 'next' | null
}

export function FixedExpenseSheet({
  open,
  expense,
  saving,
  error,
  onClose,
  onSubmit,
  onPause,
  onDelete,
}: {
  open: boolean
  expense: FixedItem | null
  saving: boolean
  error: string
  onClose: () => void
  onSubmit: (draft: FixedDraft) => void
  onPause: (paused: boolean) => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    setConfirming(false)
  }, [expense?.id, open])

  return (
    <Sheet
      open={open}
      title={confirming ? 'Eliminar gasto fijo' : expense ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}
      onClose={onClose}
    >
      {open ? (
        <FixedExpenseForm
          key={expense?.id ?? 'new'}
          expense={expense}
          saving={saving}
          error={error}
          confirming={confirming}
          onConfirming={setConfirming}
          onSubmit={onSubmit}
          onPause={onPause}
          onDelete={onDelete}
        />
      ) : null}
    </Sheet>
  )
}

function FixedExpenseForm({
  expense,
  saving,
  error,
  confirming,
  onConfirming,
  onSubmit,
  onPause,
  onDelete,
}: {
  expense: FixedItem | null
  saving: boolean
  error: string
  confirming: boolean
  onConfirming: (value: boolean) => void
  onSubmit: (draft: FixedDraft) => void
  onPause: (paused: boolean) => void
  onDelete: () => void
}) {
  const original = expense ? Math.round(expense.amount) : 0
  const [title, setTitle] = useState(expense?.title ?? '')
  const [icon, setIcon] = useState(expense?.icon ?? 'house')
  const [digits, setDigits] = useState(expense ? String(original) : '')
  const [dueDay, setDueDay] = useState(String(expense?.dueDay ?? 10))
  const [shared, setShared] = useState(expense?.isShared ?? true)
  const [remindDays, setRemindDays] = useState(expense?.remindDaysBefore ?? 2)
  const [applies, setApplies] = useState<'this' | 'next' | null>(null)
  const [localError, setLocalError] = useState('')
  const amount = amountFromDigits(digits)
  const day = Number(dueDay)
  const amountChanged = Boolean(expense) && amount !== original
  const shownError = localError || error

  function submit() {
    if (!title.trim() || amount <= 0 || day < 1 || day > 28) {
      setLocalError('Completá nombre, monto y un día del 1 al 28.')
      return
    }
    if (amountChanged && !applies) {
      setLocalError('Elegí desde cuándo aplica el monto.')
      return
    }
    setLocalError('')
    onSubmit({
      title: title.trim(),
      icon,
      amount,
      dueDay: day,
      shared,
      remindDaysBefore: remindDays,
      amountChanged,
      applies,
    })
  }

  if (confirming && expense) {
    return (
      <div>
        <p className="font-display text-xl font-semibold">¿Eliminar {expense.title}?</p>
        <p className="mt-2 text-sm font-semibold text-text">Se borra el recordatorio. Los gastos ya anotados quedan.</p>
        <button type="button" className={`mt-4 ${dangerButton}`} onClick={onDelete} disabled={saving}>
          Eliminar
        </button>
        <button type="button" className={`mt-2 ${quietButton}`} onClick={() => onConfirming(false)} disabled={saving}>
          Volver
        </button>
      </div>
    )
  }

  return (
    <div>
      <label className="mb-3 block text-sm font-bold text-muted">
        Nombre
        <input value={title} onChange={(event) => setTitle(event.target.value)} className={`mt-1 ${inputClass}`} placeholder="Alquiler, luz, obra social…" />
      </label>
      <p className="mb-2 text-sm font-bold text-muted">Ícono</p>
      <IconPicker layout="grid" value={icon} onChange={setIcon} />
      <p className="mb-1 mt-4 text-center font-display text-[2.5rem] font-semibold leading-none">{formatMoney(amount)}</p>
      <p className="mb-2 text-center text-sm font-semibold text-muted">Monto</p>
      <Keypad onKey={(key) => setDigits((current) => applyKey(current, key))} />
      <label className="mb-3 mt-4 block text-sm font-bold text-muted">
        Día de vencimiento
        <input
          value={dueDay}
          onChange={(event) => setDueDay(event.target.value.replace(/\D/g, '').slice(0, 2))}
          inputMode="numeric"
          className={`mt-1 text-center font-display text-2xl ${inputClass}`}
        />
      </label>
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip active={shared} onClick={() => setShared(true)}>
          <AppIcon name="user-group" /> Compartido
        </Chip>
        <Chip active={!shared} onClick={() => setShared(false)}>
          <AppIcon name="lock" /> Privado
        </Chip>
      </div>
      {expense?.isShared && !shared ? (
        <p className="mb-3 text-sm font-semibold text-muted">Si lo guardás privado, la otra persona deja de verlo.</p>
      ) : null}
      {!expense?.isShared && expense && shared ? (
        <p className="mb-3 text-sm font-semibold text-muted">Si lo compartís, lo ven las dos.</p>
      ) : null}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text">{remindCopy(remindDays)}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-sand font-display text-xl font-semibold text-text"
            aria-label="Menos días de anticipación"
            onClick={() => setRemindDays((current) => Math.max(0, current - 1))}
          >
            −
          </button>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-sand font-display text-xl font-semibold text-text"
            aria-label="Más días de anticipación"
            onClick={() => setRemindDays((current) => Math.min(28, current + 1))}
          >
            +
          </button>
        </div>
      </div>
      {amountChanged ? (
        <div className="mb-3">
          <p className="mb-2 text-sm font-semibold text-text">¿Desde cuándo aplica?</p>
          <div className="grid gap-2">
            <Chip active={applies === 'this'} onClick={() => setApplies('this')} className="w-full">
              Desde este mes
            </Chip>
            <Chip active={applies === 'next'} onClick={() => setApplies('next')} className="w-full">
              Desde el mes que viene
            </Chip>
          </div>
        </div>
      ) : null}
      {expense ? (
        <div className="mt-2 grid gap-2">
          <button type="button" className={quietButton} onClick={() => onPause(!expense.pausedAt)} disabled={saving}>
            {expense.pausedAt ? 'Reactivar' : 'Pausar'}
          </button>
          <button type="button" className={dangerButton} onClick={() => onConfirming(true)} disabled={saving}>
            Eliminar
          </button>
        </div>
      ) : null}
      <button type="button" className={`mt-3 ${primaryButton}`} onClick={submit} disabled={saving}>
        Guardar
      </button>
      <ErrorText>{shownError}</ErrorText>
    </div>
  )
}

function remindCopy(days: number): string {
  if (days === 0) return 'Aviso el mismo día'
  if (days === 1) return 'Aviso 1 día antes'
  return `Aviso ${days} días antes`
}
