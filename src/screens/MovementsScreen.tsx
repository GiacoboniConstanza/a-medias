import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { Plantita } from '../components/Adornos.tsx'
import { ExpenseEditor } from '../components/ExpenseEditor.tsx'
import { FilterSheet, type ExpenseFilters, type WhoFilter } from '../components/FilterSheet.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Chip } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { buildSharedCsv, downloadText } from '../lib/csv.ts'
import { monthSplit, partnerId } from '../lib/derive.ts'
import { expenseSpan, type DatePreset, type ExpenseSpan } from '../lib/expense-range.ts'
import { matchesCategories, matchesScope, matchesSpan, type ScopeFilter } from '../lib/finance-filters.ts'
import { formatMoney, normalizeMoney } from '../lib/format.ts'
import { iconSurface } from '../lib/icons.ts'
import { loadLoanMovements, type PeriodLoan } from '../lib/loans.ts'
import { catamarcaToday, monthEnd, monthName, shortDate } from '../lib/month.ts'
import type { ExpenseItem } from '../lib/api.ts'

type MovementKind = 'todos' | 'gastos' | 'ingresos' | 'transferencias'

type MovementRow = {
  id: string
  kind: 'gasto' | 'ingreso' | 'transferencia'
  title: string
  subtitle: string
  amount: number
  signed: number | null
  spentOn: string
  period: string
  isShared: boolean
  private: boolean
  payerId?: string
  categoryId?: string | null
  icon: string
  fill: string
  border: string
  expense?: ExpenseItem
}

const EMPTY_FILTERS: ExpenseFilters = {
  preset: 'month',
  customFrom: '',
  customTo: '',
  categoryIds: [],
  scope: 'all',
  who: 'all',
}

