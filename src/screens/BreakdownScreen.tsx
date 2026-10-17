import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { Bubbles } from '../components/Bubbles.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { Card, Chip, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { loadPayerExpenses, saveViewMode, type ExpenseItem } from '../lib/api.ts'
import { expenseSpan, type DatePreset } from '../lib/expense-range.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { monthEnd, shortDate } from '../lib/month.ts'
import type { ViewMode } from '../types/database.ts'

const DATE_FILTERS: { id: DatePreset; label: string }[] = [
  { id: 'month', label: 'Todo el mes' },
  { id: 'week1', label: 'Semana 1' },
  { id: 'week2', label: 'Semana 2' },
  { id: 'week3', label: 'Semana 3' },
  { id: 'rest', label: 'Semana 4/5' },
  { id: 'weekends', label: 'Fines de semana' },
  { id: 'custom', label: 'Elegir días' },
]

export function BreakdownScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error } = useFinance()
  const [preset, setPreset] = useState<DatePreset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
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
  const source = listLoading ? [] : expenses
  const visible = categoryIds.length === 0 ? source : source.filter((expense) => categoryIds.includes(expense.categoryId))
  const totals = new Map<string, { icon: string; label: string; amount: number }>()
  for (const expense of source) {
    const category = data.categories.find((item) => item.id === expense.categoryId)
    const current = totals.get(expense.categoryId) ?? {
      icon: category?.icon || DEFAULT_ICON,
      label: category?.name ?? 'Otros',
      amount: 0,
    }
    current.amount += expense.amount
    totals.set(expense.categoryId, current)
  }
  const bubbles = [...totals.entries()].map(([id, item]) => ({ id, ...item }))
  const shared = visible.filter((expense) => expense.isShared).reduce((sum, expense) => sum + expense.amount, 0)
  const privateSpent = visible.filter((expense) => !expense.isShared).reduce((sum, expense) => sum + expense.amount, 0)
  const total = shared + privateSpent
  const sharedWidth = total > 0 ? (shared / total) * 100 : 0
  const privateWidth = total > 0 ? (privateSpent / total) * 100 : 0
  const top = [...visible.reduce((map, expense) => {
    const category = data.categories.find((item) => item.id === expense.categoryId)
    const current = map.get(expense.categoryId) ?? { label: category?.name ?? 'Otros', amount: 0 }
    current.amount += expense.amount
    map.set(expense.categoryId, current)
    return map
  }, new Map<string, { label: string; amount: number }>()).values()].sort((a, b) => b.amount - a.amount)[0]
  const selectedNames = categories.filter((category) => categoryIds.includes(category.id)).map((category) => category.name)
  const friendly = me.viewMode === 'friendly'
  const filteredEmpty = !listLoading && visible.length === 0

  function choosePreset(next: DatePreset) {
    setPreset(next)
    if (next !== 'custom') return
    setCustomFrom((current) => (current >= month && current <= end ? current : month))
    setCustomTo((current) => (current >= month && current <= end ? current : end))
  }

  function toggleCategory(id: string) {
    setCategoryIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function pickBubble(id: string) {
    setCategoryIds((current) => (current.length === 1 && current[0] === id ? [] : [id]))
  }

  function clearFilters() {
    setPreset('month')
    setCategoryIds([])
  }

  async function changeMode(mode: ViewMode) {
    await saveViewMode(me.id, mode)
    await refreshProfile()
  }

  return (
    <>
      <p className="text-sm font-bold text-muted">Hola, {me.displayName}</p>
      <MonthSwitcher heading />
      <ViewToggle mode={me.viewMode} onChange={(mode) => void changeMode(mode)} className="mb-3" />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Período">
        {DATE_FILTERS.map((filter) => (
          <Chip key={filter.id} active={preset === filter.id} onClick={() => choosePreset(filter.id)}>
            {filter.label}
          </Chip>
        ))}
      </div>

      {preset === 'custom' ? (
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm font-bold text-muted">
              Desde
              <input
                type="date"
                min={month}
                max={end}
                value={customFrom || month}
                onChange={(event) => {
                  const next = event.target.value
                  setCustomFrom(next)
                  setCustomTo((current) => ((current || end) < next ? next : current))
                }}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-sm font-bold text-muted">
              Hasta
              <input
                type="date"
                min={month}
                max={end}
                value={customTo || end}
                onChange={(event) => {
                  const next = event.target.value
                  setCustomTo(next)
                  setCustomFrom((current) => ((current || month) > next ? next : current))
                }}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          </div>
        </Card>
      ) : null}

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categorías">
        <Chip active={categoryIds.length === 0} onClick={() => setCategoryIds([])}>
          Todas
        </Chip>
        {categories.map((category) => (
          <Chip key={category.id} active={categoryIds.includes(category.id)} onClick={() => toggleCategory(category.id)}>
            <AppIcon name={category.icon} /> {category.name}
          </Chip>
        ))}
      </div>

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

      {listError ? <p className="mb-3 text-center text-sm font-bold text-alert-ink">{listError}</p> : null}

      {filteredEmpty ? (
        <Card className="py-8 text-center">
          <SoftEmpty />
          <p className="font-display text-lg font-semibold">Nada por acá</p>
          <p className="text-sm font-semibold text-muted">Con este período y estas categorías no hay gastos.</p>
          <button type="button" onClick={clearFilters} className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary">
            Ver todo el mes
          </button>
        </Card>
      ) : null}

      {!listLoading && !filteredEmpty && friendly ? (
        <Card>
          {categoryIds.length > 0 ? (
            <div className="mb-3 text-center">
              <p className="text-sm font-bold text-muted">
                {selectedNames.length === 1 ? selectedNames[0] : 'Categorías elegidas'}
              </p>
              <p className="font-display text-3xl font-bold leading-none">{formatMoney(total)}</p>
            </div>
          ) : null}
          <Bubbles items={bubbles} activeIds={categoryIds} onPick={pickBubble} />
        </Card>
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
                      {expense.isShared ? 'Compartido' : 'Privado'}
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
    </>
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
