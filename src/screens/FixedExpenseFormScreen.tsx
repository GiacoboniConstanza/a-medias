import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { MoneyField } from '../components/MoneyField.tsx'
import { Button, Chip, ErrorText, NotesField, Toggle, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import {
  createFixedExpense,
  deleteFixedExpense,
  loadCategoryUsage,
  loadReminderPreferences,
  markFixedPaid,
  payRemainingInstallments,
  setFixedExpensePaused,
  undoFixedPayment,
  undoInstallmentPayoff,
  updateFixedExpense,
  type CategoryUsageRow,
} from '../lib/api.ts'
import { categoryChipsForPicker, categoryIdForFixedPayment } from '../lib/categories.ts'
import {
  firstMonthCaption,
  installmentNumber,
  remainingPayoff,
  scheduleAmount,
} from '../lib/fixed.ts'
import {
  defaultDueDayForInstallments,
  formTitle,
  installmentPlanFromDraft,
  resolveInstallmentAmount,
  resolveInstallmentTotal,
  validateFixedForm,
  type FixedFormDraft,
  type FixedKind,
} from '../lib/fixed-form.ts'
import { amountFromDigits, clampNotes, formatMoney, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import { isCurrentMonth, monthKey, monthName, shiftMonth, todayISO } from '../lib/month.ts'
import { settledSharedHelp } from '../lib/period.ts'
import { DEFAULT_REMINDER_PREFS } from '../lib/reminders.ts'

const KIND_OPTIONS: {
  id: FixedKind
  label: string
  icon: string
  soft: string
  ink: string
  ring: string
}[] = [
  {
    id: 'fixed',
    label: 'Gasto fijo',
    icon: 'calendar-day',
    soft: 'bg-azul-claro',
    ink: 'text-azul-ink',
    ring: 'border-azul-ink',
  },
  {
    id: 'installments',
    label: 'Cuotas',
    icon: 'calendar-days',
    soft: 'bg-ciruela-claro',
    ink: 'text-ciruela-ink',
    ring: 'border-ciruela-ink',
  },
]

export function FixedExpenseFormScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, refresh } = useFinance()
  const editing = id ? data?.fixed.find((item) => item.id === id) ?? null : null
  const editingMissing = Boolean(id) && data && !editing

  const [kind, setKind] = useState<FixedKind>('fixed')
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('house')
  const [digits, setDigits] = useState('')
  const [totalDigits, setTotalDigits] = useState('')
  const [dueDay, setDueDay] = useState('10')
  const [shared, setShared] = useState(true)
  const [remind, setRemind] = useState(true)
  const [notes, setNotes] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [countText, setCountText] = useState('2')
  const [currentText, setCurrentText] = useState('1')
  const [applies, setApplies] = useState<'this' | 'next' | null>(null)
  const [leadDays, setLeadDays] = useState(DEFAULT_REMINDER_PREFS.dueLeadDays)
  const [categoryUsage, setCategoryUsage] = useState<CategoryUsageRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmPayoff, setConfirmPayoff] = useState(false)
  const [keyboard, setKeyboard] = useState(0)
  const [footerH, setFooterH] = useState(88)
  const footerRef = useRef<HTMLDivElement>(null)
  const remindId = useId()
  const seeded = useRef<string | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => {
      setKeyboard(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [])

  useEffect(() => {
    const node = footerRef.current
    if (!node) return
    const update = () => setFooterH(node.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    void loadReminderPreferences(profile.id).then((prefs) => setLeadDays(prefs.dueLeadDays))
    void loadCategoryUsage().then(setCategoryUsage).catch(() => setCategoryUsage([]))
  }, [profile?.id])

  useEffect(() => {
    const key = editing?.id ?? 'new'
    if (seeded.current === key) return
    seeded.current = key
    if (editing) {
      const isInstallments = editing.installmentCount != null && editing.firstMonth != null
      setKind(isInstallments ? 'installments' : 'fixed')
      setTitle(editing.title)
      setIcon(editing.icon)
      setDigits(editing.hasAmount ? moneyDraftFromAmount(normalizeMoney(editing.amount)) : '')
      setTotalDigits(
        editing.totalAmount != null ? moneyDraftFromAmount(normalizeMoney(editing.totalAmount)) : '',
      )
      setDueDay(String(editing.dueDay))
      setShared(editing.isShared)
      setRemind(editing.remind)
      setNotes(editing.notes ?? '')
      setCategoryId(editing.categoryId)
      setCountText(editing.installmentCount != null ? String(editing.installmentCount) : '2')
      const n =
        editing.firstMonth && editing.installmentCount
          ? installmentNumber(
              { firstMonth: editing.firstMonth, count: editing.installmentCount },
              month,
            )
          : 1
      setCurrentText(String(n ?? 1))
      setApplies(null)
    } else {
      setKind('fixed')
      setTitle('')
      setIcon('house')
      setDigits('')
      setTotalDigits('')
      setDueDay('10')
      setShared(true)
      setRemind(true)
      setNotes('')
      setCategoryId(null)
      setCountText('2')
      setCurrentText('1')
      setApplies(null)
    }
  }, [editing, month])

  useEffect(() => {
    if (categoryId && data) {
      const category = data.categories.find((row) => row.id === categoryId)
      if (category && !editing) setIcon(category.icon)
    }
  }, [categoryId, data, editing])

  const amount = normalizeMoney(amountFromDigits(digits))
  const total = totalDigits ? normalizeMoney(amountFromDigits(totalDigits)) : null
  const count = Number(countText.replace(/\D/g, '')) || 0
  const currentNumber = Number(currentText.replace(/\D/g, '')) || 0
  const day = Number(dueDay.replace(/\D/g, '')) || 0
  const originalAmount = editing?.hasAmount ? normalizeMoney(editing.amount) : 0
  const amountChanged = Boolean(editing) && kind === 'fixed' && amount !== originalAmount

  const draft: FixedFormDraft = {
    kind,
    title,
    icon,
    amount,
    dueDay: kind === 'installments' ? (editing?.dueDay ?? defaultDueDayForInstallments()) : day,
    shared,
    remind: kind === 'installments' ? (editing?.remind ?? true) : remind,
    notes: kind === 'installments' ? (editing?.notes ?? null) : clampNotes(notes),
    categoryId,
    count: kind === 'installments' ? count : null,
    currentNumber: kind === 'installments' ? currentNumber : null,
    total: kind === 'installments' ? total : null,
    amountChanged,
    applies,
  }

  const resolvedAmount =
    kind === 'installments'
      ? resolveInstallmentAmount({ amount, total, count })
      : amount
  const resolvedTotal =
    kind === 'installments' ? resolveInstallmentTotal({ amount: resolvedAmount, total, count }) : null
  const plan = installmentPlanFromDraft(draft, month)
  const firstCaption =
    kind === 'installments' && plan && currentNumber > 1 ? firstMonthCaption(plan.firstMonth) : null

  const categoryChips = useMemo(
    () => categoryChipsForPicker(data?.categories ?? [], categoryUsage, categoryId, showAllCategories),
    [data?.categories, categoryUsage, categoryId, showAllCategories],
  )

  const lockedKind = Boolean(editing)
  const now = new Date()
  const paid = Boolean(editing?.payment)
  const showPayoff =
    Boolean(editing) &&
    kind === 'installments' &&
    editing?.installmentCount != null &&
    editing.installmentClosedFrom == null &&
    currentNumber > 0 &&
    currentNumber < editing.installmentCount

  const payoff =
    showPayoff && editing?.installmentCount
      ? remainingPayoff(resolvedAmount || editing.amount, editing.installmentCount, currentNumber, paid)
      : null

  function close() {
    navigate('/recordatorios')
  }

  async function save() {
    if (!profile?.householdId) return
    const message = validateFixedForm(draft)
    if (message) {
      setError(message)
      return
    }
    setSaving(true)
    setError('')
    const remindDaysBefore = draft.remind ? leadDays : 0
    try {
      if (!editing) {
        const effectiveFrom =
          kind === 'installments' && plan ? plan.firstMonth : month
        await createFixedExpense({
          householdId: profile.householdId,
          ownerId: draft.shared ? null : profile.id,
          categoryId: draft.categoryId,
          title: draft.title,
          icon: draft.icon,
          amount: resolvedAmount,
          dueDay: draft.dueDay,
          isShared: draft.shared,
          remindDaysBefore,
          remind: draft.remind,
          notes: draft.notes,
          effectiveFrom,
          createdBy: profile.id,
          installmentCount: kind === 'installments' ? draft.count : null,
          firstMonth: kind === 'installments' && plan ? plan.firstMonth : null,
          totalAmount: kind === 'installments' ? resolvedTotal : null,
        })
      } else {
        const revision =
          kind === 'fixed' && draft.amountChanged && draft.applies
            ? {
                amount: resolvedAmount,
                effectiveFrom: draft.applies === 'next' ? shiftMonth(month, 1) : month,
                createdBy: profile.id,
              }
            : kind === 'installments'
              ? {
                  amount: resolvedAmount,
                  effectiveFrom: plan?.firstMonth ?? month,
                  createdBy: profile.id,
                }
              : null
        if (
          kind === 'installments' &&
          draft.count != null &&
          editing.installmentClosedFrom == null
        ) {
          const paidCount = 0 // pagos de meses anteriores no se reescriben; solo bloqueamos N < n
          if (draft.count < currentNumber) {
            setError('La cantidad no puede ser menor a la cuota actual.')
            setSaving(false)
            return
          }
          void paidCount
        }
        await updateFixedExpense({
          id: editing.id,
          ownerId: draft.shared ? null : profile.id,
          categoryId: draft.categoryId,
          title: draft.title,
          icon: draft.icon,
          dueDay: draft.dueDay,
          isShared: draft.shared,
          remindDaysBefore,
          remind: draft.remind,
          notes: draft.notes,
          expectedAmount: scheduleAmount(editing.revisions, monthKey(now), revision),
          updatedBy: profile.id,
          revision,
          installmentCount: kind === 'installments' ? draft.count : null,
          firstMonth: kind === 'installments' && plan ? plan.firstMonth : null,
          totalAmount: kind === 'installments' ? resolvedTotal : null,
        })
      }
      await refresh()
      close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function pay() {
    if (!editing || !profile?.householdId || !data || !editing.hasAmount) return
    if (editing.isShared && data.settlement) {
      setError(settledSharedHelp(month))
      return
    }
    setSaving(true)
    setError('')
    try {
      await markFixedPaid({
        fixed: editing,
        householdId: profile.householdId,
        ownerId: profile.id,
        payerId: profile.id,
        month,
        paidOn: isCurrentMonth(month, now) ? todayISO(now) : `${month.slice(0, 8)}${String(editing.dueDay).padStart(2, '0')}`,
        categoryId: categoryIdForFixedPayment(editing.categoryId),
      })
      await refresh()
      close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude marcarlo como pagado.')
    } finally {
      setSaving(false)
    }
  }

  async function undo() {
    if (!editing?.payment || !profile) return
    setSaving(true)
    setError('')
    try {
      if (editing.installmentClosedFrom != null) {
        const cuota =
          editing.revisions.find((row) => row.effectiveFrom === editing.firstMonth)?.amount ??
          resolvedAmount
        await undoInstallmentPayoff({
          fixed: editing,
          payment: editing.payment,
          month,
          payerId: profile.id,
          installmentAmount: cuota,
        })
      } else {
        await undoFixedPayment(editing.payment)
      }
      await refresh()
      close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude deshacer el pago.')
    } finally {
      setSaving(false)
    }
  }

  async function payoffConfirm() {
    if (!editing || !profile?.householdId || !payoff || payoff.covered <= 0) return
    if (editing.isShared && data?.settlement) {
      setError(settledSharedHelp(month))
      setConfirmPayoff(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      await payRemainingInstallments({
        fixed: editing,
        householdId: profile.householdId,
        ownerId: profile.id,
        payerId: profile.id,
        month,
        paidOn: isCurrentMonth(month, now) ? todayISO(now) : `${month.slice(0, 8)}${String(editing.dueDay).padStart(2, '0')}`,
        categoryId: categoryIdForFixedPayment(editing.categoryId),
        amount: payoff.amount,
        currentNumber,
        originalCount: editing.installmentCount ?? currentNumber,
      })
      setConfirmPayoff(false)
      await refresh()
      close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude anotar el resto.')
      setConfirmPayoff(false)
    } finally {
      setSaving(false)
    }
  }

  async function pause(next: boolean) {
    if (!editing || !profile) return
    setSaving(true)
    setError('')
    try {
      await setFixedExpensePaused(editing.id, next, profile.id)
      await refresh()
      close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude cambiar la pausa.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      await deleteFixedExpense(editing.id)
      setConfirmDelete(false)
      await refresh()
      close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude eliminar.')
      setConfirmDelete(false)
    } finally {
      setSaving(false)
    }
  }

  if (!profile?.householdId) return null
  if (editingMissing) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-semibold text-tinta">No encontré ese gasto fijo.</p>
        <Link to="/recordatorios" className="mt-4 inline-block font-bold text-mostaza-ink">
          Volver
        </Link>
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
          onClick={close}
        >
          <AppIcon name="chevron-left" />
        </button>
        <h1 className="font-display text-[34px] font-semibold text-tinta">{formTitle(kind, Boolean(editing))}</h1>
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
          {KIND_OPTIONS.map((option) => {
            const selected = kind === option.id
            const locked = lockedKind && !selected
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked || undefined}
                aria-disabled={locked || undefined}
                className={`relative flex h-16 items-center gap-2 rounded-2xl px-2.5 text-sm whitespace-nowrap ${
                  selected
                    ? `${option.soft} border-2 border-tinta font-bold text-tinta`
                    : locked
                      ? 'border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado font-semibold text-gris'
                      : 'border-[1.5px] border-azul-ink bg-tarjeta font-semibold text-tinta'
                }`}
                onClick={() => {
                  if (locked) return
                  setKind(option.id)
                  if (option.id === 'installments' && !icon) setIcon('calendar-days')
                }}
              >
                {selected ? <AppIcon name="check" className="absolute right-2 top-1.5 text-xs" /> : null}
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 ${option.ring} ${
                    selected ? 'bg-tarjeta' : option.soft
                  } ${option.ink}`}
                >
                  <AppIcon name={option.icon} className="text-[15px]" />
                </span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
        {editing ? (
          <p className="mt-2 text-sm font-semibold text-tinta">
            Para cambiar el tipo, eliminalo y cargalo de nuevo.
          </p>
        ) : null}
      </section>

      <div
        className="space-y-4 px-4 pt-[calc(var(--feston-alto)+1rem)]"
        style={{ paddingBottom: `calc(${footerH}px + ${keyboard}px + 1rem)` }}
      >
        <label className="block text-sm font-semibold text-gris">
          Nombre
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 80))}
            className={`mt-1 ${inputClass}`}
            placeholder="Alquiler, luz, cama…"
          />
        </label>

        <MoneyField
          draft={digits}
          onDraft={(value) => {
            setDigits(value)
            if (kind === 'installments' && totalDigits && count >= 2) {
              // monto manual pisa el total derivado
            }
          }}
          size="form"
          autoFocus={!editing}
        />

        <div>
          <p className="mb-2 text-sm font-semibold text-gris">Categoría (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {categoryChips.map((category) => (
              <Chip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => setCategoryId((current) => (current === category.id ? null : category.id))}
              >
                <AppIcon name={category.icon} className="text-sm" />
                {category.name}
              </Chip>
            ))}
            {!showAllCategories && (data?.categories.length ?? 0) > categoryChips.length ? (
              <Chip onClick={() => setShowAllCategories(true)}>
                Ver todas ({data?.categories.length ?? 0})
              </Chip>
            ) : null}
          </div>
        </div>

        <Toggle
          label="¿Es compartido?"
          checked={shared}
          onClick={() => setShared((current) => !current)}
        />

        {kind === 'installments' ? (
          <>
            <label className="block text-sm font-semibold text-gris">
              Cantidad
              <input
                value={countText}
                onChange={(event) => setCountText(event.target.value.replace(/\D/g, '').slice(0, 3))}
                inputMode="numeric"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-sm font-semibold text-gris">
              Va por la cuota
              <input
                value={currentText}
                onChange={(event) => setCurrentText(event.target.value.replace(/\D/g, '').slice(0, 3))}
                inputMode="numeric"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            {firstCaption ? <p className="text-sm font-semibold text-gris">{firstCaption}</p> : null}
            <MoneyField
              draft={totalDigits}
              onDraft={(value) => {
                setTotalDigits(value)
                const nextTotal = value ? normalizeMoney(amountFromDigits(value)) : 0
                if (nextTotal > 0 && count >= 2) {
                  setDigits(moneyDraftFromAmount(installmentAmountFromTotalSafe(nextTotal, count)))
                }
              }}
              size="form"
              label="Total (opcional)"
            />
          </>
        ) : (
          <>
            <label className="block text-sm font-semibold text-gris">
              Día de vencimiento
              <input
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                className={`mt-1 text-center font-display text-2xl ${inputClass}`}
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <p id={remindId} className="text-lg font-medium text-tinta">
                {leadDays <= 0
                  ? 'Avisarme el mismo día'
                  : leadDays === 1
                    ? 'Avisarme 1 día antes'
                    : `Avisarme ${leadDays} días antes`}
              </p>
              <Toggle labelledBy={remindId} checked={remind} onClick={() => setRemind((current) => !current)} />
            </div>
            {amountChanged ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-tinta">¿Desde cuándo aplica?</p>
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
            <NotesField value={notes} onChange={setNotes} />
          </>
        )}

        {editing && kind === 'installments' && showPayoff && payoff && payoff.covered > 0 ? (
          <Button type="button" variant="alt" disabled={saving} onClick={() => setConfirmPayoff(true)}>
            Pagué el resto
          </Button>
        ) : null}
        {editing && !paid && editing.hasAmount ? (
          <Button type="button" variant="alt" disabled={saving} onClick={() => void pay()}>
            Marcar como pagado
          </Button>
        ) : null}
        {editing && paid ? (
          <Button type="button" variant="alt" disabled={saving} onClick={() => void undo()}>
            Deshacer
          </Button>
        ) : null}
        {editing ? (
          <>
            <Button
              type="button"
              variant="alt"
              disabled={saving}
              onClick={() => void pause(!editing.pausedAt)}
            >
              {editing.pausedAt ? 'Reactivar' : 'Pausar'}
            </Button>
            <Button type="button" variant="danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
              Eliminar
            </Button>
          </>
        ) : null}

        <ErrorText>{error}</ErrorText>
      </div>

      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 border-t border-linea-punteada bg-crema px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
        style={{ bottom: keyboard }}
      >
        <Button type="button" tall disabled={saving} onClick={() => void save()}>
          <AppIcon name="check" /> {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <ConfirmSheet
        open={confirmDelete}
        title={`¿Eliminar ${editing?.title ?? ''}?`}
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        variant="danger"
        busy={saving}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      >
        <p className="text-base font-semibold text-tinta">
          Se borra el recordatorio. Los gastos ya anotados quedan.
        </p>
      </ConfirmSheet>

      <ConfirmSheet
        open={confirmPayoff}
        title="Pagué el resto"
        confirmLabel="Pagué el resto"
        cancelLabel="Volver"
        busy={saving}
        onClose={() => setConfirmPayoff(false)}
        onConfirm={() => void payoffConfirm()}
      >
        {payoff ? (
          <p className="text-base font-semibold text-tinta">
            Se anota <span className="whitespace-nowrap">{formatMoney(payoff.amount)}</span> en{' '}
            {monthName(month)} ({payoff.covered}&nbsp;cuotas) y el plan termina.
          </p>
        ) : null}
      </ConfirmSheet>
    </div>
  )
}

function installmentAmountFromTotalSafe(total: number, count: number): number {
  return resolveInstallmentAmount({ amount: 0, total, count })
}
