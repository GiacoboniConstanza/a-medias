import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { Plantita } from '../components/Adornos.tsx'
import { BudgetCard } from '../components/BudgetCard.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { PartnerMemos } from '../components/PartnerMemos.tsx'
import { SaldoSheet } from '../components/SaldoSheet.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { SplitNotice } from '../components/SplitNotice.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { Card, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { loadBudgets, loadPlanItems } from '../lib/api.ts'
import { budgetRowsForMonth, type BudgetRow } from '../lib/budget.ts'
import { debtCopy, monthPocket, monthSplit, myPrivateSpent, partnerId } from '../lib/derive.ts'
import { fixedExpensesTotal } from '../lib/fixed-total.ts'
import { sumPaidBy } from '../lib/period.ts'
import { homeAccountingCard, type HomeCardLine } from '../lib/home-card.ts'
import { formatMoney } from '../lib/format.ts'
import { iconSurface } from '../lib/icons.ts'
import { loanMonthEffect, loadLoanMovements, type PeriodLoan, type PeriodRepayment } from '../lib/transfers.ts'
import { isHubHome } from '../lib/modules.ts'
import { planCommitted, planMargin, planRemaining, planSalaryForMonth } from '../lib/plans.ts'
import { effectiveSalary } from '../lib/salary.ts'

function yearBannerKey(userId: string, year: number) {
  return `a-medias.balance-anio.${userId}.${year}`
}

function yearBannerClosed(key: string) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function HomeScreen() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [toast, setToast] = useState('')
  const [closedBanner, setClosedBanner] = useState<string | null>(null)
  const [transferMoves, setTransferMoves] = useState<{ loans: PeriodLoan[]; repayments: PeriodRepayment[] }>({
    loans: [],
    repayments: [],
  })
  const [budgetRows, setBudgetRows] = useState<BudgetRow[] | null>(null)
  const [budgetLoading, setBudgetLoading] = useState(false)
  const [budgetError, setBudgetError] = useState('')
  const [budgetTick, setBudgetTick] = useState(0)
  const modules = useModules()
  const saldoOpen = params.get('saldo') === '1'
  const hub = modules.ready && isHubHome(modules.enabled)
  const meId = profile?.id ?? ''
  const otherId = data && meId ? partnerId(data, meId) : null
  const hasShared = Boolean(data?.monthExpenses.some((expense) => expense.isShared))

  useEffect(() => {
    const notice = (location.state as { notice?: string } | null)?.notice
    if (!notice) return
    setToast(notice)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!profile) return
    let active = true
    loadLoanMovements()
      .then((rows) => {
        if (active) setTransferMoves(rows)
      })
      .catch(() => {
        if (active) setTransferMoves({ loans: [], repayments: [] })
      })
    return () => {
      active = false
    }
  }, [profile, data])

  useEffect(() => {
    if (!profile || !data) return
    let active = true
    setBudgetLoading(true)
    setBudgetError('')
    loadBudgets(profile.id, month)
      .then((caps) => {
        if (!active) return
        setBudgetRows(budgetRowsForMonth(data, profile.id, caps))
      })
      .catch((caught) => {
        if (!active) return
        setBudgetRows(null)
        setBudgetError(caught instanceof Error ? caught.message : 'No pudimos traer tu presupuesto.')
      })
      .finally(() => {
        if (active) setBudgetLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile, data, month, budgetTick])

  useEffect(() => {
    if (!saldoOpen) return
    if (!otherId || !hasShared) {
      const next = new URLSearchParams(params)
      next.delete('saldo')
      setParams(next, { replace: true })
    }
  }, [saldoOpen, otherId, hasShared, params, setParams])

  if (!profile) return null

  const year = new Date().getFullYear()
  const bannerKey = yearBannerKey(profile.id, year)
  const showBanner = closedBanner !== bannerKey && !yearBannerClosed(bannerKey)

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <section className="scallop-b -mx-4 bg-azul px-4 pb-4 pt-2">
          <SectionHeader lead={hub ? 'crumb' : 'greeting'} name={profile.displayName} aside={<NotificationBell />} />
          <h1 className="font-display text-[34px] font-semibold text-tinta">Resumen</h1>
          <MonthSwitcher />
        </section>
        <div className="h-40 animate-pulse rounded-2xl bg-tarjeta" aria-busy="true" />
      </div>
    )
  }
  if (!data) return <p className="py-16 text-center font-semibold text-tinta">{error}</p>

  const split = monthSplit(data)
  const base = effectiveSalary(data.salaryHistory, month)
  const privateSpent = myPrivateSpent(data, meId)
  const sharedPaid = sumPaidBy(
    data.monthExpenses.filter((expense) => expense.isShared),
    meId,
  )
  const extras = data.extrasThisMonth.reduce((sum, extra) => sum + extra.amount, 0)
  const mySavingMoves = data.savingMoves.filter(
    (row) => row.userId === meId && row.period.slice(0, 7) === month.slice(0, 7),
  )
  const savedIn = mySavingMoves.filter((row) => row.kind === 'aporte').reduce((sum, row) => sum + row.amount, 0)
  const savedOut = mySavingMoves.filter((row) => row.kind === 'retiro').reduce((sum, row) => sum + row.amount, 0)
  const pocket = monthPocket({ base, privateSpent, sharedPaid, extras, savedIn, savedOut })
  const transferEffect = loanMonthEffect(meId, month, transferMoves.loans, transferMoves.repayments)
  const partnerName = (otherId && data.names[otherId]) || 'tu compañera'
  const card = homeAccountingCard(pocket, transferEffect, partnerName)
  const remaining = card.remaining
  const amountTone = remaining < 0 ? 'text-rosa-texto' : 'text-title'
  const aMano = hasShared && split.amount === 0
  const settled = Boolean(data.settlement)

  function closeBanner() {
    try {
      localStorage.setItem(bannerKey, '1')
    } catch {
      // ignore
    }
    setClosedBanner(bannerKey)
  }

  function openSaldo() {
    const next = new URLSearchParams(params)
    next.set('saldo', '1')
    setParams(next, { replace: true })
  }

  function closeSaldo() {
    const next = new URLSearchParams(params)
    next.delete('saldo')
    setParams(next, { replace: true })
  }

  return (
    <>
      <section className="scallop-b -mx-4 mb-4 bg-azul px-4 pb-4 pt-2 text-tinta">
        <SectionHeader
          lead={hub ? 'crumb' : 'greeting'}
          name={profile.displayName}
          aside={
            <>
              <NotificationBell />
              {hub ? null : (
                <Link to="/modulos" aria-label="Mis módulos" className="grid h-11 w-11 place-items-center text-tinta">
                  <AppIcon name="sliders" />
                </Link>
              )}
            </>
          }
        />
        <h1 className="font-display text-[34px] font-semibold text-tinta">Resumen</h1>
        <MonthSwitcher />

        {otherId ? (
          hasShared ? (
            <button type="button" aria-haspopup="dialog" onClick={openSaldo} className="mt-3 w-full text-left text-tinta">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 font-display text-lg font-semibold">
                  <AppIcon name="scale-balanced" /> Saldo compartidos
                </p>
                <StatusChip settled={settled} />
              </div>
              {aMano ? (
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="font-display text-[36px] font-semibold leading-none">Están a mano</p>
                  <Plantita width={46} height={60} />
                </div>
              ) : (
                <>
                  <p className="mt-2 text-lg font-semibold">{debtCopy(meId, split)}</p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="whitespace-nowrap font-display text-[36px] font-semibold leading-none">{formatMoney(split.amount)}</p>
                    <Plantita width={46} height={60} />
                  </div>
                </>
              )}
              <span className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold">
                Ver el detalle <AppIcon name="chevron-right" />
              </span>
            </button>
          ) : (
            <div className="mt-3">
              <p className="inline-flex items-center gap-2 font-display text-lg font-semibold">
                <AppIcon name="scale-balanced" /> Saldo compartidos
              </p>
              <p className="mt-2 text-lg font-semibold text-tinta">Este mes no hay gastos compartidos.</p>
            </div>
          )
        ) : null}

        {otherId ? (
          <Link
            to="/reparto"
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1 text-sm font-bold text-mostaza-ink"
          >
            Cambiar el reparto
            <AppIcon name="chevron-right" />
          </Link>
        ) : null}
      </section>

      <SplitNotice notice={data.splitNotice} />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-title">Te quedan</h2>
            <p className={`mt-1 font-display text-[clamp(1.75rem,9.25vw,2.25rem)] font-semibold leading-none whitespace-nowrap ${amountTone}`}>
              {card.remainingText}
            </p>
          </div>
          <Plantita width={56} height={73} />
        </div>
        <div className="my-3 border-t border-dashed border-line" />
        <div className="space-y-2">
          {card.lines.map((row) => (
            <Row key={row.label} line={row} />
          ))}
        </div>
      </Card>

      <BudgetCard
        month={month}
        rows={budgetRows}
        loading={budgetLoading}
        error={budgetError}
        onRetry={() => setBudgetTick((tick) => tick + 1)}
      />

      <PlansHomeCard />

      {hub ? null : <PartnerMemos />}
      {modules.error ? <p className="mb-3 text-center text-sm font-semibold text-tinta">{modules.error}</p> : null}

      {showBanner ? (
        <div className="mb-3 flex h-14 items-center gap-1 rounded-2xl border border-line bg-sand-soft pl-3 pr-1">
          <AppIcon name="chart-pie" className="shrink-0 text-mostaza-ink" />
          <p className="min-w-0 flex-1 font-display text-base font-semibold text-title">Tu balance {year} está listo</p>
          <Link to="/mi-anio" className="grid h-12 w-12 place-items-center text-base font-bold text-mostaza-ink">
            Ver
          </Link>
          <button type="button" aria-label="Cerrar aviso" onClick={closeBanner} className="grid h-12 w-12 place-items-center text-title">
            <AppIcon name="xmark" />
          </button>
        </div>
      ) : null}

      {!otherId ? (
        <Card>
          <p className="font-display font-semibold text-mostaza-ink">Invitá a tu compañera</p>
          <p className="text-sm font-normal text-muted">Pasale este código para que se sume al hogar.</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-widest text-mostaza-ink">{data.inviteCode}</p>
        </Card>
      ) : null}

      {base <= 0 ? (
        <Card>
          <p className="font-display font-semibold text-tinta">Todavía no cargaste un sueldo este mes.</p>
          <Link to="/sueldo" className="mt-2 inline-flex min-h-11 items-center font-semibold text-mostaza-ink">
            Cargarlo ahora
          </Link>
        </Card>
      ) : null}

      {error ? <p className="text-center text-sm font-semibold text-tinta">{error}</p> : null}

      <FabSpace avisos={Boolean(toast)} />
      <Fab to="/cargar" label="Cargar un movimiento" state={{ from: location.pathname }} />
      <Toast aboveFab onDone={() => setToast('')}>
        {toast}
      </Toast>

      {otherId && hasShared ? (
        <SaldoSheet open={saldoOpen} onClose={closeSaldo} data={data} meId={meId} month={month} onRefresh={refresh} />
      ) : null}
    </>
  )
}