export function MovementsScreen() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [params, setParams] = useSearchParams()
  const [transfers, setTransfers] = useState<PeriodLoan[]>([])
  const [editing, setEditing] = useState<ExpenseItem | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const tipo = (params.get('tipo') as MovementKind | null) ?? 'todos'
  const scopeParam = params.get('scope')
  const [filters, setFilters] = useState<ExpenseFilters>(() => ({
    ...EMPTY_FILTERS,
    scope: scopeParam === 'shared' || scopeParam === 'private' ? scopeParam : 'all',
  }))
  const end = monthEnd(month)

  useEffect(() => {
    if (scopeParam !== 'shared' && scopeParam !== 'private') return
    setFilters((current) => ({ ...current, scope: scopeParam }))
  }, [scopeParam])

  useEffect(() => {
    let active = true
    loadLoanMovements()
      .then((rows) => {
        if (active) setTransfers(rows.loans)
      })
      .catch(() => {
        if (active) setTransfers([])
      })
    return () => {
      active = false
    }
  }, [data])

  useEffect(() => {
    if (tipo === 'gastos') return
    setFilters((current) => {
      if ((current.scope ?? 'all') === 'all' && current.categoryIds.length === 0) return current
      return { ...current, scope: 'all', categoryIds: [] }
    })
  }, [tipo])

  if (!profile) return null
  if (loading && !data) {
    return (
      <div aria-busy="true" className="space-y-3 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-tarjeta" />
        ))}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="py-16 text-center">
        <p className="font-bold text-tinta">{error ?? 'No pude traer los movimientos.'}</p>
        <button type="button" className="mt-3 min-h-11 font-bold text-mostaza-ink" onClick={() => void refresh()}>
          Probar de nuevo
        </button>
      </div>
    )
  }

  const meId = profile.id
  const otherId = partnerId(data, meId)
  const partnerName = (otherId && data.names[otherId]) || null
  const settled = Boolean(data.settlement)
  const scope = (filters.scope ?? 'all') as ScopeFilter
  const who = (filters.who ?? 'all') as WhoFilter
  const span = expenseSpan(month, filters.preset as DatePreset, filters.customFrom || month, filters.customTo || end)

  const rows = buildRows({
    data,
    meId,
    month,
    partnerName: partnerName ?? 'tu compañera',
    otherId,
    scope,
    who,
    categoryIds: filters.categoryIds,
    preset: filters.preset,
    span,
    tipo,
    transfers,
  })

  const groups = groupByDay(rows, catamarcaToday())
  const totals = movementTotals(rows, tipo)
  const activeCount =
    (filters.preset === 'month' ? 0 : 1) +
    (tipo === 'gastos' && scope !== 'all' ? 1 : 0) +
    (tipo === 'gastos' ? filters.categoryIds.length : 0) +
    (who !== 'all' ? 1 : 0)
  const showing = showingLabel({ scope, who, tipo, partnerName })

  function setTipo(next: MovementKind) {
    const nextParams = new URLSearchParams(params)
    if (next === 'todos') nextParams.delete('tipo')
    else nextParams.set('tipo', next)
    setParams(nextParams, { replace: true })
  }

  function exportCsv() {
    const finance = data
    if (!finance) return
    const split = monthSplit(finance)
    const csv = buildSharedCsv(
      rows
        .filter((row) => row.kind === 'gasto' && row.expense)
        .map((row) => ({
          date: shortDate(row.spentOn),
          title: row.title,
          payer: finance.names[row.expense!.payerId] ?? '',
          amount: row.amount,
        })),
      split,
    )
    downloadText(`a-medias-movimientos-${month.slice(0, 7)}.csv`, csv)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
  }

  return (
    <>
      <SectionHeader lead="crumb" aside={<NotificationBell />} />
      <MonthSwitcher />
      {settled ? (
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-gris">
          <AppIcon name="lock" /> {monthName(month)} está saldado. Para cambiar un gasto, deshacé el saldo en Resumen.
        </p>
      ) : null}

      <div className="mb-3 flex h-[50px] items-center gap-1 rounded-full border-[1.5px] border-azul bg-tarjeta p-1" role="tablist" aria-label="Tipo">
        {(
          [
            { id: 'todos', label: 'Todos' },
            { id: 'gastos', label: 'Gastos' },
            { id: 'ingresos', label: 'Ingresos' },
            { id: 'transferencias', label: 'Transferencias' },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tipo === option.id}
            className={`flex h-[46px] flex-1 items-center justify-center rounded-full px-1 text-sm ${
              tipo === option.id ? 'border border-azul-ink bg-azul-claro font-bold text-tinta' : 'font-semibold text-tinta'
            }`}
            onClick={() => setTipo(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <Chip active={activeCount > 0} onClick={() => setFiltersOpen(true)}>
          <AppIcon name="sliders" /> Filtros
          {activeCount > 0 ? (
            <span className="ml-1 grid h-6 w-6 place-items-center rounded-full bg-tinta text-sm font-bold text-crema">{activeCount}</span>
          ) : null}
        </Chip>
        <p className="text-sm font-semibold text-gris">{rows.length} movimientos</p>
      </div>

      {activeCount > 0 ? (
        <p className="mb-3 text-sm font-medium text-gris">
          Mostrando: {showing}{' '}
          <button type="button" className="font-bold text-mostaza-ink" onClick={clearFilters}>
            Limpiar
          </button>
        </p>
      ) : null}

      {rows.length > 0 && totals ? (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border-[1.5px] border-azul bg-tarjeta px-3 py-2" aria-live="polite">
          {totals.map((total) => (
            <div key={total.label} className={totals.length === 1 ? 'col-span-2' : ''}>
              <p className="text-sm font-semibold text-gris">{total.label}</p>
              <p className={`whitespace-nowrap font-display text-lg font-semibold ${total.tone}`}>{total.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="py-10 text-center">
          <Plantita width={56} height={73} className="mx-auto" />
          <p className="mt-3 font-display text-lg font-semibold text-tinta">
            {activeCount > 0 || tipo !== 'todos' ? 'Con estos filtros no hay movimientos.' : 'Nada por acá'}
          </p>
          <p className="mt-1 text-sm font-medium text-gris">
            {activeCount > 0 || tipo !== 'todos'
              ? '0 movimientos'
              : `Todavía no hay movimientos en ${monthName(month)}. Tocá Cargar para sumar el primero.`}
          </p>
          {activeCount > 0 || tipo !== 'todos' ? (
            <button
              type="button"
              className="mt-3 min-h-11 font-bold text-mostaza-ink"
              onClick={() => {
                clearFilters()
                setParams({}, { replace: true })
              }}
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 text-sm font-semibold text-gris">{group.label}</h2>
              <ul className="space-y-0">
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="grid min-h-[62px] w-full grid-cols-[52px_1fr_auto] items-center gap-2 border-t border-dashed border-linea-punteada py-2 text-left"
                      onClick={() => {
                        if (row.expense) setEditing(row.expense)
                      }}
                    >
                      <span
                        className="grid h-10 w-10 place-items-center rounded-full border-2"
                        style={{ background: row.fill, borderColor: row.border, color: row.border }}
                      >
                        <AppIcon name={row.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-lg font-semibold text-tinta">{row.title}</span>
                          {row.private ? (
                            <span className="inline-flex h-[var(--alto-chip)] items-center gap-1 rounded-full border border-gris px-2 text-sm font-semibold text-gris">
                              <AppIcon name="lock" /> Privado
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-sm font-medium text-gris">{row.subtitle}</span>
                      </span>
                      <span
                        className={`whitespace-nowrap font-display text-lg font-semibold ${
                          row.kind === 'ingreso'
                            ? 'text-mostaza-ink'
                            : row.kind === 'transferencia'
                              ? 'text-ciruela-ink'
                              : 'text-tinta'
                        }`}
                      >
                        {row.signed == null ? formatMoney(row.amount) : formatSigned(row.signed)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button
            type="button"
            onClick={exportCsv}
            className="flex min-h-12 w-full items-center justify-between border-t border-dashed border-linea-punteada font-bold text-mostaza-ink"
          >
            <span className="inline-flex items-center gap-2">
              <AppIcon name="file-export" /> Exportar a planilla
            </span>
            <AppIcon name="chevron-right" />
          </button>
        </div>
      )}

      <FilterSheet
        open={filtersOpen}
        month={month}
        end={end}
        categories={data.categories}
        initial={{ ...filters, customFrom: filters.customFrom || month, customTo: filters.customTo || end }}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next)
          setFiltersOpen(false)
        }}
        title="Filtrar movimientos"
        applyLabel="Ver movimientos"
        tipo={tipo}
        partnerName={partnerName}
      />

      {editing ? (
        <ExpenseEditor
          presentation="sheet"
          expense={editing}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null)
            await refresh()
          }}
        />
      ) : null}
    </>
  )
}

function showingLabel(input: {
  scope: ScopeFilter
  who: WhoFilter
  tipo: MovementKind
  partnerName: string | null
}): string {
  const parts: string[] = []
  if (input.tipo === 'gastos' && input.scope !== 'all') {
    parts.push(input.scope === 'shared' ? 'Compartidos' : 'Privados')
  }
  if (input.who !== 'all' && input.partnerName) {
    if (input.tipo === 'gastos') parts.push(input.who === 'me' ? 'Pagaste vos' : `Pagó ${input.partnerName}`)
    else parts.push(input.who === 'me' ? 'Yo' : `Quién: ${input.partnerName}`)
  }
  return parts.join(' · ') || 'filtros'
}

function buildRows(input: {
  data: NonNullable<ReturnType<typeof useFinance>['data']>
  meId: string
  month: string
  partnerName: string
  otherId: string | null
  scope: ScopeFilter
  who: WhoFilter
  categoryIds: string[]
  preset: DatePreset
  span: ExpenseSpan
  tipo: MovementKind
  transfers: PeriodLoan[]
}): MovementRow[] {
  const { data, meId, month, partnerName, otherId, scope, who, categoryIds, preset, span, tipo, transfers } = input
  const items: MovementRow[] = []
  for (const expense of data.monthExpenses) {
    if (!matchesScope(expense.isShared, scope)) continue
    if (!matchesCategories(expense.categoryId, categoryIds)) continue
    if (preset !== 'month' && !matchesSpan(expense.spentOn, span)) continue
    if (who === 'me' && expense.payerId !== meId) continue
    if (who === 'partner' && expense.payerId === meId) continue
    const category = data.categories.find((item) => item.id === expense.categoryId)
    const title = expense.notes?.trim() || expense.title?.trim() || category?.name || 'Gasto'
    const paidByMe = expense.payerId === meId
    const subtitleParts = [
      paidByMe ? 'Pagaste vos' : `Pagó ${data.names[expense.payerId] ?? partnerName}`,
      expense.isShared ? 'Compartido' : null,
      expense.notes?.trim() && category?.name ? category.name : null,
    ].filter(Boolean)
    const surface = iconSurface(category?.icon || 'tag')
    items.push({
      id: expense.id,
      kind: 'gasto',
      title,
      subtitle: subtitleParts.join(' · '),
      amount: expense.amount,
      signed: paidByMe ? -expense.amount : null,
      spentOn: expense.spentOn,
      period: expense.period,
      isShared: expense.isShared,
      private: !expense.isShared,
      payerId: expense.payerId,
      categoryId: expense.categoryId,
      icon: category?.icon || 'tag',
      fill: surface.background,
      border: surface.border,
      expense,
    })
  }
  for (const extra of data.extrasThisMonth) {
    if (who === 'partner') continue
    if (preset !== 'month' && !matchesSpan(extra.receivedOn, span)) continue
    items.push({
      id: `extra-${extra.id}`,
      kind: 'ingreso',
      title: extra.label?.trim() || 'Ingreso',
      subtitle: 'Algo puntual',
      amount: extra.amount,
      signed: extra.amount,
      spentOn: extra.receivedOn,
      period: month,
      isShared: false,
      private: false,
      payerId: meId,
      icon: 'sack-dollar',
      fill: 'var(--color-mostaza-claro)',
      border: 'var(--color-mostaza-ink)',
    })
  }
  const base = data.bases[meId] ?? 0
  if (base > 0 && who !== 'partner') {
    const spentOn = `${month.slice(0, 8)}01`
    if (preset === 'month' || matchesSpan(spentOn, span)) {
      items.push({
        id: `sueldo-${month}`,
        kind: 'ingreso',
        title: 'Ingreso',
        subtitle: 'Sueldo',
        amount: base,
        signed: base,
        spentOn,
        period: month,
        isShared: false,
        private: false,
        payerId: meId,
        icon: 'sack-dollar',
        fill: 'var(--color-mostaza-claro)',
        border: 'var(--color-mostaza-ink)',
      })
    }
  }
  for (const transfer of transfers.filter((row) => row.period.slice(0, 10) === month.slice(0, 10))) {
    if (preset !== 'month' && !matchesSpan(transfer.period, span)) continue
    const sent = transfer.lenderId === meId
    if (who === 'me' && !sent) continue
    if (who === 'partner') {
      if (!otherId) continue
      if (sent ? transfer.borrowerId !== otherId : transfer.lenderId !== otherId) continue
    }
    items.push({
      id: `xfer-${transfer.lenderId}-${transfer.borrowerId}-${transfer.amount}-${transfer.period}`,
      kind: 'transferencia',
      title: 'Transferencia',
      subtitle: sent ? `Le pasaste a ${partnerName}` : `${partnerName} te pasó`,
      amount: transfer.amount,
      signed: sent ? -transfer.amount : transfer.amount,
      spentOn: transfer.period,
      period: transfer.period,
      isShared: false,
      private: false,
      payerId: transfer.lenderId,
      icon: 'right-left',
      fill: 'var(--color-ciruela-claro)',
      border: 'var(--color-ciruela-ink)',
    })
  }
  return items
    .filter((row) => {
      if (tipo === 'gastos') return row.kind === 'gasto'
      if (tipo === 'ingresos') return row.kind === 'ingreso'
      if (tipo === 'transferencias') return row.kind === 'transferencia'
      return true
    })
    .sort((a, b) => b.spentOn.localeCompare(a.spentOn))
}

function formatSigned(value: number): string {
  const amount = normalizeMoney(value)
  if (amount > 0) return `+${formatMoney(amount)}`
  return formatMoney(amount)
}

function groupByDay(rows: MovementRow[], today: string) {
  const map = new Map<string, MovementRow[]>()
  for (const row of rows) {
    const key = row.spentOn.slice(0, 10)
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return [...map.entries()].map(([day, dayRows]) => {
    const date = new Date(`${day}T12:00:00`)
    const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(date)
    const label =
      day === today
        ? `Hoy · ${weekday} ${Number(day.slice(8, 10))}`
        : `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${Number(day.slice(8, 10))}`
    return { label, rows: dayRows }
  })
}

function movementTotals(rows: MovementRow[], tipo: MovementKind): { label: string; value: string; tone: string }[] | null {
  if (rows.length === 0) return null
  if (tipo === 'gastos') {
    const total = rows.reduce((sum, row) => sum + row.amount, 0)
    return [{ label: 'Total de gastos', value: formatMoney(total), tone: 'text-tinta' }]
  }
  if (tipo === 'ingresos') {
    const total = rows.reduce((sum, row) => sum + row.amount, 0)
    return [{ label: 'Total de ingresos', value: formatMoney(total), tone: 'text-mostaza-ink' }]
  }
  const entered = rows.filter((row) => (row.signed ?? 0) > 0).reduce((sum, row) => sum + Math.abs(row.signed ?? 0), 0)
  const left = rows.filter((row) => (row.signed ?? 0) < 0).reduce((sum, row) => sum + Math.abs(row.signed ?? 0), 0)
  if (tipo === 'transferencias' || tipo === 'todos') {
    return [
      { label: 'Entró', value: `+${formatMoney(entered)}`, tone: 'text-mostaza-ink' },
      { label: 'Salió', value: formatMoney(-left), tone: 'text-tinta' },
    ]
  }
  return null
}
