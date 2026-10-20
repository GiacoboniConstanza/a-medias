import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { FixedExpenseSheet, type FixedDraft } from '../components/FixedExpenseSheet.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { SplitNotice } from '../components/SplitNotice.tsx'
import { Card, ErrorText } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import {
  createFixedExpense,
  deleteFixedExpense,
  loadReminderPreferences,
  markFixedPaid,
  saveReminderPreferences,
  setFixedExpensePaused,
  undoFixedPayment,
  updateFixedExpense,
  type FixedItem,
} from '../lib/api.ts'
import { dueLabel, dueVisual, editedCaption, scheduleAmount } from '../lib/fixed.ts'
import { formatMoney } from '../lib/format.ts'
import { isCurrentMonth, monthKey, monthName, shiftMonth, shortDate, todayISO } from '../lib/month.ts'
import { pushIsConfigured, subscribeToPush } from '../lib/push/permissions.ts'
import { pushPlan } from '../lib/push/plan.ts'
import {
  DEFAULT_REMINDER_PREFS,
  laterCopy,
  nextAskAt,
  reminderFootnote,
  reminderTimesValid,
  shouldAskToday,
  type ReminderPrefs,
} from '../lib/reminders.ts'

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTE_STEPS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']
const timeSelect = 'min-h-[52px] w-full rounded-2xl bg-sand px-1 font-display text-2xl font-semibold text-text scheme-light'
const addButton = 'mb-3 block min-h-[52px] w-full rounded-2xl bg-primary text-base font-semibold text-white'
const payButton = 'h-11 shrink-0 rounded-2xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-50'
const undoButton = 'h-11 shrink-0 rounded-2xl bg-sand px-3 text-sm font-semibold text-primary disabled:opacity-50'

