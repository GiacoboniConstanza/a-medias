import { useState } from 'react'
import { amountFromDigits, applyKey, Keypad } from '../components/Keypad.tsx'
import { Button, Card, Chip, ErrorText, Progress } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { contributeToGoal, createGoal } from '../lib/api.ts'
import { monthSplit } from '../lib/derive.ts'
import { EMOJIS } from '../lib/emojis.ts'
import { formatMoney } from '../lib/format.ts'
import type { ContributionMode } from '../types/database.ts'

export function GoalScreen() {
  const { profile } = useAuth()
  const { data, loading, error, refresh } = useFinance()
  const [mode, setMode] = useState<ContributionMode>('percentage')
  const [digits, setDigits] = useState('')
  const [name, setName] = useState('Vacaciones juntas')
  const [emoji, setEmoji] = useState('🏖️')
  const [targetDigits, setTargetDigits] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [editing, setEditing] = useState<'amount' | 'target'>('amount')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center font-extrabold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-extrabold text-bad">{error}</p>

  const split = monthSplit(data)
  const myPercent = split.rows.find((row) => row.id === profile.id)?.percent ?? 50
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
        emoji,
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
      <header className="mb-3 flex items-center justify-between">
        <span className="text-xl font-black text-brand">A Medias</span>
        <span className="rounded-2xl bg-chip px-3 py-1 text-[13px] font-bold">👭 Las dos</span>
      </header>
      <h1 className="mb-3 text-[22px] font-extrabold">Meta compartida</h1>
      {data.goal ? (
        <>
          <Card className="bg-[#d9f2ff] text-center">
            <div className="text-5xl">{data.goal.emoji}</div>
            <b className="text-xl">{data.goal.name}</b>
            {data.goal.targetDate ? <p className="text-sm text-muted">{data.goal.targetDate.split('-').reverse().join('/')}</p> : null}
            <p className="mt-2 text-3xl font-black">
              {formatMoney(data.goal.byUser.reduce((sum, item) => sum + item.amount, 0))}
            </p>
            <p className="text-sm text-muted">
              de {formatMoney(data.goal.target)} · ¡ya van{' '}
              {data.goal.target === 0
                ? 0
                : Math.round((data.goal.byUser.reduce((sum, item) => sum + item.amount, 0) / data.goal.target) * 100)}
              %!
            </p>
            <div className="mt-2">
              <Progress
                value={
                  data.goal.target === 0
                    ? 0
                    : (data.goal.byUser.reduce((sum, item) => sum + item.amount, 0) / data.goal.target) * 100
                }
                color="#7a5cff"
              />
            </div>
          </Card>
          <Card>
            <b>Aportes</b>
            {people.map((id) => {
              const amount = data.goal?.byUser.find((item) => item.userId === id)?.amount ?? 0
              return (
                <div key={id} className="flex items-center gap-2 border-b border-line py-2 last:border-0">
                  <span>🙋‍♀️</span>
                  <b className="flex-1">{data.names[id]}</b>
                  <span>{formatMoney(amount)}</span>
                </div>
              )
            })}
            <ContributionBar names={data.names} byUser={data.goal.byUser} />
          </Card>
          <div className="mb-2 text-center">
            <Chip active={mode === 'free'} onClick={() => setMode('free')}>
              Aportar libre
            </Chip>
            <Chip active={mode === 'percentage'} onClick={() => setMode('percentage')}>
              Usar {myPercent}%
            </Chip>
          </div>
          <button type="button" className="mb-2 w-full text-center text-3xl font-black" onClick={() => setEditing('amount')}>
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
          <p className="mt-3 text-center text-sm text-muted">🔒 Tu compañera ve tu aporte acá, no tus fondos privados.</p>
        </>
      ) : (
        <Card>
          <b>Armen la primera meta</b>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl bg-chip px-3 py-2 font-bold" />
          <div className="my-2">
            {EMOJIS.map((item) => (
              <Chip key={item} active={emoji === item} onClick={() => setEmoji(item)}>
                {item}
              </Chip>
            ))}
          </div>
          <button type="button" className="font-extrabold" onClick={() => setEditing('target')}>
            Meta: {formatMoney(amountFromDigits(targetDigits))}
          </button>
          <label className="mt-2 block text-sm font-bold text-muted">
            Fecha
            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="mt-1 w-full rounded-2xl px-3 py-2 font-bold text-ink" />
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

function ContributionBar({ names, byUser }: { names: Record<string, string>; byUser: { userId: string; amount: number }[] }) {
  const total = byUser.reduce((sum, item) => sum + item.amount, 0)
  const colors = ['#7a5cff', '#ff8fab']
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
