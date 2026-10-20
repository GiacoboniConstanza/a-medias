import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { Bubbles } from '../components/Bubbles.tsx'
import { FilterSheet, PERIODS, type ExpenseFilters } from '../components/FilterSheet.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { Card } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { loadPayerExpenses, saveViewMode, type ExpenseItem } from '../lib/api.ts'
import { monthSplit } from '../lib/derive.ts'
import { expenseSpan } from '../lib/expense-range.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { monthEnd, shortDate } from '../lib/month.ts'
import type { ViewMode } from '../types/database.ts'

export function BreakdownScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error } = useFinance()
  const [preset, setPreset] = useState<ExpenseFilters['preset']>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  const end = monthEnd(month)
  const span = useMemo(() => expenseSpan(month, preset, customFrom, customTo), [month, preset, customFrom, customTo])

  useEffect(() => {
    if (preset !== 'custom') return
    setCustomFrom((current) => (current >= month && current <= end ? current : month))
    setCustomTo((current) => (current >= month && current <= end ? current : end))
  }, [month, end, preset])

  useEffect(() => {
    const payerId = profile?.id
    if (!payerId) return
    let cancelled = false
    setListLoading(true)
    loadPayerExpenses(payerId, span)
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
  }, [profile?.id, span])

  if (!profile) return null
  const me = profile
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const categories = data.categories.filter((category) => category.ownerId === null || category.ownerId === me.id)
  const mine = monthSplit(data).rows.find((row) => row.id === me.id)
  const shareLine = `Tu parte de los compartidos es ${mine?.percent ?? 0}% · ${formatMoney(mine?.share ?? 0)}`
  const friendly = me.viewMode === 'friendly'
  const source = listLoading ? [] : expenses
  const visible = friendly || categoryIds.length === 0 ? source : source.filter((expense) => categoryIds.includes(expense.categoryId))
  const bubbles = [...source.reduce((map, expense) => {
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
  const shared = visible.filter((expense) => expense.isShared).reduce((sum, expense) => sum + expense.amount, 0)
  const privateSpent = visible.filter((expense) => !expense.isShared).reduce((sum, expense) => sum + expense.amount, 0)
  const total = shared + privateSpent
  const sharedWidth = total > 0 ? (shared / total) * 100 : 0
  const privateWidth = total > 0 ? (privateSpent / total) * 100 : 0
  const periodTotal = source.reduce((sum, expense) => sum + expense.amount, 0)
  const periodShared = source.filter((expense) => expense.isShared).reduce((sum, expense) => sum + expense.amount, 0)
  const periodPrivate = periodTotal - periodShared
  const periodSharedWidth = periodTotal > 0 ? (periodShared / periodTotal) * 100 : 0
  const periodPrivateWidth = periodTotal > 0 ? (periodPrivate / periodTotal) * 100 : 0
  const top = [...visible.reduce((map, expense) => {
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
  if (!friendly) summaryParts.push(...selectedNames)
  const activeCount = (preset === 'month' ? 0 : 1) + (friendly ? 0 : categoryIds.length)
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
    setHighlightId(null)
  }

  async function changeMode(mode: ViewMode) {
    await saveViewMode(me.id, mode)
    await refreshProfile()
  }

  return (
    <>
      <SectionHeader icon="receipt" title="Gastos" />
      <MonthSwitcher heading />
      <div className="mb-3 flex items-center gap-2">
        <ViewToggle mode={me.viewMode} onChange={(mode) => void changeMode(mode)} className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label={activeCount > 0 ? `Filtros, ${activeCount} activos` : 'Filtros'}
          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full border text-lg ${
            activeCount > 0 ? 'border-primary bg-primary text-white' : 'border-[#E8DCCB] bg-card text-primary'
          }`}
        >
          <AppIcon name="sliders" />
          {activeCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-card px-1 text-xs font-extrabold text-primary ring-2 ring-primary">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {activeCount > 0 ? (
        <p className="mb-3 text-sm font-semibold leading-6 text-muted">
          Mostrando: {summaryParts.join(' · ')}{' '}
          <button type="button" onClick={clearFilters} className="ml-1 inline-flex min-h-11 items-center font-extrabold text-primary">
            Limpiar
          </button>
        </p>
      ) : null}

      <p className="mb-3 text-sm font-semibold text-text">{shareLine}</p>

      {listError ? <p className="mb-3 text-center text-sm font-bold text-alert-ink">{listError}</p> : null}

      {!friendly ? (
        <Card>
          <h2 className="font-display text-sm font-semibold text-muted">Gastaste</h2>
          {listLoading ? (
            <p className="mt-2 font-bold text-muted">Cargando…</p>
          ) : (
            <>
              <p className="mt-1 font-display text-3xl font-bold leading-none">{formatMoney(total)}</p>
              <div className="my-2 flex h-2.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                <i className="h-full bg-lavender" style={{ width: `${sharedWidth}%` }} />
                <i className="h-full bg-blush" style={{ width: `${privateWidth}%` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm font-semibold text-muted">
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="circle" className="text-[8px] text-lavender" /> Compartidos {formatMoney(shared)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="circle" className="text-[8px] text-blush" /> Privados {formatMoney(privateSpent)}
                </span>
              </div>
            </>
          )}
        </Card>
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
              <i className="h-full bg-lavender" style={{ width: `${periodSharedWidth}%` }} />
              <i className="h-full bg-blush" style={{ width: `${periodPrivateWidth}%` }} />
            </div>
          </div>
          <BagPaidList expenses={source.filter((expense) => expense.paidFromBag)} />
        </>
      ) : null}

      {!listLoading && !filteredEmpty && !friendly ? (
        <Card>
          <ul>
            {visible.map((expense) => {
              const category = data.categories.find((item) => item.id === expense.categoryId)
              return (
                <li key={expense.id} className="flex items-start justify-between gap-3 border-b border-dashed border-line py-3 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="font-extrabold">{expense.title}</p>
                    <p className="mt-0.5 font-semibold text-muted">
                      {shortDate(expense.spentOn)} · <AppIcon name={category?.icon || DEFAULT_ICON} /> {category?.name ?? 'Otros'} ·{' '}
                      {expense.isShared ? (
                        'Compartido'
                      ) : expense.paidFromBag ? (
                        <span className="text-text">
                          Privado · <AppIcon name="bag-shopping" className="text-primary" /> pagado con la bolsa
                        </span>
                      ) : (
                        'Privado'
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 font-extrabold">{formatMoney(expense.amount)}</p>
                </li>
              )
            })}
          </ul>
          <div className="mt-1 flex justify-between border-t border-line pt-3 text-base font-extrabold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </Card>
      ) : null}

      {top ? (
        <Card className="bg-warn/25">
          <div className="flex items-start gap-2">
            <AppIcon name="lightbulb" className="mt-0.5 shrink-0 text-alert-ink" />
            <p className="text-sm font-semibold leading-snug">
              <b>Este mes:</b> {top.label.toLowerCase()} fue tu gasto más grande.
            </p>
          </div>
        </Card>
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
    </>
  )
}

function BagPaidList({ expenses }: { expenses: ExpenseItem[] }) {
  if (expenses.length === 0) return null
  return (
    <ul className="mb-4">
      {expenses.map((expense) => (
        <li key={expense.id} className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span className="min-w-0 font-semibold">
            <AppIcon name="bag-shopping" className="mr-1.5 text-primary" />
            {expense.title}
            <span className="text-muted"> · privado, pagado con la bolsa</span>
          </span>
          <span className="shrink-0 font-extrabold">{formatMoney(expense.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

function SoftEmpty() {
  return (
    <svg viewBox="0 0 160 120" className="mx-auto mb-2 h-28 w-40" role="img" aria-label="Ilustración de un filtro sin gastos">
      <ellipse cx="80" cy="100" rx="48" ry="8" fill="#EADCCB" />
      <circle cx="80" cy="62" r="30" fill="#F7B7C4" />
      <path d="M80 84 C80 68 78 58 76 48" stroke="#6A784D" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M76 60 C62 58 54 48 56 40 C70 40 78 50 76 60Z" fill="#C7DDAE" />
      <circle cx="118" cy="34" r="9" fill="#F4C542" />
    </svg>
  )
}
