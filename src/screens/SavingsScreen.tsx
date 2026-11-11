import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { EstrellaGouache } from '../components/Adornos.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { MoneyField } from '../components/MoneyField.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { createSaving, setSavingArchived, type SavingItem, type SavingMove } from '../lib/api.ts'
import { partnerId } from '../lib/derive.ts'
import { amountFromDigits, formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { isHubHome } from '../lib/modules.ts'
import { savingBalances } from '../lib/saving-balance.ts'
import { activeSavings, archivedSavings, groupSavings, savingPercent } from '../lib/savings.ts'

export function SavingsScreen() {
  const { profile } = useAuth()
  const { data, loading, error, refresh } = useFinance()
  const { enabled } = useModules()
  const location = useLocation()
  const hub = isHubHome(enabled)
  const [toast, setToast] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (!profile) return null
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Header hub={hub} name={profile.displayName} />
        <div className="h-40 animate-pulse rounded-2xl bg-tarjeta" aria-busy="true" />
      </div>
    )
  }
  if (!data) return <p className="py-16 text-center font-semibold text-tinta">{error}</p>

  const meId = profile.id
  const otherId = partnerId(data, meId)
  const partnerLabel = (otherId && data.names[otherId]) || 'tu compañera'
  const active = activeSavings(data.savings)
  const archived = archivedSavings(data.savings)
  const { shared, own } = groupSavings(active)
  const movesBySaving = indexMoves(data.savingMoves)

  async function restore(id: string) {
    setBusyId(id)
    try {
      await setSavingArchived(id, false)
      await refresh()
      setToast('Ahorro restaurado')
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'No pude restaurarlo.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Header hub={hub} name={profile.displayName} />

      {active.length === 0 ? (
        <section className="mx-auto mt-10 max-w-sm rounded-2xl border-2 border-azul-ink bg-tarjeta p-6 text-center">
          <EstrellaGouache width={56} height={52} className="mx-auto" />
          <h2 className="mt-3 font-display text-lg font-semibold text-tinta">Todavía no hay ahorros</h2>
          <p className="mt-1 text-sm font-semibold text-gris">
            Creá uno para juntar plata, solo{otherId ? ` o con ${partnerLabel}` : ''}.
          </p>
          <Button type="button" className="mt-4" onClick={() => setNewOpen(true)}>
            <AppIcon name="plus" className="mr-1" /> Nuevo ahorro
          </Button>
        </section>
      ) : (
        <div className="space-y-6">
          {shared.length > 0 ? (
            <SavingGroup
              label={`Con ${partnerLabel}`}
              icon="user-group"
              partner
              items={shared}
              meId={meId}
              movesBySaving={movesBySaving}
            />
          ) : null}
          {own.length > 0 ? (
            <SavingGroup label="Solo vos" icon="lock" items={own} meId={meId} movesBySaving={movesBySaving} />
          ) : null}

          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="inline-flex min-h-11 items-center gap-1 rounded-2xl border-[1.5px] border-azul-ink bg-tarjeta px-4 text-sm font-bold text-tinta"
          >
            <AppIcon name="plus" /> Nuevo ahorro
          </button>

          {archived.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gris">Archivados</h2>
              {archived.map((item) => {
                const moves = movesBySaving.get(item.id) ?? []
                const bal = savingBalances(item.openings, moves)
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-azul-ink bg-tarjeta p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold text-tinta">{item.name}</p>
                      <p className="text-sm font-semibold text-gris">{formatMoney(bal.total)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void restore(item.id)}
                      className="min-h-11 shrink-0 px-2 font-bold text-mostaza-ink"
                    >
                      Restaurar
                    </button>
                  </div>
                )
              })}
            </section>
          ) : null}
        </div>
      )}

      <FabSpace avisos={Boolean(toast)} />
      <Fab to="/cargar" label="Cargar un movimiento" state={{ from: location.pathname }} />
      <Toast aboveFab onDone={() => setToast('')}>
        {toast}
      </Toast>

      <NewSavingSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        householdId={profile.householdId!}
        meId={meId}
        partnerId={otherId}
        partnerLabel={partnerLabel}
        onSaved={async () => {
          await refresh()
          setToast('Ahorro creado')
          setNewOpen(false)
        }}
      />
    </>
  )
}

function Header({ hub, name }: { hub: boolean; name: string }) {
  return (
    <section className="scallop-b -mx-4 mb-4 bg-azul px-4 pb-4 pt-2 text-tinta">
      <SectionHeader lead={hub ? 'crumb' : 'greeting'} name={name} aside={<NotificationBell />} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[34px] font-semibold">Ahorros</h1>
          <MonthSwitcher />
        </div>
        <EstrellaGouache className="mt-1" />
      </div>
    </section>
  )
}

