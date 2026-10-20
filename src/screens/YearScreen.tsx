import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { DonutBreakdown } from '../components/DonutBreakdown.tsx'
import { IncomeChart } from '../components/IncomeChart.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { loadYearBalance } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
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
  return (
    <>
      <Card>
        <h2 className="mb-2 font-display text-[17px] font-semibold">Resumen</h2>
        <Table>
          <tbody>
            <tr>
              <th className="py-2 text-left font-semibold">Ingresos</th>
              <td className="py-2 text-right font-bold">{yearCell(totals.income)}</td>
            </tr>
            <tr>
              <th className="py-2 text-left font-semibold">Gastos</th>
              <td className="py-2 text-right font-bold text-alert-ink">{yearCell(totals.expenses)}</td>
            </tr>
            <tr>
              <th className="py-2 text-left font-semibold">Ahorraste</th>
              <td className="py-2 text-right font-bold text-primary">{yearCell(totals.saved)}</td>
            </tr>
          </tbody>
        </Table>
      </Card>
      <Card>
        <h2 className="mb-2 font-display text-[17px] font-semibold">Mes por mes</h2>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-2 text-left font-bold">Mes</th>
                <th className="py-2 text-right font-bold">Sueldo</th>
                <th className="py-2 text-right font-bold">Extras</th>
                <th className="py-2 text-right font-bold">Gastos</th>
                <th className="py-2 text-right font-bold">Ahorro</th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((month) => {
                const future = isFutureMonth(report.year, month.month, today)
                return (
                  <tr key={month.month} className={future ? 'text-muted' : 'text-text'}>
                    <th className="border-t border-dashed border-line py-2 text-left font-semibold">
                      {monthHeading(month.month)}
                      {future ? <span className="mt-0.5 block text-[11px] font-bold">aún no</span> : null}
                    </th>
                    <td className="border-t border-dashed border-line py-2 text-right">{yearCell(month.base)}</td>
                    <td className="border-t border-dashed border-line py-2 text-right">{yearCell(month.extras)}</td>
                    <td className="border-t border-dashed border-line py-2 text-right">{yearCell(month.expenses)}</td>
                    <td className="border-t border-dashed border-line py-2 text-right">{yearCell(month.saved)}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 font-display text-[17px] font-semibold">Categoría por categoría</h2>
        {report.categories.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Todavía no hay gastos en categorías.</p>
        ) : (
          <Table>
            <tbody>
              {report.categories.map((category, index) => (
                <tr key={category.id}>
                  <th className="border-t border-dashed border-line py-1 text-left font-semibold">
                    <button type="button" className="inline-flex min-h-11 items-center gap-2" onClick={() => onCategory(category.id)}>
                      <AppIcon name={category.icon} className="text-primary" />
                      {category.name}
                    </button>
                  </th>
                  <td className="border-t border-dashed border-line py-1 text-right font-extrabold text-alert-ink">{percents[index] ?? 0}%</td>
                  <td className="border-t border-dashed border-line py-1 text-right">{formatMoney(category.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 font-display text-[17px] font-semibold">Gustos, ahorros y momentos</h2>
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
    </>
  )
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
