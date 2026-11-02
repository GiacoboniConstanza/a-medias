import { useEffect, useState } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { PartnerMemos } from '../components/PartnerMemos.tsx'
import { Plant, plantStage } from '../components/Plant.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { SplitNotice } from '../components/SplitNotice.tsx'
import { Card, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { saveViewMode } from '../lib/api.ts'
import { debtCopy, monthPocket, monthSplit, myPrivateSpent, paceInput, partnerId } from '../lib/derive.ts'
import { homeAccountingCard, type HomeCardLine } from '../lib/home-card.ts'
import { formatMoney } from '../lib/format.ts'
import { jarStatus } from '../lib/jar.ts'
import { loanMonthEffect, loadLoanMovements, type PeriodLoan, type PeriodRepayment } from '../lib/loans.ts'
import { FINANCE_SECTION_LINKS, isHubHome } from '../lib/modules.ts'
import type { ViewMode } from '../types/database.ts'

const SECTION_TONE: Record<string, string> = {
  '/se-me-fue': 'text-alert-ink',
  '/prestamos': 'text-lavender-ink',
  '/ahorros': 'text-primary',
  '/recordatorios': 'text-gold-ink',
}

export function HomeScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error } = useFinance()
  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const [loanMoves, setLoanMoves] = useState<{ loans: PeriodLoan[]; repayments: PeriodRepayment[] }>({
    loans: [],
    repayments: [],
  })
  const modules = useModules()
  useEffect(() => {
    const notice = (location.state as { notice?: string } | null)?.notice
    if (!notice) return
    setToast(notice)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    if (!profile) return
    let active = true
    loadLoanMovements()
      .then((rows) => {
        if (active) setLoanMoves(rows)
      })
      .catch(() => {
        if (active) setLoanMoves({ loans: [], repayments: [] })
      })
    return () => {
      active = false
    }
  }, [profile])
  const financeRoute = useMatch('/finanzas')
  const hub = modules.ready && isHubHome(modules.enabled)
  if (!profile) return null
  if (loading && !data) return <p className="py-16 text-center font-semibold text-primary">Cargando tu mes…</p>
  if (!data) return <p className="py-16 text-center font-semibold text-alert-ink">{error}</p>

  const meId = profile.id
  const otherId = partnerId(data, meId)
  const split = monthSplit(data)
  const mine = split.rows.find((row) => row.id === meId)
  const pace = paceInput(month)
  const base = data.bases[meId] ?? 0
  const privateSpent = myPrivateSpent(data, meId)
  const myShare = mine?.share ?? 0
  const extras = data.extrasThisMonth.reduce((sum, extra) => sum + extra.amount, 0)
  const pocket = monthPocket({ base, privateSpent, myShare, extras })
  const loanEffect = loanMonthEffect(meId, month, loanMoves.loans, loanMoves.repayments)
  const card = homeAccountingCard(pocket, loanEffect)
  const remaining = card.remaining
  const jar = jarStatus({
    base,
    privateSpent,
    myShare,
    extras,
    loanNet: loanEffect.net,
    ...pace,
  })
  const friendly = profile.viewMode === 'friendly'
  const stage = plantStage(jar.percentLeft, jar.tone === 'empty')
  const amountTone = remaining < 0 ? 'text-alert-ink' : 'text-primary'

  async function changeMode(mode: ViewMode) {
    await saveViewMode(meId, mode)
    await refreshProfile()
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm font-semibold text-primary">
          <AppIcon name="house" className="mr-1.5 text-alert" /> Hola, {profile.displayName}
        </p>
        <Link
          to="/modulos"
          aria-label="Mis módulos"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft"
        >
          <AppIcon name="sliders" />
        </Link>
      </header>
      {hub && financeRoute ? (
        <nav aria-label="Secciones de finanzas" className="mb-3 grid grid-cols-4 overflow-hidden rounded-3xl bg-card shadow-card">
          {FINANCE_SECTION_LINKS.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 px-0.5 py-2.5 text-center text-[14px] font-semibold leading-none ${SECTION_TONE[item.to] ?? 'text-primary'} ${
                index > 0 ? 'border-l border-line' : ''
              }`}
            >
              <AppIcon name={item.icon} className="text-base" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      <MonthSwitcher heading tone="home" />
      <ViewToggle mode={profile.viewMode} onChange={(mode) => void changeMode(mode)} className="mb-3" />
      <SplitNotice notice={data.splitNotice} />
      <Link
        to="/mi-anio"
        className="mb-3 flex min-h-11 items-center gap-3 rounded-3xl bg-primary px-4 py-3.5 text-white shadow-fab"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sage-light text-primary">
          <AppIcon name="chart-pie" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold">Tu balance {new Date().getFullYear()} está listo</span>
          <span className="block text-xs font-semibold text-white">Mirá cómo te fue en el año</span>
        </span>
        <AppIcon name="arrow-right" />
      </Link>

      <Card>
        {friendly ? (
          <div className="flex items-start gap-2">
            <Plant stage={stage} />
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 font-display text-base font-medium text-alert-ink">
                <AppIcon name="seedling" className="text-primary" /> Me queda
              </h2>
              {jar.tone === 'empty' ? (
                <Link to="/sueldo" className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary">
                  Cargar sueldo base
                </Link>
              ) : (
                <p className={`font-display text-[32px] font-semibold leading-none ${amountTone}`}>{formatMoney(remaining)}</p>
              )}
              <p className="mt-1 text-sm font-normal text-muted">{jar.message}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-medium text-alert-ink">Me queda</h2>
              <HomePot />
            </div>
            <p className="mt-1 font-display text-[38px] font-semibold leading-none text-primary">{card.remainingText}</p>
            <p className="mt-2 text-sm font-normal text-muted">Ingresos menos gastos y préstamos</p>
            <SoftDivider />
            <div className="space-y-2">
              {card.income.map((row) => (
                <Row key={row.label} line={row} />
              ))}
            </div>
            <SoftDivider />
            <div className="space-y-2">
              {card.spent.map((row) => (
                <Row key={row.label} line={row} />
              ))}
            </div>
            {card.showLoans ? (
              <>
                <SoftDivider />
                <div className="space-y-2">
                  {card.loans.map((row) => (
                    <Row key={row.label} line={row} />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
        <Link to="/se-me-fue" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-primary">
          Ver gastos
          <AppIcon name="arrow-right" />
        </Link>
      </Card>

      {hub ? null : <PartnerMemos />}
      {modules.error ? <p className="mb-3 text-center text-sm font-semibold text-alert-ink">{modules.error}</p> : null}

      <Link to="/compartidos" className="block">
        <Card className="flex items-center gap-2.5 bg-blush-soft">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blush text-alert-ink">
            <AppIcon name="handshake" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">{friendly ? 'Gastos compartidos' : 'Saldo compartidos'}</p>
            <p className="font-display text-lg font-semibold text-alert-ink">{debtCopy(meId, split)}</p>
          </div>
          <AppIcon name="arrow-right" className="text-alert" />
        </Card>
      </Link>

      {!otherId ? (
        <Card>
          <p className="font-display font-semibold text-primary">Invitá a tu compañera</p>
          <p className="text-sm font-normal text-muted">Pasale este código para que se sume al hogar.</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-widest text-primary">{data.inviteCode}</p>
        </Card>
      ) : null}

      {base <= 0 ? (
        <Card>
          <p className="font-display font-semibold text-alert-ink">Falta tu sueldo base</p>
          <p className="text-base font-normal text-muted">Sin eso el reparto no sabe qué porcentaje te toca.</p>
          <Link to="/sueldo" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary">
            Cargarlo ahora
          </Link>
        </Card>
      ) : null}

      {error ? <p className="text-center text-sm font-semibold text-alert-ink">{error}</p> : null}

      <Link
        to="/cargar"
        className="fixed bottom-24 right-[max(1.25rem,calc(50vw-190px))] z-30 grid h-[58px] w-[58px] place-items-center rounded-full bg-alert text-2xl text-bg shadow-fab"
        aria-label="Cargar gasto"
      >
        <AppIcon name="plus" />
      </Link>
      <Toast>{toast}</Toast>
    </>
  )
}

function HomePot() {
  return (
    <svg viewBox="0 0 72 72" className="h-16 w-14 shrink-0" role="img" aria-label="Plantita en maceta">
      <path d="M36 50 C36 40 35 28 34 18" stroke="#4F6B57" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M34 42 C24 42 18 35 19 28 C28 28 34 34 34 42Z" fill="#C7DDAE" />
      <path d="M35 36 C45 35 51 28 50 21 C41 22 34.5 28 35 36Z" fill="#4F6B57" />
      <path d="M20 50 h32 l-4 14 h-24z" fill="#C4866D" />
      <rect x="17" y="46" width="38" height="7" rx="3.5" fill="#85503C" />
    </svg>
  )
}

function SoftDivider() {
  return <div className="my-3 border-t border-dashed border-line" />
}

function Row({ line }: { line: HomeCardLine }) {
  const tone = {
    detail: 'font-normal text-muted',
    income: 'font-semibold text-primary',
    spent: 'font-semibold text-alert-ink',
    loan: 'font-normal text-lavender-ink',
  }[line.role]
  return (
    <div className={`flex items-baseline justify-between gap-3 text-[14px] ${tone}`}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {line.role === 'loan' ? <AppIcon name="hand-holding-dollar" /> : null}
        {line.label}
      </span>
      <span className="shrink-0 text-right font-display">{line.amount}</span>
    </div>
  )
}
