import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { ExtraSheet, FundSheet, GustoSheet, MoveSheet } from '../components/bag/forms.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { ContributeSheet } from '../components/ContributeSheet.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { amountFromDigits } from '../lib/format.ts'
import { MoneyField } from '../components/MoneyField.tsx'
import { PotPlant } from '../components/Plant.tsx'
import { ScopeChips } from '../components/ScopeChips.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, Chip, ErrorText, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import {
  contributeToGoal,
  createFund,
  createGoal,
  restoreSharedGoal,
  setFundArchived,
  setGoalArchived,
  updateGoal,
  type FundItem,
  type GoalItem,
} from '../lib/api.ts'
import { monthSplit, partnerId } from '../lib/derive.ts'
import type { ScopeFilter } from '../lib/finance-filters.ts'
import { formatMoney, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import { contributionInMonth, evenMonthlyShare, goalPaceLine, goalPhrase, monthsUntil, salaryShare } from '../lib/goal.ts'
import { gustosStatus } from '../lib/gustos.ts'
import { monthName, shortDate, todayISO } from '../lib/month.ts'
import {
  filterSavings,
  rememberedSavingsScope,
  SAVINGS_SCOPE_STORAGE_KEY,
  savingPercent,
  savingSources,
  scopeFromSearch,
} from '../lib/savings.ts'

type MoveMode = 'to_fund' | 'to_gustos' | 'use'
type SavingDraft = { name: string; icon: string; target: number; targetDate: string | null }
type ArchivedRow = { id: string; name: string; shared: boolean; saved: number; archivedAt: string }

export function SavingsScreen() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [params, setParams] = useSearchParams()
  const [scope, setScope] = useState<ScopeFilter>(() => rememberedSavingsScope(readStoredScope(), params.get('alcance')))
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FundItem | null>(null)
  const [extraOpen, setExtraOpen] = useState(false)
  const [gustoOpen, setGustoOpen] = useState(false)
  const [moveMode, setMoveMode] = useState<MoveMode | null>(null)
  const [moveFund, setMoveFund] = useState<FundItem | null>(null)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmFund, setConfirmFund] = useState<FundItem | null>(null)
  const [pendingCreate, setPendingCreate] = useState<SavingDraft | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [archivedHistory, setArchivedHistory] = useState<ArchivedRow | null>(null)
  const [restoreSwap, setRestoreSwap] = useState<ArchivedRow | null>(null)
  const [toast, setToast] = useState('')
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const fromUrl = scopeFromSearch(params.get('alcance'))
    if (!fromUrl) return
    setScope(fromUrl)
    setParams({}, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    try {
      localStorage.setItem(SAVINGS_SCOPE_STORAGE_KEY, scope)
    } catch {
      // Si el navegador no guarda, el filtro queda en esta visita.
    }
  }, [scope])

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center text-base font-semibold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center text-base font-semibold text-tinta">{error}</p>

  const userId = profile.id
  const activeFunds = data.funds.filter((fund) => !fund.archivedAt)
  const rows = filterSavings(savingSources(activeFunds, data.goal), scope)
  const archivedRows = filterSavings(archivedSources(data.archivedGoals, data.funds), scope)
  const showPrivateActions = scope !== 'shared'
  const gustos = gustosStatus(data.gustosPool, Math.max(data.gustosPool - data.gustosFree, 0))
  const goal = data.goal
  const saved = goal ? goal.byUser.reduce((sum, item) => sum + item.amount, 0) : 0
  const remaining = Math.max((goal?.target ?? 0) - saved, 0)
  const months = goal?.targetDate ? monthsUntil(goal.targetDate) : 0
  const myPercent = monthSplit(data).rows.find((row) => row.id === userId)?.percent ?? 50
  const suggested = goal ? salaryShare(remaining, months, myPercent) : null
  const pace = goal ? goalPaceLine(goal.targetDate, months, evenMonthlyShare(remaining, months)) : ''
  const monthContributions = (goal?.contributions ?? []).filter((item) => contributionInMonth(item.createdAt, month))
  const partnerName = data.names[partnerId(data, userId) ?? ''] ?? 'tu compañera'
  const emptyCopy =
    scope === 'shared'
      ? 'Todavía no hay ahorros compartidos.'
      : scope === 'private'
        ? 'Todavía no hay ahorros privados.'
        : 'Todavía no hay ahorros.'

  function notify(message: string, revert: (() => Promise<void>) | null) {
    setUndo(() => revert)
    setToast(message)
  }

  function savedNotice(message: string) {
    setCreating(false)
    setEditing(null)
    setExtraOpen(false)
    setGustoOpen(false)
    setMoveMode(null)
    setActionError('')
    notify(message, null)
    void refresh()
  }

  function openMove(mode: MoveMode, fund: FundItem | null) {
    setMoveFund(fund)
    setMoveMode(mode)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setActionError('')
    try {
      await action()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'No pude guardar el cambio.')
    } finally {
      setBusy(false)
    }
  }

  async function archiveShared() {
    if (!goal) return
    const current = goal
    await run(async () => {
      await setGoalArchived(current.id, new Date().toISOString())
      setConfirmArchive(false)
      setMenuOpen(false)
      notify(`Archivaste «${current.name}»`, async () => {
        await setGoalArchived(current.id, null)
        await refresh()
      })
      await refresh()
    })
  }

  async function archivePrivate() {
    if (!confirmFund) return
    const fund = confirmFund
    await run(async () => {
      await setFundArchived(fund.id, new Date().toISOString())
      setConfirmFund(null)
      setEditing(null)
      notify(`Archivaste «${fund.name}»`, async () => {
        await setFundArchived(fund.id, null)
        await refresh()
      })
      await refresh()
    })
  }

  async function createReplacing() {
    if (!pendingCreate || !goal) return
    const previous = goal
    const draft = pendingCreate
    await run(async () => {
      await createGoal(draft)
      setPendingCreate(null)
      setCreating(false)
      notify(`Creaste «${draft.name.trim()}». Archivamos «${previous.name}».`, async () => {
        await restoreSharedGoal(previous.id)
        await refresh()
      })
      await refresh()
    })
  }

  async function restoreRow(row: ArchivedRow) {
    if (row.shared && goal) {
      setRestoreSwap(row)
      return
    }
    await run(async () => {
      if (row.shared) await setGoalArchived(row.id, null)
      else await setFundArchived(row.id, null)
      setArchivedHistory(null)
      notify(`Restauraste «${row.name}»`, async () => {
        const stamp = new Date().toISOString()
        if (row.shared) await setGoalArchived(row.id, stamp)
        else await setFundArchived(row.id, stamp)
        await refresh()
      })
      await refresh()
    })
  }

  async function restoreReplacing() {
    if (!restoreSwap || !goal) return
    const previous = goal
    const row = restoreSwap
    await run(async () => {
      await restoreSharedGoal(row.id)
      setRestoreSwap(null)
      setArchivedHistory(null)
      notify(`Restauraste «${row.name}»`, async () => {
        await restoreSharedGoal(previous.id)
        await refresh()
      })
      await refresh()
    })
  }

  return (
    <>
      <SectionHeader lead="crumb" aside={<NotificationBell />} />
      <ScopeChips value={scope} onChange={setScope} />

      {rows.length === 0 ? <p className="mb-3 text-base font-semibold text-muted">{emptyCopy}</p> : null}
      <ul aria-label="Ahorros">
        {rows.map((row) => {
          const percent = savingPercent(row.saved, row.target)
          const fund = activeFunds.find((item) => item.id === row.id) ?? null
          return (
            <li key={row.id} className="mb-3 rounded-2xl bg-card p-4 border-2 border-azul-ink">
              <div className="flex items-center gap-3">
                <PotPlant variant="fondo" progress={percent} className="h-11 w-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 font-display text-lg font-semibold">{row.name}</h2>
                    <ScopeTag shared={row.shared} />
                  </div>
                  <p className="mt-2 whitespace-nowrap text-sm font-medium text-gris">
                    <span className="font-display text-lg font-semibold text-tinta">{formatMoney(row.saved)}</span> de{' '}
                    <span className="font-display text-sm font-semibold">{formatMoney(row.target)}</span>
                  </p>
                  <p className="text-base text-muted">
                    {row.shared ? goalPhrase(row.saved, row.target) : `Vas por el ${percent}%.`}
                  </p>
                </div>
              </div>
              {row.shared && goal ? (
                <div className="mt-2">
                  {pace ? <p className="text-base text-muted">{pace}</p> : null}
                  <p className="text-base text-muted">{partnerName} ve tu aporte, no tus ahorros privados.</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <button type="button" className="min-h-11 text-base font-semibold text-mostaza-ink" onClick={() => setContributeOpen(true)}>
                      Sumar
                    </button>
                    <button
                      type="button"
                      className="min-h-11 text-base font-semibold text-mostaza-ink"
                      aria-expanded={historyOpen}
                      onClick={() => setHistoryOpen((current) => !current)}
                    >
                      {historyOpen ? 'Ocultar aportes' : 'Ver aportes'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Más acciones de ${row.name}`}
                      className="grid h-11 w-11 place-items-center rounded-full text-title"
                      onClick={() => setMenuOpen(true)}
                    >
                      <AppIcon name="ellipsis" />
                    </button>
                  </div>
                  {historyOpen ? <ContributionList names={data.names} month={month} rows={monthContributions} /> : null}
                </div>
              ) : fund ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 text-base font-semibold text-mostaza-ink" onClick={() => setEditing(fund)}>
                    Editar
                  </button>
                  <button type="button" className="min-h-11 text-base font-semibold text-mostaza-ink" onClick={() => openMove('use', fund)}>
                    Usar
                  </button>
                  <button type="button" className="min-h-11 text-base font-semibold text-mostaza-ink" onClick={() => openMove('to_gustos', fund)}>
                    A gustos
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {archivedRows.length > 0 ? (
        <section className="mt-5">
          <button
            type="button"
            aria-expanded={archivedOpen}
            className="flex min-h-11 w-full items-center gap-3 rounded-2xl bg-salvia-claro px-4 py-3"
            onClick={() => setArchivedOpen((current) => !current)}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] border-tinta bg-mostaza text-tinta">
              <AppIcon name="box-archive" />
            </span>
            <span className="flex-1 text-left text-base font-bold text-title">Archivados</span>
            <span className="rounded-full bg-card px-2.5 py-1 text-base font-bold text-title">{archivedRows.length}</span>
            <AppIcon
              name="chevron-down"
              className={`text-mostaza-ink transition-transform motion-reduce:transition-none ${archivedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {archivedOpen ? (
            <ul className="mt-2.5 space-y-2.5" aria-label="Ahorros archivados">
              {archivedRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full flex-col items-start rounded-2xl bg-card px-4 py-3 text-left border-2 border-azul-ink"
                    onClick={() => setArchivedHistory(row)}
                  >
                    <span className="text-base font-semibold">{row.name}</span>
                    <span className="text-base text-muted">
                      {formatMoney(row.saved)} · archivado el {archivedOn(row.archivedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <Button type="button" className="mt-3" onClick={() => setCreating(true)}>
        Nuevo ahorro
      </Button>

      {showPrivateActions ? (
        <div className="mt-3 rounded-2xl bg-sand-soft p-4">
          <p className="text-sm font-medium text-tinta">
            Para gustos te quedan <span className="whitespace-nowrap font-display font-semibold">{formatMoney(Math.max(data.gustosFree, 0))}</span>.
          </p>
          <button type="button" className="mt-0.5 block min-h-11 text-sm font-bold text-mostaza-ink" onClick={() => setExtraOpen(true)}>
            Cargar un extra
          </button>
          <GustosAction
            label="Me di un gusto"
            reason={data.gustosFree <= 0 ? 'No te queda plata para gustos.' : ''}
            onClick={() => setGustoOpen(true)}
          />
          <GustosAction
            label="Pasar a un fondo"
            reason={data.gustosFree <= 0 ? 'No te queda plata para gustos.' : activeFunds.length === 0 ? 'Primero creá un fondo.' : ''}
            onClick={() => openMove('to_fund', null)}
          />
        </div>
      ) : null}
      {showPrivateActions && gustos.level === 'low' ? (
        <Card className="mt-3 bg-rosa-claro text-base">
          <b className="inline-flex items-center gap-1 text-tinta">
            <AppIcon name="triangle-exclamation" /> Ojo:
          </b>{' '}
          te quedan {formatMoney(data.gustosFree)} para gustos.
        </Card>
      ) : null}

      <ErrorText>{actionError}</ErrorText>
      <Toast
        onDone={() => {
          setToast('')
          setUndo(null)
        }}
        onUndo={
          undo
            ? async () => {
                try {
                  await undo()
                } catch (caught) {
                  setActionError(caught instanceof Error ? caught.message : 'No pude deshacer.')
                  return false
                }
              }
            : undefined
        }
      >
        {toast}
      </Toast>
      <NewSavingSheet
        open={creating}
        goalExists={Boolean(goal)}
        userId={userId}
        onClose={() => setCreating(false)}
        onSaved={savedNotice}
        onAskReplace={setPendingCreate}
      />
      <FundSheet
        open={editing !== null}
        fund={editing}
        userId={userId}
        onClose={() => setEditing(null)}
        onSaved={savedNotice}
        onArchive={editing ? () => setConfirmFund(editing) : undefined}
      />
      <ExtraSheet
        open={extraOpen}
        funds={activeFunds}
        userId={userId}
        householdId={profile.householdId}
        onClose={() => setExtraOpen(false)}
        onSaved={savedNotice}
      />
      <GustoSheet
        open={gustoOpen}
        categories={data.categories}
        householdId={profile.householdId}
        userId={userId}
        gustosFree={data.gustosFree}
        onClose={() => setGustoOpen(false)}
        onSaved={savedNotice}
        onRefresh={refresh}
      />
      <MoveSheet
        open={moveMode !== null}
        mode={moveMode ?? 'to_fund'}
        funds={activeFunds}
        fund={moveFund}
        gustosFree={data.gustosFree}
        onClose={() => setMoveMode(null)}
        onSaved={savedNotice}
      />
      {goal ? (
        <ContributeSheet
          open={contributeOpen}
          suggested={suggested}
          onClose={() => setContributeOpen(false)}
          onSaved={async (amount, mode) => {
            await contributeToGoal({ goalId: goal.id, userId, amount, mode })
            await refresh()
            setContributeOpen(false)
            notify('Listo, sumaste al ahorro.', null)
          }}
        />
      ) : null}
      {goal ? (
        <Sheet open={menuOpen} title={goal.name} onClose={() => setMenuOpen(false)}>
          <button
            type="button"
            className="flex min-h-11 w-full items-center text-left text-base font-semibold"
            onClick={() => {
              setMenuOpen(false)
              setEditingGoal(true)
            }}
          >
            Editar nombre y meta
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 text-left text-base font-semibold text-title"
            onClick={() => setConfirmArchive(true)}
          >
            <AppIcon name="box-archive" /> Archivar ahorro
          </button>
          <p className="mt-3 text-base text-muted">Compartido con {partnerName}. Cualquiera de las dos puede cambiarlo.</p>
        </Sheet>
      ) : null}
      {goal ? (
        <GoalEditSheet
          open={editingGoal}
          goal={goal}
          saved={saved}
          onClose={() => setEditingGoal(false)}
          onSaved={async () => {
            setEditingGoal(false)
            notify('Listo, actualicé el ahorro.', null)
            await refresh()
          }}
        />
      ) : null}
      {goal ? (
        <ConfirmSheet
          open={confirmArchive}
          title={`¿Archivar «${goal.name}»?`}
          confirmLabel="Archivar"
          disabled={busy}
          onClose={() => setConfirmArchive(false)}
          onConfirm={() => void archiveShared()}
        >
          Se archiva para las dos. Los aportes quedan guardados y lo ves en Archivados, al final de Ahorros.
        </ConfirmSheet>
      ) : null}
      {confirmFund ? (
        <ConfirmSheet
          open
          title={`¿Archivar «${confirmFund.name}»?`}
          confirmLabel="Archivar"
          disabled={busy}
          onClose={() => setConfirmFund(null)}
          onConfirm={() => void archivePrivate()}
        >
          Los aportes quedan guardados y lo ves en Archivados, al final de Ahorros.
        </ConfirmSheet>
      ) : null}
      {pendingCreate && goal ? (
        <ConfirmSheet
          open
          title="¿Cambiar el ahorro compartido?"
          confirmLabel={`Archivar «${goal.name}» y crear`}
          disabled={busy}
          onClose={() => setPendingCreate(null)}
          onConfirm={() => void createReplacing()}
        >
          Para crear uno nuevo, archivamos «{goal.name}».
        </ConfirmSheet>
      ) : null}
      {archivedHistory ? (
        <Sheet
          open
          title="Ver aportes"
          onClose={() => setArchivedHistory(null)}
          footer={
            <Button type="button" tall variant="alt" disabled={busy} onClick={() => void restoreRow(archivedHistory)}>
              Restaurar ahorro
            </Button>
          }
        >
          <ArchivedContributions row={archivedHistory} names={data.names} goals={data.archivedGoals} />
        </Sheet>
      ) : null}
      {restoreSwap && goal ? (
        <ConfirmSheet
          open
          title="¿Cambiar el ahorro compartido?"
          confirmLabel={`Archivar «${goal.name}» y restaurar`}
          disabled={busy}
          onClose={() => setRestoreSwap(null)}
          onConfirm={() => void restoreReplacing()}
        >
          Solo puede haber uno activo. Para restaurar «{restoreSwap.name}», archivamos «{goal.name}». Sus aportes quedan guardados.
        </ConfirmSheet>
      ) : null}
    </>
  )
}

function ArchivedContributions({
  row,
  names,
  goals,
}: {
  row: ArchivedRow
  names: Record<string, string>
  goals: GoalItem[]
}) {
  const goal = goals.find((item) => item.id === row.id) ?? null
  if (!goal) {
    return (
      <p className="text-base text-muted">
        {formatMoney(row.saved)} guardados. Archivado el {archivedOn(row.archivedAt)}.
      </p>
    )
  }
  return (
    <>
      <p className="mb-2 text-base text-muted">Archivado el {archivedOn(row.archivedAt)}.</p>
      {goal.contributions.length === 0 ? <p className="text-base text-muted">No tiene aportes.</p> : null}
      <ul>
        {goal.contributions.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 border-b border-dashed border-line py-2 last:border-0">
            <span className="text-base">{names[item.userId] ?? 'Alguien'}</span>
            <span className="text-base text-muted">{shortDate(todayISO(new Date(item.createdAt)))}</span>
            <span className="whitespace-nowrap text-base font-semibold">{formatMoney(item.amount)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function ContributionList({
  names,
  month,
  rows,
}: {
  names: Record<string, string>
  month: string
  rows: { id: string; userId: string; createdAt: string; amount: number }[]
}) {
  return (
    <div className="mt-2">
      <p className="text-base font-semibold text-muted">Aportes de {monthName(month)}</p>
      {rows.length === 0 ? (
        <p className="text-base text-muted">Todavía no hay aportes este mes.</p>
      ) : (
        <ul>
          {rows.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border-b border-dashed border-line py-2 last:border-0">
              <span className="text-base">{names[item.userId] ?? 'Alguien'}</span>
              <span className="text-base text-muted">{shortDate(todayISO(new Date(item.createdAt)))}</span>
              <span className="whitespace-nowrap text-base font-semibold">{formatMoney(item.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GustosAction({ label, reason, onClick }: { label: string; reason: string; onClick: () => void }) {
  const off = reason !== ''
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-disabled={off}
        onClick={() => {
          if (!off) onClick()
        }}
        className={
          off
            ? 'flex min-h-11 w-full items-center justify-center rounded-full border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado px-4 text-lg font-semibold text-gris'
            : 'block min-h-11 text-sm font-bold text-mostaza-ink'
        }
      >
        {label}
      </button>
      {off ? <p className="mt-1.5 text-sm font-medium text-gris">{reason}</p> : null}
    </div>
  )
}

function ScopeTag({ shared }: { shared: boolean }) {
  return (
    <span
      className={`inline-flex h-[var(--alto-chip)] shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-semibold ${
        shared ? 'bg-azul-claro text-azul-ink' : 'bg-ciruela-claro text-tinta'
      }`}
    >
      {shared ? 'Compartido' : 'Privado'}
    </span>
  )
}

function readStoredScope(): string | null {
  try {
    return localStorage.getItem(SAVINGS_SCOPE_STORAGE_KEY)
  } catch {
    return null
  }
}

function archivedOn(iso: string): string {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return shortDate(`${date.getFullYear()}-${month}-${day}`)
}

function archivedSources(goals: readonly GoalItem[], funds: readonly FundItem[]): ArchivedRow[] {
  return [
    ...goals
      .filter((goal) => goal.archivedAt)
      .map((goal) => ({
        id: goal.id,
        name: goal.name,
        shared: true,
        saved: goal.byUser.reduce((sum, item) => sum + item.amount, 0),
        archivedAt: goal.archivedAt ?? '',
      })),
    ...funds
      .filter((fund) => fund.archivedAt)
      .map((fund) => ({
        id: fund.id,
        name: fund.name,
        shared: false,
        saved: fund.saved,
        archivedAt: fund.archivedAt ?? '',
      })),
  ]
}

function NewSavingSheet({
  open,
  goalExists,
  userId,
  onClose,
  onSaved,
  onAskReplace,
}: {
  open: boolean
  goalExists: boolean
  userId: string
  onClose: () => void
  onSaved: (message: string) => void
  onAskReplace: (draft: SavingDraft) => void
}) {
  const [shared, setShared] = useState(true)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('umbrella-beach')
  const [digits, setDigits] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [editingTarget, setEditingTarget] = useState(false)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [seenOpen, setSeenOpen] = useState(open)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setShared(true)
      setName('')
      setIcon('umbrella-beach')
      setDigits('')
      setTargetDate('')
      setEditingTarget(false)
      setTouched(false)
      setSaving(false)
      setMessage('')
    }
  }

  const target = normalizeMoney(amountFromDigits(digits))
  const nameError = name.trim() ? '' : 'Poné un nombre.'
  const amountError = target > 0 ? '' : 'Poné cuánto querés juntar.'

  function choose(next: boolean) {
    setShared(next)
    setMessage('')
    setIcon((current) => {
      if (next && current === 'piggy-bank') return 'umbrella-beach'
      if (!next && current === 'umbrella-beach') return 'piggy-bank'
      return current
    })
  }

  async function save() {
    setTouched(true)
    if (saving) return
    if (nameError || amountError) {
      setMessage(shared ? 'El ahorro necesita nombre y monto.' : nameError || amountError)
      return
    }
    const draft = { name, icon, target, targetDate: targetDate || null }
    if (shared && goalExists) {
      onAskReplace(draft)
      return
    }
    setSaving(true)
    setMessage('')
    try {
      if (shared) await createGoal(draft)
      else await createFund({ userId, ...draft })
      onSaved('Listo, guardé el ahorro.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude guardar el ahorro.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Nuevo ahorro"
      onClose={onClose}
      footer={
        <Button type="button" tall disabled={saving} onClick={() => void save()}>
          Guardar
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Alcance">
        <Chip active={shared} onClick={() => choose(true)}>
          <AppIcon name="user-group" /> Compartido
        </Chip>
        <Chip active={!shared} onClick={() => choose(false)}>
          <AppIcon name="lock" /> Privado
        </Chip>
      </div>
      {shared ? (
        <>
          <label className="mb-3 block text-base font-semibold text-muted">
            Nombre
            <input
              value={name}
              aria-label="Nombre del ahorro"
              onChange={(event) => setName(event.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <p className="mb-2 text-base font-semibold text-muted">Ícono</p>
          <IconPicker value={icon} onChange={setIcon} />
          <button type="button" className="mt-4 min-h-11 font-display text-2xl font-semibold" onClick={() => setEditingTarget(true)}>
            Meta: {formatMoney(amountFromDigits(digits))}
          </button>
          <label className="mt-2 block text-base font-semibold text-muted">
            Para cuándo
            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          {editingTarget ? (
            <div className="mt-2">
              <MoneyField draft={digits} onDraft={setDigits} size="display" />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <label className="mb-3 block text-base font-semibold text-muted">
            Nombre
            <input
              value={name}
              aria-label="Nombre del ahorro"
              onChange={(event) => setName(event.target.value)}
              placeholder="Vacaciones, colchón…"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <p className="mb-2 text-base font-semibold text-muted">Ícono</p>
          <div className="max-h-40 overflow-y-auto">
            <IconPicker value={icon} onChange={setIcon} layout="grid" />
          </div>
          <div className="mt-4">
            <MoneyField draft={digits} onDraft={setDigits} label="¿Cuánto querés juntar?" size="display" />
          </div>
          <label className="mt-4 block text-base font-semibold text-muted">
            Fecha objetivo (opcional)
            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
        </>
      )}
      {touched && message ? (
        <p role="alert" className="mt-3 text-base font-semibold text-tinta">
          {message}
        </p>
      ) : null}
    </Sheet>
  )
}

function GoalEditSheet({
  open,
  goal,
  saved,
  onClose,
  onSaved,
}: {
  open: boolean
  goal: GoalItem
  saved: number
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(goal.name)
  const [digits, setDigits] = useState(moneyDraftFromAmount(goal.target))
  const [targetDate, setTargetDate] = useState(goal.targetDate ?? '')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [seen, setSeen] = useState(goal.id + String(open))

  const mark = goal.id + String(open)
  if (mark !== seen) {
    setSeen(mark)
    if (open) {
      setName(goal.name)
      setDigits(moneyDraftFromAmount(goal.target))
      setTargetDate(goal.targetDate ?? '')
      setTouched(false)
      setSaving(false)
      setMessage('')
    }
  }

  const target = normalizeMoney(amountFromDigits(digits))

  async function save() {
    setTouched(true)
    if (saving) return
    if (!name.trim() || target <= 0) {
      setMessage('El ahorro necesita nombre y monto.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await updateGoal({ id: goal.id, name, target, targetDate: targetDate || null })
      await onSaved()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude guardar el ahorro.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Editar nombre y meta"
      onClose={onClose}
      footer={
        <Button type="button" tall disabled={saving} onClick={() => void save()}>
          Guardar cambios
        </Button>
      }
    >
      <p className="mb-3 text-base text-muted">Ya juntaron {formatMoney(saved)}.</p>
      <label className="mb-3 block text-base font-semibold text-muted">
        Nombre
        <input value={name} aria-label="Nombre del ahorro" onChange={(event) => setName(event.target.value)} className={`mt-1 ${inputClass}`} />
      </label>
      <MoneyField draft={digits} onDraft={setDigits} label="Meta" size="display" />
      <label className="block text-base font-semibold text-muted">
        Para cuándo
        <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={`mt-1 ${inputClass}`} />
      </label>
      {touched && message ? (
        <p role="alert" className="mt-3 text-base font-semibold text-tinta">
          {message}
        </p>
      ) : null}
    </Sheet>
  )
}
