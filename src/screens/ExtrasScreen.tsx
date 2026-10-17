import { useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { amountFromDigits, applyKey, Keypad } from '../components/Keypad.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { Button, Card, ErrorText, Progress } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { createExtra, createFund } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { gustosStatus } from '../lib/gustos.ts'
import { shortDate, todayISO } from '../lib/month.ts'

const FUND_COLORS = ['#9ec9ff', '#8fe3b0', '#c9b8ff', '#ffd36e', '#ffc2d1']

export function ExtrasScreen() {
  const { profile } = useAuth()
  const { data, loading, error, refresh } = useFinance()
  const [digits, setDigits] = useState('')
  const [label, setLabel] = useState('')
  const [receivedOn, setReceivedOn] = useState(() => todayISO())
  const [fundAmounts, setFundAmounts] = useState<Record<string, string>>({})
  const [activeFund, setActiveFund] = useState<string | null>('extra')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('piggy-bank')
  const [targetDigits, setTargetDigits] = useState('')
  const [creatingFund, setCreatingFund] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center font-extrabold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-extrabold text-bad">{error}</p>

  const userId = profile.id
  const householdId = profile.householdId
  const finance = data

  const amount = amountFromDigits(digits)
  const assigned = data.funds.reduce((sum, fund) => sum + amountFromDigits(fundAmounts[fund.id] ?? ''), 0)
  const gustosPart = amount - assigned
  const gustos = gustosStatus(data.gustosAllocated, data.privateSpentAllTime)
  const gustosUsed = data.gustosAllocated === 0 ? 0 : Math.min(100, (data.privateSpentAllTime / data.gustosAllocated) * 100)

  function onKey(key: string) {
    if (activeFund === 'extra') setDigits((current) => applyKey(current, key))
    else if (activeFund === 'target') setTargetDigits((current) => applyKey(current, key))
    else if (activeFund) {
      setFundAmounts((current) => ({ ...current, [activeFund]: applyKey(current[activeFund] ?? '', key) }))
    }
  }

  async function saveExtra() {
    if (amount <= 0 || !label.trim()) {
      setMessage('Poné el monto y un nombre para el extra.')
      return
    }
    if (gustosPart < 0) {
      setMessage('Los fondos no pueden sumar más que el extra.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const allocations: { fundId: string | null; amount: number }[] = finance.funds
        .map((fund) => ({ fundId: fund.id, amount: amountFromDigits(fundAmounts[fund.id] ?? '') }))
        .filter((allocation) => allocation.amount > 0)
      if (gustosPart > 0) allocations.push({ fundId: null, amount: gustosPart })
      await createExtra({
        userId,
        householdId,
        label,
        amount,
        receivedOn,
        allocations,
      })
      setDigits('')
      setLabel('')
      setFundAmounts({})
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude guardar el extra.')
    } finally {
      setSaving(false)
    }
  }

  async function saveFund() {
    const target = amountFromDigits(targetDigits)
    if (!name.trim() || target <= 0) {
      setMessage('El fondo necesita nombre y meta.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await createFund({ userId, name, icon, target })
      setName('')
      setTargetDigits('')
      setCreatingFund(false)
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude crear el fondo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="mb-3 flex items-center justify-between">
        <span className="text-xl font-black text-brand">A Medias</span>
        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border-2 border-edge bg-white px-3 text-sm font-semibold text-ink">
          <AppIcon name="lock" /> Solo vos
        </span>
      </header>
      <h1 className="flex items-center gap-2 text-[22px] font-extrabold">
        Bolsa de extras <AppIcon name="bag-shopping" className="text-brand" />
      </h1>
      <p className="mb-2 text-sm text-muted">Los extras no entran en el porcentaje de los gastos compartidos.</p>
      <MonthSwitcher />
      {data.extrasThisMonth.map((extra) => (
        <Card key={extra.id} className="bg-[#fff1c9]">
          <p className="text-sm text-muted">
            {extra.label} · {shortDate(extra.receivedOn)}
          </p>
          <p className="text-3xl font-black">{formatMoney(extra.amount)}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <span>Repartido:</span>
            {extra.parts.length === 0 ? <span>sin repartir</span> : null}
            {extra.parts.map((part) => (
              <span key={`${part.label}-${part.amount}`} className="inline-flex items-center gap-1">
                <AppIcon name={part.icon} /> {formatMoney(part.amount)}
              </span>
            ))}
          </div>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-md">
            {extra.parts.map((part) => (
              <i key={part.label} style={{ width: `${(part.amount / extra.amount) * 100}%`, background: part.color }} />
            ))}
          </div>
        </Card>
      ))}
      <Card>
        <b className="inline-flex items-center gap-2">
          Mis fondos de ahorro <AppIcon name="piggy-bank" className="text-brand" />
        </b>
        {data.funds.length === 0 ? <p className="mt-2 text-sm text-muted">Todavía no armaste fondos.</p> : null}
        {data.funds.map((fund, index) => (
          <div key={fund.id} className="my-2">
            <div className="flex justify-between text-sm">
              <b>
                <AppIcon name={fund.icon} /> {fund.name}
              </b>
              <span className="text-muted">
                {formatMoney(fund.saved)} / {formatMoney(fund.target)}
              </span>
            </div>
            <div className="mt-1">
              <Progress value={fund.target === 0 ? 0 : (fund.saved / fund.target) * 100} color={FUND_COLORS[index % FUND_COLORS.length] ?? '#9ec9ff'} />
            </div>
          </div>
        ))}
        <Button type="button" variant="alt" className="mt-2 py-2 text-sm" onClick={() => setCreatingFund((current) => !current)}>
          + Nuevo fondo
        </Button>
        {creatingFund ? (
          <div className="mt-3">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" className="mb-2 w-full rounded-2xl bg-chip px-3 py-2 font-bold" />
            <IconPicker value={icon} onChange={setIcon} />
            <button type="button" className="mt-2 font-extrabold" onClick={() => setActiveFund('target')}>
              Meta: {formatMoney(amountFromDigits(targetDigits))}
            </button>
            <Button type="button" className="mt-2" onClick={() => void saveFund()} disabled={saving}>
              Guardar fondo
            </Button>
          </div>
        ) : null}
      </Card>
      <Card>
        <div className="flex justify-between">
          <b className="inline-flex items-center gap-2">
            <AppIcon name="bag-shopping" /> Gustos
          </b>
          <span className="text-sm text-muted">
            {formatMoney(Math.max(gustos.remaining, 0))} de {formatMoney(data.gustosAllocated)} libres
          </span>
        </div>
        <div className="mt-2">
          <Progress value={gustosUsed} color="#ff8fab" />
        </div>
      </Card>
      {gustos.level === 'low' ? (
        <Card className="bg-bad-bg text-sm">
          <b className="inline-flex items-center gap-1 text-bad">
            <AppIcon name="triangle-exclamation" /> Ojo:
          </b>{' '}
          te quedan {formatMoney(gustos.remaining)} de gustos. Si seguís, tocás tus fondos.
        </Card>
      ) : null}
      {gustos.level === 'over' ? (
        <Card className="bg-bad-bg text-sm">
          <b className="inline-flex items-center gap-1 text-bad">
            <AppIcon name="triangle-exclamation" /> Ojo:
          </b>{' '}
          se te acabaron los gustos y ya estás usando {formatMoney(Math.abs(gustos.remaining))} de tus fondos.
        </Card>
      ) : null}
      <Card>
        <b>Cargar un extra</b>
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Incentivo, guardia, venta…" className="mt-2 w-full rounded-2xl bg-chip px-3 py-2 font-bold" />
        <label className="mt-2 block text-sm font-bold text-muted">
          Fecha
          <input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} className="mt-1 w-full rounded-2xl bg-white px-3 py-2 font-bold text-ink" />
        </label>
        <button type="button" className="mt-2 text-2xl font-black" onClick={() => setActiveFund('extra')}>
          {formatMoney(amount)}
        </button>
        {data.funds.map((fund) => (
          <button key={fund.id} type="button" className="mt-1 block text-sm font-bold" onClick={() => setActiveFund(fund.id)}>
            <AppIcon name={fund.icon} /> {fund.name}: {formatMoney(amountFromDigits(fundAmounts[fund.id] ?? ''))}
            {activeFund === fund.id ? ' · editando' : ''}
          </button>
        ))}
        <p className="mt-1 text-sm text-muted">El resto va a gustos: {formatMoney(Math.max(gustosPart, 0))}</p>
        <div className="mt-2">
          <Keypad onKey={onKey} />
        </div>
        <Button type="button" variant="pink" className="mt-3" onClick={() => void saveExtra()} disabled={saving}>
          Repartir extra
        </Button>
        <ErrorText>{message}</ErrorText>
      </Card>
    </>
  )
}
