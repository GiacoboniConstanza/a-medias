import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { amountFromDigits, applyKey, Keypad } from '../components/Keypad.tsx'
import { Button, Chip, ErrorText, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { createCategory, createExpense, type Category } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { todayISO } from '../lib/month.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { suggestCategoryId } from '../lib/mpReceipt.ts'

export type ExpensePrefill = {
  amount: number | null
  title: string | null
  spentOn: string | null
  missingAmount: boolean
  missingTitle: boolean
  missingDate: boolean
}

export function ExpenseScreen({ prefill, onCancel, onDone }: { prefill?: ExpensePrefill; onCancel?: () => void; onDone?: () => void } = {}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, refresh } = useFinance()
  const [digits, setDigits] = useState(() => digitsFromAmount(prefill?.amount ?? null))
  const [shared, setShared] = useState(true)
  const [payerId, setPayerId] = useState(profile?.id ?? '')
  const [spentOn, setSpentOn] = useState(prefill?.spentOn || todayISO())
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [dateTouched, setDateTouched] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftIcon, setDraftIcon] = useState(DEFAULT_ICON)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!profile?.householdId || !data) {
    return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  }

  const householdId = profile.householdId
  const meId = profile.id
  const people = Object.entries(data.names)
  const categories = data.categories.filter((category) => (shared ? category.ownerId === null : category.ownerId === meId))
  const suggestedId = suggestCategoryId(prefill?.title ?? null, categories)
  const amount = amountFromDigits(digits)

  function setSharedMode(next: boolean) {
    setShared(next)
    if (!next) setPayerId(meId)
  }

  async function save(category: Category) {
    if (saving || amount <= 0) {
      setError(amount <= 0 ? 'Poné el monto y después tocá la categoría.' : '')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createExpense({
        householdId,
        ownerId: meId,
        payerId: shared ? payerId || meId : meId,
        categoryId: category.id,
        title: title.trim() || category.name,
        amount,
        spentOn,
        isShared: shared,
      })
      await refresh()
      await onDone?.()
      navigate('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar el gasto.')
      setSaving(false)
    }
  }

  async function addCategory() {
    if (!draftName.trim()) {
      setError('Poné un nombre para la categoría.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const id = await createCategory({
        householdId,
        ownerId: shared ? null : meId,
        name: draftName,
        icon: draftIcon,
      })
      await refresh()
      setDrafting(false)
      setDraftName('')
      if (amount > 0) {
        await save({ id, name: draftName.trim(), icon: draftIcon, ownerId: shared ? null : meId })
      } else {
        setSaving(false)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude crear la categoría.')
      setSaving(false)
    }
  }

  return (
    <>
      <header className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (onCancel) onCancel()
            else navigate(-1)
          }}
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-text"
        >
          <AppIcon name="xmark" /> Cancelar
        </button>
        <b className="font-display font-semibold">Nuevo gasto</b>
        <span className="w-16" />
      </header>
      <div className="mb-3 text-center">
        <p className="font-display text-[44px] font-bold leading-none">{formatMoney(amount)}</p>
        <p className="text-sm font-semibold text-muted">¿Cuánto gastaste?</p>
        {prefill?.missingAmount && digits === '' ? (
          <p className="mt-1 text-sm font-bold text-[#85503C]">No pude leer el monto. Completalo antes de guardar.</p>
        ) : null}
      </div>
      {prefill ? (
        <p className="mb-3 rounded-2xl bg-[#FCE6EA] px-3 py-2 text-sm font-bold leading-snug text-[#85503C]">
          Revisá el comprobante. No se guarda hasta que elijas la categoría.
        </p>
      ) : null}
      <div className="mb-2 flex flex-wrap justify-center gap-2">
        <Chip active={shared} onClick={() => setSharedMode(true)}>
          <AppIcon name="user-group" /> Compartido
        </Chip>
        <Chip active={!shared} onClick={() => setSharedMode(false)}>
          <AppIcon name="lock" /> Privado
        </Chip>
      </div>
      {shared ? (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm font-semibold text-text">Pagó: </span>
          {people.map(([id, name]) => (
            <Chip key={id} active={payerId === id} onClick={() => setPayerId(id)}>
              {id === meId ? `Yo (${name})` : name}
            </Chip>
          ))}
        </div>
      ) : null}
      <label className="mb-2 block text-sm font-bold text-muted">
        Fecha
        <input
          type="date"
          value={spentOn}
          onChange={(event) => {
            setDateTouched(true)
            setSpentOn(event.target.value)
          }}
          className={`mt-1 ${inputClass}`}
        />
        {prefill?.missingDate && !dateTouched ? (
          <span className="mt-1 block font-bold text-[#85503C]">No pude leer la fecha. Dejé la de hoy para que la corrijas.</span>
        ) : null}
      </label>
      <label className="mb-2 block text-sm font-bold text-muted">
        Nombre (si lo dejás vacío, uso la categoría)
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={`mt-1 ${inputClass}`}
          placeholder="Alquiler, súper, café…"
        />
        {prefill?.missingTitle && title.trim() === '' ? (
          <span className="mt-1 block font-bold text-[#85503C]">No pude leer el comercio. Podés escribirlo vos.</span>
        ) : null}
      </label>
      <div className="mb-3 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <Chip
            key={category.id}
            className={category.id === suggestedId ? 'ring-2 ring-[#E98C9E]' : ''}
            onClick={() => void save(category)}
          >
            <AppIcon name={category.icon} /> {category.name}
            {category.id === suggestedId ? <span className="text-xs font-extrabold">Sugerida</span> : null}
          </Chip>
        ))}
        <Chip active={drafting} onClick={() => setDrafting((current) => !current)}>
          <AppIcon name="plus" /> Nueva
        </Chip>
      </div>
      {drafting ? (
        <div className="mb-3 rounded-3xl bg-card p-4 shadow-card">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Nombre"
            className={`mb-2 ${inputClass}`}
          />
          <IconPicker value={draftIcon} onChange={setDraftIcon} />
          <Button type="button" variant="alt" className="mt-2" onClick={() => void addCategory()} disabled={saving}>
            Crear categoría
          </Button>
        </div>
      ) : null}
      <Keypad onKey={(key) => setDigits((current) => applyKey(current, key))} />
      <p className="mt-3 text-center text-xs font-semibold text-muted">
        {prefill
          ? 'Cuando esté bien, tocá la categoría para guardarlo.'
          : 'El monto y la categoría alcanzan: compartido y “pagué yo” ya vienen elegidos.'}
      </p>
      <ErrorText>{error}</ErrorText>
      {saving ? <p className="mt-2 text-center font-bold text-primary">Guardando…</p> : null}
    </>
  )
}

function digitsFromAmount(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return ''
  const rounded = Math.round(amount)
  if (rounded <= 0) return ''
  return String(rounded).slice(0, 9)
}
