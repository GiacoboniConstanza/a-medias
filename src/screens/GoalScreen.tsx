import { useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { amountFromDigits, applyKey, Keypad } from '../components/Keypad.tsx'
import { AudiencePill, SectionHeader } from '../components/SectionHeader.tsx'
import { Button, Card, Chip, ErrorText } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { contributeToGoal, createGoal } from '../lib/api.ts'
import { monthSplit, partnerId } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import type { ContributionMode } from '../types/database.ts'

export function GoalScreen() {
  const { profile } = useAuth()
  const { data, loading, error, refresh } = useFinance()
  const [mode, setMode] = useState<ContributionMode>('percentage')
  const [digits, setDigits] = useState('')
  const [name, setName] = useState('Vacaciones juntas')
  const [icon, setIcon] = useState('umbrella-beach')
  const [targetDigits, setTargetDigits] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [editing, setEditing] = useState<'amount' | 'target'>('amount')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const split = monthSplit(data)
  const myPercent = split.rows.find((row) => row.id === profile.id)?.percent ?? 50
  const splitLabel = split.rows.map((row) => row.percent).join('/') || '50/50'
  const partnerName = data.names[partnerId(data, profile.id) ?? ''] ?? 'Tu compañera'
  const contribution = mode === 'percentage' ? Math.round((amountFromDigits(digits) * myPercent) / 100) : amountFromDigits(digits)
  const people = Object.keys(data.names)

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
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude crear la meta.')
    } finally {
      setSaving(false)
    }
  }

  async function contribute() {
    if (!data?.goal || contribution <= 0) {
      setMessage('Poné cuánto querés aportar.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await contributeToGoal({
        goalId: data.goal.id,
        userId: profile?.id as string,
        amount: contribution,
        mode,
      })
      setDigits('')
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude anotar el aporte.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionHeader
        className="mb-3"
        icon="umbrella-beach"
        title="Meta compartida"
        aside={<AudiencePill icon="user-group">Las dos</AudiencePill>}
      />
      {data.goal ? (
        <>
          <Card className="bg-lavender/20 text-center">
            <div className="text-5xl text-text">
              <AppIcon name={data.goal.icon} />
            </div>
            <b className="text-xl">{data.goal.name}</b>
            {data.goal.targetDate ? <p className="text-sm text-muted">{monthYear(data.goal.targetDate)}</p> : null}
            <p className="mt-2 font-display text-3xl font-bold">
              {formatMoney(data.goal.byUser.reduce((sum, item) => sum + item.amount, 0))}
            </p>
            <p className="text-sm text-muted">
              de {formatMoney(data.goal.target)} · ¡ya van{' '}
              {data.goal.target === 0
                ? 0
                : Math.round((data.goal.byUser.reduce((sum, item) => sum + item.amount, 0) / data.goal.target) * 100)}
              %!
            </p>
            <div className="mt-2.5 h-5 overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-lavender"
                style={{
                  width: `${
                    data.goal.target === 0
                      ? 0
                      : Math.max(
                          0,
                          Math.min(
                            100,
                            (data.goal.byUser.reduce((sum, item) => sum + item.amount, 0) / data.goal.target) * 100,
                          ),
                        )
                  }%`,
                }}
              />
            </div>
          </Card>
          <Card>
            <b>Aportes</b>
            {people.map((id) => {
              const amount = data.goal?.byUser.find((item) => item.userId === id)?.amount ?? 0
              return (
                <div key={id} className="flex items-center gap-2 border-b border-line py-2 last:border-0">
                  <AppIcon name="user" className="text-lavender" />
                  <b className="flex-1">{data.names[id]}</b>
                  <span>{formatMoney(amount)}</span>
                </div>
              )
            })}
            <ContributionBar names={data.names} byUser={data.goal.byUser} />
          </Card>
          <div className="mb-2 flex flex-wrap justify-center gap-2">
            <Chip active={mode === 'free'} onClick={() => setMode('free')}>
              Aportar libre
            </Chip>
            <Chip active={mode === 'percentage'} onClick={() => setMode('percentage')}>
              Usar {splitLabel}
            </Chip>
          </div>
          <button type="button" className="mb-2 min-h-11 w-full text-center font-display text-3xl font-bold" onClick={() => setEditing('amount')}>
            {formatMoney(amountFromDigits(digits))}
          </button>
          <p className="mb-2 text-center text-sm text-muted">
            {mode === 'percentage'
              ? `Con tu ${myPercent}% aportás ${formatMoney(contribution)}.`
              : `Aportás ${formatMoney(contribution)} de tu lado.`}
          </p>
          <Keypad
            onKey={(key) => {
              setEditing('amount')
              setDigits((current) => applyKey(current, key))
            }}
          />
          <Button type="button" variant="pink" className="mt-3" onClick={() => void contribute()} disabled={saving}>
            Aportar
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-text">
            <AppIcon name="lock" /> {partnerName} ve tu aporte acá, no tus fondos privados.
          </p>
        </>
      ) : (
        <Card>
          <b>Armen la primera meta</b>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-11 w-full rounded-2xl bg-sand px-3 py-2 font-bold text-text" />
          <div className="my-2">
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <button type="button" className="font-extrabold" onClick={() => setEditing('target')}>
            Meta: {formatMoney(amountFromDigits(targetDigits))}
          </button>
          <label className="mt-2 block text-sm font-bold text-muted">
            Fecha
            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-2xl bg-sand px-3 py-2 font-bold text-text" />
          </label>
          {editing === 'target' ? <div className="mt-2"><Keypad onKey={(key) => setTargetDigits((current) => applyKey(current, key))} /></div> : null}
          <Button type="button" className="mt-3" onClick={() => void saveGoal()} disabled={saving}>
            Crear meta
          </Button>
        </Card>
      )}
      <ErrorText>{message}</ErrorText>
    </>
  )
}

function monthYear(iso: string): string {
  const [year, month] = iso.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  const name = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(date)
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

function ContributionBar({ names, byUser }: { names: Record<string, string>; byUser: { userId: string; amount: number }[] }) {
  const total = byUser.reduce((sum, item) => sum + item.amount, 0)
  const colors = ['#A79BCB', '#F7B7C4']
  if (total <= 0) return null
  return (
    <>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-md">
        {byUser.map((item, index) => (
          <i key={item.userId} style={{ width: `${(item.amount / total) * 100}%`, background: colors[index % colors.length] }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs font-semibold text-muted">
        {byUser.map((item) => (
          <span key={item.userId}>
            {names[item.userId]} {Math.round((item.amount / total) * 100)}%
          </span>
        ))}
      </div>
    </>
  )
}
