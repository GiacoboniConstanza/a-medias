import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { Fab } from '../components/Fab.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { PartnerMemos } from '../components/PartnerMemos.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { ViewOptions } from '../components/ViewOptions.tsx'
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
import { loanMonthEffect, loadLoanMovements, sharedSignedBalance, type PeriodLoan, type PeriodRepayment } from '../lib/loans.ts'
import { isHubHome } from '../lib/modules.ts'
import type { ViewMode } from '../types/database.ts'

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
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error } = useFinance()
  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const [closedBanner, setClosedBanner] = useState<string | null>(null)
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
  const hub = modules.ready && isHubHome(modules.enabled)
  if (!profile) return null
  const year = new Date().getFullYear()
  const bannerKey = yearBannerKey(profile.id, year)
  const showBanner = closedBanner !== bannerKey && !yearBannerClosed(bannerKey)
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
  const amountTone = remaining < 0 ? 'text-alert-ink' : 'text-title'
  const sharedSigned = sharedSignedBalance(meId, split)
  const sharedTone = sharedSigned > 0 ? 'text-primary' : sharedSigned < 0 ? 'text-alert-ink' : 'text-title'

  async function changeMode(mode: ViewMode) {
    await saveViewMode(meId, mode)
    await refreshProfile()
  }

  function closeBanner() {
    try {
      localStorage.setItem(bannerKey, '1')
    } catch {
      // Si el navegador no guarda, el aviso vuelve en la próxima visita.
    }
    setClosedBanner(bannerKey)
  }

  return (
    <>
      <SectionHeader
        lead={hub ? 'crumb' : 'greeting'}
        name={profile.displayName}
        aside={
          <>
            <NotificationBell />
            {hub ? null : (
              <Link to="/modulos" aria-label="Mis módulos" className="grid h-11 w-11 place-items-center text-primary">
                <AppIcon name="sliders" />
              </Link>
            )}
            <ViewOptions mode={profile.viewMode} onChange={(mode) => void changeMode(mode)} />
          </>
        }
      />
      <MonthSwitcher heading tone="home" />
      <SplitNotice notice={data.splitNotice} />

      <Card>
        {friendly ? (
          <div className="flex items-start gap-2">
            <HomePot />
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 font-display text-base font-medium text-title">
                <AppIcon name="seedling" className="text-primary" /> Me queda
              </h2>
              {jar.tone === 'empty' ? (
                <Link to="/sueldo" className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary">
                  Cargar sueldo base
                </Link>
              ) : (
                <p className={`font-display text-[clamp(1.75rem,8vw,2rem)] font-semibold leading-none whitespace-nowrap ${amountTone}`}>{formatMoney(remaining)}</p>
              )}
              <p className="mt-1 text-sm font-normal text-muted">{jar.message}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-medium text-title">Me queda</h2>
              <HomePot />
            </div>
            <p className={`mt-1 font-display text-[clamp(1.75rem,8vw,2.375rem)] font-semibold leading-none whitespace-nowrap ${amountTone}`}>{card.remainingText}</p>
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
      </Card>

      {hub ? null : <PartnerMemos />}
      {modules.error ? <p className="mb-3 text-center text-sm font-semibold text-alert-ink">{modules.error}</p> : null}

      <Link to="/compartidos" className="block">
        <Card className="flex items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-copper-soft text-alert-ink">
            <AppIcon name="handshake" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted">Saldo compartidos</p>
            <p className={`font-display text-lg font-semibold leading-snug ${sharedTone}`}>{stableMoney(debtCopy(meId, split), sharedSigned)}</p>
          </div>
          <AppIcon name="arrow-right" className="text-alert" />
        </Card>
      </Link>

      {showBanner ? (
        <div className="mb-3 flex h-14 items-center gap-1 rounded-2xl border border-line bg-sand-soft pl-3 pr-1">
          <AppIcon name="chart-pie" className="shrink-0 text-primary" />
          <p className="min-w-0 flex-1 font-display text-base font-medium text-title">Tu balance {year} está listo</p>
          <Link to="/mi-anio" className="grid h-12 w-12 place-items-center text-base font-bold text-primary">
            Ver
          </Link>
          <button type="button" aria-label="Cerrar aviso" onClick={closeBanner} className="grid h-12 w-12 place-items-center text-title">
            <AppIcon name="xmark" />
          </button>
        </div>
      ) : null}

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

      <Fab to="/cargar" label="Nuevo gasto" state={{ from: hub ? '/finanzas' : '/' }} />
      <Toast aboveFab onDone={() => setToast('')}>
        {toast}
      </Toast>
    </>
  )
}

function stableMoney(sentence: string, signed: number) {
  if (signed === 0) return sentence
  const money = formatMoney(Math.abs(signed))
  const index = sentence.indexOf(money)
  if (index < 0) return sentence
  return (
    <>
      {sentence.slice(0, index)}
      <span className="whitespace-nowrap">{money}</span>
      {sentence.slice(index + money.length)}
    </>
  )
}

function HomePot() {
  return (
    <svg viewBox="0 0 72 72" className="h-16 w-14 shrink-0" role="img" aria-label="Plantita en maceta">
      <path d="M34 46 C22 46 16 36 18 28 C28 30 34 38 34 46Z" fill="var(--color-sage-light)" />
      <path d="M36 40 C48 38 54 28 52 20 C42 22 36 30 36 40Z" fill="var(--color-good)" />
      <path d="M22 48 h30 l-4 16 h-22z" fill="var(--color-alert)" />
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
