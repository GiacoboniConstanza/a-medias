import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { FixedExpenseSheet, type FixedDraft } from '../components/FixedExpenseSheet.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { ReminderSettingsSheet } from '../components/ReminderSettingsSheet.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { ErrorText } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import {
  createFixedExpense,
  deleteFixedExpense,
  loadDailyStatuses,
  loadReminderPreferences,
  markDayClear,
  markFixedPaid,
  saveReminderPreferences,
  setFixedExpensePaused,
  undoFixedPayment,
  updateFixedExpense,
  type FixedItem,
} from '../lib/api.ts'
import { partnerId } from '../lib/derive.ts'
import { dayDiff, dueBucket, dueLabel, dueTone, scheduleAmount, showPayLink, type DueBucket } from '../lib/fixed.ts'
import { formatMoney } from '../lib/format.ts'
import { iconSurface } from '../lib/icons.ts'
import { isCurrentMonth, monthKey, shiftMonth, todayISO } from '../lib/month.ts'
import { pushIsConfigured, subscribeToPush } from '../lib/push/permissions.ts'
import {
  DEFAULT_REMINDER_PREFS,
  laterCopy,
  loggingStreak,
  nextAskAt,
  shiftDay,
  shouldAskToday,
  streakCopy,
  type DailyKind,
  type ReminderPrefs,
} from '../lib/reminders.ts'

const GROUPS: { id: DueBucket; title: string }[] = [
  { id: 'today', title: 'Hoy' },
  { id: 'week', title: 'Esta semana' },
  { id: 'later', title: 'Más adelante' },
]

const toneClass = {
  today: 'text-primary',
  soon: 'text-muted',
  late: 'text-alert-ink',
} as const

