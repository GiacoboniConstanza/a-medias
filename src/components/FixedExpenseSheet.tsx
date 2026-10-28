import { useEffect, useId, useState } from 'react'
import { IconPicker } from './IconPicker.tsx'
import { amountFromDigits, applyKey, Keypad } from './Keypad.tsx'
import { Sheet } from './Sheet.tsx'
import { Chip, ErrorText, inputClass, Toggle } from './ui.tsx'
import type { FixedItem } from '../lib/api.ts'
import { editedCaption, remindSwitchLabel, shareSentence } from '../lib/fixed.ts'
import { formatMoney } from '../lib/format.ts'

const primaryButton = 'block min-h-11 w-full rounded-2xl bg-primary text-base font-bold text-white disabled:opacity-50'
const quietButton = 'block min-h-11 w-full rounded-2xl text-base font-bold text-primary disabled:opacity-50'
const dangerButton = 'block min-h-11 w-full rounded-2xl text-base font-bold text-alert-ink disabled:opacity-50'

export type FixedDraft = {
  title: string
  icon: string
  amount: number
  dueDay: number
  shared: boolean
  remind: boolean
  amountChanged: boolean
  applies: 'this' | 'next' | null
}

export function FixedExpenseSheet({
  open,
  expense,
  saving,
  error,
  leadDays,
  myPercent,
  partnerPercent,
  partnerName,
  splitEven,
  editorName,
  paid,
  onClose,
  onSubmit,
  onPause,
  onDelete,
  onPay,
  onUndo,
}: {
  open: boolean
  expense: FixedItem | null
  saving: boolean
  error: string
  leadDays: number
  myPercent: number
  partnerPercent: number
  partnerName: string
  splitEven: boolean
  editorName: string
  paid: boolean
  onClose: () => void
  onSubmit: (draft: FixedDraft) => void
  onPause: (paused: boolean) => void
  onDelete: () => void
  onPay: () => void
  onUndo: () => void
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
          leadDays={leadDays}
          myPercent={myPercent}
          partnerPercent={partnerPercent}
          partnerName={partnerName}
          splitEven={splitEven}
          editorName={editorName}
          paid={paid}
          confirming={confirming}
          onConfirming={setConfirming}
          onClose={onClose}
          onSubmit={onSubmit}
          onPause={onPause}
          onDelete={onDelete}
          onPay={onPay}
          onUndo={onUndo}
        />
      ) : null}
    </Sheet>
  )
}

