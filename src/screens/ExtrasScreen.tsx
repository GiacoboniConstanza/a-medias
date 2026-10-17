import { useEffect, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { ExtraSheet, FundSheet, GustoSheet, MoveSheet } from '../components/bag/forms.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { Card, Progress } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import type { BagMovementItem, ExtraItem, FundItem } from '../lib/api.ts'
import { monthBagSplit } from '../lib/bag.ts'
import { formatMoney } from '../lib/format.ts'
import { gustosStatus } from '../lib/gustos.ts'
import { shortDate } from '../lib/month.ts'

type MoveMode = 'to_fund' | 'to_gustos' | 'use'

export function ExtrasScreen() {
  const { profile } = useAuth()
  const { data, loading, error, refresh } = useFinance()
  const [fundOpen, setFundOpen] = useState(false)
  const [editing, setEditing] = useState<FundItem | null>(null)
  const [extraOpen, setExtraOpen] = useState(false)
  const [gustoOpen, setGustoOpen] = useState(false)
  const [moveMode, setMoveMode] = useState<MoveMode | null>(null)
  const [moveFund, setMoveFund] = useState<FundItem | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const userId = profile.id
  const householdId = profile.householdId
  const split = monthBagSplit(data.extrasThisMonth)
  const fundWidth = split.total > 0 ? (split.funds / split.total) * 100 : 0
  const gustosWidth = split.total > 0 ? (split.gustos / split.total) * 100 : 0
  const gustos = gustosStatus(data.gustosPool, Math.max(data.gustosPool - data.gustosFree, 0))
  const freeWidth = data.gustosPool > 0 ? Math.max(0, Math.min(100, (data.gustosFree / data.gustosPool) * 100)) : 0
  const history = historyRows(data.extrasThisMonth, data.movementsThisMonth)

  function saved(message: string) {
    setFundOpen(false)
    setExtraOpen(false)
    setGustoOpen(false)
    setMoveMode(null)
    setToast(message)
    void refresh()
  }

  function openFund(fund: FundItem | null) {
    setEditing(fund)
    setFundOpen(true)
  }

  function openMove(mode: MoveMode, fund: FundItem | null) {
    setMoveFund(fund)
    setMoveMode(mode)
  }

  return (
    <>
      <header className="mb-1 flex items-center justify-between gap-3">
        <h1 className="font-display text-[1.75rem] font-bold leading-tight">Bolsa de extras</h1>
        <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-card px-3 text-sm font-semibold text-text shadow-soft">
          <AppIcon name="lock" /> Solo vos
        </span>
      </header>
      <MonthSwitcher />

      <Card>
        <h2 className="font-display text-sm font-semibold text-muted">Tu bolsa este mes</h2>
        <p className="mt-1 font-display text-3xl font-bold leading-none">{formatMoney(split.total)}</p>
        <div
          className="my-2 flex h-2.5 overflow-hidden rounded-full bg-sand"
          role="img"
          aria-label={`Fondos ${formatMoney(split.funds)}, gustos ${formatMoney(split.gustos)}`}
        >
          <i className="h-full bg-primary" style={{ width: `${fundWidth}%` }} />
          <i className="h-full bg-warn" style={{ width: `${gustosWidth}%` }} />
        </div>
        <div className="flex justify-between gap-2 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <AppIcon name="circle" className="text-[8px] text-primary" /> Fondos {formatMoney(split.funds)}
          </span>
          <span className="inline-flex items-center gap-1">
            <AppIcon name="circle" className="text-[8px] text-warn" /> Gustos {formatMoney(split.gustos)}
          </span>
        </div>
        <button type="button" onClick={() => setExtraOpen(true)} className="mt-3 block min-h-[52px] w-full rounded-2xl bg-primary text-base font-semibold text-white">
          + Cargar un extra
        </button>
      </Card>

      <section className="mb-3" aria-labelledby="fondos-titulo">
        <h2 id="fondos-titulo" className="mb-2 font-display text-lg font-semibold">
          Mis fondos
        </h2>
        {data.funds.length === 0 ? <EmptyFunds /> : null}
        <div className="grid grid-cols-2 gap-3">
          {data.funds.map((fund) => (
            <article key={fund.id} className="flex flex-col rounded-3xl bg-card p-3 shadow-card">
              <button type="button" onClick={() => openFund(fund)} className="min-h-11 text-left">
                <span className="flex items-center gap-2">
                  <FundRing value={fund.target === 0 ? 0 : (fund.saved / fund.target) * 100} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-display text-sm font-semibold">
                      <AppIcon name={fund.icon} className="text-primary" />
                      <span className="truncate">{fund.name}</span>
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-muted">
                      {formatMoney(Math.max(fund.saved, 0))} de {formatMoney(fund.target)}
                    </span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => openMove('to_gustos', fund)}
                className="mt-2 min-h-11 rounded-2xl border-2 border-primary px-2 text-sm font-semibold text-primary"
              >
                Devolver a gustos
              </button>
              <button
                type="button"
                onClick={() => openMove('use', fund)}
                className="mt-2 min-h-11 rounded-2xl bg-sand px-2 text-sm font-semibold text-text"
              >
                Usar
              </button>
            </article>
          ))}
          <button
            type="button"
            onClick={() => openFund(null)}
            className="flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary bg-card px-3 text-base font-semibold text-primary"
          >
            <AppIcon name="plus" />
            Nuevo fondo
          </button>
        </div>
      </section>

      <Card>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-muted">
          <AppIcon name="bag-shopping" className="text-primary" /> Gustos
        </h2>
        <p className="mt-1 font-display text-xl font-semibold">
          Tenés {formatMoney(Math.max(data.gustosFree, 0))} para darte gustos
        </p>
        <div className="my-2">
          <Progress value={freeWidth} color="#F4C542" />
        </div>
        <p className="text-xs font-semibold text-muted">
          {data.gustosPool > 0
            ? `${formatMoney(Math.max(data.gustosFree, 0))} libres de ${formatMoney(data.gustosPool)}`
            : 'Cuando un extra no va a un fondo, queda acá.'}
        </p>
        <button
          type="button"
          onClick={() => setGustoOpen(true)}
          disabled={data.gustosFree <= 0}
          className="mt-3 block min-h-11 w-full rounded-2xl bg-primary text-sm font-semibold text-white disabled:opacity-50"
        >
          Me di un gusto
        </button>
        <button
          type="button"
          onClick={() => openMove('to_fund', null)}
          disabled={data.gustosFree <= 0 || data.funds.length === 0}
          className="mt-2 block min-h-11 w-full rounded-2xl border-2 border-primary bg-card text-sm font-semibold text-primary disabled:opacity-50"
        >
          Pasar a un fondo
        </button>
        {data.funds.length === 0 ? <p className="mt-2 text-sm font-semibold text-muted">Para pasar plata, primero creá un fondo.</p> : null}
      </Card>

      {gustos.level === 'low' ? (
        <Card className="bg-debt text-sm">
          <b className="inline-flex items-center gap-1 text-alert-ink">
            <AppIcon name="triangle-exclamation" /> Ojo:
          </b>{' '}
          te quedan {formatMoney(data.gustosFree)} para gustos.
        </Card>
      ) : null}

      <section className="mb-3">
        <button
          type="button"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((current) => !current)}
          className="flex min-h-11 w-full items-center justify-between rounded-3xl bg-card px-4 text-left shadow-card"
        >
          <span className="font-display text-base font-semibold">Historial de extras</span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
            {history.length === 0 ? 'Vacío' : history.length}
            <span>{historyOpen ? 'Ocultar' : 'Ver'}</span>
          </span>
        </button>
        {historyOpen ? (
          <div className="mt-2 rounded-3xl bg-card px-4 py-1 shadow-card">
            {history.length === 0 ? <p className="py-4 text-sm font-semibold text-muted">Todavía no hay movimientos este mes.</p> : null}
            <ul>
              {history.map((row) => (
                <li key={row.id} className="border-b border-dashed border-line py-3 last:border-0">
                  {row.kind === 'extra' ? <ExtraRow extra={row.extra} /> : <MovementRow movement={row.movement} />}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {toast ? (
        <p role="status" className="fixed bottom-28 left-1/2 z-50 max-w-[20rem] -translate-x-1/2 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-fab">
          {toast}
        </p>
      ) : null}

      <FundSheet open={fundOpen} fund={editing} userId={userId} onClose={() => setFundOpen(false)} onSaved={saved} />
      <ExtraSheet
        open={extraOpen}
        funds={data.funds}
        userId={userId}
        householdId={householdId}
        onClose={() => setExtraOpen(false)}
        onSaved={saved}
      />
      <GustoSheet
        open={gustoOpen}
        categories={data.categories}
        householdId={householdId}
        userId={userId}
        gustosFree={data.gustosFree}
        onClose={() => setGustoOpen(false)}
        onSaved={saved}
        onRefresh={refresh}
      />
      <MoveSheet
        open={moveMode !== null}
        mode={moveMode ?? 'to_fund'}
        funds={data.funds}
        fund={moveFund}
        gustosFree={data.gustosFree}
        onClose={() => setMoveMode(null)}
        onSaved={saved}
      />
    </>
  )
}

function FundRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const radius = 16
  const circ = 2 * Math.PI * radius
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0" role="img" aria-label={`${Math.round(pct)} por ciento de la meta`}>
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#F1E5D6" strokeWidth="5" />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="#4F6B57"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ}
        transform="rotate(-90 22 22)"
      />
    </svg>
  )
}

function EmptyFunds() {
  return (
    <div className="mb-3 rounded-3xl bg-card px-4 py-6 text-center shadow-card">
      <svg viewBox="0 0 160 110" className="mx-auto mb-2 h-24 w-36" aria-hidden="true">
        <ellipse cx="80" cy="96" rx="46" ry="8" fill="#EADCCB" />
        <rect x="48" y="38" width="64" height="46" rx="16" fill="#C7DDAE" />
        <path d="M48 54h64" stroke="#4F6B57" strokeWidth="4" />
        <circle cx="80" cy="28" r="10" fill="#F4C542" />
        <path d="M80 38v8" stroke="#4F6B57" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="font-display text-lg font-semibold">Todavía no tenés fondos</p>
      <p className="text-sm font-semibold text-muted">Un fondo junta plata para algo puntual. El resto queda para gustos.</p>
    </div>
  )
}

function ExtraRow({ extra }: { extra: ExtraItem }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold">{extra.label}</p>
          <p className="text-sm font-semibold text-muted">{shortDate(extra.receivedOn)}</p>
        </div>
        <p className="shrink-0 font-extrabold">{formatMoney(extra.amount)}</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-text">
        Repartido:{' '}
        {extra.parts.length === 0
          ? 'a gustos'
          : extra.parts.map((part) => `${part.label} ${formatMoney(part.amount)}`).join(' · ')}
      </p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-sand">
        {extra.parts.map((part) => (
          <i key={`${part.label}-${part.amount}`} className="h-full" style={{ width: `${(part.amount / extra.amount) * 100}%`, background: part.color }} />
        ))}
      </div>
    </>
  )
}

function MovementRow({ movement }: { movement: BagMovementItem }) {
  const copy =
    movement.kind === 'gusto'
      ? { title: movement.label || 'Gusto', detail: 'Me di un gusto' }
      : movement.kind === 'to_fund'
        ? { title: `A ${movement.fundName}`, detail: 'Pasaste de gustos' }
        : movement.kind === 'to_gustos'
          ? { title: `Desde ${movement.fundName}`, detail: 'Volvió a gustos' }
          : { title: movement.label || movement.fundName, detail: 'Usaste el fondo' }
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-1.5 font-extrabold">
          {movement.kind === 'gusto' ? <AppIcon name="bag-shopping" className="text-primary" /> : null}
          {copy.title}
        </p>
        <p className="text-sm font-semibold text-muted">
          {shortDate(movement.happenedOn)} · {copy.detail}
        </p>
      </div>
      <p className="shrink-0 font-extrabold">{formatMoney(movement.amount)}</p>
    </div>
  )
}

function historyRows(extras: ExtraItem[], movements: BagMovementItem[]) {
  const rows: ({ id: string; date: string } & (
    | { kind: 'extra'; extra: ExtraItem }
    | { kind: 'move'; movement: BagMovementItem }
  ))[] = [
    ...extras.map((extra) => ({ id: `extra-${extra.id}`, date: extra.receivedOn, kind: 'extra' as const, extra })),
    ...movements.map((movement) => ({
      id: `move-${movement.id}`,
      date: movement.happenedOn,
      kind: 'move' as const,
      movement,
    })),
  ]
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}
