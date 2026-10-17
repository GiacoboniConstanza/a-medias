import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { Button, Card, Chip, ErrorText } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { createFixedExpense, markFixedPaid, undoFixedPayment } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { isCurrentMonth, longDate, shortDate, todayISO } from '../lib/month.ts'
import { pushPlan } from '../lib/push/plan.ts'

export function RemindersScreen() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('house')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('10')
  const [shared, setShared] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const now = new Date()

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const today = todayISO(now)
  const loggedToday = data.lastLoggedOn === today
  const silentDays = data.lastLoggedOn ? daysBetween(data.lastLoggedOn, today) : null
  const current = isCurrentMonth(month, now)

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
        paidOn: current ? today : `${month.slice(0, 8)}${String(fixed.dueDay).padStart(2, '0')}`,
        categoryId: category.id,
      })
      await refresh()
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
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude deshacer el pago.')
    } finally {
      setSaving(false)
    }
  }

  async function addFixed() {
    const value = Number(amount)
    const day = Number(dueDay)
    if (!title.trim() || !Number.isFinite(value) || value <= 0 || day < 1 || day > 28) {
      setMessage('Completá nombre, monto y un día del 1 al 28.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await createFixedExpense({
        householdId: profile?.householdId as string,
        ownerId: shared ? null : (profile?.id ?? null),
        categoryId: null,
        title,
        icon,
        amount: value,
        dueDay: day,
        isShared: shared,
      })
      setTitle('')
      setAmount('')
      setOpen(false)
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude crear el recordatorio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="-mx-5 -mt-6 mb-4 bg-primary px-5 pb-8 pt-8 text-center text-white">
        <p className="font-display text-5xl font-semibold">
          {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-sm font-semibold text-white">{longDate(now)}</p>
      </div>
      {current && !loggedToday && !dismissed ? (
        <Card>
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
            <AppIcon name="mug-hot" /> A MEDIAS · ahora
          </p>
          <b>¿Gastaste algo hoy?</b>
          <p className="text-sm font-semibold text-text">Anotalo en dos toques así no se te escapa.</p>
          <div className="mt-2">
            <Link to="/cargar" className="mr-1 inline-flex min-h-11 items-center rounded-2xl bg-primary px-3 text-sm font-semibold text-white">
              Sí, cargar
            </Link>
            <button type="button" className="min-h-11 rounded-2xl bg-sand px-3 text-sm font-semibold text-text" onClick={() => setDismissed(true)}>
              Hoy no
            </button>
          </div>
        </Card>
      ) : null}
      <Card>
        <b className="inline-flex items-center gap-2 text-[17px]">
          <AppIcon name="calendar-days" className="text-primary" /> Vencimientos de {monthNameOnly(month)}
        </b>
        {data.fixed.length === 0 ? <p className="mt-2 text-sm text-muted">No hay gastos fijos este hogar.</p> : null}
        {data.fixed.map((item) => {
          const state = item.payment ? 'paid' : dueState(item.dueDay, month, now)
          return (
            <div key={item.id} className="flex items-center gap-2.5 border-b border-line py-2 last:border-0">
              <div
                className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
                  state === 'paid' ? 'bg-good text-white' : state === 'soon' || state === 'late' ? 'bg-warn text-text' : 'border-2 border-warn-soft bg-transparent text-transparent'
                }`}
              >
                {state === 'paid' ? <AppIcon name="check" /> : state === 'soon' || state === 'late' ? <AppIcon name="triangle-exclamation" /> : ''}
              </div>
              <div className="flex-1">
                <b>
                  <AppIcon name={item.icon} /> {item.title}
                </b>
                <p className="text-sm text-muted">
                  {item.payment
                    ? `Pagado el ${shortDate(item.payment.paidOn)} · ${data.names[item.payment.payerId] ?? ''}`
                    : `${dueLabel(item.dueDay, month, now)} · ${formatMoney(item.amount)}${item.isShared ? '' : ' · privado'}`}
                </p>
              </div>
              {item.payment ? (
                <button type="button" className="min-h-11 px-2 text-sm font-semibold text-primary" onClick={() => void undo(item.id)} disabled={saving}>
                  Deshacer
                </button>
              ) : (
                <button type="button" className="min-h-11 px-2 text-sm font-semibold text-primary" onClick={() => void pay(item.id)} disabled={saving}>
                  Pagué
                </button>
              )}
            </div>
          )
        })}
      </Card>
      {current && silentDays !== null && silentDays >= pushPlan.silence.daysWithoutExpenses ? (
        <Card className="flex items-start gap-2 bg-sand text-sm font-semibold text-text">
          <AppIcon name="bell" className="mt-0.5 text-primary" />
          {pushPlan.silence.body.replace('unos días', `${silentDays} días`)}
        </Card>
      ) : null}
      <Button type="button" variant="alt" onClick={() => setOpen((currentOpen) => !currentOpen)}>
        + Gasto fijo
      </Button>
      {open ? (
        <Card>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Alquiler, luz, obra social…" className="mb-2 min-h-11 w-full rounded-2xl bg-sand px-3 py-2 font-bold text-text" />
          <IconPicker value={icon} onChange={setIcon} />
          <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Monto" className="mt-2 min-h-11 w-full rounded-2xl bg-sand px-3 py-2 font-bold text-text" />
          <input value={dueDay} onChange={(event) => setDueDay(event.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="Día de vencimiento" className="mt-2 min-h-11 w-full rounded-2xl bg-sand px-3 py-2 font-bold text-text" />
          <div className="my-2 flex flex-wrap gap-2">
            <Chip active={shared} onClick={() => setShared(true)}>
              <AppIcon name="user-group" /> Compartido
            </Chip>
            <Chip active={!shared} onClick={() => setShared(false)}>
              <AppIcon name="lock" /> Privado
            </Chip>
          </div>
          <Button type="button" onClick={() => void addFixed()} disabled={saving}>
            Guardar
          </Button>
        </Card>
      ) : null}
      <p className="mt-4 text-center text-xs text-muted">
        El aviso diario de las {pushPlan.daily.localTime} (“{pushPlan.daily.title}”) y los vencimientos con {pushPlan.dues.daysBefore} días de anticipación quedan preparados, sin enviarlos al celular todavía.
      </p>
      <ErrorText>{message}</ErrorText>
    </>
  )
}

function monthNameOnly(month: string): string {
  const [year, monthNumber] = month.split('-')
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(date)
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function dueState(dueDay: number, month: string, today: Date): 'future' | 'soon' | 'late' {
  if (!isCurrentMonth(month, today)) return 'future'
  const diff = dueDay - today.getDate()
  if (diff < 0) return 'late'
  if (diff <= pushPlan.dues.daysBefore) return 'soon'
  return 'future'
}

function dueLabel(dueDay: number, month: string, today: Date): string {
  const [year, monthNumber] = month.split('-')
  const due = `${year}-${monthNumber}-${String(dueDay).padStart(2, '0')}`
  if (!isCurrentMonth(month, today)) return `Vence el ${shortDate(due)}`
  const diff = dueDay - today.getDate()
  if (diff < 0) return `Venció hace ${Math.abs(diff)} días`
  if (diff === 0) return 'Vence hoy'
  if (diff === 1) return 'Vence mañana'
  return `Vence en ${diff} días`
}
