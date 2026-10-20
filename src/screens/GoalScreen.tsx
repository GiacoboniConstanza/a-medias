import { useEffect, useId, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { amountFromDigits, applyKey, Keypad } from '../components/Keypad.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { AudiencePill, SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, Chip, ErrorText, FieldError } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { contributeToGoal, createGoal, type GoalContribution } from '../lib/api.ts'
import { monthSplit, partnerId } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import {
  contributionInMonth,
  evenMonthlyShare,
  goalPhrase,
  goalProgress,
  monthsLeftCopy,
  monthsUntil,
  salaryShare,
  shareLabel,
} from '../lib/goal.ts'
import { monthTitle, shortDate, todayISO } from '../lib/month.ts'
import type { ContributionMode } from '../types/database.ts'

const primaryButton = 'block min-h-[52px] w-full rounded-2xl bg-primary text-base font-semibold text-white disabled:opacity-50'
const quietButton = 'mt-2 block min-h-[52px] w-full rounded-2xl border-2 border-primary bg-card text-base font-semibold text-primary'

export function GoalScreen() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [name, setName] = useState('Vacaciones juntas')
  const [icon, setIcon] = useState('umbrella-beach')
  const [targetDigits, setTargetDigits] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [editingTarget, setEditingTarget] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const split = monthSplit(data)
  const myPercent = split.rows.find((row) => row.id === profile.id)?.percent ?? 50
  const partnerName = data.names[partnerId(data, profile.id) ?? ''] ?? 'Tu compañera'
  const goal = data.goal
  const saved = goal?.byUser.reduce((sum, item) => sum + item.amount, 0) ?? 0
  const progress = goalProgress(saved, goal?.target ?? 0)
  const remaining = Math.max((goal?.target ?? 0) - saved, 0)
  const months = goal?.targetDate ? monthsUntil(goal.targetDate) : 0
  const monthlyEach = evenMonthlyShare(remaining, months)
  const suggested = salaryShare(remaining, months, myPercent)
  const monthContributions = (goal?.contributions ?? []).filter((item) => contributionInMonth(item.createdAt, month))
  const people = orderedPeople(data.names)

  async function saveGoal() {
    const target = amountFromDigits(targetDigits)
    if (!name.trim() || target <= 0) {
      setMessage('La meta necesita nombre y monto.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await createGoal({
        householdId: profile?.householdId as string,
        name,
        icon,
        target,
        targetDate: targetDate || null,
      })
      setTargetDigits('')
      setEditingTarget(false)
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude crear la meta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionHeader icon="umbrella-beach" title="Meta compartida" aside={<AudiencePill icon="user-group">Las dos</AudiencePill>} />
      <MonthSwitcher heading className="mb-4" />
      {goal ? (
        <>
          <Card className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#EDE6F5] text-2xl text-[#5C4E86]">
              <AppIcon name={goal.icon} />
            </div>
            <h2 className="mt-2 font-display text-xl font-semibold">{goal.name}</h2>
            <ProgressRing label={progress.label} arc={progress.arc} />
            <p className="font-display text-lg font-semibold">
              {formatMoney(saved)} de {formatMoney(goal.target)}
            </p>
            {goal.targetDate ? (
              <p className="mt-1 text-sm font-semibold text-muted">
                {monthTitle(goal.targetDate)} · {monthsLeftCopy(months)}
              </p>
            ) : null}
            {monthlyEach ? (
              <p className="mt-1 text-sm font-semibold text-text">Si cada una suma {formatMoney(monthlyEach)} por mes, llegan.</p>
            ) : null}
            <p className="mt-2 text-sm font-bold text-primary">{goalPhrase(saved, goal.target)}</p>
          </Card>

          <h2 className="mb-2 font-display text-sm font-semibold text-muted">Aportes</h2>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {people.map((person, index) => {
              const amount = monthAmount(monthContributions, person.id)
              const total = monthContributions.reduce((sum, item) => sum + item.amount, 0)
              return (
                <article key={person.id} className="h-full rounded-3xl bg-card p-3 shadow-card">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-full font-display text-lg font-semibold ${personTone(person.name, index).circle}`}
                    aria-hidden="true"
                  >
                    {initials(person.name)}
                  </span>
                  <p className="mt-2 font-semibold">{person.name}</p>
                  {amount > 0 ? (
                    <>
                      <p className="font-display text-lg font-semibold leading-tight">{formatMoney(amount)}</p>
                      <p className="text-sm font-semibold text-muted">{shareLabel(amount, total)}</p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-muted">Todavía no sumó</p>
                  )}
                </article>
              )
            })}
          </div>
          <SplitBar people={people} contributions={monthContributions} />

          <button
            type="button"
            className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-white"
            onClick={() => setSheetOpen(true)}
          >
            <AppIcon name="plus" /> Sumar a la meta
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-text">
            <AppIcon name="lock" /> {partnerName} ve tu aporte acá, no tus fondos privados.
          </p>

          <section className="mb-8 mt-4">
            <button
              type="button"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((current) => !current)}
              className="flex min-h-11 w-full items-center justify-between rounded-3xl bg-card px-4 text-left shadow-card"
            >
              <span className="font-display text-base font-semibold">Historial de aportes</span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
                {monthContributions.length === 0 ? 'Vacío' : monthContributions.length}
                <span>{historyOpen ? 'Ocultar' : 'Ver'}</span>
              </span>
            </button>
            {historyOpen ? (
              <div className="mt-2 rounded-3xl bg-card px-4 py-1 shadow-card">
                {monthContributions.length === 0 ? (
                  <p className="py-4 text-sm font-semibold text-muted">Todavía no hay aportes este mes.</p>
                ) : (
                  <ul>
                    {monthContributions.map((item) => {
                      const personName = data.names[item.userId] ?? 'Alguien'
                      const index = people.findIndex((person) => person.id === item.userId)
                      return (
                        <li key={item.id} className="flex items-center gap-3 border-b border-dashed border-line py-2.5 last:border-0">
                          <span
                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-sm font-semibold ${personTone(personName, Math.max(index, 0)).circle}`}
                            aria-hidden="true"
                          >
                            {initials(personName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{personName}</p>
                            <p className="text-sm font-semibold text-muted">{shortDate(todayISO(new Date(item.createdAt)))}</p>
                          </div>
                          <p className="shrink-0 font-display font-semibold">{formatMoney(item.amount)}</p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </section>

          <ContributeSheet
            open={sheetOpen}
            suggested={suggested}
            onClose={() => setSheetOpen(false)}
            onSaved={async (amount, mode) => {
              await contributeToGoal({
                goalId: goal.id,
                userId: profile.id,
                amount,
                mode,
              })
              await refresh()
              setSheetOpen(false)
              setToast('Listo, sumaste a la meta.')
            }}
          />
        </>
      ) : (
        <Card>
          <b>Armen la primera meta</b>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Nombre de la meta"
            className="mt-2 min-h-11 w-full rounded-2xl bg-sand px-3 py-2 font-bold text-text"
          />
          <div className="my-2">
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <button type="button" className="min-h-11 font-display text-2xl font-semibold" onClick={() => setEditingTarget(true)}>
            Meta: {formatMoney(amountFromDigits(targetDigits))}
          </button>
          <label className="mt-2 block text-sm font-bold text-muted">
            Fecha
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-2xl bg-sand px-3 py-2 font-bold text-text"
            />
          </label>
          {editingTarget ? (
            <div className="mt-2">
              <Keypad onKey={(key) => setTargetDigits((current) => applyKey(current, key))} />
            </div>
          ) : null}
          <Button type="button" className="mt-3 min-h-[52px]" onClick={() => void saveGoal()} disabled={saving}>
            Crear meta
          </Button>
        </Card>
      )}
      <ErrorText>{goal ? '' : message}</ErrorText>
      {toast ? (
        <p
          role="status"
          className="fixed bottom-28 left-1/2 z-50 max-w-[20rem] -translate-x-1/2 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-fab"
        >
          {toast}
        </p>
      ) : null}
    </>
  )
}

function ProgressRing({ label, arc }: { label: string; arc: number }) {
  const radius = 46
  const circ = 2 * Math.PI * radius
  const spoken = label === '<1%' ? 'Menos del 1 por ciento de la meta' : `${label.replace('%', '')} por ciento de la meta`
  return (
    <div className="relative mx-auto my-3 grid h-40 w-40 place-items-center" role="img" aria-label={spoken}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#EDE6F5" strokeWidth="10" />
        <circle
          className="goal-ring"
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#A79BCB"
          strokeWidth="10"
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ strokeDasharray: circ, strokeDashoffset: circ - arc * circ }}
        />
      </svg>
      <p className="font-display text-4xl font-bold leading-none" aria-hidden="true">
        {label}
      </p>
    </div>
  )
}

function SplitBar({
  people,
  contributions,
}: {
  people: { id: string; name: string }[]
  contributions: GoalContribution[]
}) {
  const total = contributions.reduce((sum, item) => sum + item.amount, 0)
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-[#EDE6F5]" aria-hidden="true">
      {total > 0
        ? people.map((person, index) => {
            const amount = monthAmount(contributions, person.id)
            if (amount <= 0) return null
            return <i key={person.id} style={{ width: `${(amount / total) * 100}%`, background: personTone(person.name, index).bar }} />
          })
        : null}
    </div>
  )
}

function ContributeSheet({
  open,
  suggested,
  onClose,
  onSaved,
}: {
  open: boolean
  suggested: number | null
  onClose: () => void
  onSaved: (amount: number, mode: ContributionMode) => Promise<void>
}) {
  const errorId = useId()
  const [mode, setMode] = useState<ContributionMode>('percentage')
  const [digits, setDigits] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [seenOpen, setSeenOpen] = useState(open)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setMode('percentage')
      setDigits(suggested ? String(suggested) : '')
      setTouched(false)
      setSaving(false)
      setServerError('')
    }
  }

  const amount = amountFromDigits(digits)
  const amountError = amount > 0 ? '' : 'Poné cuánto querés aportar.'
  const visibleError = serverError || (touched ? amountError : '')

  function choose(next: ContributionMode) {
    setMode(next)
    if (next === 'percentage') setDigits(suggested ? String(suggested) : '')
  }

  async function save() {
    setTouched(true)
    if (amount <= 0 || saving) return
    setSaving(true)
    setServerError('')
    try {
      await onSaved(amount, mode)
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : 'No pude anotar el aporte.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Sumar a la meta"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={primaryButton} disabled={saving} onClick={() => void save()}>
            Aportar
          </button>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancelar
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Cómo aportar">
        <Chip active={mode === 'free'} onClick={() => choose('free')} className="min-h-[52px] w-full">
          Monto libre
        </Chip>
        <Chip active={mode === 'percentage'} onClick={() => choose('percentage')} className="min-h-[52px] w-full">
          Según mi %
        </Chip>
      </div>
      {mode === 'percentage' && suggested ? (
        <p className="mt-2 text-sm font-semibold text-muted">Según tu sueldo te toca {formatMoney(suggested)}.</p>
      ) : null}
      <div className="mt-4">
        <p className="text-sm font-bold text-muted">Monto</p>
        <p className="font-display text-4xl font-bold leading-none" aria-describedby={visibleError ? errorId : undefined}>
          {formatMoney(amount)}
        </p>
        <FieldError id={errorId}>{visibleError}</FieldError>
        <div className="mt-3">
          <Keypad
            onKey={(key) => {
              setTouched(true)
              setDigits((current) => applyKey(current, key))
            }}
          />
        </div>
      </div>
    </Sheet>
  )
}

function orderedPeople(names: Record<string, string>): { id: string; name: string }[] {
  return Object.entries(names)
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => personRank(a.name) - personRank(b.name) || a.name.localeCompare(b.name, 'es'))
}

function personRank(name: string): number {
  const key = name.trim().toLowerCase()
  if (key === 'coty') return 0
  if (key === 'maru') return 1
  return 2
}

function personTone(name: string, index: number): { circle: string; bar: string } {
  const key = name.trim().toLowerCase()
  const lavender = key === 'maru' || (key !== 'coty' && index % 2 === 1)
  if (lavender) return { circle: 'bg-[#EDE6F5] text-text', bar: '#A79BCB' }
  return { circle: 'bg-sage-light text-text', bar: '#4F6B57' }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const second = parts[1]?.[0] ?? ''
  return `${first}${second}`.toUpperCase()
}

function monthAmount(contributions: GoalContribution[], userId: string): number {
  return contributions.filter((item) => item.userId === userId).reduce((sum, item) => sum + item.amount, 0)
}
