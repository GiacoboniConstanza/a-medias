import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { PlanItemFormFields, type PlanItemDraft } from '../components/PlanItemFormFields.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Chip, ErrorText, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import {
  createPlanItem,
  deletePlanItem,
  loadPlanItems,
  loadPlanPartnerStatus,
  setPlanItemChosen,
  updatePlanItem,
  type FixedItem,
} from '../lib/api.ts'
import { partnerId } from '../lib/derive.ts'
import { amountFromDigits } from '../lib/format.ts'
import { fixedExpensesTotal } from '../lib/fixed-total.ts'
import { formatMoney, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import { isHubHome } from '../lib/modules.ts'
import { useMonth } from '../context/MonthProvider.tsx'
import {
  boughtPlanItems,
  filterPlanItemsByTag,
  formatChosenDelta,
  openPlanItems,
  partnerStatusLabel,
  partnerStatusTone,
  planCommitted,
  planItemShares,
  planMargin,
  planRemaining,
  planSalaryForMonth,
  planTags,
  type PartnerPlanStatus,
  type PlanItem,
} from '../lib/plans.ts'

export type { PlanItem }

type Draft = PlanItemDraft

const emptyDraft = (): Draft => ({ title: '', digits: '', note: '', tag: '', isPrivate: false })

export function PlansScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const { enabled } = useModules()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [items, setItems] = useState<PlanItem[]>([])
  const [partnerStatus, setPartnerStatus] = useState<PartnerPlanStatus | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PlanItem | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [boughtOpen, setBoughtOpen] = useState(false)
  const [toast, setToast] = useState(() => {
    const notice = (location.state as { toast?: string } | null)?.toast
    return notice ?? ''
  })
  const backTo = isHubHome(enabled) ? '/finanzas' : '/'

  const reload = useCallback(async () => {
    if (!profile?.householdId) return
    setLoadError('')
    try {
      const [list, status] = await Promise.all([loadPlanItems(profile.householdId), loadPlanPartnerStatus()])
      setItems(list)
      setPartnerStatus(status)
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'No pude cargar los planes.')
    }
  }, [profile?.householdId])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!profile?.householdId) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-tinta">{error}</p>

  const meId = profile.id
  const otherId = partnerId(data, meId)
  const partnerName = (otherId ? data.names[otherId] : '') || 'tu compañera'
  const salary = planSalaryForMonth(data.salaryHistory, month)
  const splitPercents = data.splitPercents
  const fixedCard = fixedExpensesTotal({
    items: data.fixed.filter((item: FixedItem) => item.applies && !item.pausedAt),
    meId,
    partnerId: otherId,
    partnerName,
    splitPercents,
    filtersActive: false,
  })
  const myFixedShare = fixedCard?.myShare ?? 0
  const myPrivateFixed = fixedCard?.privateTotal ?? 0
  const margin = planMargin(salary, myFixedShare, myPrivateFixed)
  const committed = planCommitted(items, meId, otherId, splitPercents, month)
  const remaining = margin == null ? null : planRemaining(margin, committed)
  const chosenCost = planCommitted(
    items.filter((item) => item.chosen && !item.expenseId),
    meId,
    otherId,
    splitPercents,
    month,
  )
  const boughtCost = planCommitted(
    items.filter((item) => item.expenseId && item.expensePeriod === month),
    meId,
    otherId,
    splitPercents,
    month,
  )
  const tags = planTags(items)
  const filtered = filterPlanItemsByTag(items, tagFilter)
  const openItems = openPlanItems(filtered)
  const bought = boughtPlanItems(filtered)
  const hasItems = items.length > 0
  const signal = partnerStatusLabel(partnerName, partnerStatus)
  const signalTone = partnerStatusTone(partnerStatus)

  function openEdit(item: PlanItem) {
    setEditing(item)
    setDraft({
      title: item.title,
      digits: moneyDraftFromAmount(item.amount),
      note: item.note ?? '',
      tag: item.tag ?? '',
      isPrivate: item.isPrivate,
    })
    setSheetError('')
    setConfirmDelete(false)
    setSheetOpen(true)
  }

  async function toggleChosen(item: PlanItem) {
    if (item.expenseId) return
    try {
      await setPlanItemChosen(item.id, !item.chosen, meId)
      await reload()
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'No pude actualizar el ítem.')
    }
  }

  async function saveDraft() {
    const amount = normalizeMoney(amountFromDigits(draft.digits))
    if (!draft.title.trim() || amount <= 0) {
      setSheetError('Completá nombre e importe.')
      return
    }
    if (!profile?.householdId) return
    setSaving(true)
    setSheetError('')
    try {
      if (editing) {
        await updatePlanItem({
          id: editing.id,
          updatedBy: meId,
          title: draft.title,
          amount,
          note: draft.note,
          tag: draft.tag,
        })
      } else {
        await createPlanItem({
          householdId: profile.householdId,
          createdBy: meId,
          title: draft.title,
          amount,
          note: draft.note,
          tag: draft.tag,
          isPrivate: draft.isPrivate,
        })
      }
      setSheetOpen(false)
      await reload()
      await refresh()
    } catch (caught) {
      setSheetError(caught instanceof Error ? caught.message : 'No pude guardar el ítem.')
    } finally {
      setSaving(false)
    }
  }

  async function removeItem() {
    if (!editing) return
    setSaving(true)
    try {
      await deletePlanItem(editing.id)
      setConfirmDelete(false)
      setSheetOpen(false)
      await reload()
    } catch (caught) {
      setSheetError(caught instanceof Error ? caught.message : 'No pude borrar el ítem.')
    } finally {
      setSaving(false)
    }
  }

  function buyItem(item: PlanItem) {
    if (!data) return
    const hogar = data.categories.find((category) => category.name === 'Hogar')
    navigate('/cargar/gasto', {
      state: {
        from: '/planes',
        tipo: 'gasto',
        planItemId: item.id,
        amount: item.amount,
        title: item.title,
        notes: item.note,
        isShared: !item.isPrivate,
        categoryId: hogar?.id ?? null,
        skipStep1: true,
      },
    })
  }

  const tagSuggestions = useMemo(() => {
    const q = draft.tag.trim().toLocaleLowerCase('es')
    if (!q) return tags.slice(0, 6)
    return tags.filter((tag) => tag.toLocaleLowerCase('es').includes(q)).slice(0, 6)
  }, [draft.tag, tags])

  return (
    <>
      <section className="scallop-b -mx-4 mb-4 bg-azul px-4 pb-4 pt-2 text-tinta">
        <Link to={backTo} aria-label="Volver a Resumen" className="grid h-11 w-11 place-items-center text-tinta">
          <AppIcon name="chevron-left" />
        </Link>
        <h1 className="font-display text-[34px] font-semibold text-tinta">Planes</h1>
      </section>

      {loadError ? <p className="mb-3 text-sm font-semibold text-tinta">{loadError}</p> : null}

      <section className="rounded-2xl border-2 border-azul-ink bg-tarjeta p-4" aria-live="polite">
        {hasItems && remaining != null ? (
          <>
            <p className="font-display text-lg font-semibold text-tinta">Te queda</p>
            <p
              className={`font-display text-[clamp(1.75rem,9.25vw,2.25rem)] font-semibold leading-none ${
                remaining < 0 ? 'text-rosa-texto' : 'text-tinta'
              }`}
            >
              {formatMoney(remaining)}
            </p>
            <div className="mt-3 space-y-2 border-t border-dashed border-linea-punteada pt-3">
              <SummaryRow label="Margen" value={margin == null ? null : formatMoney(margin)} />
              <SummaryRow label="Elegidos" value={formatChosenDelta(chosenCost)} />
              {boughtCost > 0 ? <SummaryRow label="Comprados" value={formatChosenDelta(boughtCost)} /> : null}
            </div>
          </>
        ) : (
          <SummaryRow
            label="Margen"
            value={
              margin == null ? (
                <Link to="/sueldo" className="inline-flex min-h-11 items-center gap-1 font-bold text-mostaza-ink">
                  Cargá tu sueldo <AppIcon name="chevron-right" />
                </Link>
              ) : (
                formatMoney(margin)
              )
            }
          />
        )}
        {hasItems && signal && signalTone ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-tinta">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full ${
                signalTone === 'ok' ? 'bg-salvia-ink' : signalTone === 'bad' ? 'bg-rosa-texto' : 'bg-mostaza-ink'
              }`}
            />
            {signal}
          </p>
        ) : null}
      </section>

      {tags.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <Chip active={tagFilter == null} onClick={() => setTagFilter(null)}>
            Todas
          </Chip>
          {tags.map((tag) => (
            <Chip key={tag} active={tagFilter === tag} onClick={() => setTagFilter(tag)}>
              <span className="max-w-[7.5rem] truncate">{tag}</span>
            </Chip>
          ))}
        </div>
      ) : null}

      {!hasItems ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <Plantita />
          <p className="text-base font-semibold text-gris">Sin ítems todavía.</p>
        </div>
      ) : (
        <>
          <div className="mt-3 overflow-hidden rounded-2xl border-2 border-azul-ink bg-tarjeta">
            {openItems.map((item) => (
              <PlanRow
                key={item.id}
                item={item}
                meId={meId}
                partnerId={otherId}
                partnerName={partnerName}
                splitPercents={data.splitPercents}
                onToggle={() => void toggleChosen(item)}
                onOpen={() => openEdit(item)}
              />
            ))}
          </div>

          {bought.length > 0 ? (
            <div className="mt-3 rounded-2xl bg-salvia-claro">
              <button
                type="button"
                aria-expanded={boughtOpen}
                onClick={() => setBoughtOpen((open) => !open)}
                className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2 text-left"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-mostaza text-tinta">
                  <AppIcon name="check" />
                </span>
                <span className="flex-1 text-sm font-bold text-tinta">Comprados</span>
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-tinta px-1.5 text-sm font-bold text-crema">
                  {bought.length}
                </span>
                <AppIcon
                  name="chevron-down"
                  className={`text-gris transition-transform ${boughtOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {boughtOpen ? (
                <div className="mx-2 mb-2 overflow-hidden rounded-2xl border-2 border-azul-ink bg-tarjeta">
                  {bought.map((item) => (
                    <div
                      key={item.id}
                      className="flex min-h-14 items-center justify-between gap-3 border-b border-dashed border-linea-punteada px-3.5 py-2 last:border-0"
                    >
                      <span className="truncate font-display text-lg font-semibold">{item.title}</span>
                      <span className="whitespace-nowrap font-display text-lg font-semibold">
                        {formatMoney(item.expenseAmount ?? item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <Sheet open={sheetOpen} title={editing ? 'Editar ítem' : 'Nuevo ítem'} onClose={() => setSheetOpen(false)}>
        <PlanItemFormFields
          draft={draft}
          onChange={setDraft}
          tagSuggestions={tagSuggestions}
          showPrivateToggle={!editing}
          privateLockedLabel={Boolean(editing?.isPrivate)}
        />
        {sheetError ? <ErrorText>{sheetError}</ErrorText> : null}
        {editing && !editing.expenseId ? (
          <Button type="button" variant="alt" className="mb-2" disabled={saving} onClick={() => buyItem(editing)}>
            {editing.isPrivate ? 'Ya lo compré' : 'Ya lo compramos'}
          </Button>
        ) : null}
        {editing ? (
          <button
            type="button"
            className="mb-3 flex min-h-11 w-full items-center justify-center text-sm font-bold text-rosa-texto"
            disabled={saving}
            onClick={() => setConfirmDelete(true)}
          >
            Borrar
          </button>
        ) : null}
        <Button type="button" onClick={() => void saveDraft()} disabled={saving}>
          Guardar
        </Button>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title={editing ? `¿Borrar ${editing.title}?` : '¿Borrar?'}
        confirmLabel="Borrar"
        variant="danger"
        busy={saving}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void removeItem()}
      >
        <p className="text-base font-semibold text-tinta">Se saca de la lista. No toca los gastos ya cargados.</p>
      </ConfirmSheet>

      <FabSpace avisos={Boolean(toast)} />
      <Fab label="Cargar" to="/cargar" state={{ from: '/planes' }} />
      <Toast aboveFab onDone={() => setToast('')}>
        {toast}
      </Toast>
    </>
  )
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm font-semibold text-gris">{label}</p>
      <div className="font-display text-base font-semibold text-tinta">{value}</div>
    </div>
  )
}

function PlanRow({
  item,
  meId,
  partnerId: otherId,
  partnerName,
  splitPercents,
  onToggle,
  onOpen,
}: {
  item: PlanItem
  meId: string
  partnerId: string | null
  partnerName: string
  splitPercents: Readonly<Record<string, number>>
  onToggle: () => void
  onOpen: () => void
}) {
  const chooseId = useId()
  const shares = item.isPrivate ? null : planItemShares(item.amount, meId, otherId, splitPercents)
  const aria = [
    item.title,
    formatMoney(item.amount),
    item.tag ? `etiqueta ${item.tag}` : null,
    item.note,
    item.chosen ? 'elegido' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="grid min-h-[96px] grid-cols-[44px_1fr] gap-1.5 border-b border-dashed border-linea-punteada px-1.5 py-1.5 last:border-0">
      <button
        type="button"
        id={chooseId}
        role="checkbox"
        aria-checked={item.chosen}
        aria-label={`Elegir ${item.title}`}
        onClick={onToggle}
        className="grid h-11 w-11 place-items-center"
      >
        <span
          className={`grid h-7 w-7 place-items-center rounded-full border-[1.5px] border-azul-ink ${
            item.chosen ? 'bg-tinta text-crema' : 'bg-tarjeta'
          }`}
        >
          {item.chosen ? <AppIcon name="check" className="text-sm" /> : null}
        </span>
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 py-1 text-left" aria-label={aria}>
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-display text-lg font-semibold text-tinta">{item.title}</span>
          <span className="shrink-0 whitespace-nowrap font-display text-lg font-semibold text-tinta">
            {formatMoney(item.amount)}
          </span>
        </span>
        {item.isPrivate ? (
          <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-gris">
            <AppIcon name="lock" className="text-xs" /> Privado
          </span>
        ) : shares ? (
          <span className="mt-0.5 block text-sm font-semibold text-gris">
            Vos <span className="font-bold text-tinta">{formatMoney(shares.myShare)}</span>
            {' · '}
            {partnerName} <span className="font-bold text-tinta">{formatMoney(shares.partnerShare)}</span>
          </span>
        ) : null}
        {item.tag || item.note ? (
          <span className="mt-1 flex min-w-0 items-center gap-2">
            {item.tag ? (
              <span className="inline-flex h-[22px] max-w-[7.5rem] shrink-0 items-center truncate rounded-full bg-azul-claro px-2 text-sm font-semibold text-azul-ink">
                {item.tag}
              </span>
            ) : null}
            {item.note ? <span className="min-w-0 truncate text-sm font-medium text-gris">{item.note}</span> : null}
          </span>
        ) : null}
      </button>
    </div>
  )
}

function Plantita() {
  return (
    <svg width="56" height="73" viewBox="0 0 56 73" fill="none" aria-hidden>
      <path d="M28 70c10 0 18-3 18-8s-8-8-18-8-18 3-18 8 8 8 18 8Z" fill="#D7C4A4" />
      <path d="M28 12c-8 10-10 22-8 34 8-6 14-16 16-28-6 2-8 8-8 8Z" fill="#8FA86A" />
      <path d="M28 18c8 8 12 18 10 30-6-4-12-12-14-22 4 0 4-8 4-8Z" fill="#6F8A4E" />
      <path d="M27 48v14" stroke="#5A5735" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