export function RemindersScreen() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [now, setNow] = useState(() => new Date())
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null)
  const [statuses, setStatuses] = useState<{ day: string; kind: DailyKind }[]>([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FixedItem | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paidOpen, setPaidOpen] = useState(false)
  const [pausedOpen, setPausedOpen] = useState(false)
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
    const since = shiftDay(todayISO(), -400)
    Promise.all([loadReminderPreferences(profile.id), loadDailyStatuses(profile.id, since)])
      .then(([next, rows]) => {
        if (!active) return
        setPrefs(next)
        setStatuses(rows)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setPrefs({ ...DEFAULT_REMINDER_PREFS, times: [...DEFAULT_REMINDER_PREFS.times] })
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

  async function reloadDays() {
    if (!profile) return
    const rows = await loadDailyStatuses(profile.id, shiftDay(todayISO(now), -400))
    setStatuses(rows)
  }

  async function activatePush() {
    if (!prefs || !profile) return
    if (!pushIsConfigured()) {
      setToast('Todavía no están configuradas. No enviamos nada al celular.')
      return
    }
    try {
      const readiness = await subscribeToPush(profile.id)
      if (readiness === 'ready') {
        persist({ ...prefs, pushEnabled: true })
        setToast('Listo. Cuando haya avisos, llegan al celular.')
        return
      }
      if (readiness === 'denied') setToast('El celular no dio permiso. El aviso sigue en Avisos.')
      else setToast('Todavía no están configuradas. No enviamos nada al celular.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude preparar los avisos del celular.')
    }
  }

  async function markReviewed() {
    if (!prefs || !profile) return
    const day = todayISO(now)
    persist({ ...prefs, reviewedOn: day, hiddenUntil: null })
    setStatuses((current) => [...current.filter((row) => row.day !== day), { day, kind: 'clear' }])
    try {
      await markDayClear(profile.id, day)
      setToast('Hoy no te vuelvo a preguntar.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude marcar el día.')
    }
  }

  function askLater() {
    if (!prefs) return
    const next = nextAskAt(now, prefs.times)
    persist({ ...prefs, hiddenUntil: next.toISOString() })
    setToast(laterCopy(now, next))
  }

  function openEditor(item: FixedItem) {
    setCreating(false)
    setSettingsOpen(false)
    setSheetError('')
    setEditing(item)
  }

  async function pay(id: string) {
    const fixed = data?.fixed.find((item) => item.id === id)
    if (!fixed || !profile?.householdId || !data) return
    const category =
      data.categories.find((item) => item.id === fixed.categoryId) ??
      data.categories.find((item) => (fixed.isShared ? item.ownerId === null : item.ownerId === profile.id))
    if (!category) {
      const text = fixed.isShared ? 'Falta una categoría compartida.' : 'Creá una categoría privada en Cargar gasto.'
      if (liveEditing) setSheetError(text)
      else setMessage(text)
      return
    }
    setSaving(true)
    setMessage('')
    setSheetError('')
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
      await reloadDays()
      setEditing(null)
      setToast('Marcado como pagado.')
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : 'No pude marcarlo como pagado.'
      if (liveEditing?.id === id) setSheetError(text)
      else setMessage(text)
    } finally {
      setSaving(false)
    }
  }

  async function undo(id: string) {
    const payment = data?.fixed.find((item) => item.id === id)?.payment
    if (!payment) return
    setSaving(true)
    setMessage('')
    setSheetError('')
    try {
      await undoFixedPayment(payment)
      await refresh()
      await reloadDays()
      setEditing(null)
      setToast('Deshice el pago.')
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : 'No pude deshacer el pago.'
      if (liveEditing?.id === id) setSheetError(text)
      else setMessage(text)
    } finally {
      setSaving(false)
    }
  }

  async function saveDraft(draft: FixedDraft) {
    if (!profile?.householdId) return
    setSaving(true)
    setSheetError('')
    const remindDaysBefore = draft.remind ? shownPrefs.dueLeadDays : 0
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
          remindDaysBefore,
          remind: draft.remind,
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
          remindDaysBefore,
          remind: draft.remind,
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

  const today = todayISO(now)
  const otherId = partnerId(data, profile.id)
  const partnerName = (otherId ? data.names[otherId] : '') || 'tu compañera'
  const myName = data.names[profile.id] ?? ''
  const loggedDays = [
    ...statuses.filter((row) => row.kind === 'logged').map((row) => row.day),
    ...data.monthExpenses.filter((expense) => expense.ownerId === profile.id).map((expense) => expense.spentOn),
  ]
  if (data.lastLoggedOn) loggedDays.push(data.lastLoggedOn)
  const loggedToday = loggedDays.includes(today)
  const clearToday = !loggedToday && (statuses.some((row) => row.day === today && row.kind === 'clear') || shownPrefs.reviewedOn === today)
  const ask = Boolean(prefs && shouldAskToday(now, shownPrefs, { logged: loggedToday, clear: clearToday }))
  const streak = loggingStreak(loggedDays, today)

  const dues = data.fixed.filter((item) => item.applies && !item.pausedAt)
  const paused = data.fixed.filter((item) => item.applies && item.pausedAt)
  const openItems = dues.filter((item) => !item.payment)
  const paidItems = dues.filter((item) => item.payment)
  const grouped = GROUPS.map((group) => ({
    ...group,
    items: openItems
      .filter((item) => dueBucket(item.dueDay, month, now) === group.id)
      .sort((left, right) => compareDue(left, right, group.id, month, now)),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      <SectionHeader
        icon="bell"
        title="Avisos"
        aside={
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full bg-card text-primary shadow-soft"
            aria-label="Mis recordatorios"
            onClick={() => {
              setCreating(false)
              setEditing(null)
              setSettingsOpen(true)
            }}
          >
            <AppIcon name="sliders" />
          </button>
        }
      />
      <MonthSwitcher className="mb-4" />
      {ask ? (
        <section className="relative mb-3 rounded-3xl bg-card p-4 shadow-card">
          <button
            type="button"
            aria-label="Cerrar hasta el próximo horario"
            className="absolute right-1 top-1 grid h-11 w-11 place-items-center text-muted"
            onClick={askLater}
          >
            <AppIcon name="xmark" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <MoonMark />
            <h2 className="font-display text-[19px] font-semibold">¿Gastaste algo hoy?</h2>
          </div>
          <div className="mt-3.5 flex items-center gap-3">
            <Link
              to="/cargar"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[18px] bg-primary px-5 text-sm font-extrabold text-white"
            >
              <AppIcon name="pen" /> Anotar
            </Link>
            <button type="button" className="min-h-11 px-1 text-sm font-extrabold text-primary" onClick={() => void markReviewed()}>
              No gasté nada
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold text-muted">{streakCopy(streak)}</p>
        </section>
      ) : null}

      {grouped.length === 0 && paidItems.length === 0 && paused.length === 0 ? (
        <p className="px-1 text-sm font-semibold text-muted">No hay vencimientos este mes.</p>
      ) : null}

      {grouped.map((group) => (
        <section key={group.id} className="mt-5">
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">{group.title}</h2>
          <div className="space-y-2.5">
            {group.items.map((item) => (
              <SwipeDue
                key={item.id}
                item={item}
                month={month}
                now={now}
                partnerName={partnerName}
                saving={saving}
                onEdit={() => openEditor(item)}
                onPay={() => void pay(item.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {paidItems.length > 0 ? (
        <section className="mt-5">
          <button
            type="button"
            aria-expanded={paidOpen}
            className="flex min-h-11 w-full items-center gap-3 rounded-3xl bg-[#EAF1DF] px-4 py-3"
            onClick={() => setPaidOpen((current) => !current)}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm text-white">
              <AppIcon name="check" />
            </span>
            <span className="flex-1 text-left text-sm font-bold text-text">Ya pagados</span>
            <span className="rounded-full bg-sage-light px-2.5 py-1 text-xs font-extrabold text-primary">{paidItems.length}</span>
            <AppIcon
              name="chevron-down"
              className={`text-primary transition-transform motion-reduce:transition-none ${paidOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {paidOpen ? (
            <ul className="mt-2.5 space-y-2.5">
              {paidItems.map((item) => (
                <li key={item.id} className="flex items-center gap-3.5 rounded-3xl bg-card px-4 py-3 shadow-card">
                  <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-3.5 text-left" onClick={() => openEditor(item)}>
                    <IconBubble icon={item.icon} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{item.title}</span>
                  </button>
                  <div className="text-right">
                    <p className="font-display text-base font-bold">{formatMoney(item.amount)}</p>
                    <button
                      type="button"
                      className="min-h-11 text-xs font-extrabold text-primary disabled:opacity-50"
                      onClick={() => void undo(item.id)}
                      disabled={saving}
                    >
                      Deshacer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {paused.length > 0 ? (
        <section className="mt-3">
          <button
            type="button"
            aria-expanded={pausedOpen}
            className="flex min-h-11 w-full items-center gap-3 rounded-3xl bg-sand px-4 py-3"
            onClick={() => setPausedOpen((current) => !current)}
          >
            <span className="flex-1 text-left text-sm font-bold text-text">En pausa</span>
            <span className="rounded-full bg-card px-2.5 py-1 text-xs font-extrabold text-muted">{paused.length}</span>
            <AppIcon
              name="chevron-down"
              className={`text-muted transition-transform motion-reduce:transition-none ${pausedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {pausedOpen ? (
            <ul className="mt-2.5 space-y-2.5">
              {paused.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3.5 rounded-3xl bg-card px-4 py-3 text-left shadow-card"
                    onClick={() => openEditor(item)}
                  >
                    <IconBubble icon={item.icon} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{item.title}</span>
                    <span className="font-display text-base font-bold">{formatMoney(item.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="h-24" aria-hidden="true" />
      <ErrorText>{message}</ErrorText>
      {toast ? (
        <p
          role="status"
          className="fixed bottom-28 left-1/2 z-50 max-w-[20rem] -translate-x-1/2 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-fab"
        >
          {toast}
        </p>
      ) : null}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px]">
        <button
          type="button"
          className="pointer-events-auto absolute bottom-28 right-5 grid h-[60px] w-[60px] place-items-center rounded-full bg-primary text-2xl text-white shadow-fab"
          aria-label="Nuevo gasto fijo"
          onClick={() => {
            setEditing(null)
            setSettingsOpen(false)
            setSheetError('')
            setCreating(true)
          }}
        >
          <AppIcon name="plus" />
        </button>
      </div>
      <FixedExpenseSheet
        open={creating || liveEditing !== null}
        expense={creating ? null : liveEditing}
        saving={saving}
        error={sheetError}
        leadDays={shownPrefs.dueLeadDays}
        myPercent={data.splitPercents[profile.id] ?? 0}
        partnerPercent={otherId ? (data.splitPercents[otherId] ?? 0) : 0}
        partnerName={partnerName}
        splitEven={data.splitEven}
        editorName={liveEditing?.updatedBy ? (data.names[liveEditing.updatedBy] ?? myName) : myName}
        paid={Boolean(liveEditing?.payment)}
        onClose={() => {
          setCreating(false)
          setEditing(null)
          setSheetError('')
        }}
        onSubmit={(draft) => void saveDraft(draft)}
        onPause={(next) => void pause(next)}
        onDelete={() => void remove()}
        onPay={() => {
          if (liveEditing) void pay(liveEditing.id)
        }}
        onUndo={() => {
          if (liveEditing) void undo(liveEditing.id)
        }}
      />
      <ReminderSettingsSheet
        open={settingsOpen}
        prefs={shownPrefs}
        partnerName={partnerName}
        error={message}
        onClose={() => setSettingsOpen(false)}
        onChange={(next) => {
          if (prefs) persist(next)
        }}
        onActivatePush={() => void activatePush()}
      />
    </>
  )
}

function compareDue(left: FixedItem, right: FixedItem, bucket: DueBucket, month: string, now: Date): number {
  const delta = dayDiff(left.dueDay, month, now) - dayDiff(right.dueDay, month, now)
  return bucket === 'today' ? -delta : delta
}

function MoonMark() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true" className="shrink-0">
      <circle cx="29" cy="29" r="27" fill="#EDE6F5" />
      <path d="M36 14a15 15 0 1 0 9 24a12 12 0 1 1-9-24z" fill="#F4C542" />
      <circle cx="16" cy="16" r="1.8" fill="#A79BCB" />
      <circle cx="44" cy="12" r="1.4" fill="#A79BCB" />
      <circle cx="12" cy="40" r="1.2" fill="#A79BCB" />
    </svg>
  )
}

function IconBubble({ icon }: { icon: string }) {
  const surface = iconSurface(icon)
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-base"
      style={{ background: surface.background, color: surface.color }}
    >
      <AppIcon name={icon} />
    </span>
  )
}

function SwipeDue({
  item,
  month,
  now,
  partnerName,
  saving,
  onEdit,
  onPay,
}: {
  item: FixedItem
  month: string
  now: Date
  partnerName: string
  saving: boolean
  onEdit: () => void
  onPay: () => void
}) {
  const tone = dueTone(item.dueDay, month, now)
  const when = dueLabel(item.dueDay, month, now)
  const payOnCard = showPayLink(item.dueDay, month, now)
  const [reveal, setReveal] = useState(0)
  const [dragging, setDragging] = useState(false)
  const origin = useRef({ x: 0, y: 0, reveal: 0 })
  const tracking = useRef(false)
  const horizontal = useRef(false)
  const dragged = useRef(false)
  const revealRef = useRef(0)

  function setRevealTo(value: number) {
    revealRef.current = value
    setReveal(value)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('[data-pay]')) return
    tracking.current = true
    horizontal.current = false
    origin.current = { x: event.clientX, y: event.clientY, reveal: revealRef.current }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!tracking.current) return
    const dx = event.clientX - origin.current.x
    const dy = event.clientY - origin.current.y
    if (!horizontal.current) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        tracking.current = false
        return
      }
      if (Math.abs(dx) < 8) return
      horizontal.current = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setRevealTo(Math.min(72, Math.max(0, origin.current.reveal - dx)))
  }

  function onPointerUp() {
    const wasHorizontal = horizontal.current
    tracking.current = false
    horizontal.current = false
    setDragging(false)
    if (!wasHorizontal) return
    dragged.current = true
    setRevealTo(revealRef.current > 36 ? 72 : 0)
  }

  function edit() {
    if (dragged.current) {
      dragged.current = false
      return
    }
    onEdit()
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#E3EDD6]">
      <button
        type="button"
        data-pay="true"
        aria-label={`Marcar ${item.title} como pagado`}
        aria-hidden={reveal < 36}
        tabIndex={reveal >= 36 ? 0 : -1}
        disabled={saving}
        onClick={onPay}
        className="absolute inset-y-0 right-0 flex w-[72px] flex-col items-center justify-center gap-1 text-xs font-extrabold text-primary disabled:opacity-50"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-sage-light">
          <AppIcon name="check" />
        </span>
        Pagué
      </button>
      <div
        className={`swipe-motion relative z-10 touch-pan-y rounded-3xl bg-card shadow-card ${dragging ? '' : 'transition-[margin] duration-200 ease-out'}`}
        style={{ marginRight: reveal }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex items-center gap-3.5 px-4 py-4">
          <button type="button" onClick={edit} className="flex min-h-11 min-w-0 flex-1 items-center gap-3.5 text-left" aria-label={`Editar ${item.title}, ${when}`}>
            <IconBubble icon={item.icon} />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-[15.5px] font-bold">{item.title}</span>
                {item.isShared ? <span className="shrink-0 text-xs font-semibold text-muted">con {partnerName}</span> : null}
              </span>
              <span className={`mt-0.5 block text-[13px] font-bold ${toneClass[tone]}`}>{when}</span>
            </span>
          </button>
          <div className="text-right">
            <p className="font-display text-base font-bold">{formatMoney(item.amount)}</p>
            {payOnCard ? (
              <button
                type="button"
                data-pay="true"
                className="inline-flex min-h-11 items-center gap-1 text-[12.5px] font-extrabold text-primary disabled:opacity-50"
                onClick={onPay}
                disabled={saving}
              >
                <AppIcon name="check" className="text-[10px]" /> Pagué
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
