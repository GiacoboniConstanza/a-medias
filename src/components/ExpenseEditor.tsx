import { useEffect, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { IconPicker } from './IconPicker.tsx'
import { amountFromDigits, applyKey, Keypad } from './Keypad.tsx'
import { Sheet } from './Sheet.tsx'
import { Chip, ErrorText, inputClass } from './ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import {
  createCategory,
  createExpense,
  deleteExpense,
  updateExpense,
  type Category,
  type ExpenseItem,
} from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { monthKey, monthTitle, shiftMonth, todayISO } from '../lib/month.ts'
import { suggestCategoryId } from '../lib/mpReceipt.ts'
import { periodFollowsDate, periodFromDate } from '../lib/period.ts'

export type ExpensePrefill = {
  amount: number | null
  title: string | null
  spentOn: string | null
  missingAmount: boolean
  missingTitle: boolean
  missingDate: boolean
}

const saveButton =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#4F6B57] px-4 text-base font-semibold text-white disabled:opacity-50'
const deleteButton =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#85503C] text-base font-semibold text-[#85503C] disabled:opacity-50'

export function ExpenseEditor({
  presentation,
  expense = null,
  prefill,
  onClose,
  onDone,
}: {
  presentation: 'page' | 'sheet'
  expense?: ExpenseItem | null
  prefill?: ExpensePrefill
  onClose: () => void
  onDone: (notice: string) => void
}) {
  const { profile } = useAuth()
  const { data, refresh } = useFinance()
  const readOnly = Boolean(expense && profile && expense.ownerId !== profile.id)
  const titleText = expense ? (readOnly ? 'Gasto' : 'Editar gasto') : 'Nuevo gasto'

  if (!profile?.householdId || !data) {
    const loading = <p className="py-16 text-center font-bold text-muted">Cargando…</p>
    if (presentation === 'sheet') {
      return (
        <Sheet open title={titleText} onClose={onClose}>
          {loading}
        </Sheet>
      )
    }
    return loading
  }

  return (
    <ExpenseForm
      key={expense?.id ?? 'new'}
      householdId={profile.householdId}
      meId={profile.id}
      names={data.names}
      categories={data.categories}
      expense={expense}
      prefill={prefill}
      readOnly={readOnly}
      presentation={presentation}
      titleText={titleText}
      onClose={onClose}
      onDone={async (notice) => {
        await refresh()
        onDone(notice)
      }}
    />
  )
}

