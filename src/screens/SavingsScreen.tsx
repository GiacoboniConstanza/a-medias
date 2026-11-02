import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { ExtraSheet, FundSheet, GustoSheet, MoveSheet } from '../components/bag/forms.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { amountFromDigits } from '../components/Keypad.tsx'
import { MoneyField } from '../components/MoneyField.tsx'
import { PotPlant } from '../components/Plant.tsx'
import { ScopeChips } from '../components/ScopeChips.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, Chip, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { contributeToGoal, createFund, createGoal, type FundItem } from '../lib/api.ts'
import { monthSplit, partnerId } from '../lib/derive.ts'
import { formatMoney, normalizeMoney } from '../lib/format.ts'
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
import type { ScopeFilter } from '../lib/finance-filters.ts'
import { ContributeSheet } from './GoalScreen.tsx'

type MoveMode = 'to_fund' | 'to_gustos' | 'use'

const primaryButton = 'block min-h-[52px] w-full rounded-2xl bg-primary text-base font-semibold text-on-primary disabled:opacity-50'
const quietButton = 'mt-2 block min-h-[52px] w-full rounded-2xl border-2 border-primary bg-card text-base font-semibold text-primary'

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
  const [toast, setToast] = useState('')

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
  if (!data) return <p className="py-16 text-center text-base font-semibold text-alert-ink">{error}</p>

  const userId = profile.id
  const householdId = profile.householdId
  const rows = filterSavings(savingSources(data.funds, data.goal), scope)
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
  const partnerName = data.names[partnerId(data, userId) ?? ''] ?? 'Tu compañera'

  function savedNotice(message: string) {
    setCreating(false)
    setEditing(null)
    setExtraOpen(false)
    setGustoOpen(false)
    setMoveMode(null)
    setToast(message)
    void refresh()
  }

  function openMove(mode: MoveMode, fund: FundItem | null) {
    setMoveFund(fund)
    setMoveMode(mode)
  }

  const friendly = true // S11: siempre Amigable, aunque el modo guardado sea Contable.
  const emptyCopy =
    scope === 'shared'
      ? 'Todavía no hay ahorros compartidos.'
      : scope === 'private'
        ? 'Todavía no hay ahorros privados.'
        : 'Todavía no hay ahorros.'

  return (
    <>
      <SectionHeader lead="crumb" aside={<NotificationBell />} />
      <ScopeChips value={scope} onChange={setScope} />

      {rows.length === 0 ? <p className="mb-3 text-base font-semibold text-muted">{emptyCopy}</p> : null}
      <ul aria-label="Ahorros">
        {rows.map((row) => {
          const percent = savingPercent(row.saved, row.target)
          const fund = data.funds.find((item) => item.id === row.id) ?? null
          return (
            <li key={row.id} className="mb-3 rounded-3xl bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <PotPlant variant="fondo" progress={percent} className="h-[104px] w-[92px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 text-base font-semibold">{row.name}</h2>
                    <ScopeTag shared={row.shared} />
                  </div>
                  <p className="font-display text-xl font-semibold leading-tight">{formatMoney(row.saved)}</p>
                  <p className="text-base text-muted">de {formatMoney(row.target)}</p>
                  {friendly ? (
                    <p className="text-base text-muted">
                      {row.shared ? goalPhrase(row.saved, row.target) : `Vas por el ${percent}%.`}
                    </p>
                  ) : (
                    <p className="text-base text-muted">
                      Ahorrado {formatMoney(row.saved)} · Meta {formatMoney(row.target)}
                      {row.targetDate ? ` · ${shortDate(row.targetDate)}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {row.shared && goal ? (
                <div className="mt-2">
                  {pace ? <p className="text-base text-muted">{pace}</p> : null}
                  <p className="text-base text-muted">{partnerName} ve tu aporte, no tus ahorros privados.</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button type="button" className="min-h-11 text-base font-semibold text-primary" onClick={() => setContributeOpen(true)}>
                      Sumar
                    </button>
                    <button
                      type="button"
                      className="min-h-11 text-base font-semibold text-primary"
                      aria-expanded={historyOpen}
                      onClick={() => setHistoryOpen((current) => !current)}
                    >
                      {historyOpen ? 'Ocultar aportes' : 'Ver aportes'}
                    </button>
                  </div>
                  {historyOpen ? (
                    <div className="mt-2">
                      <p className="text-base font-semibold text-muted">Aportes de {monthName(month)}</p>
                      {monthContributions.length === 0 ? (
                        <p className="text-base text-muted">Todavía no hay aportes este mes.</p>
                      ) : (
                        <ul>
                          {monthContributions.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 border-b border-dashed border-line py-2 last:border-0">
                              <span className="text-base">{data.names[item.userId] ?? 'Alguien'}</span>
                              <span className="text-base text-muted">{shortDate(todayISO(new Date(item.createdAt)))}</span>
                              <span className="text-base font-semibold">{formatMoney(item.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : fund ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 text-base font-semibold text-primary" onClick={() => setEditing(fund)}>
                    Editar
                  </button>
                  <button type="button" className="min-h-11 text-base font-semibold text-primary" onClick={() => openMove('use', fund)}>
                    Usar
                  </button>
                  <button type="button" className="min-h-11 text-base font-semibold text-primary" onClick={() => openMove('to_gustos', fund)}>
                    A gustos
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <Button type="button" onClick={() => setCreating(true)}>
        Nuevo ahorro
      </Button>

      {showPrivateActions ? (
        <div className="mt-2">
          <button type="button" className={quietButton} onClick={() => setExtraOpen(true)}>
            Cargar un extra
          </button>
          <p className="mt-3 text-base text-muted">
            {data.gustosPool > 0 ? `Para gustos te quedan ${formatMoney(Math.max(data.gustosFree, 0))}.` : 'Cuando un extra no va a un fondo, queda para gustos.'}
          </p>
          <button type="button" className={primaryButton} disabled={data.gustosFree <= 0} onClick={() => setGustoOpen(true)}>
            Me di un gusto
          </button>
          <button
            type="button"
            className={quietButton}
            disabled={data.gustosFree <= 0 || data.funds.length === 0}
            onClick={() => openMove('to_fund', null)}
          >
            Pasar a un fondo
          </button>
          {gustos.level === 'low' ? (
            <Card className="mt-3 bg-copper-soft text-base">
              <b className="inline-flex items-center gap-1 text-alert-ink">
                <AppIcon name="triangle-exclamation" /> Ojo:
              </b>{' '}
              te quedan {formatMoney(data.gustosFree)} para gustos.
            </Card>
          ) : null}
        </div>
      ) : null}

      <Toast onDone={() => setToast('')}>{toast}</Toast>
      <NewSavingSheet
        open={creating}
        goalExists={Boolean(goal)}
        userId={userId}
        householdId={householdId}
        onClose={() => setCreating(false)}
        onSaved={savedNotice}
      />
      <FundSheet open={editing !== null} fund={editing} userId={userId} onClose={() => setEditing(null)} onSaved={savedNotice} />
      <ExtraSheet
        open={extraOpen}
        funds={data.funds}
        userId={userId}
        householdId={householdId}
        onClose={() => setExtraOpen(false)}
        onSaved={savedNotice}
      />
      <GustoSheet
        open={gustoOpen}
        categories={data.categories}
        householdId={householdId}
        userId={userId}
        gustosFree={data.gustosFree}
        onClose={() => setGustoOpen(false)}
        onSaved={savedNotice}
        onRefresh={refresh}
      />
      <MoveSheet
        open={moveMode !== null}
        mode={moveMode ?? 'to_fund'}
        funds={data.funds}
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
            setToast('Listo, sumaste al ahorro.')
          }}
        />
      ) : null}
    </>
  )
}

function ScopeTag({ shared }: { shared: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-base font-semibold ${
        shared ? 'bg-lavender-soft text-title' : 'bg-sand text-title'
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

function NewSavingSheet({
  open,
  goalExists,
  userId,
  householdId,
  onClose,
  onSaved,
}: {
  open: boolean
  goalExists: boolean
  userId: string
  householdId: string
  onClose: () => void
  onSaved: (message: string) => void
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
  const blocked = shared && goalExists
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
    if (blocked) return
    if (nameError || amountError) {
      setMessage(shared ? 'El ahorro necesita nombre y monto.' : nameError || amountError)
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const input = { name, icon, target, targetDate: targetDate || null }
      if (shared) await createGoal({ householdId, ...input })
      else await createFund({ userId, ...input })
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
        <button type="button" className={primaryButton} disabled={saving} onClick={() => void save()}>
          Guardar
        </button>
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
      {blocked ? (
        <p className="text-base font-semibold text-muted">Ya tienen un ahorro compartido. Sumale desde la lista.</p>
      ) : shared ? (
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
            Fecha
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
        <p role="alert" className="mt-3 text-base font-semibold text-alert-ink">
          {message}
        </p>
      ) : null}
    </Sheet>
  )
}
