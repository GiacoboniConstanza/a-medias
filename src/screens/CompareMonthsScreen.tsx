import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { Plantita } from '../components/Adornos.tsx'
import { FitMoney } from '../components/FitMoney.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, Chip } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { loadYearBalance } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { iconSurface } from '../lib/icons.ts'
import {
  MONTH_NAMES,
  compareCategories,
  comparePhrase,
  defaultCompareMonths,
  deltaPercentLabel,
  formatSignedMoney,
  isFutureMonth,
  monthDelta,
  monthHeading,
  monthIncome,
  monthIsEmpty,
  monthName,
  type CompareCategoryRow,
  type MonthDelta,
  type YearMonth,
  type YearReport,
} from '../lib/year.ts'
import { CategoryDetail } from './YearScreen.tsx'

type Picker = 'a' | 'b' | null

export function CompareMonthsScreen() {
  const { profile } = useAuth()
  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(() => today.getFullYear())
  const defaults = defaultCompareMonths(year, today)
  const [monthA, setMonthA] = useState(defaults.monthA)
  const [monthB, setMonthB] = useState(defaults.monthB)
  const [yearB, setYearB] = useState(defaults.yearB)
  const [reportA, setReportA] = useState<YearReport | null>(null)
  const [reportB, setReportB] = useState<YearReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState<Picker>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)

  useEffect(() => {
    const next = defaultCompareMonths(year, today)
    setMonthA(next.monthA)
    setMonthB(next.monthB)
    setYearB(next.yearB)
  }, [year, today])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const loads =
      yearB === year
        ? [loadYearBalance(year)]
        : [loadYearBalance(year), loadYearBalance(yearB)]
    Promise.all(loads)
      .then((rows) => {
        if (!active) return
        setReportA(rows[0] ?? null)
        setReportB(yearB === year ? rows[0] ?? null : rows[1] ?? null)
      })
      .catch(() => {
        if (!active) return
        setReportA(null)
        setReportB(null)
        setError('No pude armar la comparación.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [year, yearB])

  if (!profile) return null

  const monthRowA = reportA?.months.find((row) => row.month === monthA)
  const monthRowB = reportB?.months.find((row) => row.month === monthB)
  const empty = monthIsEmpty(monthRowA) || monthIsEmpty(monthRowB)
  const categories =
    reportA && reportB ? compareCategories(reportA, monthA, reportB, monthB) : []
  const top = categories.find((row) => row.delta.kind !== 'equal') ?? null
  const phrase = comparePhrase(top, monthA, monthB)
  const category = categories.find((row) => row.id === categoryId) ?? null
  const categoryForSheet =
    category && reportA
      ? reportA.categories.find((row) => row.id === category.id) ??
        reportB?.categories.find((row) => row.id === category.id) ??
        null
      : null

  function pickMonth(side: 'a' | 'b', month: number) {
    if (side === 'a') {
      setMonthA(month)
      if (month === monthB && yearB === year) {
        if (month > 1) {
          setMonthB(month - 1)
          setYearB(year)
        } else {
          setMonthB(12)
          setYearB(year - 1)
        }
      }
    } else {
      setMonthB(month)
      setYearB(year)
      if (month === monthA) {
        setMonthA(month > 1 ? month - 1 : month + 1)
      }
    }
    setPicker(null)
  }

  return (
    <>
      <SectionHeader
        lead="back"
        backTo="/mi-anio"
        icon="right-left"
        title="Comparar meses"
        aside={
          <span className="mr-1 inline-flex min-h-7 items-center gap-1.5 rounded-2xl bg-salvia-claro px-2.5 py-1 text-sm font-bold text-mostaza-ink">
            <AppIcon name="lock" /> Solo vos
          </span>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-title disabled:opacity-40"
          aria-label="Año anterior"
          disabled={year <= 2000}
          onClick={() => setYear((value) => value - 1)}
        >
          <AppIcon name="chevron-left" />
        </button>
        <p className="font-display text-[2rem] font-semibold leading-none">{year}</p>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-title disabled:opacity-40"
          aria-label="Año siguiente"
          disabled={year >= today.getFullYear()}
          onClick={() => setYear((value) => value + 1)}
        >
          <AppIcon name="chevron-right" />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <MonthPickerButton
          open={picker === 'a'}
          month={monthA}
          year={year}
          label={`Mes que mirás: ${monthName(monthA)} de ${year}. Cambiar`}
          onClick={() => setPicker(picker === 'a' ? null : 'a')}
        />
        <span className="text-sm font-semibold text-gris">contra</span>
        <MonthPickerButton
          open={picker === 'b'}
          month={monthB}
          year={yearB}
          label={`Mes con el que comparás: ${monthName(monthB)} de ${yearB}. Cambiar`}
          onClick={() => setPicker(picker === 'b' ? null : 'b')}
        />
      </div>

      {loading ? <CompareSkeleton /> : null}
      {!loading && error ? <p className="py-10 text-center font-semibold text-tinta">{error}</p> : null}
      {!loading && !error && empty ? <EmptyCompare /> : null}
      {!loading && !error && !empty && reportA && reportB ? (
        <div className="flex flex-col gap-4">
          <HowItWent monthA={monthA} monthB={monthB} rowA={monthRowA} rowB={monthRowB} />
          {categories.length > 0 ? (
            <HighlightCard phrase={phrase} />
          ) : null}
          <CategoryList
            monthA={monthA}
            monthB={monthB}
            year={year}
            yearB={yearB}
            rows={categories}
            onOpen={setCategoryId}
          />
        </div>
      ) : null}

      <Sheet
        open={picker !== null}
        title={picker === 'a' ? '¿Qué mes mirás?' : '¿Contra qué mes?'}
        onClose={() => setPicker(null)}
      >
        {picker ? (
          <MonthSheet
            side={picker}
            year={year}
            monthA={monthA}
            monthB={monthB}
            yearB={yearB}
            today={today}
            onPick={(month) => pickMonth(picker, month)}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={categoryForSheet !== null}
        title={categoryForSheet?.name ?? 'Categoría'}
        onClose={() => setCategoryId(null)}
        footer={
          <Button type="button" variant="alt" onClick={() => setCategoryId(null)}>
            Cerrar
          </Button>
        }
      >
        {categoryForSheet && reportA ? (
          <CategoryDetail
            category={categoryForSheet}
            year={reportA.year}
            today={today}
            reload={0}
            onOpen={() => undefined}
          />
        ) : null}
      </Sheet>
    </>
  )
}

function MonthPickerButton({
  open,
  month,
  year,
  label,
  onClick,
}: {
  open: boolean
  month: number
  year: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      onClick={onClick}
      className={`flex min-h-[60px] items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-left ${
        open ? 'border-2 border-azul-ink bg-azul-claro' : 'border-[1.5px] border-azul-ink bg-tarjeta'
      }`}
    >
      <span className="min-w-0">
        <span className="block font-display text-[17px] font-semibold text-tinta">{monthHeading(month)}</span>
        <span className="block text-sm font-semibold text-gris">{year}</span>
      </span>
      <AppIcon name="chevron-down" className="shrink-0 text-sm text-gris" />
    </button>
  )
}

function MonthSheet({
  side,
  year,
  monthA,
  monthB,
  yearB,
  today,
  onPick,
}: {
  side: 'a' | 'b'
  year: number
  monthA: number
  monthB: number
  yearB: number
  today: Date
  onPick: (month: number) => void
}) {
  const otherMonth = side === 'a' ? monthB : monthA
  const otherYear = side === 'a' ? yearB : year
  const otherLabel = `${monthName(otherMonth)} de ${otherYear}`
  const selected = side === 'a' ? monthA : monthB
  const blocked: string[] = []
  if (otherYear === year) blocked.push(`${monthHeading(otherMonth)} ya está del otro lado`)
  const futureMonths = MONTH_NAMES.map((_, index) => index + 1).filter((month) =>
    isFutureMonth(year, month, today),
  )
  if (futureMonths.length === 1) blocked.push(`${monthHeading(futureMonths[0]!)} todavía no llegó`)
  if (futureMonths.length > 1) {
    blocked.push(
      `${monthHeading(futureMonths[0]!)} a ${monthName(futureMonths[futureMonths.length - 1]!)} todavía no llegaron`,
    )
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gris">Lo comparás con {otherLabel}.</p>
      <p className="mt-3 font-display text-[17px] font-semibold text-tinta">{year}</p>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Meses">
        {MONTH_NAMES.map((name, index) => {
          const month = index + 1
          const future = isFutureMonth(year, month, today)
          const taken = otherYear === year && month === otherMonth
          const disabled = future || taken
          const reason = future ? 'todavía no llegó' : taken ? 'ya está del otro lado' : ''
          return (
            <Chip
              key={name}
              role="radio"
              active={selected === month}
              className={
                disabled
                  ? 'pointer-events-none border-dashed border-gris-claro bg-fondo-desactivado font-semibold text-gris'
                  : ''
              }
              onClick={() => {
                if (!disabled) onPick(month)
              }}
              aria-checked={selected === month}
              aria-disabled={disabled || undefined}
              aria-label={`${monthHeading(month)}${reason ? `, ${reason}` : ''}`}
            >
              {monthHeading(month).slice(0, 3)}
            </Chip>
          )
        })}
      </div>
      {blocked.length > 0 ? (
        <p className="mt-3 text-sm font-semibold text-gris">{blocked.join('. ')}.</p>
      ) : null}
    </div>
  )
}

function HowItWent({
  monthA,
  monthB,
  rowA,
  rowB,
}: {
  monthA: number
  monthB: number
  rowA: YearMonth | undefined
  rowB: YearMonth | undefined
}) {
  const incomeA = monthIncome(rowA)
  const incomeB = monthIncome(rowB)
  const expensesA = rowA?.expenses ?? null
  const expensesB = rowB?.expenses ?? null
  const savedA = rowA?.saved ?? null
  const savedB = rowB?.saved ?? null
  const rows: { label: string; a: number | null; b: number | null; sense: 'income' | 'expense' | 'saved' }[] = [
    { label: 'Ingresos', a: incomeA, b: incomeB, sense: 'income' },
    { label: 'Gastos', a: expensesA, b: expensesB, sense: 'expense' },
    { label: 'Ahorraste', a: savedA, b: savedB, sense: 'saved' },
  ]
  return (
    <Card className="mb-0">
      <h2 className="mb-3 flex items-center gap-2 font-display text-[17px] font-semibold text-tinta">
        <AppIcon name="scale-balanced" className="text-mostaza-ink" /> Cómo te fue
      </h2>
      <div className="mb-2 grid grid-cols-[1fr_108px_108px] gap-2 text-sm font-semibold text-gris">
        <span />
        <span className="text-right">{monthHeading(monthA)}</span>
        <span className="text-right">{monthHeading(monthB)}</span>
      </div>
      <ul>
        {rows.map((row, index) => {
          const delta = monthDelta(row.a, row.b)
          return (
            <li
              key={row.label}
              className={`py-2 ${index < rows.length - 1 ? 'border-b border-dashed border-linea-punteada' : ''}`}
            >
              <div className="grid grid-cols-[1fr_108px_108px] items-start gap-2">
                <span className="text-[15px] font-semibold text-tinta">{row.label}</span>
                <span className="text-right">
                  <Amount value={row.a} sense={row.sense} />
                </span>
                <span className="text-right">
                  <Amount value={row.b} sense={row.sense} tone="muted" />
                </span>
              </div>
              <p className={`mt-1 text-right text-sm font-semibold ${deltaTone(delta, row.sense)}`}>
                <DeltaArrow delta={delta} /> {formatSignedMoney(delta.diff)}
                {deltaPercentLabel(delta) ? ` · ${deltaPercentLabel(delta)}` : ''}
              </p>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Amount({
  value,
  sense,
  tone = 'ink',
}: {
  value: number | null
  sense: 'income' | 'expense' | 'saved'
  tone?: 'ink' | 'muted'
}) {
  if (value === null) return <span className="font-display text-[15px] font-semibold text-gris">—</span>
  const color =
    sense === 'saved' && value < 0
      ? 'text-rosa-texto'
      : tone === 'muted'
        ? 'text-gris'
        : 'text-tinta'
  return <FitMoney value={value} className={`w-full text-right font-display text-[15px] font-semibold ${color}`} />
}

function HighlightCard({ phrase }: { phrase: { headline: string; detail: string | null } }) {
  return (
    <Card className="mb-0 bg-[linear-gradient(160deg,var(--color-card),var(--color-salvia-claro))]">
      <div className="flex items-start gap-3">
        <Plantita width={54} height={70} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gris">Lo que más cambió</p>
          <p className="mt-1 font-display text-lg font-semibold text-tinta">{phrase.headline}</p>
          {phrase.detail ? <p className="mt-1 text-sm font-semibold text-gris">{phrase.detail}</p> : null}
        </div>
      </div>
    </Card>
  )
}

function CategoryList({
  monthA,
  monthB,
  year,
  yearB,
  rows,
  onOpen,
}: {
  monthA: number
  monthB: number
  year: number
  yearB: number
  rows: CompareCategoryRow[]
  onOpen: (id: string) => void
}) {
  return (
    <Card className="mb-0">
      <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold text-tinta">
        <AppIcon name="chart-pie" className="text-mostaza-ink" /> Categoría por categoría
      </h2>
      <p className="mt-1 text-sm font-semibold text-gris">Primero, lo que más cambió en plata.</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-muted">Todavía no hay gastos en categorías.</p>
      ) : (
        <ul className="mt-2">
          {rows.map((row, index) => {
            const surface = iconSurface(row.icon)
            const label = deltaPercentLabel(row.delta)
            const aria = `${row.name}: ${formatMoney(row.a)} en ${monthName(monthA)}, ${formatMoney(row.b)} en ${monthName(monthB)}, ${label || formatSignedMoney(row.delta.diff)}. Ver el detalle`
            return (
              <li key={row.id}>
                <button
                  type="button"
                  aria-label={aria}
                  onClick={() => onOpen(row.id)}
                  className={`grid min-h-[68px] w-full grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-0.5 py-2.5 text-left ${
                    index < rows.length - 1 ? 'border-b border-dashed border-linea-punteada' : ''
                  }`}
                >
                  <span
                    className="row-span-2 grid h-10 w-10 place-items-center rounded-full border-2"
                    style={{ background: surface.background, color: surface.color, borderColor: surface.border }}
                    aria-hidden="true"
                  >
                    <AppIcon name={row.icon} />
                  </span>
                  <span className="min-w-0 truncate font-display text-base font-semibold text-tinta">{row.name}</span>
                  <span className="font-display text-base font-semibold text-tinta">
                    <FitMoney value={row.a} className="w-[7rem] text-right font-display text-base font-semibold" />
                  </span>
                  <span className={`text-sm font-semibold ${categoryDeltaTone(row.delta)}`}>
                    <DeltaArrow delta={row.delta} /> {label}
                  </span>
                  <span className="text-right text-sm font-semibold text-gris">
                    {monthName(monthB)}
                    {yearB !== year ? ` ${yearB}` : ''} {formatMoney(row.b)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-gris">
        <AppIcon name="hand-pointer" /> Tocá una categoría para ver el detalle
      </p>
    </Card>
  )
}

function DeltaArrow({ delta }: { delta: MonthDelta }) {
  if (delta.kind === 'equal') return <span aria-hidden="true">=</span>
  if (delta.kind === 'new' || delta.diff > 0) return <span aria-hidden="true">↑</span>
  if (delta.diff < 0) return <span aria-hidden="true">↓</span>
  return null
}

function deltaTone(delta: MonthDelta, sense: 'income' | 'expense' | 'saved'): string {
  if (delta.kind === 'equal') return 'text-gris'
  const better =
    sense === 'expense' ? delta.diff < 0 : delta.diff > 0
  if (delta.diff === 0) return 'text-gris'
  return better ? 'text-salvia-ink' : 'text-rosa-texto'
}

function categoryDeltaTone(delta: MonthDelta): string {
  if (delta.kind === 'equal' || delta.kind === 'gone') return 'text-gris'
  if (delta.kind === 'new') return 'text-ciruela-ink'
  return delta.diff > 0 ? 'text-rosa-texto' : 'text-salvia-ink'
}

function EmptyCompare() {
  return (
    <Card className="bg-[linear-gradient(160deg,var(--color-card),var(--color-salvia-claro))] text-center">
      <div className="flex justify-center">
        <Plantita width={54} height={70} />
      </div>
      <h2 className="mt-2 font-display text-xl font-semibold text-tinta">Todavía no hay dos meses para comparar</h2>
      <p className="mt-1 text-sm font-semibold text-gris">
        Cuando tengas gastos o sueldo en los dos meses, vas a ver acá cómo cambiaron.
      </p>
    </Card>
  )
}

function CompareSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Cargando la comparación…</span>
      <div className="h-40 animate-pulse rounded-2xl bg-sand" />
      <div className="h-28 animate-pulse rounded-2xl bg-sand" />
      <div className="h-56 animate-pulse rounded-2xl bg-sand" />
    </div>
  )
}