export function RemindersScreen() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [now, setNow] = useState(() => new Date())
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FixedItem | null>(null)
  const [message, setMessage] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const saveChain = useRef(Promise.resolve())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!profile) return
    let active = true
    loadReminderPreferences(profile.id)
      .then((next) => {
        if (active) setPrefs(next)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setPrefs({ ...DEFAULT_REMINDER_PREFS })
        setMessage(caught instanceof Error ? caught.message : 'No pude leer tus horarios.')
      })
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    if (!editing || !data) return
    if (!data.fixed.some((item) => item.id === editing.id)) setEditing(null)
  }, [data, editing])

  const liveEditing = editing ? (data?.fixed.find((item) => item.id === editing.id) ?? null) : null
  const shownPrefs = prefs ?? DEFAULT_REMINDER_PREFS

  function persist(next: ReminderPrefs) {
    if (!profile) return
    setPrefs(next)
    const userId = profile.id
    saveChain.current = saveChain.current.then(async () => {
      try {
        await saveReminderPreferences(userId, next)
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'No pude guardar el recordatorio.')
      }
    })
  }

  async function toggleReminder(enabled: boolean) {
    if (!prefs || !profile) return
    persist({ ...prefs, enabled })
    if (!enabled || !pushIsConfigured()) return
    try {
      const readiness = await subscribeToPush(profile.id)
      if (readiness === 'denied') setToast('El celular no dio permiso. El aviso sigue en Avisos.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude preparar los avisos del celular.')
    }
  }

  function changeTime(which: 'first' | 'second', value: string) {
    if (!prefs) return
    const next = {
      ...prefs,
      firstTime: which === 'first' ? value : prefs.firstTime,
      secondTime: which === 'second' ? value : prefs.secondTime,
    }
    if (!reminderTimesValid(next.firstTime, next.secondTime)) {
      setMessage('Elegí dos horarios distintos, el segundo después del primero.')
      return
    }
    setMessage('')
    persist(next)
  }

  function markReviewed() {
    if (!prefs) return
    persist({ ...prefs, reviewedOn: todayISO(now), hiddenUntil: null })
    setToast('Hoy no te vuelvo a preguntar.')
  }

  function askLater() {
    if (!prefs) return
    const next = nextAskAt(now, prefs.firstTime, prefs.secondTime)
    persist({ ...prefs, hiddenUntil: next.toISOString() })
    setToast(laterCopy(now, next))
  }

  async function pay(id: string) {
    const fixed = data?.fixed.find((item) => item.id === id)
    if (!fixed || !profile?.householdId || !data) return
    const category =
      data.categories.find((item) => item.id === fixed.categoryId) ??
      data.categories.find((item) => (fixed.isShared ? item.ownerId === null : item.ownerId === profile.id))
    if (!category) {
      setMessage(fixed.isShared ? 'Falta una categoría compartida.' : 'Creá una categoría privada en Cargar gasto.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await markFixedPaid({
        fixed,
        householdId: profile.householdId,
        ownerId: profile.id,
        payerId: profile.id,
        month,
        paidOn: isCurrentMonth(month, now) ? todayISO(now) : `${month.slice(0, 8)}${String(fixed.dueDay).padStart(2, '0')}`,
        categoryId: category.id,
      })
      await refresh()
      setToast('Marcado como pagado.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude marcarlo como pagado.')
    } finally {
      setSaving(false)
    }
  }

  async function undo(id: string) {
    const payment = data?.fixed.find((item) => item.id === id)?.payment
    if (!payment) return
    setSaving(true)
    setMessage('')
    try {
      await undoFixedPayment(payment)
      await refresh()
      setToast('Deshice el pago.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude deshacer el pago.')
    } finally {
      setSaving(false)
    }
  }

  async function saveDraft(draft: FixedDraft) {
    if (!profile?.householdId) return
    setSaving(true)
    setSheetError('')
    try {
      if (!liveEditing) {
        await createFixedExpense({
          householdId: profile.householdId,
          ownerId: draft.shared ? null : profile.id,
          categoryId: null,
          title: draft.title,
          icon: draft.icon,
          amount: draft.amount,
          dueDay: draft.dueDay,
          isShared: draft.shared,
          remindDaysBefore: draft.remindDaysBefore,
          effectiveFrom: month,
          createdBy: profile.id,
        })
        setToast('Listo, guardé el gasto fijo.')
      } else {
        const revision =
          draft.amountChanged && draft.applies
            ? {
                amount: draft.amount,
                effectiveFrom: draft.applies === 'next' ? shiftMonth(month, 1) : month,
                createdBy: profile.id,
              }
            : null
        await updateFixedExpense({
          id: liveEditing.id,
          ownerId: draft.shared ? null : profile.id,
          categoryId: liveEditing.isShared === draft.shared ? liveEditing.categoryId : null,
          title: draft.title,
          icon: draft.icon,
          dueDay: draft.dueDay,
          isShared: draft.shared,
          remindDaysBefore: draft.remindDaysBefore,
          expectedAmount: scheduleAmount(liveEditing.revisions, monthKey(now), revision),
          updatedBy: profile.id,
          revision,
        })
        setToast('Listo, actualicé el gasto fijo.')
      }
      setCreating(false)
      setEditing(null)
      await refresh()
    } catch (caught) {
      setSheetError(caught instanceof Error ? caught.message : 'No pude guardar el gasto fijo.')
    } finally {
      setSaving(false)
    }
  }

  async function pause(paused: boolean) {
    if (!liveEditing || !profile) return
    setSaving(true)
    setSheetError('')
    try {
      await setFixedExpensePaused(liveEditing.id, paused, profile.id)
      await refresh()
      setToast(paused ? 'Quedó en pausa. No genera vencimientos.' : 'Volvió a generar vencimientos.')
    } catch (caught) {
      setSheetError(caught instanceof Error ? caught.message : 'No pude cambiar la pausa.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!liveEditing) return
    setSaving(true)
    setSheetError('')
    try {
      await deleteFixedExpense(liveEditing.id)
      setEditing(null)
      setCreating(false)
      await refresh()
      setToast('Eliminé el gasto fijo.')
    } catch (caught) {
      setSheetError(caught instanceof Error ? caught.message : 'No pude eliminar el gasto fijo.')
    } finally {
      setSaving(false)
    }
  }

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const dues = data.fixed.filter((item) => item.applies && !item.pausedAt)
  const paused = data.fixed.filter((item) => item.applies && item.pausedAt)
  const silentDays = data.lastLoggedOn ? daysBetween(data.lastLoggedOn, todayISO(now)) : null
  const ask = Boolean(prefs && shouldAskToday(now, prefs))

  return (
    <>
      <SectionHeader icon="bell" title="Avisos" />
      <MonthSwitcher className="mb-4" />
      <SplitNotice notice={data.splitNotice} />
      {ask ? (
        <Card>
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
            <AppIcon name="bell" /> A MEDIAS · ahora
          </p>
          <b className="mt-1 block font-display text-xl font-semibold">{pushPlan.daily.title}</b>
          <p className="text-sm font-semibold text-text">{pushPlan.daily.body}</p>
          <div className="mt-3 grid gap-2">
            <Link to="/cargar" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-3 text-sm font-semibold text-white">
              Anotar gasto
            </Link>
            <button type="button" className="min-h-11 rounded-2xl bg-sand px-3 text-sm font-semibold text-text" onClick={markReviewed}>
              No gasté nada
            </button>
            <button type="button" className="min-h-11 rounded-2xl border border-line bg-card px-3 text-sm font-semibold text-text" onClick={askLater}>
              Más tarde
            </button>
          </div>
        </Card>
      ) : null}
      <Card>
        <b className="inline-flex items-center gap-2 text-[17px]">
          <AppIcon name="calendar-days" className="text-primary" /> Vencimientos de {monthName(month)}
        </b>
        {dues.length === 0 ? <p className="mt-2 text-sm font-semibold text-muted">No hay vencimientos este mes.</p> : null}
        <ul className="mt-1">
          {dues.map((item) => (
            <DueRow
              key={item.id}
              item={item}
              month={month}
              now={now}
              names={data.names}
              saving={saving}
              onEdit={() => {
                setCreating(false)
                setSheetError('')
                setEditing(item)
              }}
              onPay={() => void pay(item.id)}
              onUndo={() => void undo(item.id)}
            />
          ))}
        </ul>
      </Card>
      {silentDays !== null && silentDays >= pushPlan.silence.daysWithoutExpenses ? (
        <Card className="flex items-start gap-2 bg-sand text-sm font-semibold text-text">
          <AppIcon name="bell" className="mt-0.5 text-primary" />
          {pushPlan.silence.body.replace('unos días', `${silentDays} días`)}
        </Card>
      ) : null}
      {paused.length > 0 ? (
        <Card>
          <b className="text-[17px]">En pausa</b>
          <p className="text-sm font-semibold text-muted">No generan vencimientos hasta que los actives.</p>
          <ul className="mt-1">
            {paused.map((item) => (
              <li key={item.id} className="border-b border-line py-2 last:border-0">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 text-left"
                  aria-label={`Editar ${item.title}`}
                  onClick={() => {
                    setCreating(false)
                    setSheetError('')
                    setEditing(item)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">
                      <AppIcon name={item.icon} /> {item.title}
                    </b>
                    <p className="text-sm font-semibold text-muted">En pausa{item.isShared ? '' : ' · privado'}</p>
                  </span>
                  <b className="shrink-0 font-display text-base font-semibold">{formatMoney(item.amount)}</b>
                  <AppIcon name="pen" className="shrink-0 text-primary" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <button
        type="button"
        className={addButton}
        onClick={() => {
          setEditing(null)
          setSheetError('')
          setCreating(true)
        }}
      >
        + Gasto fijo
      </button>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <p id="reminder-label" className="text-base font-semibold text-text">
            Recordarme a las
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={shownPrefs.enabled}
            aria-labelledby="reminder-label"
            disabled={!prefs || saving}
            onClick={() => void toggleReminder(!shownPrefs.enabled)}
            className={`relative h-11 w-16 shrink-0 rounded-full border border-line disabled:opacity-50 ${
              shownPrefs.enabled ? 'bg-primary' : 'bg-sand'
            }`}
          >
            <span
              className={`absolute left-1 top-1 h-8 w-8 rounded-full bg-white shadow-soft transition-transform motion-reduce:transition-none ${
                shownPrefs.enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <TimeSelect label="Primer horario" value={shownPrefs.firstTime} onChange={(value) => changeTime('first', value)} />
          <span className="shrink-0 text-sm font-semibold text-muted">y</span>
          <TimeSelect label="Segundo horario" value={shownPrefs.secondTime} onChange={(value) => changeTime('second', value)} />
        </div>
      </Card>
      <p className="mt-4 text-center text-xs font-semibold text-muted">{reminderFootnote(shownPrefs)}</p>
      <ErrorText>{message}</ErrorText>
      {toast ? (
        <p
          role="status"
          className="fixed bottom-28 left-1/2 z-50 max-w-[20rem] -translate-x-1/2 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-fab"
        >
          {toast}
        </p>
      ) : null}
      <FixedExpenseSheet
        open={creating || liveEditing !== null}
        expense={creating ? null : liveEditing}
        saving={saving}
        error={sheetError}
        onClose={() => {
          setCreating(false)
          setEditing(null)
          setSheetError('')
        }}
        onSubmit={(draft) => void saveDraft(draft)}
        onPause={(next) => void pause(next)}
        onDelete={() => void remove()}
      />
    </>
  )
}

function DueRow({
  item,
  month,
  now,
  names,
  saving,
  onEdit,
  onPay,
  onUndo,
}: {
  item: FixedItem
  month: string
  now: Date
  names: Record<string, string>
  saving: boolean
  onEdit: () => void
  onPay: () => void
  onUndo: () => void
}) {
  const state = item.payment ? 'paid' : dueVisual(item.dueDay, month, now)
  const meta = item.payment
    ? `Pagado el ${shortDate(item.payment.paidOn)} · ${names[item.payment.payerId] ?? ''}`
    : dueLabel(item.dueDay, month, now)
  const caption = item.updatedAt ? editedCaption(item.updatedAt, names[item.updatedBy ?? ''] ?? '') : null
  return (
    <li className="flex items-center gap-2 border-b border-line py-2 last:border-0">
      <button type="button" onClick={onEdit} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" aria-label={`Editar ${item.title}`}>
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${
            state === 'paid' ? 'bg-good text-white' : state === 'late' ? 'bg-warn text-text' : 'border-2 border-line bg-transparent text-transparent'
          }`}
          aria-hidden="true"
        >
          {state === 'paid' ? <AppIcon name="check" /> : state === 'late' ? <AppIcon name="triangle-exclamation" /> : ''}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate">
            <AppIcon name={item.icon} /> {item.title}
          </b>
          <p className="text-sm font-semibold text-muted">
            {meta}
            {item.isShared ? '' : ' · privado'}
          </p>
          {caption ? <p className="text-xs font-semibold text-muted">{caption}</p> : null}
        </span>
        <b className="shrink-0 font-display text-base font-semibold">{formatMoney(item.amount)}</b>
        <AppIcon name="pen" className="shrink-0 text-primary" />
      </button>
      {item.payment ? (
        <button type="button" className={undoButton} onClick={onUndo} disabled={saving}>
          Deshacer
        </button>
      ) : (
        <button type="button" className={payButton} onClick={onPay} disabled={saving}>
          Pagué
        </button>
      )}
    </li>
  )
}

function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [hour = '14', minute = '00'] = value.split(':')
  const minutes = MINUTE_STEPS.includes(minute) ? MINUTE_STEPS : [minute, ...MINUTE_STEPS]
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <select aria-label={`${label}, hora`} value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)} className={timeSelect}>
        {HOURS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="font-display text-xl font-semibold text-muted" aria-hidden="true">
        :
      </span>
      <select
        aria-label={`${label}, minutos`}
        value={minute}
        onChange={(event) => onChange(`${hour}:${event.target.value}`)}
        className={timeSelect}
      >
        {minutes.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}
