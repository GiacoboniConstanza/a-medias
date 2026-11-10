import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppIcon } from './AppIcon.tsx'
import { Plantita } from './Adornos.tsx'
import { IconPicker } from './IconPicker.tsx'
import { amountFromDigits } from '../lib/format.ts'
import { MoneyField } from './MoneyField.tsx'
import { Button, Chip, inputClass } from './ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import {
  createCategory,
  createExpense,
  createExtra,
  deleteExpense,
  loadSettledMonths,
  saveSalaryRevision,
  updateExpense,
  type Category,
  type ExpenseItem,
} from '../lib/api.ts'
import { monthPocket, monthSplit, partnerId } from '../lib/derive.ts'
import { formatMoney, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import { homeAccountingCard } from '../lib/home-card.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { loanMonthEffect, loadLoanMovements, saveTransfer, sharedSignedBalance } from '../lib/loans.ts'
import { movementTextFields, movementTypeIsLocked, showSharedPayerPicker } from '../lib/movement-row.ts'
import { catamarcaToday, isAfterDay, monthKey, monthName, monthTitle, shiftMonth, shortDate } from '../lib/month.ts'
import { periodFollowsDate, periodFromDate, sharedMonthSettled } from '../lib/period.ts'
import { debtSentence } from '../lib/split.ts'

export type MovementType = 'gasto' | 'ingreso' | 'transferencia'

export type MovementPrefill = {
  amount?: number | null
  title?: string | null
  spentOn?: string | null
  tipo?: MovementType
  missingAmount?: boolean
  missingTitle?: boolean
  missingDate?: boolean
}

type IncomeKind = 'puntual' | 'sueldo'
type TransferDir = 'sent' | 'received'

const SUGGESTED = ['Súper', 'Comida', 'Hogar', 'Luz', 'Salidas', 'Farmacia']
const settledHelp =
  'Los meses saldados están cerrados. Para cargar ahí, deshacé el saldo en Resumen.'

type SavedView = {
  kind: MovementType | 'edit'
  amount: number
  summary: string
}

export function MovementForm({
  expense = null,
  prefill,
  onClose,
  onDone,
}: {
  expense?: ExpenseItem | null
  prefill?: MovementPrefill
  onClose?: () => void
  onDone?: () => void | Promise<void>
} = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const { data, refresh } = useFinance()
  const [settledMonths, setSettledMonths] = useState<string[]>([])
  const [saved, setSaved] = useState<SavedView | null>(null)
  const [savedPocket, setSavedPocket] = useState<ReturnType<typeof homeAccountingCard> | null>(null)
  const [savedDebt, setSavedDebt] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const stateTipo = (location.state as { tipo?: MovementType; from?: string } | null)?.tipo
  const fromPath = (location.state as { from?: string } | null)?.from

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

  if (!profile?.householdId) {
    return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  }

  if (saved && savedPocket) {
    const title =
      saved.kind === 'edit'
        ? 'Cambios guardados'
        : saved.kind === 'gasto'
          ? 'Gasto guardado'
          : saved.kind === 'ingreso'
            ? 'Ingreso guardado'
            : 'Transferencia guardada'
    return (
      <div className="min-h-dvh bg-crema pb-8">
        <section className="scallop-b bg-azul px-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label="Volver"
            className="-ml-3 inline-flex min-h-11 min-w-11 items-center justify-center text-tinta"
            onClick={() => navigate(fromPath || '/')}
          >
            <AppIcon name="chevron-left" />
          </button>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-[34px] font-semibold text-tinta">
            <AppIcon name="circle-check" className="mr-2" />
            {title}
          </h1>
          <p className="mt-1 text-sm font-semibold text-tinta">{saved.summary}</p>
          <div className="sr-only" aria-live="polite">
            {title}. Te quedan {savedPocket.remainingText}.
          </div>
        </section>
        <div className="space-y-4 px-4 pt-4">
          <section className="rounded-2xl border-2 border-azul-ink bg-tarjeta p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold text-tinta">Te quedan en {monthName(monthKey())}</h2>
                <p className="mt-1 whitespace-nowrap font-display text-[clamp(1.75rem,9.25vw,2.25rem)] font-semibold text-tinta">
                  {savedPocket.remainingText}
                </p>
              </div>
              <Plantita width={56} height={73} className="shrink-0" />
            </div>
            <div className="mt-3 space-y-2 border-t border-dashed border-linea-punteada pt-3">
              {savedPocket.lines.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-3 text-sm font-semibold">
                  <span className="text-gris">{line.label}</span>
                  <span
                    className={`whitespace-nowrap font-display text-lg ${
                      line.role === 'income' ? 'text-mostaza-ink' : line.role === 'loan' ? 'text-ciruela-ink' : 'text-tinta'
                    }`}
                  >
                    {line.amount}
                  </span>
                </div>
              ))}
            </div>
          </section>
          {savedDebt ? (
            <section className="rounded-2xl border-2 border-azul-ink bg-tarjeta p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-rosa-claro text-tinta">
                  <AppIcon name="handshake" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gris">Saldo con {partnerName(data?.names ?? {}, profile.id)}</p>
                  <p className="font-display text-lg font-semibold text-tinta">{savedDebt}</p>
                </div>
              </div>
            </section>
          ) : null}
          <div className="space-y-2 pt-6">
            <Button
              type="button"
              tall
              onClick={() => {
                void onDone?.()
                if (onClose) onClose()
                else navigate(fromPath || '/')
              }}
            >
              Listo
            </Button>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center font-semibold text-mostaza-ink"
              onClick={() => {
                setSaved(null)
                setSavedPocket(null)
                setSavedDebt(null)
              }}
            >
              <AppIcon name="plus" className="mr-1" /> Cargar otro
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>

  return (
    <MovementFormBody
      householdId={profile.householdId}
      meId={profile.id}
      names={data.names}
      categories={data.categories}
      expense={expense}
      prefill={prefill}
      initialTipo={expense ? 'gasto' : prefill?.tipo ?? stateTipo ?? null}
      editing={Boolean(expense)}
      settledMonths={settledMonths}
      salaryHistory={data.salaryHistory}
      onClose={() => {
        if (onClose) onClose()
        else if (fromPath) navigate(fromPath)
        else navigate(-1)
      }}
      onSaved={async (view) => {
        await refresh()
        const finance = await import('../lib/api.ts').then((mod) =>
          mod.loadFinance(profile.householdId!, profile.id, monthKey()),
        )
        const partner = partnerId(finance, profile.id)
        const partnerLabel = partner ? finance.names[partner] ?? 'tu compañera' : ''
        const pocket = monthPocket({
          base: finance.bases[profile.id] ?? 0,
          privateSpent: finance.monthExpenses
            .filter((row) => !row.isShared && row.payerId === profile.id)
            .reduce((sum, row) => sum + row.amount, 0),
          sharedPaid: finance.monthExpenses
            .filter((row) => row.isShared && row.payerId === profile.id)
            .reduce((sum, row) => sum + row.amount, 0),
          extras: finance.extrasThisMonth.reduce((sum, row) => sum + row.amount, 0),
        })
        const moves = await loadLoanMovements()
        const effect = loanMonthEffect(profile.id, monthKey(), moves.loans, moves.repayments)
        setSavedPocket(homeAccountingCard(pocket, effect, partnerLabel || 'tu compañera'))
        const split = monthSplit(finance)
        const signed = sharedSignedBalance(profile.id, split)
        setSavedDebt(partner ? debtSentence(profile.id, split) : null)
        if (!partner || signed === 0 && split.amount === 0) {
          // keep debt sentence even when a mano
        }
        setSaved(view)
        await onDone?.()
        queueMicrotask(() => headingRef.current?.focus())
      }}
    />
  )
}

function partnerName(names: Record<string, string>, meId: string): string {
  const other = Object.entries(names).find(([id]) => id !== meId)
  return other?.[1] ?? 'tu compañera'
}

function MovementFormBody({
  householdId,
  meId,
  names,
  categories,
  expense,
  prefill,
  initialTipo,
  editing,
  settledMonths,
  salaryHistory,
  onClose,
  onSaved,
}: {
  householdId: string
  meId: string
  names: Record<string, string>
  categories: Category[]
  expense: ExpenseItem | null
  prefill?: MovementPrefill
  initialTipo: MovementType | null
  editing: boolean
  settledMonths: readonly string[]
  salaryHistory: { id: string; amount: number; effectiveFrom: string }[]
  onClose: () => void
  onSaved: (view: SavedView) => void | Promise<void>
}) {
  const { refresh } = useFinance()
  const people = Object.entries(names)
  const partner = people.find(([id]) => id !== meId) ?? null
  const partnerIdValue = partner?.[0] ?? null
  const partnerLabel = partner?.[1] ?? 'tu compañera'

  const [tipo, setTipo] = useState<MovementType | null>(initialTipo)
  const [digits, setDigits] = useState(() => moneyDraftFromAmount(expense?.amount ?? prefill?.amount ?? null))
  const [shared, setShared] = useState(expense ? expense.isShared : true)
  const [payerId, setPayerId] = useState(expense?.payerId ?? meId)
  const [rememberedPayer, setRememberedPayer] = useState(expense?.payerId ?? meId)
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftIcon, setDraftIcon] = useState(DEFAULT_ICON)
  const [incomeKind, setIncomeKind] = useState<IncomeKind>('puntual')
  const [transferDir, setTransferDir] = useState<TransferDir>('sent')
  const [moreOpen, setMoreOpen] = useState(false)
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? prefill?.spentOn ?? catamarcaToday())
  const [period, setPeriod] = useState(expense?.period ?? periodFromDate(prefill?.spentOn || catamarcaToday()))
  const [periodTouched, setPeriodTouched] = useState(Boolean(expense))
  const [title, setTitle] = useState(expense?.title ?? prefill?.title ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const [fieldError, setFieldError] = useState<'tipo' | 'monto' | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [keyboard, setKeyboard] = useState(0)
  const montoRef = useRef<HTMLDivElement>(null)
  const tipoRef = useRef<HTMLDivElement>(null)
  const moreId = useId()

  const amount = normalizeMoney(amountFromDigits(digits))
  const today = catamarcaToday()
  const todayMonth = monthKey()
  const futureDate = isAfterDay(spentOn, today)
  const monthChoices = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, 1)]
  const periodSettled = sharedMonthSettled(true, period, settledMonths)
  const gastoBlocked = tipo === 'gasto' && periodSettled

  const suggested = useMemo(() => {
    const byName = new Map(categories.map((category) => [category.name.toLowerCase(), category]))
    return SUGGESTED.map((name) => byName.get(name.toLowerCase())).filter(Boolean) as Category[]
  }, [categories])
  const categoryList = showAllCategories ? categories : suggested.slice(0, 6)
  const latestSalary = salaryHistory[0] ?? null

  useEffect(() => {
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
  }, [])

  function missingReason(): string | null {
    if (!tipo && amount <= 0) return 'Elegí el tipo y poné el monto.'
    if (!tipo) return 'Elegí si es gasto, ingreso o transferencia.'
    if (amount <= 0) return 'Poné el monto.'
    if (gastoBlocked) return settledHelp
    if (tipo === 'transferencia' && !partnerIdValue) return 'Para cargar transferencias, primero sumá a tu compañera.'
    return null
  }

  const disabledReason = missingReason()
  const canSave = disabledReason === null && !futureDate

  function chooseTipo(next: MovementType) {
    if (movementTypeIsLocked(editing)) return
    if (next === 'transferencia' && !partnerIdValue) {
      setTipo(next)
      setError('Para cargar transferencias, primero sumá a tu compañera.')
      return
    }
    setError('')
    setTipo(next)
    setFieldError(null)
  }

  function toggleShared() {
    setShared((current) => {
      const next = !current
      if (!next) {
        setRememberedPayer(payerId)
        setPayerId(meId)
      } else {
        setPayerId(rememberedPayer)
      }
      return next
    })
  }

  async function save() {
    if (saving) return
    setShowErrors(true)
    if (!tipo) {
      setFieldError('tipo')
      tipoRef.current?.focus()
      return
    }
    if (amount <= 0) {
      setFieldError('monto')
      setError(digits === '' && prefill?.missingAmount ? 'No pude leer el monto. Completalo antes de guardar.' : 'El monto tiene que ser mayor a 0.')
      montoRef.current?.querySelector('input')?.focus()
      return
    }
    if (futureDate) {
      setError('La fecha no puede ser posterior a hoy')
      return
    }
    if (gastoBlocked) {
      setError(settledHelp)
      return
    }
    if (tipo === 'transferencia' && !partnerIdValue) {
      setError('Para cargar transferencias, primero sumá a tu compañera.')
      return
    }

    setSaving(true)
    setError('')
    const nextPeriod = periodFollowsDate(spentOn, period, periodTouched)
    const text = movementTextFields(title, notes)

    try {
      if (tipo === 'gasto') {
        const payload = {
          payerId: shared ? payerId || meId : meId,
          categoryId: categoryId || null,
          title: text.title,
          amount,
          spentOn,
          period: nextPeriod,
          isShared: Boolean(partnerIdValue) && shared,
          notes: text.notes,
        }
        if (expense) {
          await updateExpense({ id: expense.id, ...payload })
          await onSaved({
            kind: 'edit',
            amount,
            summary: summaryLine('gasto', amount, text.title, categoryId, categories, shared, payerId, meId, names),
          })
        } else {
          await createExpense({ householdId, ownerId: meId, ...payload })
          await onSaved({
            kind: 'gasto',
            amount,
            summary: summaryLine('gasto', amount, text.title, categoryId, categories, shared, payerId, meId, names),
          })
        }
      } else if (tipo === 'ingreso') {
        if (incomeKind === 'sueldo') {
          await saveSalaryRevision({
            id: null,
            userId: meId,
            amount,
            effectiveFrom: nextPeriod,
          })
        } else {
          await createExtra({
            userId: meId,
            householdId,
            label: text.title ?? 'Algo puntual',
            amount,
            receivedOn: spentOn,
            notes: text.notes,
            allocations: [],
          })
        }
        await onSaved({
          kind: 'ingreso',
          amount,
          summary: `${formatMoney(amount)} · ${
            incomeKind === 'sueldo' ? 'Sueldo' : text.title ?? 'Algo puntual'
          }`,
        })
      } else if (partnerIdValue) {
        const fromId = transferDir === 'sent' ? meId : partnerIdValue
        const toId = transferDir === 'sent' ? partnerIdValue : meId
        await saveTransfer({
          fromId,
          toId,
          amount,
          transferredOn: spentOn,
          period: nextPeriod,
          // transfers solo tienen notes: nombre si hay, si no la observación.
          notes: text.title ?? text.notes,
        })
        await onSaved({
          kind: 'transferencia',
          amount,
          summary: `${formatMoney(amount)} · ${
            text.title ??
            (transferDir === 'sent' ? `Le pasaste a ${partnerLabel}` : `${partnerLabel} te pasó`)
          }`,
        })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar. Revisá la conexión y probá de nuevo.')
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
        name: draftName,
        icon: draftIcon,
      })
      await refresh()
      setCategoryId(id)
      setDrafting(false)
      setDraftName('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude crear la categoría.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!expense || saving) return
    setSaving(true)
    try {
      await deleteExpense(expense.id)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude eliminar el gasto.')
      setSaving(false)
    }
  }

  const moreSummary = `${monthName(period)} · ${spentOn === today ? 'Hoy' : shortDate(spentOn)}`

  return (
    <div className="min-h-dvh bg-crema">
      <section className="scallop-b bg-azul px-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Volver"
          className="-ml-3 inline-flex min-h-12 min-w-11 items-center justify-center text-tinta"
          onClick={onClose}
        >
          <AppIcon name="chevron-left" />
        </button>
        <h1 className="font-display text-[34px] font-semibold text-tinta">
          {editing ? 'Editar movimiento' : 'Nuevo movimiento'}
        </h1>
        <div
          ref={tipoRef}
          tabIndex={-1}
          className="mt-3 grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label="Tipo de movimiento"
        >
          {(
            [
              { id: 'gasto', label: 'Gasto', icon: 'receipt', tone: 'bg-rosa-claro' },
              { id: 'ingreso', label: 'Ingreso', icon: 'sack-dollar', tone: 'bg-mostaza-claro' },
              { id: 'transferencia', label: 'Transferencia', icon: 'right-left', tone: 'bg-ciruela-claro' },
            ] as const
          ).map((option) => {
            const selected = tipo === option.id
            const locked = movementTypeIsLocked(editing) && tipo !== option.id
            const transferOff = option.id === 'transferencia' && !partnerIdValue && !editing
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked || transferOff || undefined}
                aria-disabled={locked || transferOff || undefined}
                className={`relative flex h-16 flex-col items-center justify-center rounded-2xl text-sm ${
                  selected
                    ? `${option.tone} border-2 border-tinta font-bold text-tinta`
                    : locked || transferOff
                      ? 'border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado font-semibold text-gris'
                      : 'border-[1.5px] border-azul-ink bg-tarjeta font-semibold text-tinta'
                }`}
                onClick={() => {
                  if (locked) return
                  chooseTipo(option.id)
                }}
              >
                {selected ? <AppIcon name="check" className="absolute right-2 top-2 text-xs" /> : null}
                <AppIcon name={option.icon} />
                <span className="mt-1">{option.label}</span>
              </button>
            )
          })}
        </div>
        {editing ? (
          <p className="mt-2 text-sm font-semibold text-tinta">Para cambiar el tipo, eliminalo y cargalo de nuevo.</p>
        ) : null}
        {tipo === 'transferencia' && !partnerIdValue ? (
          <p className="mt-2 text-sm font-semibold text-tinta" role="alert">
            Para cargar transferencias, primero sumá a tu compañera.{' '}
            <Link to="/compartir" className="font-bold text-mostaza-ink">
              Invitarla
            </Link>
          </p>
        ) : null}
        {showErrors && fieldError === 'tipo' ? (
          <p className="mt-2 flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
            <AppIcon name="circle-exclamation" /> Elegí si es gasto, ingreso o transferencia.
          </p>
        ) : null}
      </section>

      <div
        className="space-y-4 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[calc(var(--feston-alto)+1rem)]"
        style={{ paddingBottom: `calc(7.5rem + ${keyboard}px)` }}
      >
        <label className="block text-sm font-semibold text-gris">
          Nombre (opcional)
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 500))}
            placeholder="Opcional"
            maxLength={500}
            className={`mt-1 ${inputClass}`}
          />
        </label>

        <div ref={montoRef}>
          <MoneyField
            draft={digits}
            onDraft={setDigits}
            size="form"
            autoFocus={!editing}
            error={
              showErrors && fieldError === 'monto'
                ? error || 'El monto tiene que ser mayor a 0.'
                : undefined
            }
          />
        </div>

        {tipo === 'gasto' ? (
          <>
            {partnerIdValue ? (
              <button
                type="button"
                role="switch"
                aria-checked={shared}
                className="flex min-h-[52px] w-full items-center justify-between gap-3"
                onClick={toggleShared}
              >
                <span className="text-lg font-medium text-tinta">¿Es compartido?</span>
                <span
                  className={`relative inline-flex h-10 w-16 items-center rounded-full border-[1.5px] px-1 ${
                    shared ? 'justify-end border-tinta bg-mostaza' : 'justify-start border-gris bg-tarjeta'
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                      shared ? 'bg-tinta text-mostaza' : 'bg-gris text-tarjeta'
                    }`}
                  >
                    {shared ? <AppIcon name="check" className="text-[14px]" /> : null}
                  </span>
                </span>
              </button>
            ) : null}
            {showSharedPayerPicker({ tipo, shared, hasPartner: Boolean(partnerIdValue) }) ? (
              <div>
                <p id="quien-pago" className="mb-1 text-sm font-semibold text-gris">
                  ¿Quién pagó?
                </p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="quien-pago">
                  {people.map(([id, name]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={payerId === id}
                      className={`inline-flex min-h-[52px] items-center justify-center gap-1 rounded-full px-3 text-sm ${
                        payerId === id
                          ? 'border-[1.5px] border-azul-ink bg-azul-claro font-bold text-tinta'
                          : 'border-[1.5px] border-azul-ink bg-tarjeta font-semibold text-tinta'
                      }`}
                      onClick={() => {
                        setPayerId(id)
                        setRememberedPayer(id)
                      }}
                    >
                      {payerId === id ? <AppIcon name="check" /> : null}
                      {id === meId ? `Yo (${name})` : name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="mb-1 text-sm font-semibold text-gris">Categoría (opcional)</p>
              <div className="flex flex-wrap gap-2">
                {categoryList.map((category) => (
                  <Chip
                    key={category.id}
                    active={categoryId === category.id}
                    onClick={() => setCategoryId((current) => (current === category.id ? '' : category.id))}
                  >
                    <AppIcon name={category.icon} /> {category.name}
                  </Chip>
                ))}
                {!showAllCategories && categories.length > suggested.length ? (
                  <Chip onClick={() => setShowAllCategories(true)}>Ver todas ({categories.length})</Chip>
                ) : null}
                <Chip active={drafting} onClick={() => setDrafting((current) => !current)}>
                  <AppIcon name="plus" /> Nueva
                </Chip>
              </div>
              {drafting ? (
                <div className="mt-2 rounded-2xl border-2 border-azul-ink bg-tarjeta p-4">
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
            </div>
          </>
        ) : null}

        {tipo === 'ingreso' ? (
          <div>
            <p id="que-es" className="mb-1 text-sm font-semibold text-gris">
              ¿Qué es?
            </p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="que-es">
              {(
                [
                  { id: 'puntual', label: 'Algo puntual' },
                  { id: 'sueldo', label: 'Sueldo' },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={incomeKind === option.id}
                  className={`inline-flex min-h-[52px] items-center justify-center gap-1 rounded-full px-3 text-sm ${
                    incomeKind === option.id
                      ? 'border-[1.5px] border-azul-ink bg-azul-claro font-bold text-tinta'
                      : 'border-[1.5px] border-azul-ink bg-tarjeta font-semibold text-tinta'
                  }`}
                  onClick={() => setIncomeKind(option.id)}
                >
                  {incomeKind === option.id ? <AppIcon name="check" /> : null}
                  {option.label}
                </button>
              ))}
            </div>
            {incomeKind === 'sueldo' ? (
              <p className="mt-2 text-sm font-medium text-gris">
                Desde {monthName(period).toLowerCase()}, va a ser tu sueldo en el reparto
                {latestSalary ? `. Hoy figura ${formatMoney(latestSalary.amount)}.` : '.'}
              </p>
            ) : null}
          </div>
        ) : null}

        {tipo === 'transferencia' && partnerIdValue ? (
          <div>
            <p id="quien-paso" className="mb-1 text-sm font-semibold text-gris">
              ¿Quién le pasó a quién?
            </p>
            <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-labelledby="quien-paso">
              <button
                type="button"
                role="radio"
                aria-checked={transferDir === 'sent'}
                className={`inline-flex min-h-[52px] items-center justify-center gap-1 rounded-full px-3 text-sm ${
                  transferDir === 'sent'
                    ? 'border-[1.5px] border-azul-ink bg-azul-claro font-bold text-tinta'
                    : 'border-[1.5px] border-azul-ink bg-tarjeta font-semibold text-tinta'
                }`}
                onClick={() => setTransferDir('sent')}
              >
                {transferDir === 'sent' ? <AppIcon name="check" /> : null}
                Le pasé a {partnerLabel}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={transferDir === 'received'}
                className={`inline-flex min-h-[52px] items-center justify-center gap-1 rounded-full px-3 text-sm ${
                  transferDir === 'received'
                    ? 'border-[1.5px] border-azul-ink bg-azul-claro font-bold text-tinta'
                    : 'border-[1.5px] border-azul-ink bg-tarjeta font-semibold text-tinta'
                }`}
                onClick={() => setTransferDir('received')}
              >
                {transferDir === 'received' ? <AppIcon name="check" /> : null}
                {partnerLabel} me pasó
              </button>
            </div>
            <p className="mt-2 text-sm font-medium text-gris">
              {transferDir === 'sent'
                ? `Para vos es un gasto y para ${partnerLabel}, un ingreso.`
                : `Para vos es un ingreso y para ${partnerLabel}, un gasto.`}
            </p>
          </div>
        ) : null}

        {tipo ? (
          <div>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between border-t border-dashed border-linea-punteada pt-1"
              aria-expanded={moreOpen}
              aria-controls={moreId}
              onClick={() => setMoreOpen((current) => !current)}
            >
              <span className="text-sm font-bold text-mostaza-ink">Más opciones</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gris">
                {moreOpen ? null : moreSummary}
                <AppIcon name="chevron-down" className={moreOpen ? 'rotate-180' : ''} />
              </span>
            </button>
            {moreOpen ? (
              <div id={moreId} className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gris">Período</p>
                    <select
                      value={period}
                      onChange={(event) => {
                        setPeriodTouched(true)
                        setPeriod(periodFromDate(event.target.value))
                      }}
                      className={`mt-1 ${inputClass}`}
                    >
                      {monthChoices.map((choice) => (
                        <option key={choice} value={choice}>
                          {monthTitle(choice)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="block text-sm font-semibold text-gris">
                    Fecha
                    <input
                      type="date"
                      value={spentOn}
                      max={today}
                      onChange={(event) => {
                        const next = event.target.value
                        setSpentOn(next)
                        if (!periodTouched) setPeriod(periodFromDate(next))
                      }}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                </div>
                <div className="text-sm font-semibold text-gris">
                  Observación (opcional)
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value.slice(0, 500))}
                    placeholder="Opcional"
                    rows={3}
                    maxLength={500}
                    className={`mt-1 min-h-[88px] resize-none ${inputClass}`}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {error && fieldError !== 'monto' ? (
          <p className="flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
            <AppIcon name="circle-exclamation" /> {error}
          </p>
        ) : null}
        {showErrors && futureDate ? (
          <p className="flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
            <AppIcon name="circle-exclamation" /> La fecha no puede ser posterior a hoy
          </p>
        ) : null}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 border-t border-linea-punteada bg-crema px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
        style={{ bottom: keyboard }}
      >
        {disabledReason ? (
          <p id="guardar-motivo" className="mb-2 text-center text-sm font-medium text-gris">
            {disabledReason}
          </p>
        ) : null}
        <Button
          type="button"
          tall
          aria-disabled={!canSave || saving || undefined}
          aria-busy={saving || undefined}
          aria-describedby={disabledReason ? 'guardar-motivo' : undefined}
          disabled={saving}
          onClick={() => {
            if (!canSave) {
              setShowErrors(true)
              if (!tipo) {
                setFieldError('tipo')
                tipoRef.current?.focus()
              } else if (amount <= 0) {
                setFieldError('monto')
                montoRef.current?.querySelector('input')?.focus()
              }
              return
            }
            void save()
          }}
        >
          <AppIcon name="check" /> {saving ? 'Guardando…' : 'Guardar'}
        </Button>
        {editing ? (
          <button
            type="button"
            className="mt-2 flex min-h-11 w-full items-center justify-center font-semibold text-tinta"
            onClick={() => void remove()}
          >
            <AppIcon name="trash" className="mr-1" /> Eliminar
          </button>
        ) : null}
      </div>
    </div>
  )
}

function summaryLine(
  _tipo: 'gasto',
  amount: number,
  name: string | null,
  categoryId: string,
  categories: Category[],
  shared: boolean,
  payerId: string,
  meId: string,
  names: Record<string, string>,
): string {
  const category = categories.find((row) => row.id === categoryId)?.name
  const parts = [formatMoney(amount)]
  if (name) parts.push(name)
  else if (category) parts.push(category)
  if (shared) {
    parts.push(payerId === meId ? 'Compartido, pagaste vos' : `Compartido, pagó ${names[payerId] ?? 'tu compañera'}`)
  } else {
    parts.push('Privado')
  }
  return parts.join(' · ')
}
