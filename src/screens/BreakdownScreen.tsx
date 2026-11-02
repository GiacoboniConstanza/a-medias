import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { Bubbles } from '../components/Bubbles.tsx'
import { FilterSheet, PERIODS, type ExpenseFilters } from '../components/FilterSheet.tsx'
import { ScopeChips } from '../components/ScopeChips.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { ViewOptions } from '../components/ViewOptions.tsx'
import { ExpenseEditor } from '../components/ExpenseEditor.tsx'
import { ExpenseLine } from '../components/ExpenseLine.tsx'
import { Card, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { loadVisibleExpenses, saveViewMode, type ExpenseItem } from '../lib/api.ts'
import { monthSplit } from '../lib/derive.ts'
import { expenseSpan } from '../lib/expense-range.ts'
import { filterByScopeAndCategory, type ScopeFilter } from '../lib/finance-filters.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { monthEnd, monthName, shortDate } from '../lib/month.ts'
import { sumPaidBy } from '../lib/period.ts'
import type { ViewMode } from '../types/database.ts'

export function BreakdownScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error } = useFinance()
  const [preset, setPreset] = useState<ExpenseFilters['preset']>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [editing, setEditing] = useState<ExpenseItem | null>(null)
  const [toast, setToast] = useState('')
  const [reload, setReload] = useState(0)

  const end = monthEnd(month)
  const span = useMemo(() => expenseSpan(month, preset, customFrom, customTo), [month, preset, customFrom, customTo])

  useEffect(() => {
    if (preset !== 'custom') return
    setCustomFrom((current) => (current >= month && current <= end ? current : month))
    setCustomTo((current) => (current >= month && current <= end ? current : end))
  }, [month, end, preset])

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    setListLoading(true)
    loadVisibleExpenses(span, month)
      .then((rows) => {
        if (cancelled) return
        setExpenses(rows)
        setListError('')
      })
      .catch((caught) => {
        if (cancelled) return
        setExpenses([])
        setListError(caught instanceof Error ? caught.message : 'No pude cargar los gastos.')
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile?.id, span, month, reload])

  if (!profile) return null
  const me = profile
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const categories = data.categories.filter((category) => category.ownerId === null || category.ownerId === me.id)
  const mine = monthSplit(data).rows.find((row) => row.id === me.id)
  const shareLine = `Tu parte de los compartidos es ${mine?.percent ?? 0}% · ${formatMoney(mine?.share ?? 0)}`
  const friendly = me.viewMode === 'friendly'
  const source = listLoading ? [] : expenses
  const visible = filterByScopeAndCategory(source, { scope, categoryIds: friendly ? [] : categoryIds })
  const paidByMe = visible.filter((expense) => expense.payerId === me.id)
  const bubbles = [...paidByMe.reduce((map, expense) => {
    const category = data.categories.find((item) => item.id === expense.categoryId)
    const current = map.get(expense.categoryId) ?? {
      icon: category?.icon || DEFAULT_ICON,
      label: category?.name ?? 'Otros',
      amount: 0,
    }
    current.amount += expense.amount
    map.set(expense.categoryId, current)
    return map
  }, new Map<string, { icon: string; label: string; amount: number }>()).entries()].map(([id, item]) => ({ id, ...item }))
  const shared = sumPaidBy(
    visible.filter((expense) => expense.isShared),
    me.id,
  )
  const privateSpent = sumPaidBy(
    visible.filter((expense) => !expense.isShared),
    me.id,
  )
  const total = shared + privateSpent
  const sharedWidth = total > 0 ? (shared / total) * 100 : 0
  const privateWidth = total > 0 ? (privateSpent / total) * 100 : 0
  const periodTotal = sumPaidBy(visible, me.id)
  const periodShared = sumPaidBy(
    visible.filter((expense) => expense.isShared),
    me.id,
  )
  const periodPrivate = periodTotal - periodShared
  const periodSharedWidth = periodTotal > 0 ? (periodShared / periodTotal) * 100 : 0
  const periodPrivateWidth = periodTotal > 0 ? (periodPrivate / periodTotal) * 100 : 0
  const top = [...paidByMe.reduce((map, expense) => {
    const category = data.categories.find((item) => item.id === expense.categoryId)
    const current = map.get(expense.categoryId) ?? { label: category?.name ?? 'Otros', amount: 0 }
    current.amount += expense.amount
    map.set(expense.categoryId, current)
    return map
  }, new Map<string, { label: string; amount: number }>()).values()].sort((a, b) => b.amount - a.amount)[0]
  const selectedNames = categories.filter((category) => categoryIds.includes(category.id)).map((category) => category.name)
  const summaryParts: string[] = []
  if (preset !== 'month') {
    const label = PERIODS.find((period) => period.id === preset)?.label ?? 'Período'
    summaryParts.push(preset === 'custom' ? `${shortDate(customFrom || month)} – ${shortDate(customTo || end)}` : label)
  }
  if (scope !== 'all') summaryParts.push(scope === 'shared' ? 'Compartidos' : 'Privados')
  if (!friendly) summaryParts.push(...selectedNames)
  const activeCount = (preset === 'month' ? 0 : 1) + (friendly ? 0 : categoryIds.length) + (scope === 'all' ? 0 : 1)
  const filteredEmpty = !listLoading && visible.length === 0
  const filters: ExpenseFilters = { preset, customFrom, customTo, categoryIds }

  function applyFilters(next: ExpenseFilters) {
    setPreset(next.preset)
    setCustomFrom(next.customFrom)
    setCustomTo(next.customTo)
    if (!friendly) setCategoryIds(next.categoryIds)
    setSheetOpen(false)
  }

  function clearFilters() {
    setPreset('month')
    setCategoryIds([])
    setScope('all')
    setHighlightId(null)
  }

  async function changeMode(mode: ViewMode) {
    await saveViewMode(me.id, mode)
    await refreshProfile()
  }

  return (
    <>
      <SectionHeader
        lead="crumb"
        aside={
          <>
            <NotificationBell />
            <ViewOptions mode={me.viewMode} onChange={(mode) => void changeMode(mode)} />
          </>
        }
      />
      <MonthSwitcher heading />
      <div className="mb-3 flex items-center gap-2">
        <ScopeChips fill value={scope} onChange={setScope} />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label={activeCount > 0 ? `Filtros, ${activeCount} activos` : 'Filtros'}
          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full border text-lg ${
            activeCount > 0 ? 'border-primary bg-primary text-on-primary' : 'border-line bg-card text-primary'
          }`}
        >
          <AppIcon name="sliders" />
          {activeCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-card px-1 text-sm font-bold text-primary ring-2 ring-primary">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {activeCount > 0 ? (
        <p className="mb-3 text-sm font-semibold leading-6 text-muted">
          Mostrando: {summaryParts.join(' · ')}{' '}
          <button type="button" onClick={clearFilters} className="ml-1 inline-flex min-h-11 items-center font-bold text-primary">
            Limpiar
          </button>
        </p>
      ) : null}

      {listError ? <p className="mb-3 text-center text-sm font-bold text-alert-ink">{listError}</p> : null}

      {!friendly ? (
        <div className="mb-3">
          <h2 className="font-display text-sm font-semibold text-muted">Gastaste en {monthName(month)}</h2>
          {listLoading ? (
            <p className="mt-2 font-bold text-muted">Cargando…</p>
          ) : (
            <>
              <p className="mt-1 font-display text-[38px] font-semibold leading-none text-title">{formatMoney(total)}</p>
              <div className="my-2 flex h-3.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                <i className="h-full bg-good" style={{ width: `${sharedWidth}%` }} />
                <i className="h-full bg-warn-soft" style={{ width: `${privateWidth}%` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm font-semibold text-muted">
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="circle" className="text-sm text-good" /> Compartidos {formatMoney(shared)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="circle" className="text-sm text-warn-soft" /> Privados {formatMoney(privateSpent)}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-muted">Suma solo lo que pagaste vos.</p>
              <p className="text-sm font-semibold text-title">{shareLine}</p>
            </>
          )}
        </div>
      ) : null}

      {friendly && listLoading ? <p className="py-10 text-center font-bold text-muted">Cargando…</p> : null}

      {filteredEmpty ? (
        <Card className="py-8 text-center">
          <SoftEmpty />
          <p className="font-display text-lg font-semibold">Nada por acá</p>
          <p className="text-sm font-semibold text-muted">
            {friendly ? 'Con este período no hay gastos.' : 'Con este período y estas categorías no hay gastos.'}
          </p>
          <button type="button" onClick={clearFilters} className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary">
            Ver todo el mes
          </button>
        </Card>
      ) : null}

      {!listLoading && !filteredEmpty && friendly ? (
        <>
          <Bubbles
            items={bubbles}
            activeId={highlightId}
            onPick={(id) => setHighlightId((current) => (current === id ? null : id))}
          />
          <div className="mb-4 mt-2">
            <p className="text-sm font-semibold text-muted">Gastaste {formatMoney(periodTotal)} este mes</p>
            <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-sand" aria-hidden="true">
              <i className="h-full bg-good" style={{ width: `${periodSharedWidth}%` }} />
              <i className="h-full bg-warn-soft" style={{ width: `${periodPrivateWidth}%` }} />
            </div>
          </div>
          <BagPaidList expenses={visible.filter((expense) => expense.paidFromBag)} onOpen={setEditing} />
          <ExpenseRows
            expenses={highlightId ? visible.filter((expense) => expense.categoryId === highlightId) : visible}
            categories={data.categories}
            names={data.names}
            meId={me.id}
            onOpen={setEditing}
          />
        </>
      ) : null}

      {!listLoading && !filteredEmpty && !friendly ? (
        <Card>
          <ul>
            {visible.map((expense) => {
              const category = data.categories.find((item) => item.id === expense.categoryId)
              return (
                <li key={expense.id} className="border-b border-line last:border-0">
                  <ExpenseLine
                    expense={expense}
                    categoryName={category?.name ?? 'Otros'}
                    categoryIcon={category?.icon || DEFAULT_ICON}
                    partnerPaid={expense.isShared && expense.payerId !== me.id ? data.names[expense.payerId] : undefined}
                    showPrivate
                    onOpen={() => setEditing(expense)}
                  />
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      {top ? (
        <p className="mb-3 flex items-start gap-2 text-sm font-semibold text-title">
          <AppIcon name="lightbulb" className="mt-0.5 shrink-0 text-warn-ink" />
          Este mes: {top.label.toLowerCase()} fue tu gasto más grande.
        </p>
      ) : null}

      <FilterSheet
        open={sheetOpen}
        friendly={friendly}
        month={month}
        end={end}
        categories={categories}
        initial={filters}
        onClose={() => setSheetOpen(false)}
        onApply={applyFilters}
      />
      <Toast onDone={() => setToast('')}>{toast}</Toast>
      {editing ? (
        <ExpenseEditor
          presentation="sheet"
          expense={editing}
          onClose={() => setEditing(null)}
          onDone={(notice) => {
            setEditing(null)
            setToast(notice)
            setReload((current) => current + 1)
          }}
        />
      ) : null}
    </>
  )
}

function BagPaidList({ expenses, onOpen }: { expenses: ExpenseItem[]; onOpen: (expense: ExpenseItem) => void }) {
  if (expenses.length === 0) return null
  return (
    <ul className="mb-4">
      {expenses.map((expense) => (
        <li key={expense.id}>
          <button type="button" onClick={() => onOpen(expense)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm">
            <span className="min-w-0 font-semibold">
              <AppIcon name="bag-shopping" className="mr-1.5 text-primary" />
              {expense.title}
              <span className="text-muted"> · privado, pagado con la bolsa</span>
            </span>
            <span className="shrink-0 whitespace-nowrap font-display font-medium">{formatMoney(expense.amount)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ExpenseRows({
  expenses,
  categories,
  names,
  meId,
  onOpen,
}: {
  expenses: ExpenseItem[]
  categories: { id: string; name: string; icon: string }[]
  names: Record<string, string>
  meId: string
  onOpen: (expense: ExpenseItem) => void
}) {
  if (expenses.length === 0) return null
  return (
    <ul className="mb-4 overflow-hidden rounded-3xl bg-card px-4">
      {expenses.map((expense) => {
        const category = categories.find((item) => item.id === expense.categoryId)
        return (
          <li key={expense.id} className="border-b border-line last:border-0">
            <ExpenseLine
              expense={expense}
              categoryName={category?.name ?? 'Otros'}
              categoryIcon={category?.icon || DEFAULT_ICON}
              partnerPaid={expense.isShared && expense.payerId !== meId ? names[expense.payerId] : undefined}
              showPrivate
              onOpen={() => onOpen(expense)}
            />
          </li>
        )
      })}
    </ul>
  )
}

function SoftEmpty() {
  return (
    <svg viewBox="0 0 160 120" className="mx-auto mb-2 h-28 w-40" role="img" aria-label="Ilustración de un filtro sin gastos">
      <ellipse cx="80" cy="100" rx="48" ry="8" fill="var(--color-line)" />
      <circle cx="80" cy="62" r="30" fill="var(--color-alert)" />
      <path d="M80 84 C80 68 78 58 76 48" stroke="var(--color-good)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M76 60 C62 58 54 48 56 40 C70 40 78 50 76 60Z" fill="var(--color-sage-light)" />
      <circle cx="118" cy="34" r="9" fill="var(--color-warn)" />
    </svg>
  )
}
