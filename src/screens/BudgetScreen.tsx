import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { BudgetListIcon, PrivacyChip } from '../components/BudgetCard.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { FabSpace } from '../components/Fab.tsx'
import { MoneyField } from '../components/MoneyField.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Chip, ErrorText, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { loadBudgets, removeBudget, saveBudget, type BudgetCap } from '../lib/api.ts'
import { budgetSpent } from '../lib/budget.ts'
import { partnerId } from '../lib/derive.ts'
import { formatMoney, parseMoneyInput, sanitizeMoneyDraft } from '../lib/format.ts'
import { isHubHome } from '../lib/modules.ts'
import { monthName } from '../lib/month.ts'

const SUGGESTED = ['Súper', 'Comida', 'Hogar', 'Luz', 'Salidas', 'Farmacia']

export function BudgetScreen() {
  const { profile } = useAuth()
  const { enabled } = useModules()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [caps, setCaps] = useState<BudgetCap[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<BudgetCap | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [draft, setDraft] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const meId = profile?.id ?? ''
  const hub = isHubHome(enabled)
  const backTo = hub ? '/finanzas' : '/'

  async function reloadCaps() {
    if (!meId) return
    setLoadError('')
    try {
      setCaps(await loadBudgets(meId, month))
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'No pudimos traer tu presupuesto.')
      setCaps([])
    }
  }

  useEffect(() => {
    void reloadCaps()
  }, [meId, month, data])

  const partnerName = useMemo(() => {
    if (!data || !meId) return 'tu compañera'
    const other = partnerId(data, meId)
    return (other && data.names[other]) || 'tu compañera'
  }, [data, meId])

  const cappedIds = useMemo(() => new Set((caps ?? []).map((row) => row.categoryId)), [caps])

  const availableCategories = useMemo(() => {
    const empty = { suggested: [] as { id: string; name: string; icon: string }[], rest: [] as { id: string; name: string; icon: string }[], all: [] as { id: string; name: string; icon: string }[] }
    if (!data) return empty
    const free = data.categories.filter((category) => !cappedIds.has(category.id) || category.id === editing?.categoryId)
    const suggested = SUGGESTED.flatMap((name) => {
      const match = free.find((category) => category.name === name)
      return match ? [match] : []
    })
    const rest = free
      .filter((category) => !SUGGESTED.includes(category.name))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
    return { suggested, rest, all: [...suggested, ...rest] }
  }, [data, cappedIds, editing])

  const listRows = useMemo(() => {
    if (!data || !caps) return []
    return [...caps]
      .map((cap) => {
        const category = data.categories.find((row) => row.id === cap.categoryId)
        return category ? { ...cap, name: category.name, icon: category.icon } : null
      })
      .filter((row): row is BudgetCap & { name: string; icon: string } => Boolean(row))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
  }, [caps, data])

  const spentForSelected =
    data && meId && (editing?.categoryId || categoryId)
      ? budgetSpent(data, meId, editing?.categoryId || categoryId)
      : 0
  const selectedName =
    data?.categories.find((row) => row.id === (editing?.categoryId || categoryId))?.name ?? ''

  function openCreate() {
    setEditing(null)
    setCategoryId('')
    setDraft('')
    setShowAll(false)
    setSheetError('')
    setSheetOpen(true)
  }

  function openEdit(cap: BudgetCap & { name: string; icon: string }) {
    setEditing(cap)
    setCategoryId(cap.categoryId)
    setDraft(String(cap.amount).replace('.', ','))
    setShowAll(false)
    setSheetError('')
    setSheetOpen(true)
  }

  function closeSheet() {
    if (saving) return
    setSheetOpen(false)
    setConfirmOpen(false)
  }

  async function persist() {
    const amount = parseMoneyInput(draft)
    if (!editing && !categoryId) {
      setSheetError('Elegí una categoría.')
      return
    }
    if (amount == null || amount <= 0) {
      setSheetError('Poné un monto mayor a cero.')
      return
    }
    setSaving(true)
    setSheetError('')
    try {
      await saveBudget(meId, { categoryId: editing?.categoryId || categoryId, amount })
      await reloadCaps()
      await refresh()
      setSheetOpen(false)
      setToast('Tope guardado.')
    } catch {
      setSheetError('No se pudo guardar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function erase() {
    if (!editing) return
    setSaving(true)
    setSheetError('')
    try {
      await removeBudget(meId, editing.categoryId)
      await reloadCaps()
      await refresh()
      setConfirmOpen(false)
      setSheetOpen(false)
      setToast('Tope borrado.')
    } catch {
      setSheetError('No se pudo guardar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-tinta">{error}</p>

  const amountOk = (() => {
    const amount = parseMoneyInput(draft)
    return amount != null && amount > 0
  })()
  const canSave = Boolean((editing || categoryId) && amountOk && !saving)
  const chips = showAll ? availableCategories.all : availableCategories.suggested
  const hiddenCount = availableCategories.all.length - availableCategories.suggested.length
  const allCapped = !editing && availableCategories.all.length === 0

  return (
    <>
      <section className="scallop-b -mx-4 mb-4 bg-azul px-4 pb-4 pt-2 text-tinta">
        <Link to={backTo} aria-label="Volver" className="grid h-11 w-11 place-items-center text-tinta">
          <AppIcon name="chevron-left" />
        </Link>
        <h1 className="font-display text-[34px] font-semibold text-tinta">Tus topes</h1>
        <p className="mt-1 text-sm font-semibold text-tinta">Se repiten todos los meses hasta que los cambies.</p>
        <div className="mt-3">
          <PrivacyChip />
        </div>
      </section>

      {loadError ? <p className="mb-3 text-sm font-semibold text-tinta">{loadError}</p> : null}

      <ul className="space-y-2">
        {listRows.map((row) => (
          <li key={row.categoryId}>
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="grid min-h-[72px] w-full grid-cols-[40px_1fr_24px] items-center gap-3 rounded-2xl border-2 border-azul-ink bg-tarjeta px-4 py-3 text-left"
            >
              <BudgetListIcon icon={row.icon} />
              <span className="min-w-0">
                <span className="block truncate font-display text-lg font-semibold text-title">{row.name}</span>
                <span className="block text-sm font-semibold text-gris">{formatMoney(row.amount)} por mes</span>
              </span>
              <AppIcon name="chevron-right" className="justify-self-end text-gris" />
            </button>
          </li>
        ))}
      </ul>

      {allCapped ? (
        <p className="mt-4 text-center text-sm font-semibold text-muted">Ya pusiste tope a todas tus categorías.</p>
      ) : (
        <Button type="button" variant="alt" className="mt-4" onClick={openCreate}>
          <span className="inline-flex items-center gap-2">
            <AppIcon name="plus" /> Agregar un tope
          </span>
        </Button>
      )}

      <p className="mt-4 text-sm font-semibold text-gris">
        Cuenta lo que te toca de cada categoría: tus gastos privados y tu parte de los compartidos. {partnerName} no ve tus
        topes.
      </p>

      <FabSpace />

      <Sheet open={sheetOpen} title={editing ? 'Editar tope' : 'Nuevo tope'} onClose={closeSheet}>
        {editing ? (
          <div className="mb-4 flex items-center gap-3">
            <BudgetListIcon icon={editing.categoryId ? listRows.find((row) => row.categoryId === editing.categoryId)?.icon || 'tag' : 'tag'} />
            <p className="font-display text-lg font-semibold text-title">
              {listRows.find((row) => row.categoryId === editing.categoryId)?.name ?? 'Categoría'}
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-gris">Categoría</p>
            <div className="flex flex-wrap gap-2">
              {chips.map((category) => (
                <Chip
                  key={category.id}
                  active={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  <AppIcon name={category.icon} /> {category.name}
                </Chip>
              ))}
            </div>
            {!showAll && hiddenCount > 0 ? (
              <button
                type="button"
                className="mt-2 min-h-11 text-sm font-bold text-mostaza-ink"
                onClick={() => setShowAll(true)}
              >
                Ver todas ({availableCategories.all.length})
              </button>
            ) : null}
          </div>
        )}

        <MoneyField
          label="Tope por mes"
          draft={draft}
          onDraft={(value) => setDraft(sanitizeMoneyDraft(value))}
          size="form"
          error={sheetError && !amountOk ? sheetError : undefined}
        />
        <p className="mt-2 text-sm font-semibold text-muted">Se repite todos los meses hasta que lo cambies.</p>
        {(editing || categoryId) && selectedName ? (
          <p className="mt-3 text-sm font-semibold text-gris">
            En {monthName(month)} llevás {formatMoney(spentForSelected)} en {selectedName}.
          </p>
        ) : null}

        <Button type="button" tall className="mt-4" disabled={!canSave} onClick={() => void persist()}>
          <span className="inline-flex items-center gap-2">
            <AppIcon name="check" /> {editing ? 'Guardar cambios' : 'Guardar tope'}
          </span>
        </Button>
        {editing ? (
          <Button
            type="button"
            variant="danger"
            className="mt-2"
            disabled={saving}
            onClick={() => setConfirmOpen(true)}
          >
            Borrar tope
          </Button>
        ) : null}
        <ErrorText>{sheetError}</ErrorText>
      </Sheet>

      <ConfirmSheet
        open={confirmOpen}
        title={editing ? `¿Borrás el tope de ${listRows.find((row) => row.categoryId === editing.categoryId)?.name ?? ''}?` : ''}
        onClose={() => {
          if (!saving) setConfirmOpen(false)
        }}
        confirmLabel="Borrar"
        onConfirm={() => void erase()}
        disabled={saving}
        busy={saving}
        variant="danger"
      >
        <p className="text-base font-semibold text-tinta">
          Deja de aparecer en tu presupuesto desde este mes. Tus gastos no cambian.
        </p>
      </ConfirmSheet>

      <Toast onDone={() => setToast('')}>{toast}</Toast>
    </>
  )
}
