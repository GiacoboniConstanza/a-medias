import { useState } from 'react'
import { amountFromDigits } from '../lib/format.ts'
import { MoneyField } from './MoneyField.tsx'
import { Sheet } from './Sheet.tsx'
import { Button, Chip } from './ui.tsx'
import { formatMoney, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import type { ContributionMode } from '../types/database.ts'

export function ContributeSheet({
  open,
  suggested,
  onClose,
  onSaved,
}: {
  open: boolean
  suggested: number | null
  onClose: () => void
  onSaved: (amount: number, mode: ContributionMode) => Promise<void>
}) {
  const [mode, setMode] = useState<ContributionMode>('percentage')
  const [digits, setDigits] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [seenOpen, setSeenOpen] = useState(open)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setMode('percentage')
      setDigits(suggested ? moneyDraftFromAmount(suggested) : '')
      setTouched(false)
      setSaving(false)
      setServerError('')
    }
  }

  const amount = normalizeMoney(amountFromDigits(digits))
  const amountError = amount > 0 ? '' : 'Poné cuánto querés aportar.'
  const visibleError = serverError || (touched ? amountError : '')

  function choose(next: ContributionMode) {
    setMode(next)
    if (next === 'percentage') setDigits(suggested ? moneyDraftFromAmount(suggested) : '')
  }

  async function save() {
    setTouched(true)
    if (amount <= 0 || saving) return
    setSaving(true)
    setServerError('')
    try {
      await onSaved(amount, mode)
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'No pude anotar el aporte.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Sumar a la meta"
      onClose={onClose}
      footer={
        <>
          <Button type="button" tall disabled={saving} onClick={() => void save()}>
            Aportar
          </Button>
          <Button type="button" tall variant="alt" className="mt-2" onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Cómo aportar">
        <Chip active={mode === 'free'} onClick={() => choose('free')} className="min-h-[52px] w-full">
          Monto libre
        </Chip>
        <Chip active={mode === 'percentage'} onClick={() => choose('percentage')} className="min-h-[52px] w-full">
          Según mi %
        </Chip>
      </div>
      {mode === 'percentage' && suggested ? (
        <p className="mt-2 text-sm font-semibold text-muted">Según tu sueldo te toca {formatMoney(suggested)}.</p>
      ) : null}
      <div className="mt-4">
        <MoneyField
          draft={digits}
          onDraft={(value) => {
            setTouched(true)
            setDigits(value)
          }}
          error={visibleError}
          size="display"
        />
      </div>
    </Sheet>
  )
}
