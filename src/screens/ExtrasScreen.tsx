import { useEffect, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { ExtraSheet, FundSheet, GustoSheet, MoveSheet } from '../components/bag/forms.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { PotPlant } from '../components/Plant.tsx'
import { AudiencePill, SectionHeader } from '../components/SectionHeader.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { Card } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { saveViewMode, type BagMovementItem, type ExtraItem, type FundItem } from '../lib/api.ts'
import { monthBagSplit } from '../lib/bag.ts'
import { formatMoney } from '../lib/format.ts'
import { gustosStatus } from '../lib/gustos.ts'
import { monthName, shortDate } from '../lib/month.ts'
import type { ViewMode } from '../types/database.ts'

type MoveMode = 'to_fund' | 'to_gustos' | 'use'

export function ExtrasScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [fundOpen, setFundOpen] = useState(false)
  const [editing, setEditing] = useState<FundItem | null>(null)
  const [extraOpen, setExtraOpen] = useState(false)
  const [gustoOpen, setGustoOpen] = useState(false)
  const [moveMode, setMoveMode] = useState<MoveMode | null>(null)
  const [moveFund, setMoveFund] = useState<FundItem | null>(null)
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

  async function changeMode(mode: ViewMode) {
    if (!profile) return
    await saveViewMode(profile.id, mode)
    await refreshProfile()
  }

  const latestExtra = [...data.extrasThisMonth].sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))[0]

  return (
    <>
      <SectionHeader icon="bag-shopping" title="Bolsa" aside={<AudiencePill icon="lock">Solo vos</AudiencePill>} />
      <MonthSwitcher heading />
      <ViewToggle mode={profile.viewMode} onChange={(mode) => void changeMode(mode)} className="mb-3" />

      <Card>
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-muted">
          <AppIcon name="sun" className="text-warn" /> Extras de {monthName(month)}
        </h2>
        <p className="mt-1 font-display text-[26px] font-bold leading-none text-alert-ink">{formatMoney(split.total)}</p>
        {latestExtra ? (
          <p className="mt-1 text-xs font-semibold text-muted">
            {data.extrasThisMonth.length === 1
              ? `${latestExtra.label} · ${shortDate(latestExtra.receivedOn)}`
              : `${data.extrasThisMonth.length} extras este mes`}
          </p>
        ) : null}
        <div
          className="my-2 flex h-2.5 overflow-hidden rounded-md bg-sand"
          role="img"
          aria-label={`A tus fondos ${formatMoney(split.funds)}, a gustos ${formatMoney(split.gustos)}`}
        >
          <i className="h-full bg-sage-light" style={{ width: `${fundWidth}%` }} />
          <i className="h-full bg-blush" style={{ width: `${gustosWidth}%` }} />
        </div>
        <div className="flex justify-between gap-2 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <AppIcon name="circle" className="text-[8px] text-sage-light" /> A tus fondos {formatMoney(split.funds)}
          </span>
          <span className="inline-flex items-center gap-1">
            <AppIcon name="circle" className="text-[8px] text-blush" /> A gustos {formatMoney(split.gustos)}
          </span>
        </div>
        <button type="button" onClick={() => setExtraOpen(true)} className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-white">
          <AppIcon name="plus" /> Cargar un extra
        </button>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 id="fondos-titulo" className="flex items-center gap-1.5 font-display text-sm font-semibold text-muted">
            <AppIcon name="seedling" className="text-good" /> Mis fondos
          </h2>
          {data.funds.length > 0 ? (
            <button type="button" onClick={() => openFund(null)} className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-primary">
              <AppIcon name="plus" /> Nuevo fondo
            </button>
          ) : null}
        </div>
        {data.funds.length === 0 ? (
          <EmptyFunds onCreate={() => openFund(null)} />
        ) : (
          <div className="mt-1 grid grid-cols-3 gap-2">
            {data.funds.map((fund) => {
              const percent = fundPercent(fund.saved, fund.target)
              return (
                <article key={fund.id} className="min-w-0 text-center">
                  <button type="button" onClick={() => openFund(fund)} className="w-full min-h-11" aria-label={`Editar ${fund.name}`}>
                    <PotPlant variant="fondo" progress={percent} className="mx-auto aspect-[92/104] w-full max-w-[92px]" />
                    <b className="mt-0.5 block truncate text-sm">{fund.name}</b>
                    <span className="block font-display text-[15px] font-bold leading-tight text-primary">{percent}%</span>
                    <span className="block text-xs font-semibold text-muted">{formatMoney(Math.max(fund.saved, 0))}</span>
                  </button>
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" onClick={() => openMove('use', fund)} className="min-h-11 px-1 text-xs font-extrabold text-primary">
                      Usar
                    </button>
                    <button type="button" onClick={() => openMove('to_gustos', fund)} className="min-h-11 px-1 text-xs font-extrabold text-primary">
                      A gustos
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-3.5">
          <PotPlant variant="gustos" progress={freeWidth} className="h-[58px] w-[58px] shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-semibold text-muted">Gustos</h2>
            <p className="font-display text-[19px] font-bold leading-tight">Te quedan {formatMoney(Math.max(data.gustosFree, 0))}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F2EADF]" role="img" aria-label={`${Math.round(freeWidth)} por ciento libre`}>
              <div className="h-full rounded-full bg-[#E98C9E]" style={{ width: `${freeWidth}%` }} />
            </div>
            <p className="mt-1 text-xs font-semibold text-muted">
              {data.gustosPool > 0
                ? `de ${formatMoney(data.gustosPool)} de este mes`
                : 'Cuando un extra no va a un fondo, queda acá.'}
            </p>
          </div>
        </div>
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

      <Card className="px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 py-1 font-display text-sm font-semibold text-muted">
          <AppIcon name="clock-rotate-left" className="text-muted" /> Movimientos
        </h2>
        {history.length === 0 ? <p className="py-3 text-sm font-semibold text-muted">Todavía no hay movimientos este mes.</p> : null}
        <ul>
          {history.map((row) => (
            <li key={row.id}>{row.kind === 'extra' ? <ExtraRow extra={row.extra} /> : <MovementRow movement={row.movement} />}</li>
          ))}
        </ul>
      </Card>

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

function fundPercent(saved: number, target: number): number {
  if (target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((saved / target) * 100)))
}

function EmptyFunds({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="px-2 py-4 text-center">
      <PotPlant variant="fondo" progress={0} className="mx-auto aspect-[92/104] w-[92px]" />
      <p className="mt-1 text-sm font-semibold text-muted">Un fondo junta plata para algo puntual.</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-white"
      >
        <AppIcon name="plus" /> Crear el primer fondo
      </button>
    </div>
  )
}

function ExtraRow({ extra }: { extra: ExtraItem }) {
  const split =
    extra.parts.length === 0 ? 'A gustos' : extra.parts.map((part) => `${part.label} ${formatMoney(part.amount)}`).join(' · ')
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-line py-2.5 last:border-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF1C2] text-alert-ink">
        <AppIcon name="sun" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{extra.label}</p>
        <p className="text-xs font-semibold text-muted">
          {shortDate(extra.receivedOn)} · {split}
        </p>
      </div>
      <p className="shrink-0 font-display text-[15px] font-bold text-good">+ {formatMoney(extra.amount)}</p>
    </div>
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
  const outgoing = movement.kind === 'gusto' || movement.kind === 'use'
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-line py-2.5 last:border-0">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${movement.kind === 'gusto' ? 'bg-[#FCE6EA] text-alert-ink' : 'bg-sage-light text-primary'}`}>
        <AppIcon name={movement.kind === 'gusto' ? 'bag-shopping' : 'seedling'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{copy.title}</p>
        <p className="text-xs font-semibold text-muted">
          {shortDate(movement.happenedOn)} · {copy.detail}
        </p>
      </div>
      <p className={`shrink-0 font-display text-[15px] font-bold ${outgoing ? 'text-text' : 'text-good'}`}>
        {outgoing ? '−' : '+'} {formatMoney(movement.amount)}
      </p>
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
