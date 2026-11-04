import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from './AppIcon.tsx'
import { IconPicker } from './IconPicker.tsx'
import { amountFromDigits } from './Keypad.tsx'
import { MoneyField } from './MoneyField.tsx'
import { Sheet } from './Sheet.tsx'
import { Button, Chip, ErrorText, NotesField, inputClass } from './ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import {
  createCategory,
  createExpense,
  deleteExpense,
  loadSettledMonths,
  updateExpense,
  type Category,
  type ExpenseItem,
} from '../lib/api.ts'
import { clampNotes, formatMoney, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { catamarcaToday, isAfterDay, monthKey, monthName, monthTitle, shiftMonth, shortDate } from '../lib/month.ts'
import { suggestCategoryId } from '../lib/mpReceipt.ts'
import {
  deleteExpenseConfirm,
  expenseIsReadOnly,
  ownerCanMakePrivate,
  periodFollowsDate,
  periodFromDate,
  privateSwitchError,
  settledExpenseError,
  sharedMonthSettled,
} from '../lib/period.ts'

export type ExpensePrefill = {
  amount: number | null
  title: string | null
  spentOn: string | null
  missingAmount: boolean
  missingTitle: boolean
  missingDate: boolean
}

const settledHelp = 'Los meses saldados están cerrados. Para cargar ahí, deshacé el saldo en Compartidos.'

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
  const [settledMonths, setSettledMonths] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    loadSettledMonths()
      .then((months) => {
        if (!cancelled) setSettledMonths(months)
      })
      .catch(() => {
        if (!cancelled) setSettledMonths([])
      })
    return () => {
      cancelled = true
    }
  }, [])
  const settledLock = Boolean(expense && sharedMonthSettled(expense.isShared, expense.period, settledMonths))
  const readOnly = Boolean(expense && profile && expenseIsReadOnly(expense, profile.id, settledMonths))
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
      settledLock={settledLock}
      settledMonths={settledMonths}
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
  settledLock,
  settledMonths,
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
  settledLock: boolean
  settledMonths: readonly string[]
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
  const [digits, setDigits] = useState(() => moneyDraftFromAmount(expense?.amount ?? prefill?.amount ?? null))
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? prefill?.spentOn ?? catamarcaToday())
  const [dateTouched, setDateTouched] = useState(false)
  const [period, setPeriod] = useState(expense?.period ?? periodFromDate(prefill?.spentOn || catamarcaToday()))
  const [periodTouched, setPeriodTouched] = useState(Boolean(expense))
  const [shared, setShared] = useState(expense ? expense.isShared : true)
  const [payerId, setPayerId] = useState(expense?.payerId ?? meId)
  const [showErrors, setShowErrors] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftIcon, setDraftIcon] = useState(DEFAULT_ICON)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(Boolean(expense?.notes))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState<'delete' | 'discard' | null>(null)
  const [keyboard, setKeyboard] = useState(0)

  const visibleCategories = categories.filter((category) => (shared ? category.ownerId === null : category.ownerId === meId))
  const suggestedId = suggestCategoryId(prefill?.title ?? null, visibleCategories)
  const amount = normalizeMoney(amountFromDigits(digits))
  const missingName = title.trim() === ''
  const missingCategory = categoryId === ''
  const missingAmount = amount <= 0
  const canSave = !missingName && !missingCategory && !missingAmount
  const todayMonth = monthKey()
  const today = catamarcaToday()
  const futureDate = isAfterDay(spentOn, today)
  const monthChoices = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, 1)]
  const editing = Boolean(expense)
  const privacyLocked = Boolean(expense?.isShared && !ownerCanMakePrivate(expense.ownerId, meId))
  const nextShared = expense?.paidFromBag ? false : shared

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
    const normalized = periodFromDate(next)
    if (nextShared && sharedMonthSettled(true, normalized, settledMonths)) {
      setError(settledHelp)
      return
    }
    setError('')
    setPeriodTouched(true)
    setPeriod(normalized)
    setPeriodOpen(false)
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
      return title.trim() !== '' || digits !== '' || categoryId !== '' || dateTouched || periodTouched || !shared || payerId !== meId || notes.trim() !== ''
    }
    return (
      title.trim() !== expense?.title ||
      categoryId !== expense?.categoryId ||
      amount !== normalizeMoney(expense?.amount ?? 0) ||
      spentOn !== expense?.spentOn ||
      period !== expense?.period ||
      shared !== expense?.isShared ||
      payerId !== expense?.payerId ||
      clampNotes(notes) !== (expense?.notes ?? null)
    )
  }

  async function save() {
    if (saving || readOnly) return
    setShowErrors(true)
    if (!canSave || futureDate) return
    const nextPeriod = periodFollowsDate(spentOn, period, periodTouched)
    if (nextShared && sharedMonthSettled(true, nextPeriod, settledMonths)) {
      setError(settledExpenseError)
      return
    }
    if (expense?.isShared && !nextShared && !ownerCanMakePrivate(expense.ownerId, meId)) {
      setError(privateSwitchError)
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      payerId: shared ? payerId || meId : meId,
      categoryId,
      title: title.trim(),
      amount,
      spentOn,
      period: nextPeriod,
      isShared: nextShared,
      notes: clampNotes(notes),
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

  const categoryName = categories.find((category) => category.id === categoryId)?.name ?? ''
  const payerName = names[payerId] ?? ''
  const periodLabel = periodCaption(period, monthChoices)

  const footer = readOnly ? (
    <Button type="button" variant="alt" tall onClick={onClose}>
      Listo
    </Button>
  ) : confirming === 'delete' ? (
    <div className="space-y-2">
      <p className="text-center text-sm font-bold text-title">{deleteExpenseConfirm}</p>
      <Button type="button" variant="danger" tall onClick={() => void remove()} disabled={saving}>
        <AppIcon name="trash" /> {saving ? 'Eliminando…' : 'Eliminar'}
      </Button>
      <Button type="button" variant="alt" onClick={() => setConfirming(null)} disabled={saving}>
        Cancelar
      </Button>
    </div>
  ) : confirming === 'discard' ? (
    <div className="space-y-2">
      <p className="text-center text-sm font-bold text-title">¿Descartar este gasto?</p>
      <Button type="button" variant="danger" tall onClick={onClose}>
        Descartar
      </Button>
      <Button type="button" variant="alt" onClick={() => setConfirming(null)}>
        Seguir
      </Button>
    </div>
  ) : (
    <div className="space-y-2">
      <Button
        type="button"
        tall
        disabled={saving}
        onClick={() => {
          if (saving) return
          void save()
        }}
      >
        <AppIcon name="check" /> {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar'}
      </Button>
      {editing ? (
        <Button type="button" variant="danger" tall onClick={() => setConfirming('delete')} disabled={saving}>
          <AppIcon name="trash" /> Eliminar
        </Button>
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
        <p className="mb-3 rounded-2xl bg-mostaza-claro px-3 py-2 text-sm font-bold leading-snug text-mostaza-ink">
          Revisá el comprobante. No se guarda hasta que toques Guardar.
        </p>
      ) : null}
      {settledLock ? (
        <div className="mb-3 rounded-2xl bg-azul-claro p-3 text-base font-semibold text-tinta">
          <AppIcon name="lock" className="mr-1" />
          {monthWord(expense?.period ?? period)} ya está saldado. Para cambiar este gasto, primero deshacé el saldo en Compartidos.
          <Link to="/compartidos" className="mt-2 flex min-h-11 items-center text-base font-bold text-mostaza-ink">
            Ir a Compartidos
          </Link>
        </div>
      ) : null}
      {readOnly ? (
        <div>
          <PlainRow label="Tipo" value={expense?.paidFromBag ? 'Privado, pagado con la bolsa' : shared ? 'Compartido' : 'Privado'} />
          {shared && !expense?.paidFromBag ? <PlainRow label="Quién pagó" value={payerName} /> : null}
          <PlainRow label="Nombre" value={title} />
          <PlainRow label="Categoría" value={categoryName} />
          <div className="mb-3 border-b border-line py-2">
            <p className="text-sm font-semibold text-muted">Monto</p>
            <p className="font-display text-[38px] font-semibold leading-none text-title">{formatMoney(amount)}</p>
          </div>
          <PlainRow label="Fecha" value={shortDate(spentOn)} />
          <PlainRow label="Corresponde a" value={monthTitle(period)} />
          {notes.trim() ? <PlainRow label="Notas" value={notes} /> : null}
        </div>
      ) : null}
      {readOnly ? null : (
      <>
      {expense?.paidFromBag ? (
        <p className="mb-3 text-sm font-semibold text-muted">
          <AppIcon name="bag-shopping" className="mr-1 text-mostaza-ink" /> Pagado con la bolsa. Sigue siendo privado.
        </p>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label="¿Compartido o privado?">
          <button
            type="button"
            disabled={privacyLocked}
            aria-pressed={shared}
            className={segmentClass(shared, 'primary')}
            onClick={() => {
              setShared(true)
              setCategoryId((current) => (categories.some((category) => category.id === current && category.ownerId === null) ? current : ''))
            }}
          >
            <AppIcon name="user-group" /> Compartido
          </button>
          <button
            type="button"
            disabled={privacyLocked}
            aria-pressed={!shared}
            className={segmentClass(!shared, 'warn')}
            onClick={() => {
              setShared(false)
              setPayerId(meId)
              setCategoryId((current) => (categories.some((category) => category.id === current && category.ownerId === meId) ? current : ''))
            }}
          >
            <AppIcon name="lock" /> Privado
          </button>
        </div>
      )}
      {shared && !expense?.paidFromBag ? (
        <div className="mb-3">
          <p className="mb-1 text-sm font-bold text-muted">¿Quién pagó?</p>
          <div className="grid grid-cols-2 gap-2">
            {people.map(([id, name]) => (
              <button key={id} type="button" aria-pressed={payerId === id} className={segmentClass(payerId === id, 'primary')} onClick={() => setPayerId(id)}>
                {id === meId ? `Yo (${name})` : name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
        {showErrors && missingName ? <span className="mt-1 block font-bold text-tinta">Poné un nombre.</span> : null}
        {prefill?.missingTitle && title.trim() === '' ? (
          <span className="mt-1 block font-bold text-tinta">No pude leer el comercio. Podés escribirlo vos.</span>
        ) : null}
      </label>
      <div className="mb-3">
        <p className="mb-1 text-sm font-bold text-muted">Categoría</p>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((category) => (
            <Chip
              key={category.id}
              active={categoryId === category.id}
              className={category.id === suggestedId ? 'ring-2 ring-mostaza-ink' : ''}
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
        {showErrors && missingCategory ? <p className="mt-1 text-sm font-bold text-tinta">Elegí una categoría.</p> : null}
        {drafting ? (
          <div className="mt-2 rounded-2xl bg-card p-4 border-2 border-azul-ink">
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
            <Button type="button" variant="alt" className="mt-2" onClick={() => void addCategory()} disabled={saving}>
              Crear categoría
            </Button>
          </div>
        ) : null}
      </div>
      <MoneyField
        draft={digits}
        onDraft={setDigits}
        size="hero"
        error={
          showErrors && missingAmount
            ? 'El monto tiene que ser mayor a 0.'
            : prefill?.missingAmount && digits === ''
              ? 'No pude leer el monto. Completalo antes de guardar.'
              : undefined
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block text-sm font-bold text-muted">
          Fecha
          <input
            type="date"
            value={spentOn}
            max={today}
            onChange={(event) => {
              const next = event.target.value
              setDateTouched(true)
              setSpentOn(next)
              if (!periodTouched) setPeriod(periodFromDate(next))
            }}
            className={`mt-1 ${inputClass} ${showErrors && futureDate ? '!border-rosa-hondo' : ''}`}
          />
        </label>
        <div>
          <p className="text-sm font-bold text-muted">Corresponde a</p>
          <button type="button" className={`mt-1 ${inputClass} text-left`} onClick={() => setPeriodOpen(true)}>
            {periodLabel}
          </button>
        </div>
      </div>
      {showErrors && futureDate ? (
        <p className="mb-3 flex items-center gap-1 text-sm font-bold text-tinta">
          <AppIcon name="circle-exclamation" /> La fecha no puede ser posterior a hoy
        </p>
      ) : null}
      {prefill?.missingDate && !dateTouched ? (
        <p className="mb-3 text-sm font-bold text-tinta">No pude leer la fecha. Dejé la de hoy para que la corrijas.</p>
      ) : null}
      {nextShared ? <p className="mb-3 text-sm font-semibold text-muted">{settledHelp}</p> : null}
      {notesOpen ? (
        <NotesField value={notes} onChange={setNotes} />
      ) : (
        <button type="button" className="mb-3 inline-flex min-h-11 items-center text-base font-bold text-mostaza-ink" onClick={() => setNotesOpen(true)}>
          Agregar una nota
        </button>
      )}
      </>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )

  if (presentation === 'sheet') {
    return (
      <>
      <Sheet open title={titleText} onClose={requestClose} footer={footer}>
        {fields}
      </Sheet>
      <PeriodPicker
        open={periodOpen}
        period={period}
        choices={monthChoices}
        shared={nextShared}
        settledMonths={settledMonths}
        onChoose={choosePeriod}
        onOther={(next) => {
          if (nextShared && sharedMonthSettled(true, next, settledMonths)) {
            setError(settledHelp)
            return
          }
          setError('')
          setPeriodTouched(true)
          setPeriod(next)
          setPeriodOpen(false)
        }}
        onClose={() => setPeriodOpen(false)}
      />
      </>
    )
  }

  return (
    <>
      <header className="mb-3 flex items-center">
        <button type="button" onClick={requestClose} aria-label="Volver" className="grid h-11 w-11 shrink-0 place-items-center text-title">
          <AppIcon name="chevron-left" />
        </button>
        <h1 className="font-display text-xl font-semibold text-title">{titleText}</h1>
      </header>
      {fields}
      <PeriodPicker
        open={periodOpen}
        period={period}
        choices={monthChoices}
        shared={nextShared}
        settledMonths={settledMonths}
        onChoose={choosePeriod}
        onOther={(next) => {
          if (nextShared && sharedMonthSettled(true, next, settledMonths)) {
            setError(settledHelp)
            return
          }
          setError('')
          setPeriodTouched(true)
          setPeriod(next)
          setPeriodOpen(false)
        }}
        onClose={() => setPeriodOpen(false)}
      />
      <div className="h-36" />
      <div className="fixed inset-x-0 z-30 mx-auto w-full max-w-[430px] bg-bg px-5 pb-3 pt-2" style={{ bottom: keyboard }}>
        {footer}
      </div>
    </>
  )
}

function monthWord(period: string): string {
  const name = monthName(period)
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function periodCaption(period: string, choices: readonly string[]): string {
  const index = choices.indexOf(period)
  if (index === 0) return 'Mes anterior'
  if (index === 1) return 'Mes actual'
  if (index === 2) return 'Mes siguiente'
  return monthTitle(period)
}

function segmentClass(active: boolean, tone: 'primary' | 'warn'): string {
  const on = tone === 'warn' ? 'bg-mostaza-claro text-title' : 'border-[1.5px] border-tinta bg-mostaza text-tinta'
  return `inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-3 text-base font-bold disabled:opacity-60 ${active ? on : 'bg-sand text-title'}`
}

function PlainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 border-b border-line py-2">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="text-base font-bold text-title">{value}</p>
    </div>
  )
}

function PeriodPicker({
  open,
  period,
  choices,
  shared,
  settledMonths,
  onChoose,
  onOther,
  onClose,
}: {
  open: boolean
  period: string
  choices: readonly string[]
  shared: boolean
  settledMonths: readonly string[]
  onChoose: (period: string) => void
  onOther: (period: string) => void
  onClose: () => void
}) {
  const [other, setOther] = useState(!choices.includes(period))
  const labels = ['Mes anterior', 'Mes actual', 'Mes siguiente']
  return (
    <Sheet
      open={open}
      title="Corresponde a"
      onClose={onClose}
      footer={
        <Button type="button" variant="alt" tall onClick={onClose}>
          Listo
        </Button>
      }
    >
      <div className="space-y-2">
        {choices.map((choice, index) => {
          const closed = shared && sharedMonthSettled(true, choice, settledMonths)
          return (
            <button
              key={choice}
              type="button"
              disabled={closed}
              onClick={() => onChoose(choice)}
              className="flex min-h-[52px] w-full items-center justify-between rounded-2xl px-3 text-left disabled:text-muted"
            >
              <span>
                <span className="block text-base font-bold text-title">{labels[index]}</span>
                <span className="text-sm font-semibold text-muted">{monthWord(choice)}</span>
              </span>
              {closed ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
                  <AppIcon name="lock" /> Saldado
                </span>
              ) : period === choice ? (
                <AppIcon name="check" className="text-mostaza-ink" />
              ) : null}
            </button>
          )
        })}
        <button type="button" className="flex min-h-[52px] w-full items-center justify-between rounded-2xl px-3 text-left" onClick={() => setOther(true)}>
          <span>
            <span className="block text-base font-bold text-title">Elegir otro</span>
            <span className="text-sm font-semibold text-muted">Cualquier mes sin saldar</span>
          </span>
        </button>
        {other ? (
          <label className="block px-3 text-sm font-bold text-muted">
            {monthTitle(period)}
            <input
              type="month"
              value={period.slice(0, 7)}
              onChange={(event) => {
                if (!event.target.value) return
                onOther(`${event.target.value}-01`)
              }}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        ) : null}
      </div>
    </Sheet>
  )
}

