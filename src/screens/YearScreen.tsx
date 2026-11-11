import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { Plantita } from '../components/Adornos.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { DonutBreakdown } from '../components/DonutBreakdown.tsx'
import { IncomeChart } from '../components/IncomeChart.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { MovementForm } from '../components/MovementForm.tsx'
import { ExpenseLine } from '../components/ExpenseLine.tsx'
import { Button, Card, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { loadCategoryYearExpenses, loadYearBalance, type ExpenseItem } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { abbreviateMoney, monthRows, monthSpan } from '../lib/year-rows.ts'
import {
  CATEGORY_COLORS,
  MONTH_NAMES,
  bestSavingMonth,
  biggestSpendingMonth,
  categoryPercents,
  incomeCaption,
  isFutureMonth,
  monthHeading,
  yearCell,
  yearGlancePhrase,
  yearHasData,
  yearMoments,
  yearTotals,
  type YearCategory,
  type YearReport,
  type YearSaving,
} from '../lib/year.ts'
import { savingPercent } from '../lib/savings.ts'

const ARROW = 'grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-lg text-mostaza-ink shadow-soft disabled:opacity-40'

export function YearScreen() {
  const { profile } = useAuth()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [report, setReport] = useState<YearReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ExpenseItem | null>(null)
  const [toast, setToast] = useState('')
  const [reload, setReload] = useState(0)
  const today = new Date()
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    loadYearBalance(year)
      .then((next) => {
        if (!cancelled) setReport(next)
      })
      .catch((caught) => {
        if (!cancelled) {
          setReport(null)
          setError(caught instanceof Error ? caught.message : 'No pude armar tu año.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year, reload])

  if (!profile) return null
  const category = report?.categories.find((item) => item.id === categoryId) ?? null
  const ready = report && yearHasData(report, today) ? report : null
  const accounting = true

  return (
    <>
      <SectionHeader
        lead="back"
        icon="chart-pie"
        title="Mi año"
        aside={
          <>
            <span className="mr-1 inline-flex min-h-7 items-center gap-1.5 rounded-2xl bg-salvia-claro px-2.5 py-1 text-sm font-bold text-mostaza-ink">
              <AppIcon name="lock" /> Solo vos
            </span>
          </>
        }
      />
      <div className="mb-3 flex items-center justify-between gap-3">
        <button type="button" className={ARROW} aria-label="Año anterior" disabled={year <= 2000} onClick={() => setYear((value) => value - 1)}>
          <AppIcon name="chevron-left" />
        </button>
        <p className="font-display text-[2rem] font-semibold leading-none">{year}</p>
        <button type="button" className={ARROW} aria-label="Año siguiente" disabled={year >= 2100} onClick={() => setYear((value) => value + 1)}>
          <AppIcon name="chevron-right" />
        </button>
      </div>

      {loading ? <YearSkeleton /> : null}
      {!loading && error ? <p className="py-10 text-center font-semibold text-tinta">{error}</p> : null}
      {!loading && !error && !ready ? <EmptyYear year={year} /> : null}
      {!loading && ready ? (
        accounting ? (
          <AccountingView report={ready} today={today} onCategory={setCategoryId} />
        ) : (
          <FriendlyView report={ready} today={today} onCategory={setCategoryId} />
        )
      ) : null}

      <Sheet
        open={category !== null}
        title={category?.name ?? 'Categoría'}
        onClose={() => setCategoryId(null)}
        footer={
          <Button type="button" variant="alt" onClick={() => setCategoryId(null)}>
            Cerrar
          </Button>
        }
      >
        {category && report ? (
          <CategoryDetail category={category} year={report.year} today={today} reload={reload} onOpen={setEditing} />
        ) : null}
      </Sheet>
      <Toast onDone={() => setToast('')}>{toast}</Toast>
      {editing ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-crema">
          <MovementForm
            expense={editing}
            onClose={() => setEditing(null)}
            onDone={() => {
              setEditing(null)
              setToast('Cambios guardados')
              setReload((current) => current + 1)
            }}
          />
        </div>
      ) : null}
    </>
  )
}

function FriendlyView({
  report,
  today,
  onCategory,
}: {
  report: YearReport
  today: Date
  onCategory: (id: string) => void
}) {
  const totals = yearTotals(report.months, report.year, today)
  const best = bestSavingMonth(report.months, report.year, today)
  const spender = biggestSpendingMonth(report.months, report.year, today)
  const percents = categoryPercents(report.categories)
  const moments = yearMoments(report, today)
  const caption = incomeCaption(report.months, report.year, today)

  return (
    <>
      <Card className="year-rise bg-[linear-gradient(160deg,var(--color-card),var(--color-salvia-claro))]">
        <div className="flex items-center gap-3">
          <YearPlant />
          <div>
            <h2 className="font-display text-[17px] font-semibold">Tu año en un vistazo</h2>
            <p className="text-sm font-bold text-title">{yearGlancePhrase(totals, report.previous)}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <Stat icon="arrow-down" label="Ingresos" value={totals.income} className="bg-sand" />
          <Stat icon="arrow-up" label="Gastos" value={totals.expenses} className="bg-rosa-claro" valueClass="text-rosa-texto" />
          <Stat icon="piggy-bank" label="Ahorraste" value={totals.saved} className="bg-salvia-claro" valueClass="text-mostaza-ink" />
        </div>
      </Card>

      <Card className="year-rise">
        <h2 className="mb-2 flex items-center gap-2 font-display text-[17px] font-semibold">
          <AppIcon name="seedling" className="text-mostaza-ink" /> Cómo fueron tus ingresos
        </h2>
        <p className="mb-1 flex flex-wrap gap-3.5 text-sm font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <AppIcon name="minus" className="text-mostaza-ink" /> Sueldo base
          </span>
          <span className="inline-flex items-center gap-1">
            <AppIcon name="circle" className="text-[9px] text-mostaza-ink" /> Extras
          </span>
        </p>
        <IncomeChart year={report.year} months={report.months} caption={caption} today={today} />
        <p className="mt-1.5 text-sm font-semibold text-muted">{caption}</p>
      </Card>

      <div className="mb-3 flex gap-3">
        <Card className="year-rise mb-0 flex-1 bg-[var(--color-salvia-claro)]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-salvia-claro text-mostaza-ink">
            <AppIcon name="trophy" />
          </span>
          <p className="mt-2 text-sm text-muted">Tu mejor mes</p>
          <p className="font-display text-xl font-semibold">{best ? monthHeading(best.month) : '—'}</p>
          <p className="text-sm text-muted">{best?.saved != null ? `Ahorraste ${formatMoney(best.saved)}` : 'Todavía no hay un mes para comparar'}</p>
        </Card>
        <Card className="year-rise mb-0 flex-1 bg-rosa-claro">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-rosa-claro text-tinta">
            <AppIcon name="fire" />
          </span>
          <p className="mt-2 text-sm text-muted">El mes más gastador</p>
          <p className="font-display text-xl font-semibold">{spender ? monthHeading(spender.month) : '—'}</p>
          <p className="text-sm text-muted">{spender?.expenses != null ? `Gastaste ${formatMoney(spender.expenses)}` : 'Cuando anotes gastos, va a aparecer acá'}</p>
        </Card>
      </div>

      <Card className="year-rise">
        {report.categories.length === 0 ? (
          <>
            <h2 className="mb-2 flex items-center gap-2 font-display text-[17px] font-semibold">
              <AppIcon name="chart-pie" className="text-mostaza-ink" /> ¿En qué se me fue?
            </h2>
            <p className="text-sm font-semibold text-muted">Cuando anotes gastos, vas a ver en qué se fueron.</p>
          </>
        ) : (
          <>
            <DonutBreakdown
              title="¿En qué se me fue?"
              titleIcon={<AppIcon name="chart-pie" className="text-mostaza-ink" />}
              center={{ kicker: 'Gastaste', value: formatMoney(report.categories.reduce((sum, item) => sum + item.total, 0)) }}
              slices={report.categories.map((item, index) => {
                const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0]
                return {
                  id: item.id,
                  label: item.name,
                  amount: item.total,
                  color: color.fill,
                  ink: color.ink,
                  soft: color.ink !== 'var(--color-tinta)',
                  percent: `${percents[index] ?? 0}%`,
                  marker: <AppIcon name={item.icon} />,
                }
              })}
              onSelect={onCategory}
            />
            <p className="mt-2 text-center text-sm font-semibold text-muted">
              <AppIcon name="hand-pointer" /> Tocá una categoría para ver el detalle
            </p>
          </>
        )}
      </Card>

      <Card className="year-rise">
        <h2 className="mb-3 flex items-center gap-2 font-display text-[17px] font-semibold">
          <AppIcon name="piggy-bank" className="text-mostaza-ink" /> Tus ahorros
        </h2>
        {report.savings.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Cuando cargues un aporte, lo vas a ver acá.</p>
        ) : (
          <div className="space-y-3">
            {report.savings.map((saving) => (
              <YearSavingCard key={saving.id} saving={saving} />
            ))}
          </div>
        )}
      </Card>

      <h2 className="year-rise mb-2.5 flex items-center gap-2 px-1 font-display text-[17px] font-semibold">
        <AppIcon name="star" className="text-mostaza-ink" /> Momentos del año
      </h2>
      {moments.map((moment) => (
        <Card key={moment.text} className="year-rise flex items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              moment.tone === 'blush' ? 'bg-rosa-claro text-tinta' : moment.tone === 'sun' ? 'bg-mostaza-claro text-tinta' : 'bg-salvia-claro text-mostaza-ink'
            }`}
          >
            <AppIcon name={moment.icon} />
          </span>
          <p className="text-sm font-semibold">{moment.text}</p>
        </Card>
      ))}
    </>
  )
}

function AccountingView({
  report,
  today,
  onCategory,
}: {
  report: YearReport
  today: Date
  onCategory: (id: string) => void
}) {
  const totals = yearTotals(report.months, report.year, today)
  const percents = categoryPercents(report.categories)
  const moments = yearMoments(report, today)
  const rows = monthRows(report.months, report.year, today)
  const [openMonth, setOpenMonth] = useState<number | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <Card className="mb-0">
        <h2 className="mb-3 font-display text-[17px] font-semibold">Resumen</h2>
        <ul>
          <SummaryRow icon="arrow-down" label="Ingresos" value={totals.income} iconClass="bg-sand text-mostaza-ink" />
          <SummaryRow icon="arrow-up" label="Gastos" value={totals.expenses} iconClass="bg-rosa-claro text-tinta" valueClass="text-rosa-texto" />
          <SummaryRow icon="piggy-bank" label="Ahorraste" value={totals.saved} iconClass="bg-salvia-claro text-mostaza-ink" valueClass="text-mostaza-ink" />
        </ul>
      </Card>
      <Card className="mb-0">
        <h2 className="mb-3 font-display text-[17px] font-semibold">Mes por mes</h2>
        <ul>
          {rows.map((row) => {
            if (row.kind === 'empty') {
              return (
                <li key={`empty-${row.from}`} className="border-b border-line py-1.5 text-sm font-semibold leading-5 text-muted last:border-b-0">
                  {monthSpan(row.from, row.to)} · sin registros
                </li>
              )
            }
            if (row.kind === 'future') {
              const pending = row.from === row.to ? 'todavía no llega' : 'todavía no llegan'
              return (
                <li key={`future-${row.from}`} className="border-b border-line py-1.5 text-sm font-medium leading-5 text-muted last:border-b-0">
                  {monthSpan(row.from, row.to)} · {pending}
                </li>
              )
            }
            const month = row.month
            const open = openMonth === month.month
            return (
              <li key={month.month} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  className="flex h-14 w-full items-center gap-2 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenMonth((current) => (current === month.month ? null : month.month))}
                >
                  <span className="shrink-0 text-[15px] font-semibold">{monthHeading(month.month)}</span>
                  <span className="flex min-w-0 flex-1 justify-end">
                    {month.saved === null ? (
                      <span className="font-display text-base font-semibold text-muted tabular-nums">—</span>
                    ) : (
                      <FitMoney value={month.saved} className={`w-full text-right font-display text-base font-semibold ${savingTone(month.saved)}`} />
                    )}
                  </span>
                  <AppIcon name="chevron-down" className={`shrink-0 text-sm text-muted transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
                </button>
                <div
                  aria-hidden={!open}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <dl className="grid grid-cols-2 gap-3 py-3">
                      <MonthFact label="Sueldo" value={month.base} />
                      <MonthFact label="Extras" value={month.extras} />
                      <MonthFact label="Gastos" value={month.expenses} />
                      <MonthFact label="Ahorro" value={month.saved} valueClass={savingTone(month.saved)} />
                    </dl>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 flex h-14 items-center justify-between rounded-2xl bg-salvia-claro px-3 font-display">
          <span className="text-base font-semibold text-title">Total del año</span>
          {totals.saved === null ? (
            <span className="text-xl font-bold text-muted tabular-nums">—</span>
          ) : (
            <FitMoney value={totals.saved} className={`max-w-[58%] text-right text-xl font-bold ${savingTone(totals.saved)}`} />
          )}
        </div>
      </Card>
      <Card className="mb-0">
        <h2 className="mb-3 font-display text-[17px] font-semibold">Categoría por categoría</h2>
        {report.categories.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Todavía no hay gastos en categorías.</p>
        ) : (
          <ul>
            {report.categories.map((category, index) => {
              const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0]
              const percent = percents[index] ?? 0
              return (
                <li key={category.id} className="border-b border-line last:border-b-0">
                  <button type="button" className="flex h-14 w-full items-center gap-3 text-left" onClick={() => onCategory(category.id)}>
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm ${color.ink === 'var(--color-tinta)' ? '' : 'ring-1 ring-line ring-inset'}`}
                      style={{ background: color.fill, color: color.ink }}
                      aria-hidden="true"
                    >
                      <AppIcon name={category.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-tight">{category.name}</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                        <span className="block h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%`, background: color.fill }} />
                      </span>
                    </span>
                    <span className="flex w-[7.25rem] shrink-0 flex-col items-end">
                      <FitMoney value={category.total} className="w-full text-right font-display text-sm font-semibold" />
                      <span className="text-sm font-semibold leading-none text-muted">{percent}%</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card className="mb-0">
        <h2 className="mb-3 font-display text-[17px] font-semibold">Ahorros y momentos</h2>
        <Table>
          <tbody>
            <tr>
              <th className="py-2 text-left font-semibold">Extras del año</th>
              <td className="py-2 text-right font-bold">{yearCell(report.extrasTotal)}</td>
            </tr>
            {report.savings.map((saving) => {
              const shown = saving.isShared ? saving.balance : saving.mine
              return (
                <tr key={saving.id}>
                  <th className="border-t border-dashed border-line py-2 text-left font-semibold">
                    {saving.name}
                    {saving.archived ? ' (archivado)' : ''}
                  </th>
                  <td className="border-t border-dashed border-line py-2 text-right">
                    {formatMoney(shown)}
                    {saving.yearIn > 0 || saving.yearOut > 0
                      ? ` · +${formatMoney(saving.yearIn)}${saving.yearOut > 0 ? ` / −${formatMoney(saving.yearOut)}` : ''}`
                      : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        <ul className="mt-3">
          {moments.map((moment) => (
            <li key={moment.text} className="border-t border-dashed border-line py-2 text-sm font-semibold">
              {moment.text}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function SummaryRow({
  icon,
  label,
  value,
  iconClass,
  valueClass = '',
}: {
  icon: string
  label: string
  value: number | null
  iconClass: string
  valueClass?: string
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-line last:border-b-0">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${iconClass}`}>
        <AppIcon name={icon} />
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-semibold">{label}</span>
      <span className={`shrink-0 font-display text-base font-semibold tabular-nums ${valueClass}`}>{yearCell(value)}</span>
    </li>
  )
}

function MonthFact({ label, value, valueClass = '' }: { label: string; value: number | null; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className={`font-display text-base font-semibold break-words tabular-nums ${valueClass}`}>{yearCell(value)}</dd>
    </div>
  )
}

function FitMoney({ value, className = '' }: { value: number; className?: string }) {
  const full = formatMoney(value)
  const boxRef = useRef<HTMLSpanElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [tight, setTight] = useState(false)

  useLayoutEffect(() => {
    const box = boxRef.current
    const probe = probeRef.current
    if (!box || !probe) return
    const measure = () => setTight(probe.offsetWidth > box.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [full])

  return (
    <span ref={boxRef} className={`relative block min-w-0 truncate tabular-nums ${className}`}>
      <span ref={probeRef} className="invisible absolute top-0 left-0 whitespace-nowrap" aria-hidden="true">
        {full}
      </span>
      <span aria-hidden="true">{tight ? abbreviateMoney(value) : full}</span>
      <span className="sr-only">{full}</span>
    </span>
  )
}

function savingTone(value: number | null): string {
  if (value === null) return 'text-muted'
  return value < 0 ? 'text-rosa-texto' : 'text-mostaza-ink'
}

function CategoryDetail({
  category,
  year,
  today,
  reload,
  onOpen,
}: {
  category: YearCategory
  year: number
  today: Date
  reload: number
  onOpen: (expense: ExpenseItem) => void
}) {
  const [rows, setRows] = useState<ExpenseItem[]>([])
  useEffect(() => {
    let cancelled = false
    loadCategoryYearExpenses(category.id, year)
      .then((next) => {
        if (!cancelled) setRows(next)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [category.id, year, reload])
  const max = Math.max(...category.months.map((amount) => amount ?? 0), 0)
  return (
    <>
      <p className="mb-3 font-display text-2xl font-semibold">{formatMoney(category.total)}</p>
      <ul>
        {category.months.map((amount, index) => {
          const future = isFutureMonth(year, index + 1, today)
          const width = amount && max > 0 ? Math.max((amount / max) * 100, 8) : 0
          return (
            <li key={MONTH_NAMES[index]} className="flex min-h-11 items-center gap-3">
              <span className={`w-24 shrink-0 text-sm font-semibold capitalize ${future ? 'text-muted' : ''}`}>
                {MONTH_NAMES[index]}
                {future ? ' · aún no' : ''}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                {amount !== null && amount > 0 ? <span className="year-bar block h-full rounded-full bg-mostaza" style={{ width: `${width}%` }} /> : null}
              </span>
              <span className="w-24 shrink-0 text-right font-display text-sm font-semibold">{yearCell(amount)}</span>
            </li>
          )
        })}
      </ul>
      {rows.length > 0 ? (
        <ul className="mt-3 border-t border-dashed border-line">
          {rows.map((expense) => (
            <li key={expense.id} className="border-b border-dashed border-line last:border-0">
              <ExpenseLine expense={expense} categoryName={category.name} categoryIcon={category.icon} onOpen={() => onOpen(expense)} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

function YearSavingCard({ saving }: { saving: YearSaving }) {
  const shown = saving.isShared ? saving.balance : saving.mine
  const pct = saving.target != null && saving.target > 0 ? savingPercent(shown, saving.target) : null
  return (
    <article className="rounded-2xl border-2 border-azul-ink bg-tarjeta p-4 text-tinta">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-azul-ink bg-azul-claro text-azul-ink">
          <AppIcon name={saving.icon || 'piggy-bank'} />
        </span>
        <p className="min-w-0 flex-1 font-display text-lg font-semibold">{saving.name}</p>
        {saving.isShared ? <span className="text-sm font-semibold text-gris">Compartido</span> : null}
        {saving.archived ? <span className="text-sm font-semibold text-gris">Archivado</span> : null}
      </div>
      <p className="mt-3 whitespace-nowrap font-display text-[36px] font-semibold leading-none">{formatMoney(shown)}</p>
      {pct != null ? (
        <div className="mt-3">
          <div className="h-[10px] overflow-hidden rounded-full border-[1.5px] border-tinta bg-tarjeta">
            <div className="h-full border-r-[1.5px] border-tinta bg-mostaza" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-sm font-semibold text-gris">
            {pct} % de {formatMoney(saving.target ?? 0)}
          </p>
        </div>
      ) : null}
      {saving.isShared ? (
        <p className="mt-2 text-sm font-semibold text-gris">
          Lo tuyo: <span className="font-display text-tinta">{formatMoney(saving.mine)}</span>
        </p>
      ) : null}
      {saving.yearIn > 0 || saving.yearOut > 0 ? (
        <p className="mt-2 text-sm font-semibold text-gris">
          Este año: +{formatMoney(saving.yearIn)}
          {saving.yearOut > 0 ? ` / −${formatMoney(saving.yearOut)}` : ''}
        </p>
      ) : null}
    </article>
  )
}

function Stat({
  icon,
  label,
  value,
  className,
  valueClass = '',
}: {
  icon: string
  label: string
  value: number | null
  className: string
  valueClass?: string
}) {
  return (
    <div className={`min-w-0 flex-1 rounded-[18px] px-2 py-2.5 text-center ${className}`}>
      <p className="text-sm text-muted">
        <AppIcon name={icon} /> {label}
      </p>
      <p className={`mt-0.5 font-display text-[14.5px] font-semibold leading-tight ${valueClass}`}>{yearCell(value)}</p>
    </div>
  )
}

function YearPlant() {
  return <Plantita width={54} height={70} />
}

function EmptyYear({ year }: { year: number }) {
  return (
    <Card className="year-rise bg-[linear-gradient(160deg,var(--color-card),var(--color-salvia-claro))] text-center">
      <div className="flex justify-center">
        <YearPlant />
      </div>
      <h2 className="mt-2 font-display text-xl font-semibold">Todavía no hay datos de {year}</h2>
      <p className="mt-1 text-sm font-semibold text-muted">Cuando cargues el sueldo o un gasto, tu año va a aparecer acá. Con calma.</p>
      <Link to="/sueldo" className="mt-3 inline-flex min-h-11 items-center font-semibold text-mostaza-ink">
        Cargar sueldo base
      </Link>
    </Card>
  )
}

function YearSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Cargando tu año…</p>
      <div className="mb-3 h-36 animate-pulse rounded-2xl bg-sand motion-reduce:animate-none" />
      <div className="mb-3 h-64 animate-pulse rounded-2xl bg-sand motion-reduce:animate-none" />
      <div className="mb-3 flex gap-3">
        <div className="h-28 flex-1 animate-pulse rounded-2xl bg-sand motion-reduce:animate-none" />
        <div className="h-28 flex-1 animate-pulse rounded-2xl bg-sand motion-reduce:animate-none" />
      </div>
    </div>
  )
}

function Table({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-sm">{children}</table>
}