function FixedExpenseForm({
  expense,
  saving,
  error,
  leadDays,
  myPercent,
  partnerPercent,
  partnerName,
  splitEven,
  editorName,
  paid,
  confirming,
  onConfirming,
  onClose,
  onSubmit,
  onPause,
  onDelete,
  onPay,
  onUndo,
}: {
  expense: FixedItem | null
  saving: boolean
  error: string
  leadDays: number
  myPercent: number
  partnerPercent: number
  partnerName: string
  splitEven: boolean
  editorName: string
  paid: boolean
  confirming: boolean
  onConfirming: (value: boolean) => void
  onClose: () => void
  onSubmit: (draft: FixedDraft) => void
  onPause: (paused: boolean) => void
  onDelete: () => void
  onPay: () => void
  onUndo: () => void
}) {
  const remindId = useId()
  const original = expense ? Math.round(expense.amount) : 0
  const [title, setTitle] = useState(expense?.title ?? '')
  const [icon, setIcon] = useState(expense?.icon ?? 'house')
  const [digits, setDigits] = useState(expense ? String(original) : '')
  const [dueDay, setDueDay] = useState(String(expense?.dueDay ?? 10))
  const [shared, setShared] = useState(expense?.isShared ?? true)
  const [remind, setRemind] = useState(expense?.remind ?? true)
  const [applies, setApplies] = useState<'this' | 'next' | null>(null)
  const [localError, setLocalError] = useState('')
  const amount = amountFromDigits(digits)
  const day = Number(dueDay)
  const amountChanged = Boolean(expense) && amount !== original
  const shownError = localError || error
  const caption = expense?.updatedAt ? editedCaption(expense.updatedAt, editorName) : null

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
      remind,
      amountChanged,
      applies,
    })
  }

  if (confirming && expense) {
    return (
      <div>
        <p className="font-display text-xl font-semibold">¿Eliminar {expense.title}?</p>
        <p className="mt-2 text-sm font-semibold text-text">Se borra el recordatorio. Los gastos ya anotados quedan.</p>
        <button type="button" className={`mt-4 ${primaryButton} bg-alert-ink`} onClick={onDelete} disabled={saving}>
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
      {amountChanged ? (
        <p className="mb-2 text-center text-sm font-semibold text-muted">Antes: {formatMoney(original)}</p>
      ) : (
        <p className="mb-2 text-center text-sm font-semibold text-muted">Monto</p>
      )}
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
      <div className="mb-3 grid grid-cols-2 rounded-[18px] bg-sand p-1">
        <button
          type="button"
          aria-pressed={shared}
          onClick={() => setShared(true)}
          className={`min-h-11 rounded-[15px] text-sm font-extrabold ${shared ? 'bg-primary text-white' : 'text-muted'}`}
        >
          Compartido
        </button>
        <button
          type="button"
          aria-pressed={!shared}
          onClick={() => setShared(false)}
          className={`min-h-11 rounded-[15px] text-sm font-extrabold ${shared ? 'text-muted' : 'bg-primary text-white'}`}
        >
          Privado
        </button>
      </div>
      {shared ? (
        <p className="mb-3 text-sm font-semibold text-muted">{shareSentence(myPercent, partnerPercent, partnerName, splitEven)}</p>
      ) : null}
      {expense?.isShared && !shared ? (
        <p className="mb-3 text-sm font-semibold text-muted">Si lo guardás privado, la otra persona deja de verlo.</p>
      ) : null}
      {!expense?.isShared && expense && shared ? (
        <p className="mb-3 text-sm font-semibold text-muted">Si lo compartís, lo ven las dos.</p>
      ) : null}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p id={remindId} className="text-sm font-bold text-text">
          {remindSwitchLabel(leadDays)}
        </p>
        <Toggle labelledBy={remindId} checked={remind} onClick={() => setRemind((current) => !current)} />
      </div>
      {amountChanged ? (
        <div className="mb-3">
          <p className="mb-2 text-sm font-semibold text-text">¿Desde cuándo aplica?</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={applies === 'this'} onClick={() => setApplies('this')}>
              Este mes
            </Chip>
            <Chip active={applies === 'next'} onClick={() => setApplies('next')}>
              El mes que viene
            </Chip>
          </div>
        </div>
      ) : null}
      {expense && !paid ? (
        <button type="button" className={quietButton} onClick={onPay} disabled={saving}>
          Marcar como pagado
        </button>
      ) : null}
      {expense && paid ? (
        <button type="button" className={quietButton} onClick={onUndo} disabled={saving}>
          Deshacer
        </button>
      ) : null}
      <button type="button" className={`mt-3 ${primaryButton}`} onClick={submit} disabled={saving}>
        Guardar
      </button>
      <button type="button" className={`mt-2 ${quietButton}`} onClick={onClose} disabled={saving}>
        Cancelar
      </button>
      {expense ? (
        <div className="mt-4">
          <button type="button" className={quietButton} onClick={() => onPause(!expense.pausedAt)} disabled={saving}>
            {expense.pausedAt ? 'Reactivar' : 'Pausar'}
          </button>
          <button type="button" className={dangerButton} onClick={() => onConfirming(true)} disabled={saving}>
            Eliminar
          </button>
        </div>
      ) : null}
      {caption ? <p className="mt-3 text-center text-xs font-semibold text-muted">{caption}</p> : null}
      <ErrorText>{shownError}</ErrorText>
    </div>
  )
}
