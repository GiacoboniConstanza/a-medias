import { useId, useState } from 'react'
import { AppIcon } from '../AppIcon.tsx'
import { amountFromDigits, applyKey, Keypad } from '../Keypad.tsx'
import { Sheet } from '../Sheet.tsx'
import { FieldError, inputClass } from '../ui.tsx'
import { createCategory, createExtra, createFund, moveBagMoney, spendFromGustos, updateFund, type Category, type FundItem } from '../../lib/api.ts'
import { formatMoney } from '../../lib/format.ts'
import { ICON_CHOICES } from '../../lib/icons.ts'
import { todayISO } from '../../lib/month.ts'

const primaryButton =
  'block min-h-[52px] w-full rounded-2xl bg-primary text-base font-semibold text-white disabled:opacity-50'
const quietButton =
  'mt-2 block min-h-[52px] w-full rounded-2xl border-2 border-primary bg-card text-base font-semibold text-primary'

function IconGrid({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <div className="grid max-h-40 grid-cols-6 gap-2 overflow-y-auto" role="listbox" aria-label="Elegí un ícono">
      {ICON_CHOICES.map((choice) => {
        const selected = value === choice.name
        return (
          <button
            key={choice.name}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={choice.label}
            onClick={() => onChange(choice.name)}
            className={`relative grid aspect-square min-h-11 place-items-center rounded-2xl border-2 text-lg text-text ${
              selected ? 'border-primary bg-sage-light' : 'border-[#E8DCCB] bg-white'
            }`}
          >
            <AppIcon name={choice.name} />
            {selected ? (
              <span className="absolute right-0.5 top-0.5 text-[10px] text-primary">
                <AppIcon name="check" />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function AmountReadout({ label, digits, errorId, error }: { label: string; digits: string; errorId: string; error: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-muted">{label}</p>
      <p className="font-display text-4xl font-bold leading-none" aria-describedby={error ? errorId : undefined}>
        {formatMoney(amountFromDigits(digits))}
      </p>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}

export function FundSheet({
  open,
  fund,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean
  fund: FundItem | null
  userId: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const nameErrorId = useId()
  const amountErrorId = useId()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('piggy-bank')
  const [digits, setDigits] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [amountTouched, setAmountTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [seenOpen, setSeenOpen] = useState(open)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setName(fund?.name ?? '')
      setIcon(fund?.icon || 'piggy-bank')
      setDigits(fund && fund.target > 0 ? String(Math.round(fund.target)) : '')
      setTargetDate(fund?.targetDate ?? '')
      setNameTouched(false)
      setAmountTouched(false)
      setSaving(false)
      setServerError('')
    }
  }

  const target = amountFromDigits(digits)
  const nameError = name.trim() ? '' : 'Poné un nombre para el fondo.'
  const amountError = target > 0 ? '' : 'Poné cuánto querés juntar.'
  const valid = !nameError && !amountError

  async function save() {
    setNameTouched(true)
    setAmountTouched(true)
    if (!valid || saving) return
    setSaving(true)
    setServerError('')
    try {
      const input = { name, icon, target, targetDate: targetDate || null }
      if (fund) await updateFund({ id: fund.id, ...input })
      else await createFund({ userId, ...input })
      onSaved(fund ? 'Listo, actualicé el fondo.' : 'Listo, guardé el fondo.')
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'No pude guardar el fondo.')
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title={fund ? 'Editar fondo' : 'Nuevo fondo'} onClose={onClose} footer={
      <>
        <button type="button" className={primaryButton} disabled={!valid || saving} onClick={() => void save()}>
          Guardar fondo
        </button>
        <button type="button" className={quietButton} onClick={onClose}>
          Cancelar
        </button>
      </>
    }>
      <label className="mb-3 block text-sm font-bold text-muted" htmlFor={`${nameErrorId}-input`}>
        Nombre
        <input
          id={`${nameErrorId}-input`}
          value={name}
          aria-invalid={nameTouched && !!nameError}
          aria-describedby={nameTouched && nameError ? nameErrorId : undefined}
          onBlur={() => setNameTouched(true)}
          onChange={(event) => {
            setName(event.target.value)
            setNameTouched(true)
          }}
          placeholder="Vacaciones, colchón…"
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <FieldError id={nameErrorId}>{nameTouched ? nameError : ''}</FieldError>
      <p className="mb-2 mt-4 text-sm font-bold text-muted">Ícono</p>
      <IconGrid value={icon} onChange={setIcon} />
      <div className="mt-4">
        <AmountReadout
          label="¿Cuánto querés juntar?"
          digits={digits}
          errorId={amountErrorId}
          error={amountTouched || (nameTouched && !nameError) ? amountError : ''}
        />
        <div className="mt-3">
          <Keypad
            onKey={(key) => {
              setAmountTouched(true)
              setDigits((current) => applyKey(current, key))
            }}
          />
        </div>
      </div>
      <label className="mt-4 block text-sm font-bold text-muted">
        Fecha objetivo (opcional)
        <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={`mt-1 ${inputClass}`} />
      </label>
      <FieldError>{serverError}</FieldError>
    </Sheet>
  )
}

export function ExtraSheet({
  open,
  funds,
  userId,
  householdId,
  onClose,
  onSaved,
}: {
  open: boolean
  funds: FundItem[]
  userId: string
  householdId: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const nameErrorId = useId()
  const amountErrorId = useId()
  const splitErrorId = useId()
  const [step, setStep] = useState(1)
  const [label, setLabel] = useState('')
  const [receivedOn, setReceivedOn] = useState(todayISO())
  const [digits, setDigits] = useState('')
  const [fundDigits, setFundDigits] = useState<Record<string, string>>({})
  const [activeFund, setActiveFund] = useState<string | null>(null)
  const [nameTouched, setNameTouched] = useState(false)
  const [amountTouched, setAmountTouched] = useState(false)
  const [splitTouched, setSplitTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [seenOpen, setSeenOpen] = useState(open)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setStep(1)
      setLabel('')
      setReceivedOn(todayISO())
      setDigits('')
      setFundDigits({})
      setActiveFund(funds[0]?.id ?? null)
      setNameTouched(false)
      setAmountTouched(false)
      setSplitTouched(false)
      setSaving(false)
      setServerError('')
    }
  }

  const amount = amountFromDigits(digits)
  const assigned = funds.reduce((sum, fund) => sum + amountFromDigits(fundDigits[fund.id] ?? ''), 0)
  const gustosPart = amount - assigned
  const nameError = label.trim() ? '' : 'Poné un nombre para el extra.'
  const dateError = receivedOn ? '' : 'Elegí la fecha.'
  const amountError = amount > 0 ? '' : 'Poné el monto del extra.'
  const splitError = gustosPart < 0 ? 'Los fondos no pueden sumar más que el extra.' : ''
  const stepValid = step === 1 ? !nameError && !dateError : step === 2 ? !amountError : !splitError && !nameError && !amountError

  async function save() {
    setSplitTouched(true)
    if (!stepValid || saving || gustosPart < 0 || amount <= 0 || !label.trim()) return
    setSaving(true)
    setServerError('')
    try {
      const allocations: { fundId: string | null; amount: number }[] = funds
        .map((fund) => ({ fundId: fund.id, amount: amountFromDigits(fundDigits[fund.id] ?? '') }))
        .filter((allocation) => allocation.amount > 0)
      if (gustosPart > 0) allocations.push({ fundId: null, amount: gustosPart })
      await createExtra({ userId, householdId, label, amount, receivedOn, allocations })
      onSaved('Listo, repartí el extra.')
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'No pude guardar el extra.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Cargar un extra"
      onClose={onClose}
      footer={
        <>
          {step < 3 ? (
            <button
              type="button"
              className={primaryButton}
              disabled={!stepValid}
              onClick={() => {
                if (step === 1) setNameTouched(true)
                if (step === 2) setAmountTouched(true)
                if (stepValid) setStep((current) => current + 1)
              }}
            >
              Siguiente
            </button>
          ) : (
            <button type="button" className={primaryButton} disabled={!stepValid || saving} onClick={() => void save()}>
              Repartir extra
            </button>
          )}
          {step > 1 ? (
            <button type="button" className={quietButton} onClick={() => setStep((current) => current - 1)}>
              Atrás
            </button>
          ) : (
            <button type="button" className={quietButton} onClick={onClose}>
              Cancelar
            </button>
          )}
        </>
      }
    >
      <p className="mb-3 text-sm font-semibold text-muted">Paso {step} de 3</p>
      {step === 1 ? (
        <>
          <label className="block text-sm font-bold text-muted" htmlFor={`${nameErrorId}-input`}>
            Nombre
            <input
              id={`${nameErrorId}-input`}
              value={label}
              aria-invalid={nameTouched && !!nameError}
              aria-describedby={nameTouched && nameError ? nameErrorId : undefined}
              onBlur={() => setNameTouched(true)}
              onChange={(event) => {
                setLabel(event.target.value)
                setNameTouched(true)
              }}
              placeholder="Incentivo, guardia, venta…"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <FieldError id={nameErrorId}>{nameTouched ? nameError : ''}</FieldError>
          <label className="mt-3 block text-sm font-bold text-muted">
            Fecha
            <input
              type="date"
              value={receivedOn}
              onChange={(event) => setReceivedOn(event.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <FieldError>{nameTouched && !receivedOn ? dateError : ''}</FieldError>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <AmountReadout label="Monto del extra" digits={digits} errorId={amountErrorId} error={amountTouched ? amountError : ''} />
          <div className="mt-3">
            <Keypad
              onKey={(key) => {
                setAmountTouched(true)
                setDigits((current) => applyKey(current, key))
              }}
            />
          </div>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <p className="font-display text-lg font-semibold">{label.trim() || 'Extra'}</p>
          <p className="mb-3 text-sm font-semibold text-muted">Son {formatMoney(amount)}. Repartilos entre fondos y gustos.</p>
          {funds.length === 0 ? <p className="text-sm font-semibold text-muted">Sin fondos, todo queda para gustos.</p> : null}
          <div role="group" aria-label="Cuánto va a cada fondo" aria-describedby={splitTouched && splitError ? splitErrorId : undefined}>
            {funds.map((fund) => {
              const selected = activeFund === fund.id
              return (
                <button
                  key={fund.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveFund(fund.id)}
                  className={`mb-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border-2 px-3 text-left text-sm font-semibold ${
                    selected ? 'border-primary bg-sage-light' : 'border-[#E8DCCB] bg-white'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <AppIcon name={fund.icon} /> {fund.name}
                  </span>
                  <span>{formatMoney(amountFromDigits(fundDigits[fund.id] ?? ''))}</span>
                </button>
              )
            })}
          </div>
          <p className="text-sm font-semibold text-text">El resto va a gustos: {formatMoney(Math.max(gustosPart, 0))}</p>
          <FieldError id={splitErrorId}>{splitTouched ? splitError : ''}</FieldError>
          {funds.length > 0 ? (
            <div className="mt-3">
              <Keypad
                onKey={(key) => {
                  if (!activeFund) return
                  setSplitTouched(true)
                  setFundDigits((current) => ({ ...current, [activeFund]: applyKey(current[activeFund] ?? '', key) }))
                }}
              />
            </div>
          ) : null}
          <FieldError>{serverError}</FieldError>
        </>
      ) : null}
    </Sheet>
  )
}

export function GustoSheet({
  open,
  categories,
  householdId,
  userId,
  gustosFree,
  onClose,
  onSaved,
  onRefresh,
}: {
  open: boolean
  categories: Category[]
  householdId: string
  userId: string
  gustosFree: number
  onClose: () => void
  onSaved: (message: string) => void
  onRefresh: () => Promise<void>
}) {
  const titleErrorId = useId()
  const categoryErrorId = useId()
  const amountErrorId = useId()
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [spentOn, setSpentOn] = useState(todayISO())
  const [digits, setDigits] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftIcon, setDraftIcon] = useState('bag-shopping')
  const [titleTouched, setTitleTouched] = useState(false)
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [amountTouched, setAmountTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [seenOpen, setSeenOpen] = useState(open)
  const privateCategories = categories.filter((category) => category.ownerId === userId)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setTitle('')
      setCategoryId('')
      setSpentOn(todayISO())
      setDigits('')
      setDrafting(false)
      setDraftName('')
      setDraftIcon('bag-shopping')
      setTitleTouched(false)
      setCategoryTouched(false)
      setAmountTouched(false)
      setSaving(false)
      setServerError('')
    }
  }

  const amount = amountFromDigits(digits)
  const titleError = title.trim() ? '' : 'Poné qué gusto te diste.'
  const categoryError = categoryId ? '' : 'Elegí una categoría tuya.'
  const amountError =
    amount <= 0 ? 'Poné el monto.' : amount > gustosFree ? 'No te alcanza lo libre de gustos.' : ''
  const valid = !titleError && !categoryError && !amountError && !!spentOn

  async function addCategory() {
    if (!draftName.trim()) {
      setServerError('Poné un nombre para la categoría.')
      return
    }
    setSaving(true)
    setServerError('')
    try {
      const id = await createCategory({ householdId, ownerId: userId, name: draftName, icon: draftIcon })
      await onRefresh()
      setCategoryId(id)
      setDrafting(false)
      setDraftName('')
      setCategoryTouched(true)
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'No pude crear la categoría.')
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    setTitleTouched(true)
    setCategoryTouched(true)
    setAmountTouched(true)
    if (!valid || saving) return
    setSaving(true)
    setServerError('')
    try {
      await spendFromGustos({ title, categoryId, amount, spentOn })
      onSaved('Listo, anoté el gusto.')
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'No pude anotar el gusto.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Me di un gusto"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={primaryButton} disabled={!valid || saving} onClick={() => void save()}>
            Anotar gusto
          </button>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancelar
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm font-semibold text-muted">
        Sale de tus gustos. Queda privado y no entra en el reparto de gastos compartidos.
      </p>
      <label className="block text-sm font-bold text-muted" htmlFor={`${titleErrorId}-input`}>
        Descripción
        <input
          id={`${titleErrorId}-input`}
          value={title}
          aria-invalid={titleTouched && !!titleError}
          aria-describedby={titleTouched && titleError ? titleErrorId : undefined}
          onBlur={() => setTitleTouched(true)}
          onChange={(event) => {
            setTitle(event.target.value)
            setTitleTouched(true)
          }}
          placeholder="Helado, libro, salida…"
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <FieldError id={titleErrorId}>{titleTouched ? titleError : ''}</FieldError>
      <p id={categoryErrorId} className="mb-2 mt-4 text-sm font-bold text-muted">
        Categoría
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Categoría privada">
        {privateCategories.map((category) => {
          const selected = categoryId === category.id
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setCategoryId(category.id)
                setCategoryTouched(true)
              }}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl border-2 px-3 text-sm font-semibold ${
                selected ? 'border-primary bg-sage-light' : 'border-[#E8DCCB] bg-white'
              }`}
            >
              <AppIcon name={category.icon} /> {category.name}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={drafting}
          onClick={() => setDrafting((current) => !current)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border-2 border-[#E8DCCB] bg-white px-3 text-sm font-semibold"
        >
          <AppIcon name="plus" /> Nueva
        </button>
      </div>
      <FieldError>{categoryTouched ? categoryError : ''}</FieldError>
      {drafting ? (
        <div className="mt-3">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Nombre de la categoría"
            className={inputClass}
          />
          <div className="mt-2">
            <IconGrid value={draftIcon} onChange={setDraftIcon} />
          </div>
          <button type="button" className={`${primaryButton} mt-3`} disabled={saving || !draftName.trim()} onClick={() => void addCategory()}>
            Crear categoría
          </button>
        </div>
      ) : null}
      <label className="mt-4 block text-sm font-bold text-muted">
        Fecha
        <input type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} className={`mt-1 ${inputClass}`} />
      </label>
      <div className="mt-4">
        <AmountReadout label="Monto" digits={digits} errorId={amountErrorId} error={amountTouched ? amountError : ''} />
        <p className="mt-1 text-sm font-semibold text-muted">Libre para gustos: {formatMoney(Math.max(gustosFree, 0))}</p>
        <div className="mt-3">
          <Keypad
            onKey={(key) => {
              setAmountTouched(true)
              setDigits((current) => applyKey(current, key))
            }}
          />
        </div>
      </div>
      <FieldError>{serverError}</FieldError>
    </Sheet>
  )
}

export function MoveSheet({
  open,
  mode,
  funds,
  fund,
  gustosFree,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: 'to_fund' | 'to_gustos' | 'use'
  funds: FundItem[]
  fund: FundItem | null
  gustosFree: number
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const amountErrorId = useId()
  const fundErrorId = useId()
  const [fundId, setFundId] = useState('')
  const [digits, setDigits] = useState('')
  const [note, setNote] = useState('')
  const [happenedOn, setHappenedOn] = useState(todayISO())
  const [fundTouched, setFundTouched] = useState(false)
  const [amountTouched, setAmountTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [seenOpen, setSeenOpen] = useState(open)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setFundId(fund?.id ?? '')
      setDigits('')
      setNote('')
      setHappenedOn(todayISO())
      setFundTouched(false)
      setAmountTouched(false)
      setSaving(false)
      setServerError('')
    }
  }

  const chosen = funds.find((item) => item.id === (mode === 'to_fund' ? fundId : fund?.id)) ?? null
  const amount = amountFromDigits(digits)
  const ceiling = mode === 'to_fund' ? gustosFree : (chosen?.saved ?? 0)
  const fundError = mode === 'to_fund' && !chosen ? 'Elegí un fondo.' : ''
  const amountError =
    ceiling <= 0
      ? mode === 'to_fund'
        ? 'No tenés gustos libres para pasar.'
        : 'No hay plata para sacar de este fondo.'
      : amount <= 0
        ? 'Poné el monto.'
        : amount > ceiling
          ? mode === 'to_fund'
            ? 'No te alcanza lo libre de gustos.'
            : 'No te alcanza lo ahorrado en el fondo.'
          : ''
  const valid = !fundError && !amountError && !!chosen && !!happenedOn
  const title = mode === 'to_fund' ? 'Pasar a un fondo' : mode === 'to_gustos' ? 'Devolver a gustos' : 'Usar el fondo'
  const action = mode === 'to_fund' ? 'Pasar a este fondo' : mode === 'to_gustos' ? 'Devolver a gustos' : 'Usar'
  const done =
    mode === 'to_fund' ? 'Listo, pasó al fondo.' : mode === 'to_gustos' ? 'Listo, volvió a gustos.' : 'Listo, anoté el uso.'

  async function save() {
    setFundTouched(true)
    setAmountTouched(true)
    if (!valid || saving || !chosen) return
    setSaving(true)
    setServerError('')
    try {
      await moveBagMoney({
        kind: mode,
        fundId: chosen.id,
        amount,
        happenedOn,
        label: note.trim() || (mode === 'use' ? `Usé ${chosen.name}` : chosen.name),
      })
      onSaved(done)
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'No pude mover la plata.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={primaryButton} disabled={!valid || saving} onClick={() => void save()}>
            {action}
          </button>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancelar
          </button>
        </>
      }
    >
      {mode === 'to_fund' ? (
        <>
          <p id={fundErrorId} className="mb-2 text-sm font-bold text-muted">
            ¿A qué fondo?
          </p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Fondos">
            {funds.map((item) => {
              const selected = fundId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setFundId(item.id)
                    setFundTouched(true)
                  }}
                  className={`flex min-h-11 flex-col items-start justify-center gap-1 rounded-2xl border-2 px-3 py-2 text-left text-sm font-semibold ${
                    selected ? 'border-primary bg-sage-light' : 'border-[#E8DCCB] bg-white'
                  }`}
                >
                  <AppIcon name={item.icon} />
                  {item.name}
                </button>
              )
            })}
          </div>
          <FieldError>{fundTouched || amountTouched ? fundError : ''}</FieldError>
          <p className="mt-3 text-sm font-semibold text-muted">Libre para gustos: {formatMoney(Math.max(gustosFree, 0))}</p>
        </>
      ) : (
        <p className="mb-3 text-sm font-semibold text-muted">
          En {chosen?.name ?? 'este fondo'} hay {formatMoney(Math.max(chosen?.saved ?? 0, 0))}.
        </p>
      )}
      {mode === 'use' ? (
        <label className="mt-3 block text-sm font-bold text-muted">
          ¿En qué lo usaste? (opcional)
          <input value={note} onChange={(event) => setNote(event.target.value)} className={`mt-1 ${inputClass}`} placeholder="Un arreglo, un regalo…" />
        </label>
      ) : null}
      <label className="mt-3 block text-sm font-bold text-muted">
        Fecha
        <input type="date" value={happenedOn} onChange={(event) => setHappenedOn(event.target.value)} className={`mt-1 ${inputClass}`} />
      </label>
      <div className="mt-4">
        <AmountReadout label="Monto" digits={digits} errorId={amountErrorId} error={amountTouched || ceiling <= 0 ? amountError : ''} />
        <div className="mt-3">
          <Keypad
            onKey={(key) => {
              setAmountTouched(true)
              setDigits((current) => applyKey(current, key))
            }}
          />
        </div>
      </div>
      <FieldError>{serverError}</FieldError>
    </Sheet>
  )
}
