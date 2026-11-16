import { useState } from 'react'
import { Link } from 'react-router'
import { AppIcon } from './AppIcon.tsx'
import { IconPicker } from './IconPicker.tsx'
import { MoneyField } from './MoneyField.tsx'
import { Sheet } from './Sheet.tsx'
import { Button, inputClass } from './ui.tsx'
import { createSaving } from '../lib/api.ts'
import { amountFromDigits } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'

export function NewSavingSheet({
  open,
  onClose,
  householdId,
  meId,
  partnerId: otherId,
  partnerLabel,
  onSaved,
  initialShared,
}: {
  open: boolean
  onClose: () => void
  householdId: string
  meId: string
  partnerId: string | null
  partnerLabel: string
  onSaved: (id: string) => void | Promise<void>
  initialShared?: boolean
}) {
  const hasPartner = Boolean(otherId)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(Boolean(initialShared && hasPartner))
  const [icon, setIcon] = useState(DEFAULT_ICON)
  const [digits, setDigits] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setName('')
      setShared(Boolean(initialShared && hasPartner))
      setIcon(DEFAULT_ICON)
      setDigits('')
      setTargetDate('')
      setError('')
    }
  }

  async function save() {
    if (!name.trim()) {
      setError('Poné un nombre.')
      return
    }
    const target = amountFromDigits(digits)
    setSaving(true)
    setError('')
    try {
      const id = await createSaving({
        householdId,
        name,
        icon,
        target: target > 0 ? target : null,
        targetDate: targetDate || null,
        isShared: shared && hasPartner,
        ownerId: shared && hasPartner ? null : meId,
      })
      await onSaved(id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude crear el ahorro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Nuevo ahorro"
      onClose={onClose}
      footer={
        <Button type="button" tall disabled={saving} onClick={() => void save()}>
          Guardar
        </Button>
      }
    >
      <label className="block text-sm font-semibold text-gris">
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={`mt-1 ${inputClass}`} />
      </label>

      <div className="mt-4">
        <p className="text-sm font-semibold text-gris">¿Con quién?</p>
        <div className="mt-2 grid h-[52px] grid-cols-2 gap-2" role="radiogroup" aria-label="Alcance">
          <button
            type="button"
            role="radio"
            aria-checked={shared}
            aria-disabled={!hasPartner || undefined}
            disabled={!hasPartner}
            onClick={() => hasPartner && setShared(true)}
            className={`rounded-2xl text-sm font-semibold ${
              !hasPartner
                ? 'border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado text-gris'
                : shared
                  ? 'border-2 border-tinta bg-azul-claro text-tinta'
                  : 'border-[1.5px] border-azul-ink bg-tarjeta text-tinta'
            }`}
          >
            {hasPartner ? `Con ${partnerLabel}` : 'Con tu compañera'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!shared}
            onClick={() => setShared(false)}
            className={`rounded-2xl text-sm font-semibold ${
              !shared ? 'border-2 border-tinta bg-azul-claro text-tinta' : 'border-[1.5px] border-azul-ink bg-tarjeta text-tinta'
            }`}
          >
            Solo yo
          </button>
        </div>
        {!hasPartner ? (
          <p className="mt-2 text-sm font-semibold text-gris">
            Para ahorrar con alguien, primero sumá a tu compañera.{' '}
            <Link to="/compartir" className="font-bold text-mostaza-ink">
              Invitarla
            </Link>
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-gris">Ícono</p>
        <IconPicker value={icon} onChange={setIcon} />
      </div>

      <div className="mt-4">
        <MoneyField label="Meta (opcional)" draft={digits} onDraft={setDigits} size="form" />
      </div>

      <label className="mt-4 block text-sm font-semibold text-gris">
        Para cuándo (opcional)
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={`mt-1 ${inputClass}`} />
      </label>

      {error ? (
        <p className="mt-3 flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
          <AppIcon name="circle-exclamation" /> {error}
        </p>
      ) : null}
    </Sheet>
  )
}
