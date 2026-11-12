import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
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
  createSavingMove,
  deleteExpense,
  deleteExtra,
  deleteSavingMove,
  loadFinance,
  loadSettledMonths,
  saveSalaryRevision,
  updateExpense,
  updateSavingMove,
  type Category,
  type ExpenseItem,
  type ExtraItem,
  type SavingItem,
  type SavingMove,
} from '../lib/api.ts'
import { NewSavingSheet } from '../screens/SavingsScreen.tsx'
import { savingBalances, withdrawableByUser } from '../lib/saving-balance.ts'
import { activeSavings, groupSavings } from '../lib/savings.ts'
import { monthPocket, monthSplit, myPrivateSpent, partnerId } from '../lib/derive.ts'
import { expenseIsReadOnly, sumPaidBy } from '../lib/period.ts'
import { formatMoney, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import { homeAccountingCard } from '../lib/home-card.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { deleteLoan, loanMonthEffect, loadLoanMovements, saveTransfer, type Transfer } from '../lib/transfers.ts'
import { movementTextFields, movementTypeIsLocked, showSharedPayerPicker } from '../lib/movement-row.ts'
import { catamarcaToday, isAfterDay, monthKey, monthName, monthTitle, shiftMonth, shortDate } from '../lib/month.ts'
import { periodFollowsDate, periodFromDate, settledSharedHelp, sharedMonthSettled } from '../lib/period.ts'
import { debtSentence } from '../lib/split.ts'

export type MovementType = 'gasto' | 'ingreso' | 'transferencia' | 'ahorro'

export type MovementPrefill = {
  amount?: number | null
  title?: string | null
  spentOn?: string | null
  tipo?: MovementType
  savingId?: string | null
  savingKind?: 'aporte' | 'retiro'
  missingAmount?: boolean
  missingTitle?: boolean
  missingDate?: boolean
}

type IncomeKind = 'puntual' | 'sueldo'
type TransferDir = 'sent' | 'received'

const SUGGESTED = ['Súper', 'Comida', 'Hogar', 'Luz', 'Salidas', 'Farmacia']

type SavedView = {
  kind: MovementType | 'edit' | 'aporte' | 'retiro'
  amount: number
  summary: string
  saving?: SavingItem
  savingBalance?: number
  mineBalance?: number
}

export function MovementForm({
  expense = null,
  transfer = null,
  savingMove = null,
  extra = null,
  prefill,
  onClose,
  onDone,
}: {
  expense?: ExpenseItem | null
  transfer?: Transfer | null
  savingMove?: SavingMove | null
  extra?: ExtraItem | null
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

  const locationState = (location.state as { tipo?: MovementType; from?: string; savingId?: string } | null)
  const stateTipo = locationState?.tipo
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
            : saved.kind === 'aporte'
              ? 'Aporte guardado'
              : saved.kind === 'retiro'
                ? 'Retiro guardado'
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
                      line.role === 'income'
                        ? 'text-mostaza-ink'
                        : line.role === 'transfer'
                          ? 'text-ciruela-ink'
                          : line.role === 'ahorro'
                            ? 'text-azul-ink'
                            : 'text-tinta'
                    }`}
                  >
                    {line.amount}
                  </span>
                </div>
              ))}
            </div>
          </section>
          {saved.saving ? (
            <section className="rounded-2xl border-2 border-azul-ink bg-tarjeta p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-azul-ink bg-azul-claro text-azul-ink">
                  <AppIcon name={saved.saving.icon} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gris">
                    {saved.saving.isShared ? `En ${saved.saving.name} juntaron` : `En ${saved.saving.name} quedan`}
                  </p>
                  <p className="font-display text-lg font-semibold text-tinta">{formatMoney(saved.savingBalance ?? 0)}</p>
                  {saved.saving.isShared ? (
                    <p className="text-sm font-semibold text-gris">Lo tuyo {formatMoney(saved.mineBalance ?? 0)}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : savedDebt ? (
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
      transfer={transfer}
      savingMove={savingMove}
      extra={extra}
      fixedExpenseIds={
        new Set(
          data.fixed
            .map((item) => item.payment?.expenseId)
            .filter((id): id is string => Boolean(id)),
        )
      }
      prefill={prefill}
      initialTipo={
        expense
          ? 'gasto'
          : transfer
            ? 'transferencia'
            : savingMove
              ? 'ahorro'
              : extra
                ? 'ingreso'
                : prefill?.tipo ?? stateTipo ?? null
      }
      initialSavingId={savingMove?.savingId ?? prefill?.savingId ?? locationState?.savingId ?? null}
      savings={data.savings}
      savingMoves={data.savingMoves}
      editing={Boolean(expense || transfer || savingMove || extra)}
      settledMonths={settledMonths}
      salaryHistory={data.salaryHistory}
      onClose={() => {
        if (onClose) onClose()
        else if (fromPath) navigate(fromPath)
        else navigate(-1)
      }}
      onSaved={async (view) => {
        await refresh()
        const finance = await loadFinance(profile.householdId!, profile.id, monthKey())
        const partner = partnerId(finance, profile.id)
        const partnerLabel = partner ? finance.names[partner] ?? 'tu compañera' : ''
        const myMoves = finance.savingMoves.filter(
          (row) => row.userId === profile.id && row.period.slice(0, 7) === monthKey().slice(0, 7),
        )
        const savedIn = myMoves.filter((row) => row.kind === 'aporte').reduce((sum, row) => sum + row.amount, 0)
        const savedOut = myMoves.filter((row) => row.kind === 'retiro').reduce((sum, row) => sum + row.amount, 0)
        const pocket = monthPocket({
          base: finance.bases[profile.id] ?? 0,
          privateSpent: myPrivateSpent(finance, profile.id),
          sharedPaid: sumPaidBy(
            finance.monthExpenses.filter((row) => row.isShared),
            profile.id,
          ),
          extras: finance.extrasThisMonth.reduce((sum, row) => sum + row.amount, 0),
          savedIn,
          savedOut,
        })
        const moves = await loadLoanMovements()
        const effect = loanMonthEffect(profile.id, monthKey(), moves.loans, moves.repayments)
        setSavedPocket(homeAccountingCard(pocket, effect, partnerLabel || 'tu compañera'))
        const split = monthSplit(finance)
        setSavedDebt(partner ? debtSentence(profile.id, split) : null)
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
  transfer,
  savingMove,
  extra,
  fixedExpenseIds,
  prefill,
  initialTipo,
  initialSavingId,
  savings,
  savingMoves,
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
  transfer: Transfer | null
  savingMove: SavingMove | null
  extra: ExtraItem | null
  fixedExpenseIds: ReadonlySet<string>
  prefill?: MovementPrefill
  initialTipo: MovementType | null
  initialSavingId: string | null
  savings: SavingItem[]
  savingMoves: SavingMove[]
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
  const [digits, setDigits] = useState(() => moneyDraftFromAmount(expense?.amount ?? transfer?.amount ?? savingMove?.amount ?? prefill?.amount ?? null))
  const [shared, setShared] = useState(expense ? expense.isShared : true)
  const [payerId, setPayerId] = useState(expense?.payerId ?? meId)
  const [rememberedPayer, setRememberedPayer] = useState(expense?.payerId ?? meId)
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftIcon, setDraftIcon] = useState(DEFAULT_ICON)
  const [incomeKind, setIncomeKind] = useState<IncomeKind>('puntual')
  const [transferDir, setTransferDir] = useState<TransferDir>(() =>
    transfer && transfer.toId === meId ? 'received' : 'sent',
  )
  const [savingAction, setSavingAction] = useState<'aporte' | 'retiro'>(
    savingMove?.kind ?? prefill?.savingKind ?? 'aporte',
  )
  const activeSavingList = activeSavings(savings)
  const grouped = groupSavings(activeSavingList)
  const orderedSavings = (() => {
    const list = [...grouped.shared, ...grouped.own]
    if (savingMove && !list.some((item) => item.id === savingMove.savingId)) {
      const current = savings.find((item) => item.id === savingMove.savingId)
      if (current) list.unshift(current)
    }
    return list
  })()
  const [savingId, setSavingId] = useState<string | null>(() => {
    if (initialSavingId && (orderedSavings.some((item) => item.id === initialSavingId) || savingMove)) {
      return initialSavingId
    }
    return orderedSavings.length === 1 ? orderedSavings[0]!.id : null
  })
  const [newSavingOpen, setNewSavingOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [spentOn, setSpentOn] = useState(
    expense?.spentOn ?? transfer?.transferredOn ?? savingMove?.spentOn ?? prefill?.spentOn ?? catamarcaToday(),
  )
  const [period, setPeriod] = useState(
    expense?.period ??
      transfer?.period ??
      savingMove?.period ??
      periodFromDate(prefill?.spentOn || catamarcaToday()),
  )
  const [periodTouched, setPeriodTouched] = useState(Boolean(expense || transfer || savingMove))
  const [title, setTitle] = useState(
    expense?.title ?? savingMove?.title ?? (transfer?.notes ?? prefill?.title ?? ''),
  )
  const [notes, setNotes] = useState(expense?.notes ?? savingMove?.notes ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const [fieldError, setFieldError] = useState<'tipo' | 'monto' | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [keyboard, setKeyboard] = useState(0)
  const montoRef = useRef<HTMLDivElement>(null)
  const tipoRef = useRef<HTMLDivElement>(null)
  const moreId = useId()

  const amount = normalizeMoney(amountFromDigits(digits))
  const today = catamarcaToday()
  const todayMonth = monthKey()
  const futureDate = isAfterDay(spentOn, today)
  const monthChoices = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, 1)]
  // P4: solo gastos que se guardarían como compartidos; chequear el período que realmente se guarda.
  const willBeShared = Boolean(partnerIdValue) && shared
  const nextPeriodPreview = periodFollowsDate(spentOn, period, periodTouched)
  const periodSettled = sharedMonthSettled(willBeShared, nextPeriodPreview, settledMonths)
  const gastoBlocked = tipo === 'gasto' && periodSettled
  const settledHelp = settledSharedHelp(nextPeriodPreview)

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
    if (!tipo) return 'Elegí si es gasto, ingreso, transferencia o ahorro.'
    if (amount <= 0) return 'Poné el monto.'
    if (gastoBlocked) return settledHelp
    if (tipo === 'transferencia' && !partnerIdValue) return 'Para cargar transferencias, primero sumá a tu compañera.'
    if (tipo === 'ahorro') {
      if (orderedSavings.length === 0) return 'Primero creá un ahorro.'
      if (!savingId) return savingAction === 'aporte' ? 'Elegí a qué ahorro va.' : 'Elegí de qué ahorro sale.'
      const chosen = orderedSavings.find((item) => item.id === savingId)
      if (chosen && savingAction === 'retiro') {
        const bal = savingBalances(
          chosen.openings,
          savingMoves.filter((row) => row.savingId === chosen.id),
        )
        const ceiling = chosen.isShared ? withdrawableByUser(bal, meId) : bal.total
        if (amount > ceiling) return 'Bajá el monto o elegí otro ahorro.'
      }
    }
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
          })
        }
        await onSaved({
          kind: 'ingreso',
          amount,
          summary: `${formatMoney(amount)} · ${
            incomeKind === 'sueldo' ? 'Sueldo' : text.title ?? 'Algo puntual'
          }`,
        })
      } else if (tipo === 'ahorro') {
        if (!savingId) throw new Error(savingAction === 'aporte' ? 'Elegí a qué ahorro va.' : 'Elegí de qué ahorro sale.')
        if (savingMove) {
          await updateSavingMove({
            id: savingMove.id,
            savingId,
            amount,
            spentOn,
            period: nextPeriod,
            title: text.title,
            notes: text.notes,
          })
        } else {
          await createSavingMove({
            savingId,
            householdId,
            userId: meId,
            kind: savingAction,
            amount,
            spentOn,
            period: nextPeriod,
            title: text.title,
            notes: text.notes,
          })
        }
        const chosen = savings.find((item) => item.id === savingId)!
        const moves = savingMove
          ? savingMoves.map((row) =>
              row.id === savingMove.id
                ? { userId: meId, kind: savingAction, amount }
                : { userId: row.userId, kind: row.kind, amount: row.amount },
            )
          : [
              ...savingMoves.filter((row) => row.savingId === savingId),
              { userId: meId, kind: savingAction, amount },
            ]
        const bal = savingBalances(chosen.openings, moves)
        await onSaved({
          kind: savingMove ? 'edit' : savingAction,
          amount,
          summary: `${formatMoney(amount)} · ${chosen.name}${text.title ? ` · ${text.title}` : chosen.isShared ? ` · Con ${partnerLabel}` : ''}`,
          saving: chosen,
          savingBalance: bal.total,
          mineBalance: bal.byUser[meId] ?? 0,
        })
      } else if (partnerIdValue) {
        if (transfer) {
          throw new Error('Las transferencias se borran; no se editan acá.')
        }
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
    if (saving) return
    if (!expense && !transfer && !savingMove && !extra) return
    setSaving(true)
    setError('')
    try {
      if (expense) await deleteExpense(expense.id)
      else if (transfer) await deleteLoan(transfer.id)
      else if (savingMove) await deleteSavingMove(savingMove.id)
      else if (extra) await deleteExtra(extra.id)
      onClose()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : expense
            ? 'No pude eliminar el gasto.'
            : transfer
              ? 'No pude eliminar la transferencia.'
              : extra
                ? 'No pude eliminar el ingreso.'
                : 'No pude eliminar el movimiento de ahorro.',
      )
      setSaving(false)
      setConfirmingDelete(false)
    }
  }

  const moreSummary = `${monthName(period)} · ${spentOn === today ? 'Hoy' : shortDate(spentOn)}`
  const expenseReadOnly = expenseIsReadOnly(expense, meId, settledMonths)
  const expenseIsFixedPayment = Boolean(expense && fixedExpenseIds.has(expense.id))
  const savingArchived = Boolean(
    savingMove && savings.find((item) => item.id === savingMove.savingId)?.archivedAt,
  )
  const transferOwnedByPartner = Boolean(transfer && transfer.createdBy && transfer.createdBy !== meId)
  const deleteBlockedReason = expenseIsFixedPayment
    ? 'Es el pago de un gasto fijo: se deshace en Avisos.'
    : expense && expense.isShared && sharedMonthSettled(expense.isShared, expense.period, settledMonths)
      ? `${monthName(expense.period)} está saldado: un gasto compartido no se puede eliminar. Deshacé el saldo en Resumen.`
      : expenseReadOnly
        ? 'No podés eliminar un gasto privado de otra.'
        : savingArchived
          ? 'El ahorro está archivado.'
          : transferOwnedByPartner
            ? `La cargó ${partnerLabel}: solo ella la puede eliminar.`
            : null

  if (extra) {
    return (
      <div className="min-h-dvh bg-crema">
        <section className="scallop-b bg-azul px-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-crema text-tinta" onClick={onClose}>
              <AppIcon name="arrow-left" />
            </button>
            <h1 className="font-display text-xl font-semibold text-tinta">Ingreso</h1>
          </div>
        </section>
        <div className="space-y-4 px-4 py-6">
          <p className="font-display text-3xl font-semibold text-mostaza-ink">+{formatMoney(extra.amount)}</p>
          <p className="text-sm font-semibold text-gris">
            {extra.label?.trim() || 'Algo puntual'} · {shortDate(extra.receivedOn)}
          </p>
          {extra.notes ? <p className="text-sm font-semibold text-tinta">{extra.notes}</p> : null}
          {error ? (
            <p className="flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
              <AppIcon name="circle-exclamation" /> {error}
            </p>
          ) : null}
          {confirmingDelete ? (
            <div className="space-y-3">
              <p className="font-display text-xl font-semibold">¿Eliminar este ingreso?</p>
              <p className="text-sm font-semibold text-gris">No se puede deshacer.</p>
              <Button type="button" variant="danger" className="w-full" onClick={() => void remove()} disabled={saving}>
                Eliminar
              </Button>
              <Button type="button" variant="alt" className="w-full" onClick={() => setConfirmingDelete(false)} disabled={saving}>
                Volver
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center font-semibold text-tinta"
              onClick={() => setConfirmingDelete(true)}
            >
              <AppIcon name="trash" className="mr-1" /> Eliminar
            </button>
          )}
        </div>
      </div>
    )
  }

  if (transfer) {
    const sent = transfer.fromId === meId
    return (
      <div className="min-h-dvh bg-crema">
        <section className="scallop-b bg-azul px-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-crema text-tinta" onClick={onClose}>
              <AppIcon name="arrow-left" />
            </button>
            <h1 className="font-display text-xl font-semibold text-tinta">Transferencia</h1>
          </div>
        </section>
        <div className="space-y-4 px-4 py-6">
          <p className="font-display text-3xl font-semibold">{formatMoney(transfer.amount)}</p>
          <p className="text-sm font-semibold text-gris">
            {sent ? `Le pasaste a ${partnerLabel}` : `${partnerLabel} te pasó`} · {shortDate(transfer.transferredOn)}
          </p>
          {transfer.notes ? <p className="text-sm font-semibold text-tinta">{transfer.notes}</p> : null}
          {error ? (
            <p className="flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
              <AppIcon name="circle-exclamation" /> {error}
            </p>
          ) : null}
          {transferOwnedByPartner ? (
            <p className="flex items-start gap-2 text-sm font-semibold text-tinta">
              <AppIcon name="lock" className="mt-0.5 shrink-0" />
              <span>{deleteBlockedReason}</span>
            </p>
          ) : confirmingDelete ? (
            <div className="space-y-3">
              <p className="font-display text-xl font-semibold">¿Eliminar esta transferencia?</p>
              <p className="text-sm font-semibold text-gris">Se saca de Te quedan. No se puede deshacer.</p>
              <Button type="button" variant="danger" className="w-full" onClick={() => void remove()} disabled={saving}>
                Eliminar
              </Button>
              <Button type="button" variant="alt" className="w-full" onClick={() => setConfirmingDelete(false)} disabled={saving}>
                Volver
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center font-semibold text-tinta"
              onClick={() => setConfirmingDelete(true)}
            >
              <AppIcon name="trash" className="mr-1" /> Eliminar
            </button>
          )}
        </div>
      </div>
    )
  }

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
          className="mt-3 grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Tipo de movimiento"
        >
          {(
            [
              { id: 'gasto', label: 'Gasto', icon: 'receipt', soft: 'bg-rosa-claro', ink: 'text-rosa-texto', ring: 'border-rosa-texto' },
              { id: 'ingreso', label: 'Ingreso', icon: 'sack-dollar', soft: 'bg-mostaza-claro', ink: 'text-mostaza-ink', ring: 'border-mostaza-ink' },
              { id: 'transferencia', label: 'Transferencia', icon: 'right-left', soft: 'bg-ciruela-claro', ink: 'text-ciruela-ink', ring: 'border-ciruela-ink' },
              { id: 'ahorro', label: 'Ahorro', icon: 'piggy-bank', soft: 'bg-azul-claro', ink: 'text-azul-ink', ring: 'border-azul-ink' },
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
                className={`relative flex h-16 items-center gap-2 rounded-2xl px-2.5 text-sm whitespace-nowrap ${
                  selected
                    ? `${option.soft} border-2 border-tinta font-bold text-tinta`
                    : locked || transferOff
                      ? 'border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado font-semibold text-gris'
                      : 'border-[1.5px] border-azul-ink bg-tarjeta font-semibold text-tinta'
                }`}
                onClick={() => {
                  if (locked) return
                  chooseTipo(option.id)
                }}
              >
                {selected ? <AppIcon name="check" className="absolute right-2 top-1.5 text-xs" /> : null}
                <span className={`grid h-8 w-8 place-items-center rounded-full border-2 ${option.ring} ${selected ? 'bg-tarjeta' : option.soft} ${option.ink}`}>
                  <AppIcon name={option.icon} className="text-[15px]" />
                </span>
                <span>{option.label}</span>
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
            <AppIcon name="circle-exclamation" /> Elegí si es gasto, ingreso, transferencia o ahorro.
          </p>
        ) : null}
        {!editing ? (
          <Link
            to="/movimientos/resumen"
            state={{ from: '/cargar' }}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-tinta underline"
          >
            <AppIcon name="file-arrow-up" /> O subí un resumen de Mercado Pago
          </Link>
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

        {tipo === 'ahorro' ? (
          <AhorroFields
            action={savingAction}
            onAction={setSavingAction}
            actionLocked={Boolean(savingMove)}
            savings={orderedSavings}
            savingId={savingId}
            onSavingId={setSavingId}
            meId={meId}
            partnerLabel={partnerLabel}
            savingMoves={savingMoves}
            amount={amount}
            showErrors={showErrors}
            onCreateSaving={() => setNewSavingOpen(true)}
          />
        ) : null}

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

      <NewSavingSheet
        open={newSavingOpen}
        onClose={() => setNewSavingOpen(false)}
        householdId={householdId}
        meId={meId}
        partnerId={partnerIdValue}
        partnerLabel={partnerLabel}
        onSaved={async (id) => {
          await refresh()
          setSavingId(id)
          setNewSavingOpen(false)
        }}
      />

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
        {editing && (expense || savingMove) ? (
          deleteBlockedReason ? (
            <p className="mt-3 flex items-start justify-center gap-2 text-sm font-semibold text-tinta">
              <AppIcon name="lock" className="mt-0.5 shrink-0" />
              <span>{deleteBlockedReason}</span>
            </p>
          ) : confirmingDelete ? (
            <div className="mt-3 space-y-2">
              <p className="text-center font-display text-lg font-semibold">
                {expense ? '¿Eliminar este gasto?' : '¿Eliminar este movimiento de ahorro?'}
              </p>
              <Button type="button" variant="danger" className="w-full" onClick={() => void remove()} disabled={saving}>
                Eliminar
              </Button>
              <Button type="button" variant="alt" className="w-full" onClick={() => setConfirmingDelete(false)} disabled={saving}>
                Volver
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="mt-2 flex min-h-11 w-full items-center justify-center font-semibold text-tinta"
              onClick={() => setConfirmingDelete(true)}
            >
              <AppIcon name="trash" className="mr-1" /> Eliminar
            </button>
          )
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


function AhorroFields({
  action,
  onAction,
  actionLocked = false,
  savings,
  savingId,
  onSavingId,
  meId,
  partnerLabel,
  savingMoves,
  amount,
  showErrors,
  onCreateSaving,
}: {
  action: 'aporte' | 'retiro'
  onAction: (value: 'aporte' | 'retiro') => void
  actionLocked?: boolean
  savings: SavingItem[]
  savingId: string | null
  onSavingId: (id: string) => void
  meId: string
  partnerLabel: string
  savingMoves: SavingMove[]
  amount: number
  showErrors: boolean
  onCreateSaving: () => void
}) {
  const chosen = savings.find((item) => item.id === savingId) ?? null
  const bal = chosen
    ? savingBalances(
        chosen.openings,
        savingMoves.filter((row) => row.savingId === chosen.id),
      )
    : null
  const mine = bal ? withdrawableByUser(bal, meId) : 0
  const over =
    action === 'retiro' && chosen && amount > 0
      ? chosen.isShared
        ? amount > mine
        : amount > (bal?.total ?? 0)
      : false
  const overMessage =
    chosen && over
      ? chosen.isShared
        ? `Podés retirar hasta ${formatMoney(mine)}: es lo que pusiste vos en ${chosen.name}.`
        : `En ${chosen.name} hay ${formatMoney(bal?.total ?? 0)}. No podés retirar más que eso.`
      : ''

  return (
    <>
      {overMessage ? (
        <p className="flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
          <AppIcon name="circle-exclamation" /> {overMessage}
        </p>
      ) : null}
      <div>
        <p className="text-sm font-semibold text-gris">¿Qué hacés?</p>
        <div className="mt-2 grid h-[52px] grid-cols-2 gap-2" role="radiogroup" aria-label="Aportar o retirar">
          {(['aporte', 'retiro'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={action === value}
              disabled={actionLocked && action !== value}
              onClick={() => {
                if (actionLocked) return
                onAction(value)
              }}
              className={`rounded-2xl text-sm font-semibold ${
                action === value ? 'border-2 border-tinta bg-azul-claro text-tinta' : 'border-[1.5px] border-azul-ink bg-tarjeta text-tinta'
              }`}
            >
              {value === 'aporte' ? 'Aportar' : 'Retirar'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-gris">
          {action === 'aporte' ? '¿A qué ahorro va?' : '¿De qué ahorro sale?'}
        </p>
        {savings.length === 0 ? (
          <div className="mt-2 rounded-2xl border-2 border-azul-ink bg-tarjeta p-4 text-center">
            <p className="font-display text-lg font-semibold text-tinta">Todavía no tenés ahorros</p>
            <p className="mt-1 text-sm font-semibold text-gris">
              Creá uno y seguí cargando: lo que pusiste acá no se pierde.
            </p>
            <button type="button" onClick={onCreateSaving} className="mt-3 inline-flex min-h-11 items-center font-bold text-mostaza-ink">
              <AppIcon name="plus" className="mr-1" /> Crear un ahorro
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-2" role="radiogroup">
            {savings.map((item) => {
              const itemBal = savingBalances(
                item.openings,
                savingMoves.filter((row) => row.savingId === item.id),
              )
              const itemMine = withdrawableByUser(itemBal, meId)
              const selected = savingId === item.id
              const sub =
                action === 'aporte'
                  ? item.isShared
                    ? `Con ${partnerLabel} · juntaron ${formatMoney(itemBal.total)}`
                    : `Solo vos · hay ${formatMoney(itemBal.total)}`
                  : item.isShared
                    ? `Con ${partnerLabel} · lo tuyo ${formatMoney(itemMine)}`
                    : `Solo vos · hay ${formatMoney(itemBal.total)}`
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSavingId(item.id)}
                  className={`grid min-h-16 w-full grid-cols-[40px_1fr_24px] items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                    selected ? 'border-2 border-azul-ink bg-azul-claro' : 'border-[1.5px] border-azul bg-tarjeta'
                  }`}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-azul-ink bg-azul-claro text-azul-ink">
                    <AppIcon name={item.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-semibold text-tinta">{item.name}</span>
                    <span className="block text-sm font-semibold text-gris">{sub}</span>
                  </span>
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full ${
                      selected ? 'bg-tinta text-tarjeta' : 'border-[1.5px] border-azul-ink'
                    }`}
                  >
                    {selected ? <AppIcon name="check" className="text-xs" /> : null}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {showErrors && !savingId && savings.length > 0 ? (
          <p className="mt-2 flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
            <AppIcon name="circle-exclamation" />
            {action === 'aporte' ? 'Elegí a qué ahorro va.' : 'Elegí de qué ahorro sale.'}
          </p>
        ) : null}
        {showErrors && savings.length === 0 ? (
          <p className="mt-2 flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
            <AppIcon name="circle-exclamation" /> Primero creá un ahorro.
          </p>
        ) : null}
      </div>
      {chosen ? (
        <p className="text-sm font-semibold text-gris">
          {action === 'aporte'
            ? chosen.isShared
              ? `Te descuenta solo a vos de lo que te queda y suma a ${chosen.name}. No entra en el reparto.`
              : `Te descuenta de lo que te queda y suma a ${chosen.name}.`
            : chosen.isShared
              ? `Vuelve solo a lo que te queda a vos y baja el saldo de ${chosen.name}. No entra en el reparto.`
              : `Vuelve a lo que te queda y baja el saldo de ${chosen.name}.`}
        </p>
      ) : null}
    </>
  )
}