function SavingGroup({
  label,
  icon,
  partner = false,
  items,
  meId,
  movesBySaving,
}: {
  label: string
  icon: string
  partner?: boolean
  items: SavingItem[]
  meId: string
  movesBySaving: Map<string, SavingMove[]>
}) {
  return (
    <section>
      <h2 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${partner ? 'text-salvia-ink' : 'text-gris'}`}>
        <AppIcon name={icon} /> {label}
      </h2>
      <div className="space-y-3">
        {items.map((item) => {
          const moves = movesBySaving.get(item.id) ?? []
          const bal = savingBalances(item.openings, moves)
          const mine = bal.byUser[meId] ?? 0
          const pct = savingPercent(bal.total, item.target)
          return (
            <Link
              key={item.id}
              to={`/ahorros/${item.id}`}
              className="block rounded-2xl border-2 border-azul-ink bg-tarjeta p-4 text-tinta"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-azul-ink bg-azul-claro text-azul-ink">
                  <AppIcon name={item.icon} />
                </span>
                <p className="min-w-0 flex-1 font-display text-lg font-semibold">{item.name}</p>
                <AppIcon name="chevron-right" className="text-gris" />
              </div>
              <p className="mt-3 whitespace-nowrap font-display text-[36px] font-semibold leading-none">
                {formatMoney(bal.total)}
              </p>
              {item.target != null && item.target > 0 ? (
                <div className="mt-3">
                  <div className="h-[10px] overflow-hidden rounded-full border-[1.5px] border-tinta bg-tarjeta">
                    <div className="h-full border-r-[1.5px] border-tinta bg-mostaza" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gris">
                    {pct} % de {formatMoney(item.target)}
                  </p>
                </div>
              ) : null}
              {item.isShared ? (
                <p className="mt-2 text-sm font-semibold text-gris">
                  Lo tuyo: <span className="font-display text-tinta">{formatMoney(mine)}</span>
                </p>
              ) : null}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function indexMoves(moves: readonly SavingMove[]): Map<string, SavingMove[]> {
  const map = new Map<string, SavingMove[]>()
  for (const move of moves) {
    const list = map.get(move.savingId) ?? []
    list.push(move)
    map.set(move.savingId, list)
  }
  return map
}

export function NewSavingSheet({
  open,
  onClose,
  householdId,
  meId,
  partnerId: otherId,
  partnerLabel,
  onSaved,
  initialShared,
}: {
  open: boolean
  onClose: () => void
  householdId: string
  meId: string
  partnerId: string | null
  partnerLabel: string
  onSaved: (id: string) => void | Promise<void>
  initialShared?: boolean
}) {
  const hasPartner = Boolean(otherId)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(Boolean(initialShared && hasPartner))
  const [icon, setIcon] = useState(DEFAULT_ICON)
  const [digits, setDigits] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setName('')
      setShared(Boolean(initialShared && hasPartner))
      setIcon(DEFAULT_ICON)
      setDigits('')
      setTargetDate('')
      setError('')
    }
  }

  async function save() {
    if (!name.trim()) {
      setError('Poné un nombre.')
      return
    }
    const target = amountFromDigits(digits)
    setSaving(true)
    setError('')
    try {
      const id = await createSaving({
        householdId,
        name,
        icon,
        target: target > 0 ? target : null,
        targetDate: targetDate || null,
        isShared: shared && hasPartner,
        ownerId: shared && hasPartner ? null : meId,
      })
      await onSaved(id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude crear el ahorro.')
    } finally {
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
      <label className="block text-sm font-semibold text-gris">
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={`mt-1 ${inputClass}`} />
      </label>

      <div className="mt-4">
        <p className="text-sm font-semibold text-gris">¿Con quién?</p>
        <div className="mt-2 grid h-[52px] grid-cols-2 gap-2" role="radiogroup" aria-label="Alcance">
          <button
            type="button"
            role="radio"
            aria-checked={shared}
            aria-disabled={!hasPartner || undefined}
            disabled={!hasPartner}
            onClick={() => hasPartner && setShared(true)}
            className={`rounded-2xl text-sm font-semibold ${
              !hasPartner
                ? 'border-[1.5px] border-dashed border-gris-claro bg-fondo-desactivado text-gris'
                : shared
                  ? 'border-2 border-tinta bg-azul-claro text-tinta'
                  : 'border-[1.5px] border-azul-ink bg-tarjeta text-tinta'
            }`}
          >
            {hasPartner ? `Con ${partnerLabel}` : 'Con tu compañera'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!shared}
            onClick={() => setShared(false)}
            className={`rounded-2xl text-sm font-semibold ${
              !shared ? 'border-2 border-tinta bg-azul-claro text-tinta' : 'border-[1.5px] border-azul-ink bg-tarjeta text-tinta'
            }`}
          >
            Solo yo
          </button>
        </div>
        {!hasPartner ? (
          <p className="mt-2 text-sm font-semibold text-gris">
            Para ahorrar con alguien, primero sumá a tu compañera.{' '}
            <Link to="/compartir" className="font-bold text-mostaza-ink">
              Invitarla
            </Link>
          </p>
        ) : null}
      </div>

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

      {error ? (
        <p className="mt-3 flex items-center gap-1 text-sm font-bold text-tinta" role="alert">
          <AppIcon name="circle-exclamation" /> {error}
        </p>
      ) : null}
    </Sheet>
  )
}