function ExpenseForm({
  householdId,
  meId,
  names,
  categories,
  expense,
  prefill,
  readOnly,
  presentation,
  titleText,
  onClose,
  onDone,
}: {
  householdId: string
  meId: string
  names: Record<string, string>
  categories: Category[]
  expense: ExpenseItem | null
  prefill?: ExpensePrefill
  readOnly: boolean
  presentation: 'page' | 'sheet'
  titleText: string
  onClose: () => void
  onDone: (notice: string) => void | Promise<void>
}) {
  const { refresh } = useFinance()
  const people = Object.entries(names)
  const [title, setTitle] = useState(expense?.title ?? prefill?.title ?? '')
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [categoryTouched, setCategoryTouched] = useState(Boolean(expense))
  const [digits, setDigits] = useState(() => digitsFromAmount(expense?.amount ?? prefill?.amount ?? null))
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? prefill?.spentOn ?? todayISO())
  const [dateTouched, setDateTouched] = useState(false)
  const [period, setPeriod] = useState(expense?.period ?? periodFromDate(prefill?.spentOn || todayISO()))
  const [periodTouched, setPeriodTouched] = useState(Boolean(expense))
  const [shared, setShared] = useState(expense ? expense.isShared : true)
  const [payerId, setPayerId] = useState(expense?.payerId ?? meId)
  const [showErrors, setShowErrors] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftIcon, setDraftIcon] = useState(DEFAULT_ICON)
  const [otherMonth, setOtherMonth] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState<'delete' | 'discard' | null>(null)
  const [keyboard, setKeyboard] = useState(0)

  const visibleCategories = categories.filter((category) => (shared ? category.ownerId === null : category.ownerId === meId))
  const suggestedId = suggestCategoryId(prefill?.title ?? null, visibleCategories)
  const amount = amountFromDigits(digits)
  const missingName = title.trim() === ''
  const missingCategory = categoryId === ''
  const missingAmount = amount <= 0
  const canSave = !missingName && !missingCategory && !missingAmount
  const todayMonth = monthKey()
  const monthChoices = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, 1)]
  const editing = Boolean(expense)

  useEffect(() => {
    if (categoryTouched || expense) return
    if (suggestedId) setCategoryId(suggestedId)
  }, [categoryTouched, expense, suggestedId])

  useEffect(() => {
    if (presentation !== 'page') return
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => setKeyboard(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [presentation])

  function choosePeriod(next: string) {
    if (readOnly) return
    setPeriodTouched(true)
    setPeriod(periodFromDate(next))
    setOtherMonth(false)
  }

  function requestClose() {
    if (saving || confirming === 'discard') return
    if (readOnly || !isDirty()) {
      onClose()
      return
    }
    setConfirming('discard')
  }

  function isDirty(): boolean {
    if (!editing) {
      return title.trim() !== '' || digits !== '' || categoryId !== '' || dateTouched || periodTouched || !shared || payerId !== meId
    }
    return (
      title.trim() !== expense?.title ||
      categoryId !== expense?.categoryId ||
      amount !== Math.round(expense?.amount ?? 0) ||
      spentOn !== expense?.spentOn ||
      period !== expense?.period ||
      shared !== expense?.isShared ||
      payerId !== expense?.payerId
    )
  }

  async function save() {
    if (saving || readOnly) return
    setShowErrors(true)
    if (!canSave) return
    setSaving(true)
    setError('')
    const payload = {
      payerId: shared ? payerId || meId : meId,
      categoryId,
      title: title.trim(),
      amount,
      spentOn,
      period: periodFollowsDate(spentOn, period, periodTouched),
      isShared: expense?.paidFromBag ? false : shared,
    }
    try {
      if (expense) {
        await updateExpense({ id: expense.id, ...payload })
        await onDone('Gasto actualizado')
      } else {
        await createExpense({ householdId, ownerId: meId, ...payload })
        await onDone('Gasto guardado')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar el gasto.')
      setSaving(false)
    }
  }

  async function remove() {
    if (!expense || saving || readOnly) return
    setSaving(true)
    setError('')
    try {
      await deleteExpense(expense.id)
      await onDone('Gasto eliminado')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude eliminar el gasto.')
      setSaving(false)
      setConfirming(null)
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
      setCategoryId(id)
      setCategoryTouched(true)
      setDrafting(false)
      setDraftName('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude crear la categoría.')
    } finally {
      setSaving(false)
    }
  }

  const footer = readOnly ? null : confirming === 'delete' ? (
    <div className="space-y-2">
      <p className="text-center text-sm font-bold text-text">¿Eliminar este gasto? No se puede deshacer.</p>
      <button type="button" className={deleteButton} onClick={() => void remove()} disabled={saving}>
        <AppIcon name="trash" /> {saving ? 'Eliminando…' : 'Eliminar'}
      </button>
      <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-primary" onClick={() => setConfirming(null)} disabled={saving}>
        Cancelar
      </button>
    </div>
  ) : confirming === 'discard' ? (
    <div className="space-y-2">
      <p className="text-center text-sm font-bold text-text">¿Descartar este gasto?</p>
      <button type="button" className={deleteButton} onClick={onClose}>
        Descartar
      </button>
      <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-primary" onClick={() => setConfirming(null)}>
        Seguir
      </button>
    </div>
  ) : (
    <div className="space-y-2">
      <button
        type="button"
        className={`${saveButton} ${!canSave || saving ? 'opacity-50' : ''}`}
        aria-disabled={!canSave || saving}
        onClick={() => {
          if (saving) return
          if (!canSave) {
            setShowErrors(true)
            return
          }
          void save()
        }}
      >
        <AppIcon name="check" /> {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar'}
      </button>
      {editing ? (
        <button type="button" className={deleteButton} onClick={() => setConfirming('delete')} disabled={saving}>
          <AppIcon name="trash" /> Eliminar
        </button>
      ) : null}
    </div>
  )

  const fields = (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault()
      }}
    >
      {prefill ? (
        <p className="mb-3 rounded-2xl bg-[#FCE6EA] px-3 py-2 text-sm font-bold leading-snug text-[#85503C]">
          Revisá el comprobante. No se guarda hasta que toques Guardar.
        </p>
      ) : null}
      {readOnly ? <p className="mb-3 text-sm font-semibold text-muted">Lo cargó otra persona. Podés verlo, no cambiarlo.</p> : null}
      <label className="mb-3 block text-sm font-bold text-muted">
        Nombre
        <input
          value={title}
          disabled={readOnly}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          className={`mt-1 ${inputClass}`}
          placeholder="Alquiler, súper, café…"
        />
        {showErrors && missingName ? <span className="mt-1 block font-bold text-[#85503C]">Poné un nombre.</span> : null}
        {prefill?.missingTitle && title.trim() === '' ? (
          <span className="mt-1 block font-bold text-[#85503C]">No pude leer el comercio. Podés escribirlo vos.</span>
        ) : null}
      </label>
      <div className="mb-3">
        <p className="mb-1 text-sm font-bold text-muted">Categoría</p>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((category) => (
            <Chip
              key={category.id}
              active={categoryId === category.id}
              className={category.id === suggestedId ? 'ring-2 ring-[#E98C9E]' : ''}
              onClick={() => {
                if (readOnly) return
                setCategoryTouched(true)
                setCategoryId(category.id)
              }}
            >
              <AppIcon name={category.icon} /> {category.name}
            </Chip>
          ))}
          {readOnly ? null : (
            <Chip active={drafting} onClick={() => setDrafting((current) => !current)}>
              <AppIcon name="plus" /> Nueva
            </Chip>
          )}
        </div>
        {showErrors && missingCategory ? <p className="mt-1 text-sm font-bold text-[#85503C]">Elegí una categoría.</p> : null}
        {drafting ? (
          <div className="mt-2 rounded-3xl bg-card p-4 shadow-card">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault()
              }}
              placeholder="Nombre"
              className={`mb-2 ${inputClass}`}
            />
            <IconPicker value={draftIcon} onChange={setDraftIcon} />
            <button type="button" className="mt-2 min-h-11 w-full rounded-2xl bg-sand font-semibold text-primary" onClick={() => void addCategory()} disabled={saving}>
              Crear categoría
            </button>
          </div>
        ) : null}
      </div>
      <div className="mb-3 text-center">
        <p className="text-sm font-bold text-muted">Monto</p>
        <p className="font-display text-[44px] font-bold leading-none">{formatMoney(amount)}</p>
        {showErrors && missingAmount ? <p className="mt-1 text-sm font-bold text-[#85503C]">El monto tiene que ser mayor a 0.</p> : null}
        {prefill?.missingAmount && digits === '' ? (
          <p className="mt-1 text-sm font-bold text-[#85503C]">No pude leer el monto. Completalo antes de guardar.</p>
        ) : null}
        {readOnly ? null : <div className="mt-2"><Keypad onKey={(key) => setDigits((current) => applyKey(current, key))} /></div>}
      </div>
      <label className="mb-3 block text-sm font-bold text-muted">
        Fecha
        <input
          type="date"
          value={spentOn}
          disabled={readOnly}
          onChange={(event) => {
            const next = event.target.value
            setDateTouched(true)
            setSpentOn(next)
            if (!periodTouched) setPeriod(periodFromDate(next))
          }}
          className={`mt-1 ${inputClass}`}
        />
        {prefill?.missingDate && !dateTouched ? (
          <span className="mt-1 block font-bold text-[#85503C]">No pude leer la fecha. Dejé la de hoy para que la corrijas.</span>
        ) : null}
      </label>
      <div className="mb-3">
        <p className="mb-1 text-sm font-bold text-muted">Corresponde a</p>
        <div className="flex flex-wrap gap-2">
          {monthChoices.map((choice, index) => (
            <Chip key={choice} active={period === choice && !otherMonth} onClick={() => choosePeriod(choice)}>
              {index === 0 ? 'Mes anterior' : index === 1 ? 'Mes actual' : 'Mes siguiente'}
            </Chip>
          ))}
          <Chip
            active={otherMonth || !monthChoices.includes(period)}
            onClick={() => {
              setOtherMonth(true)
              setPeriodTouched(true)
            }}
          >
            Elegir otro
          </Chip>
        </div>
        {otherMonth || !monthChoices.includes(period) ? (
          <label className="mt-2 block text-sm font-bold text-muted">
            {monthTitle(period)}
            <input
              type="month"
              disabled={readOnly}
              value={period.slice(0, 7)}
              onChange={(event) => {
                if (!event.target.value) return
                setPeriodTouched(true)
                setPeriod(`${event.target.value}-01`)
              }}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        ) : null}
      </div>
      {expense?.paidFromBag ? (
        <p className="mb-3 text-sm font-semibold text-muted">
          <AppIcon name="bag-shopping" className="mr-1 text-primary" /> Pagado con la bolsa. Sigue siendo privado.
        </p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip
            active={shared}
            onClick={() => {
              if (readOnly) return
              setShared(true)
              setCategoryId((current) => (categories.some((category) => category.id === current && category.ownerId === null) ? current : ''))
            }}
          >
            <AppIcon name="user-group" /> Compartido
          </Chip>
          <Chip
            active={!shared}
            onClick={() => {
              if (readOnly) return
              setShared(false)
              setPayerId(meId)
              setCategoryId((current) => (categories.some((category) => category.id === current && category.ownerId === meId) ? current : ''))
            }}
          >
            <AppIcon name="lock" /> Privado
          </Chip>
        </div>
      )}
      {shared && !expense?.paidFromBag ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text">Pagó: </span>
          {people.map(([id, name]) => (
            <Chip key={id} active={payerId === id} onClick={() => { if (!readOnly) setPayerId(id) }}>
              {id === meId ? `Yo (${name})` : name}
            </Chip>
          ))}
        </div>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </div>
  )

  if (presentation === 'sheet') {
    return (
      <Sheet open title={titleText} onClose={requestClose} footer={footer}>
        {fields}
      </Sheet>
    )
  }

  return (
    <>
      <header className="mb-2 flex items-center justify-between">
        <button type="button" onClick={requestClose} className="inline-flex min-h-11 items-center gap-1 font-semibold text-text">
          <AppIcon name="xmark" /> Cancelar
        </button>
        <b className="font-display font-semibold">{editing ? 'Editar gasto' : 'Nuevo gasto'}</b>
        <span className="w-16" />
      </header>
      {fields}
      <div className="h-36" />
      <div className="fixed inset-x-0 z-30 mx-auto w-full max-w-[430px] bg-bg px-5 pb-3 pt-2" style={{ bottom: `calc(5.5rem + ${keyboard}px)` }}>
        {footer}
      </div>
    </>
  )
}

function digitsFromAmount(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return ''
  const rounded = Math.round(amount)
  if (rounded <= 0) return ''
  return String(rounded).slice(0, 9)
}
