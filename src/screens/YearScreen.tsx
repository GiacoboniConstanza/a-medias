import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { DonutBreakdown } from '../components/DonutBreakdown.tsx'
import { IncomeChart } from '../components/IncomeChart.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { loadYearBalance } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { abbreviateMoney, monthRows, monthSpan } from '../lib/year-rows.ts'
import {
  CATEGORY_COLORS,
  MONTH_NAMES,
  bestSavingMonth,
  biggestSpendingMonth,
  categoryPercents,
  gustosSentence,
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
} from '../lib/year.ts'

const ARROW = 'grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-lg text-primary shadow-soft disabled:opacity-40'

export function YearScreen() {
  const { profile } = useAuth()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [report, setReport] = useState<YearReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accounting, setAccounting] = useState(profile?.viewMode === 'accounting')
  const [categoryId, setCategoryId] = useState<string | null>(null)
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
  }, [year])

  if (!profile) return null
  const category = report?.categories.find((item) => item.id === categoryId) ?? null
  const ready = report && yearHasData(report, today) ? report : null

  return (
    <>
      <Link to="/" className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-text">
        <AppIcon name="chevron-left" /> Volver
      </Link>
      <header className="mb-1 flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-1.5 font-display text-base font-semibold text-primary">
          <AppIcon name="chart-pie" /> Mi año
        </h1>
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-2xl bg-sage-light px-2.5 py-1 text-xs font-extrabold text-primary">
          <AppIcon name="lock" /> Solo vos
        </span>
      </header>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <button type="button" className={ARROW} aria-label="Año anterior" disabled={year <= 2000} onClick={() => setYear((value) => value - 1)}>
          <AppIcon name="chevron-left" />
        </button>
        <p className="font-display text-[2rem] font-bold leading-none">{year}</p>
        <button type="button" className={ARROW} aria-label="Año siguiente" disabled={year >= 2100} onClick={() => setYear((value) => value + 1)}>
          <AppIcon name="chevron-right" />
        </button>
      </div>

      {loading ? <YearSkeleton /> : null}
      {!loading && error ? <p className="py-10 text-center font-extrabold text-alert-ink">{error}</p> : null}
      {!loading && !error && !ready ? <EmptyYear year={year} /> : null}
      {!loading && ready ? (
        <>
          {accounting ? <AccountingView report={ready} today={today} onCategory={setCategoryId} /> : <FriendlyView report={ready} today={today} onCategory={setCategoryId} />}
          <button
            type="button"
            aria-pressed={accounting}
            className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-[20px] border-2 border-primary bg-transparent px-4 py-3 text-center font-extrabold text-primary"
            onClick={() => setAccounting((value) => !value)}
          >
            <AppIcon name={accounting ? 'chart-pie' : 'table-list'} />
            {accounting ? 'Ver en vista amigable' : 'Ver en vista contable'}
          </button>
        </>
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
        {category && report ? <CategoryDetail category={category} year={report.year} today={today} /> : null}
      </Sheet>
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
      <Card className="year-rise bg-[linear-gradient(160deg,#FFFAF4,#eef5e3)]">
        <div className="flex items-center gap-3">
          <YearPlant />
          <div>
            <h2 className="font-display text-[17px] font-semibold">Tu año en un vistazo</h2>
            <p className="text-sm font-bold text-good">{yearGlancePhrase(totals, report.previous)}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <Stat icon="arrow-down" label="Ingresos" value={totals.income} className="bg-[#F2EADF]" />
          <Stat icon="arrow-up" label="Gastos" value={totals.expenses} className="bg-[#FCE6EA]" valueClass="text-alert-ink" />
          <Stat icon="piggy-bank" label="Ahorraste" value={totals.saved} className="bg-[#E3EED4]" valueClass="text-primary" />
        </div>
      </Card>

      <Card className="year-rise">
        <h2 className="mb-2 flex items-center gap-2 font-display text-[17px] font-semibold">
          <AppIcon name="seedling" className="text-primary" /> Cómo fueron tus ingresos
        </h2>
        <p className="mb-1 flex flex-wrap gap-3.5 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <AppIcon name="minus" className="text-primary" /> Sueldo base
          </span>
          <span className="inline-flex items-center gap-1">
            <AppIcon name="circle" className="text-[9px] text-warn" /> Extras (a la bolsa)
          </span>
        </p>
        <IncomeChart year={report.year} months={report.months} caption={caption} today={today} />
        <p className="mt-1.5 text-xs font-semibold text-muted">{caption}</p>
      </Card>

      <div className="mb-3 flex gap-3">
        <Card className="year-rise mb-0 flex-1 bg-[#eef5e3]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-sage-light text-primary">
            <AppIcon name="trophy" />
          </span>
          <p className="mt-2 text-xs text-muted">Tu mejor mes</p>
          <p className="font-display text-xl font-bold">{best ? monthHeading(best.month) : '—'}</p>
          <p className="text-xs text-muted">{best?.saved != null ? `Ahorraste ${formatMoney(best.saved)}` : 'Todavía no hay un mes para comparar'}</p>
        </Card>
        <Card className="year-rise mb-0 flex-1 bg-[#fdeee9]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-blush text-alert-ink">
            <AppIcon name="fire" />
          </span>
          <p className="mt-2 text-xs text-muted">El mes más gastador</p>
          <p className="font-display text-xl font-bold">{spender ? monthHeading(spender.month) : '—'}</p>
          <p className="text-xs text-muted">{spender?.expenses != null ? `Gastaste ${formatMoney(spender.expenses)}` : 'Cuando anotes gastos, va a aparecer acá'}</p>
        </Card>
      </div>

      <Card className="year-rise">
        {report.categories.length === 0 ? (
          <>
            <h2 className="mb-2 flex items-center gap-2 font-display text-[17px] font-semibold">
              <AppIcon name="chart-pie" className="text-primary" /> ¿En qué se me fue?
            </h2>
            <p className="text-sm font-semibold text-muted">Cuando anotes gastos, vas a ver en qué se fueron.</p>
          </>
        ) : (
          <>
            <DonutBreakdown
              title="¿En qué se me fue?"
              titleIcon={<AppIcon name="chart-pie" className="text-primary" />}
              center={{ kicker: 'Gastaste', value: formatMoney(report.categories.reduce((sum, item) => sum + item.total, 0)) }}
              slices={report.categories.map((item, index) => {
                const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0]
                return {
                  id: item.id,
                  label: item.name,
                  amount: item.total,
                  color: color.fill,
                  ink: color.ink,
                  soft: color.ink !== '#ffffff',
                  percent: `${percents[index] ?? 0}%`,
                  marker: <AppIcon name={item.icon} />,
                }
              })}
              onSelect={onCategory}
            />
            <p className="mt-2 text-center text-xs font-semibold text-muted">
              <AppIcon name="hand-pointer" /> Tocá una categoría para ver el detalle
            </p>
          </>
        )}
      </Card>

      <Card className="year-rise bg-[#FFF3DC]">
        <h2 className="mb-1 flex items-center gap-2 font-display text-[17px] font-semibold">
          <AppIcon name="bag-shopping" className="text-alert-ink" /> Tus gustos del año
        </h2>
        {report.gustosSpent !== null && report.gustosSpent > 0 ? (
          <p className="font-display text-[26px] font-bold text-alert-ink">{formatMoney(report.gustosSpent)}</p>
        ) : null}
        <p className="text-sm text-muted">{gustosSentence(report.gustosSpent, report.extrasTotal, report.extrasSaved)}</p>
      </Card>

      <Card className="year-rise">
        <h2 className="mb-3 flex items-center gap-2 font-display text-[17px] font-semibold">
          <AppIcon name="piggy-bank" className="text-primary" /> Tus ahorros
        </h2>
        {report.funds.length === 0 && !report.goal ? (
          <p className="text-sm font-semibold text-muted">Cuando apartes un extra a un fondo o a la meta, lo vas a ver acá.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {report.funds.map((fund) => (
              <Ring
                key={fund.id}
                icon={fund.icon}
                color="#4F6B57"
                ratio={fund.target > 0 ? fund.saved / fund.target : 0}
                title={fund.name}
                detail={`${formatMoney(fund.saved)} / ${formatMoney(fund.target)}`}
                note={fund.target > 0 ? `${Math.round((fund.saved / fund.target) * 100)}%` : '—'}
              />
            ))}
            {report.goal ? (
              <Ring
                icon={report.goal.icon}
                color="#A79BCB"
                ratio={report.goal.target > 0 ? report.goal.total / report.goal.target : 0}
                title={report.goal.name}
                detail={`${formatMoney(report.goal.total)} / ${formatMoney(report.goal.target)}`}
                note={`${report.goal.target > 0 ? Math.round((report.goal.total / report.goal.target) * 100) : 0}% · compartida`}
                extra={`Tu aporte ${formatMoney(report.goal.mine)}`}
              />
            ) : null}
          </div>
        )}
      </Card>

      <h2 className="year-rise mb-2.5 flex items-center gap-2 px-1 font-display text-[17px] font-semibold">
        <AppIcon name="star" className="text-warn" /> Momentos del año
      </h2>
      {moments.map((moment) => (
        <Card key={moment.text} className="year-rise flex items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              moment.tone === 'blush' ? 'bg-[#FCE6EA] text-alert-ink' : moment.tone === 'sun' ? 'bg-[#FFF3C9] text-alert-ink' : 'bg-[#E3EED4] text-primary'
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
    <div className="mb-4 flex flex-col gap-4">
      <Card className="mb-0">
        <h2 className="mb-3 font-display text-[17px] font-semibold">Resumen</h2>
        <ul>
          <SummaryRow icon="arrow-down" label="Ingresos" value={totals.income} iconClass="bg-[#F2EADF] text-primary" />
          <SummaryRow icon="arrow-up" label="Gastos" value={totals.expenses} iconClass="bg-[#FCE6EA] text-alert-ink" valueClass="text-alert-ink" />
          <SummaryRow icon="piggy-bank" label="Ahorraste" value={totals.saved} iconClass="bg-sage-light text-primary" valueClass="text-primary" />
        </ul>
      </Card>
      <Card className="mb-0">
        <h2 className="mb-3 font-display text-[17px] font-semibold">Mes por mes</h2>
        <ul>
          {rows.map((row) => {
            if (row.kind === 'empty') {
              return (
                <li key={`empty-${row.from}`} className="border-b border-line py-1.5 text-[13px] font-semibold leading-5 text-muted last:border-b-0">
                  {monthSpan(row.from, row.to)} · sin registros
                </li>
              )
            }
            if (row.kind === 'future') {
              const pending = row.from === row.to ? 'todavía no llega' : 'todavía no llegan'
              return (
                <li key={`future-${row.from}`} className="border-b border-line py-1.5 text-[13px] font-medium leading-5 text-muted last:border-b-0">
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
        <div className="mt-3 flex h-14 items-center justify-between rounded-2xl bg-sage-light px-3 font-display">
          <span className="text-base font-semibold text-text">Total del año</span>
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
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm ${color.ink === '#ffffff' ? '' : 'ring-1 ring-line ring-inset'}`}
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
                      <span className="text-[13px] font-semibold leading-none text-muted">{percent}%</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card className="mb-0">
        <h2 className="mb-3 font-display text-[17px] font-semibold">Gustos, ahorros y momentos</h2>
        <Table>
          <tbody>
            <tr>
              <th className="py-2 text-left font-semibold">Gustos desde la bolsa</th>
              <td className="py-2 text-right font-bold">{yearCell(report.gustosSpent)}</td>
            </tr>
            <tr>
              <th className="border-t border-dashed border-line py-2 text-left font-semibold">Extras del año</th>
              <td className="border-t border-dashed border-line py-2 text-right">{yearCell(report.extrasTotal)}</td>
            </tr>
            <tr>
              <th className="border-t border-dashed border-line py-2 text-left font-semibold">Extras al ahorro</th>
              <td className="border-t border-dashed border-line py-2 text-right">{yearCell(report.extrasSaved)}</td>
            </tr>
            {report.funds.map((fund) => (
              <tr key={fund.id}>
                <th className="border-t border-dashed border-line py-2 text-left font-semibold">{fund.name}</th>
                <td className="border-t border-dashed border-line py-2 text-right">
                  {formatMoney(fund.saved)} / {formatMoney(fund.target)}
                </td>
              </tr>
            ))}
            {report.goal ? (
              <>
                <tr>
                  <th className="border-t border-dashed border-line py-2 text-left font-semibold">{report.goal.name} (total)</th>
                  <td className="border-t border-dashed border-line py-2 text-right">
                    {formatMoney(report.goal.total)} / {formatMoney(report.goal.target)}
                  </td>
                </tr>
                <tr>
                  <th className="border-t border-dashed border-line py-2 text-left font-semibold">Tu aporte a la meta</th>
                  <td className="border-t border-dashed border-line py-2 text-right">{formatMoney(report.goal.mine)}</td>
                </tr>
              </>
            ) : null}
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
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
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
  return value < 0 ? 'text-alert-ink' : 'text-primary'
}

function CategoryDetail({ category, year, today }: { category: YearCategory; year: number; today: Date }) {
  const max = Math.max(...category.months.map((amount) => amount ?? 0), 0)
  return (
    <>
      <p className="mb-3 font-display text-2xl font-bold">{formatMoney(category.total)}</p>
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
                {amount !== null && amount > 0 ? <span className="year-bar block h-full rounded-full bg-primary" style={{ width: `${width}%` }} /> : null}
              </span>
              <span className="w-24 shrink-0 text-right font-display text-sm font-semibold">{yearCell(amount)}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Ring({
  icon,
  color,
  ratio,
  title,
  detail,
  note,
  extra,
}: {
  icon: string
  color: string
  ratio: number
  title: string
  detail: string
  note: string
  extra?: string
}) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setDrawn(true)
      return
    }
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const dash = (drawn ? Math.max(0, Math.min(ratio, 1)) : 0) * circumference
  return (
    <div className="flex w-[9.5rem] flex-col items-center gap-1 text-center">
      <div className="relative h-[70px] w-[70px]">
        <svg viewBox="0 0 70 70" className="h-full w-full" aria-hidden="true">
          <circle cx="35" cy="35" r={radius} fill="none" stroke="#F1E5D6" strokeWidth="8" />
          <circle
            className="year-ring"
            cx="35"
            cy="35"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 35 35)"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[15px]" style={{ color }}>
          <AppIcon name={icon} />
        </span>
      </div>
      <p className="text-[13px] font-bold">{title}</p>
      <p className="text-xs text-muted">{detail}</p>
      <p className="text-xs font-extrabold" style={{ color }}>
        {note}
      </p>
      {extra ? <p className="text-xs font-semibold text-muted">{extra}</p> : null}
    </div>
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
      <p className="text-xs text-muted">
        <AppIcon name={icon} /> {label}
      </p>
      <p className={`mt-0.5 font-display text-[14.5px] font-bold leading-tight ${valueClass}`}>{yearCell(value)}</p>
    </div>
  )
}

function YearPlant() {
  return (
    <svg width="70" height="70" viewBox="0 0 70 70" className="shrink-0" role="img" aria-label="Plantita y sol">
      <circle cx="48" cy="20" r="12" fill="#F4C542" />
      <path d="M35 64 C35 48 34 40 32 30" stroke="#6A784D" strokeWidth="3" fill="none" />
      <path d="M33 44 C22 43 16 35 17 28 C27 28 33 35 33 44Z" fill="#C7DDAE" />
      <path d="M33 38 C43 36 48 28 47 21 C38 22 32 29 33 38Z" fill="#6A784D" />
      <path d="M20 60 h30 l-4 10 h-22z" fill="#C4866D" />
    </svg>
  )
}

function EmptyYear({ year }: { year: number }) {
  return (
    <Card className="year-rise bg-[linear-gradient(160deg,#FFFAF4,#eef5e3)] text-center">
      <div className="flex justify-center">
        <YearPlant />
      </div>
      <h2 className="mt-2 font-display text-xl font-semibold">Todavía no hay datos de {year}</h2>
      <p className="mt-1 text-sm font-semibold text-muted">Cuando cargues el sueldo o un gasto, tu año va a aparecer acá. Con calma.</p>
      <Link to="/sueldo" className="mt-3 inline-flex min-h-11 items-center font-extrabold text-primary">
        Cargar sueldo base
      </Link>
    </Card>
  )
}

function YearSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Cargando tu año…</p>
      <div className="mb-3 h-36 animate-pulse rounded-3xl bg-sand motion-reduce:animate-none" />
      <div className="mb-3 h-64 animate-pulse rounded-3xl bg-sand motion-reduce:animate-none" />
      <div className="mb-3 flex gap-3">
        <div className="h-28 flex-1 animate-pulse rounded-3xl bg-sand motion-reduce:animate-none" />
        <div className="h-28 flex-1 animate-pulse rounded-3xl bg-sand motion-reduce:animate-none" />
      </div>
    </div>
  )
}

function Table({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-[13px]">{children}</table>
}
