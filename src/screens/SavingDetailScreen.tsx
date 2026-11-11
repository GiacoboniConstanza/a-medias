import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { EstrellaGouache } from '../components/Adornos.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { MoneyField } from '../components/MoneyField.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import {
  loadSavingMoves,
  setSavingArchived,
  updateSaving,
  type SavingItem,
  type SavingMove,
} from '../lib/api.ts'
import { partnerId } from '../lib/derive.ts'
import { amountFromDigits, formatMoney, moneyDraftFromAmount } from '../lib/format.ts'
import { evenMonthlyShare, goalPaceLine, monthsUntil, shareLabel } from '../lib/goal.ts'
import { monthKey, monthName, shortDate } from '../lib/month.ts'
import { movementSavingTitle } from '../lib/movement-row.ts'
import { savingBalances } from '../lib/saving-balance.ts'
import { savingPercent } from '../lib/savings.ts'

export function SavingDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { data, refresh } = useFinance()
  const navigate = useNavigate()
  const location = useLocation()
  const [moves, setMoves] = useState<SavingMove[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [monthsShown, setMonthsShown] = useState(12)

  useEffect(() => {
    if (!id) return
    let active = true
    loadSavingMoves(id)
      .then((rows) => {
        if (active) setMoves(rows)
      })
      .catch(() => {
        if (active) setMoves([])
      })
    return () => {
      active = false
    }
  }, [id, data?.savingMoves])

  const saving = data?.savings.find((item) => item.id === id) ?? null
  const meId = profile?.id ?? ''
  const history = useMemo(() => {
    if (!saving || !data || !meId) return { groups: [], hasMore: false }
    return buildHistory(saving, moves, data.names, meId, monthsShown)
  }, [saving, moves, data, meId, monthsShown])

  if (!profile || !data || !id) return <p className="py-16 text-center font-semibold text-muted">Cargando…</p>
  if (!saving) return <p className="py-16 text-center font-semibold text-tinta">No encontré ese ahorro.</p>

  const otherId = partnerId(data, meId)
  const partnerLabel = (otherId && data.names[otherId]) || 'tu compañera'
  const bal = savingBalances(saving.openings, moves)
  const pct = savingPercent(bal.total, saving.target)
  const months = saving.targetDate ? monthsUntil(saving.targetDate) : 0
  const remainingTarget = Math.max(0, (saving.target ?? 0) - bal.total)
  const pace =
    saving.isShared && saving.target != null && saving.targetDate
      ? goalPaceLine(saving.targetDate, months, evenMonthlyShare(remainingTarget, months))
      : ''

  return (
    <>
      <section className="scallop-b -mx-4 mb-4 bg-azul px-4 pb-4 pt-2 text-tinta">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Volver"
            className="-ml-3 inline-flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => navigate('/ahorros')}
          >
            <AppIcon name="chevron-left" />
          </button>
          <NotificationBell />
        </div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <h1 className="font-display text-[34px] font-semibold">{saving.name}</h1>
          <span className="inline-flex h-[var(--alto-chip)] items-center gap-1 rounded-full border-[1.5px] border-tinta bg-crema px-2.5 text-sm font-semibold">
            <AppIcon name={saving.isShared ? 'user-group' : 'lock'} />
            {saving.isShared ? `Con ${partnerLabel}` : 'Solo vos'}
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{saving.isShared ? 'Juntaron' : 'Hay'}</p>
            <p className="whitespace-nowrap font-display text-[36px] font-semibold leading-none">{formatMoney(bal.total)}</p>
          </div>
          <EstrellaGouache />
        </div>
        {saving.target != null && saving.target > 0 ? (
          <div className="mt-3">
            <div className="h-[10px] overflow-hidden rounded-full border-[1.5px] border-tinta bg-tarjeta">
              <div className="h-full border-r-[1.5px] border-tinta bg-mostaza" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-sm font-semibold text-tinta">
              {pct} % de {formatMoney(saving.target)}
              {saving.targetDate ? ` · para ${monthName(saving.targetDate)}` : ''}
            </p>
          </div>
        ) : null}
      </section>

      {saving.isShared ? (
        <section className="mb-4 rounded-2xl border-2 border-azul-ink bg-tarjeta p-4">
          <h2 className="font-display text-lg font-semibold text-tinta">Cuánto puso cada una</h2>
          <div className="mt-3 space-y-3">
            {[meId, otherId].filter(Boolean).map((uid) => {
              const amount = bal.byUser[uid!] ?? 0
              const label = uid === meId ? 'Vos' : partnerLabel
              const bar = uid === meId ? 'bg-rosa' : 'bg-salvia'
              const ink = uid === meId ? 'text-rosa-texto' : 'text-salvia-ink'
              const width = bal.total > 0 ? Math.round((amount / bal.total) * 100) : 0
              return (
                <div key={uid}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`font-display text-lg font-semibold ${ink}`}>{label}</p>
                    <p className="text-sm font-semibold text-tinta">
                      {formatMoney(amount)} · {shareLabel(amount, bal.total)}
                    </p>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-tarjeta">
                    <div className={`h-full border-r-[1.5px] border-tinta ${bar}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          {pace ? <p className="mt-3 text-sm font-semibold text-gris">{pace}</p> : null}
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-lg font-semibold text-tinta">Historial</h2>
        <div className="mt-2 space-y-4">
          {history.groups.map((group) => (
            <div key={group.label}>
              <h3 className="mb-1 text-sm font-semibold text-gris">{group.label}</h3>
              <ul>
                {group.rows.map((row) => (
                  <li
                    key={row.key}
                    className="flex min-h-[62px] items-center gap-3 border-b border-dashed border-linea-punteada py-2"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-azul-ink bg-azul-claro text-azul-ink">
                      <AppIcon name={row.icon} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-tinta">{row.title}</p>
                      <p className="text-sm font-semibold text-gris">{row.subtitle}</p>
                    </div>
                    <p className="whitespace-nowrap font-display text-lg font-semibold text-tinta">{row.amount}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {history.hasMore ? (
          <button
            type="button"
            className="mt-2 flex min-h-12 w-full items-center justify-center font-bold text-mostaza-ink"
            onClick={() => setMonthsShown((n) => n + 12)}
          >
            Ver meses anteriores
          </button>
        ) : null}
      </section>

      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="mt-6 flex min-h-12 w-full items-center justify-between rounded-2xl px-1 font-bold text-mostaza-ink"
      >
        <span className="inline-flex items-center gap-2">
          <AppIcon name="pen" /> Editar ahorro
        </span>
        <AppIcon name="chevron-right" />
      </button>

      <FabSpace avisos={Boolean(toast)} />
      <Fab
        to="/cargar"
        label={`Cargar un movimiento en ${saving.name}`}
        state={{ from: location.pathname, tipo: 'ahorro', savingId: saving.id }}
      />
      <Toast aboveFab onDone={() => setToast('')}>
        {toast}
      </Toast>

      <EditSavingSheet
        open={editOpen}
        saving={saving}
        balance={bal.total}
        partnerLabel={partnerLabel}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await refresh()
          setEditOpen(false)
          setToast('Cambios guardados')
        }}
        onArchived={async () => {
          await refresh()
          setEditOpen(false)
          navigate('/ahorros')
        }}
      />
    </>
  )
}

function EditSavingSheet({
  open,
  saving,
  balance,
  partnerLabel,
  onClose,
  onSaved,
  onArchived,
}: {
  open: boolean
  saving: SavingItem
  balance: number
  partnerLabel: string
  onClose: () => void
  onSaved: () => void | Promise<void>
  onArchived: () => void | Promise<void>
}) {
  const [name, setName] = useState(saving.name)
  const [icon, setIcon] = useState(saving.icon)
  const [digits, setDigits] = useState(moneyDraftFromAmount(saving.target))
  const [targetDate, setTargetDate] = useState(saving.targetDate ?? '')
  const [error, setError] = useState('')
  const [savingBusy, setSavingBusy] = useState(false)
  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setName(saving.name)
      setIcon(saving.icon)
      setDigits(moneyDraftFromAmount(saving.target))
      setTargetDate(saving.targetDate ?? '')
      setError('')
    }
  }

  const canArchive = balance === 0

  async function save() {
    if (!name.trim()) {
      setError('Poné un nombre.')
      return
    }
    const target = amountFromDigits(digits)
    setSavingBusy(true)
    try {
      await updateSaving({
        id: saving.id,
        name,
        icon,
        target: target > 0 ? target : null,
        targetDate: targetDate || null,
      })
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar.')
    } finally {
      setSavingBusy(false)
    }
  }

  async function archive() {
    if (!canArchive) return
    setSavingBusy(true)
    try {
      await setSavingArchived(saving.id, true)
      await onArchived()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude archivar.')
    } finally {
      setSavingBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Editar ahorro"
      onClose={onClose}
      footer={
        <Button type="button" tall disabled={savingBusy} onClick={() => void save()}>
          Guardar cambios
        </Button>
      }
    >
      <label className="block text-sm font-semibold text-gris">
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={`mt-1 ${inputClass}`} />
      </label>
      <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-gris">
        <AppIcon name={saving.isShared ? 'user-group' : 'lock'} className="mt-0.5" />
        <span>
          {saving.isShared ? `Con ${partnerLabel}` : 'Solo vos'}. Para cambiar con quién es, creá otro ahorro.
        </span>
      </p>
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-gris">Ícono</p>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div className="mt-4">
        <MoneyField label="Meta (opcional)" draft={digits} onDraft={setDigits} size="form" />
      </div>
      <label className="mt-4 block text-sm font-semibold text-gris">
        Para cuándo (opcional)
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={`mt-1 ${inputClass}`} />
      </label>
      <button
        type="button"
        aria-disabled={!canArchive || undefined}
        disabled={!canArchive || savingBusy}
        onClick={() => void archive()}
        className={`mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold ${
          canArchive
            ? 'border-[1.5px] border-azul-ink bg-tarjeta text-tinta'
            : 'border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado text-gris'
        }`}
      >
        <AppIcon name="box-archive" /> Archivar ahorro
      </button>
      {!canArchive ? (
        <p className="mt-2 text-sm font-semibold text-gris">
          {saving.isShared
            ? 'Para archivarlo, primero retiren lo que queda.'
            : 'Para archivarlo, primero retirá lo que queda.'}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
          <AppIcon name="circle-exclamation" /> {error}
        </p>
      ) : null}
    </Sheet>
  )
}

function buildHistory(
  saving: SavingItem,
  moves: SavingMove[],
  names: Record<string, string>,
  meId: string,
  monthsShown: number,
) {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - (monthsShown - 1))
  const cutoffKey = monthKey(cutoff)

  type Row = { key: string; title: string; subtitle: string; amount: string; icon: string; sort: string; month: string }
  const rows: Row[] = []

  for (const move of moves) {
    const month = move.spentOn.slice(0, 7) + '-01'
    if (month < cutoffKey) continue
    const title = movementSavingTitle({ title: move.title, savingName: saving.name, kind: move.kind })
    const who = move.userId === meId ? 'Vos' : names[move.userId] ?? 'Alguien'
    const day = `${weekdayName(move.spentOn)} ${Number(move.spentOn.slice(8, 10))}`
    const subtitle = saving.isShared
      ? `${who} · ${day}`
      : `${move.kind === 'aporte' ? 'Aporte' : 'Retiro'} · ${day}`
    // en propio con título custom, bajada sin "Aporte" duplicado si título != tipo
    const ownSubtitle = saving.isShared
      ? subtitle
      : move.title?.trim()
        ? `${move.kind === 'retiro' ? 'Retiro' : 'Aporte'} · ${day}`
        : day
    rows.push({
      key: move.id,
      title: saving.isShared || move.title?.trim() ? title : move.kind === 'aporte' ? 'Aporte' : 'Retiro',
      subtitle: saving.isShared ? subtitle : ownSubtitle,
      amount: `${move.kind === 'aporte' ? '+' : '−'}${formatMoney(move.amount)}`,
      icon: move.kind === 'aporte' ? 'arrow-right-to-bracket' : 'arrow-right-from-bracket',
      sort: move.spentOn,
      month,
    })
  }

  const openingRows: Row[] = saving.openings.map((opening) => ({
    key: `open-${opening.userId}`,
    title: saving.isShared ? names[opening.userId] ?? 'Alguien' : 'Saldo inicial',
    subtitle: 'Lo que ya había',
    amount: formatMoney(opening.amount),
    icon: 'flag',
    sort: '0000-00-00',
    month: 'Saldo inicial',
  }))

  const byMonth = new Map<string, Row[]>()
  for (const row of rows.sort((a, b) => b.sort.localeCompare(a.sort))) {
    const label = monthName(row.month)
    const list = byMonth.get(label) ?? []
    list.push(row)
    byMonth.set(label, list)
  }

  const groups = [...byMonth.entries()].map(([label, groupRows]) => ({ label, rows: groupRows }))
  if (openingRows.length) groups.push({ label: 'Saldo inicial', rows: openingRows })

  const oldestMove = moves.map((m) => m.spentOn.slice(0, 7) + '-01').sort()[0]
  const hasMore = Boolean(oldestMove && oldestMove < cutoffKey)

  return { groups, hasMore }
}

function weekdayName(iso: string): string {
  try {
    const label = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Catamarca' }).format(
      new Date(`${iso}T12:00:00`),
    )
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch {
    return shortDate(iso)
  }
}