function PlansHomeCard() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data } = useFinance()
  const [count, setCount] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!profile?.householdId || !data) return
    let active = true
    void loadPlanItems(profile.householdId)
      .then((items) => {
        if (!active) return
        setCount(items.length)
        const meId = profile.id
        const otherId = partnerId(data, meId)
        const fixedCard = fixedExpensesTotal({
          items: data.fixed.filter((item) => item.applies && !item.pausedAt),
          meId,
          partnerId: otherId,
          partnerName: '',
          splitPercents: data.splitPercents,
          filtersActive: false,
        })
        const salary = planSalaryForMonth(data.salaryHistory, month)
        const margin = planMargin(salary, fixedCard?.myShare ?? 0, fixedCard?.privateTotal ?? 0)
        if (margin == null || items.length === 0) {
          setRemaining(null)
          return
        }
        setRemaining(planRemaining(margin, planCommitted(items, meId, otherId, data.splitPercents, month)))
      })
      .catch(() => {
        if (active) setCount(0)
      })
    return () => {
      active = false
    }
  }, [profile, data, month])

  const surface = iconSurface('couch')
  return (
    <Link
      to="/planes"
      className="mt-3 grid min-h-[72px] w-full grid-cols-[40px_1fr_24px] items-center gap-3 rounded-2xl border-2 border-azul-ink bg-tarjeta px-4 py-3 text-left"
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-full border-2 text-base"
        style={{ background: surface.background, color: surface.color, borderColor: surface.border }}
      >
        <AppIcon name="couch" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold text-tinta">Planes</span>
        {count === 0 || remaining == null ? (
          <span className="text-sm font-bold text-azul-ink">Armar un plan</span>
        ) : (
          <span className="text-sm font-semibold text-gris">
            Te queda <span className="font-display text-[22px] font-semibold text-tinta">{formatMoney(remaining)}</span>
          </span>
        )}
      </span>
      <AppIcon name="chevron-right" className="justify-self-end text-tinta" />
    </Link>
  )
}

function StatusChip({ settled }: { settled: boolean }) {
  return (
    <span
      className={`inline-flex h-[var(--alto-chip)] items-center gap-1 rounded-full border-[1.5px] border-tinta px-2.5 text-sm font-semibold ${
        settled ? 'bg-azul-claro text-azul-ink' : 'bg-crema text-tinta'
      }`}
    >
      {settled ? <AppIcon name="check" /> : <AppIcon name="circle" className="text-[10px]" />}
      {settled ? 'Saldado' : 'Sin saldar'}
    </span>
  )
}

function Row({ line }: { line: HomeCardLine }) {
  const tone = {
    income: 'font-semibold text-mostaza-ink',
    spent: 'font-semibold text-rosa-texto',
    ahorro: 'font-semibold text-azul-ink',
    transfer: 'font-normal text-ciruela-ink',
  }[line.role]
  return (
    <div className={`flex items-baseline justify-between gap-3 text-[14px] ${tone}`}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {line.role === 'transfer' ? <AppIcon name="right-left" /> : null}
        {line.role === 'ahorro' ? <AppIcon name="piggy-bank" /> : null}
        {line.label}
      </span>
      <span className="shrink-0 whitespace-nowrap text-right font-display">{line.amount}</span>
    </div>
  )
}
