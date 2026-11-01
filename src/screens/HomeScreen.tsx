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
import { formatMoney } from '../lib/format.ts'
import { jarStatus } from '../lib/jar.ts'
import { FINANCE_SECTION_LINKS, isHubHome } from '../lib/modules.ts'
import type { ViewMode } from '../types/database.ts'

export function HomeScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error } = useFinance()
  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
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
  const financeRoute = useMatch('/finanzas')
  const hub = modules.ready && isHubHome(modules.enabled)
  if (!profile) return null
  if (loading && !data) return <p className="py-16 text-center font-extrabold text-muted">Cargando tu mes…</p>
  if (!data) return <p className="py-16 text-center font-extrabold text-alert-ink">{error}</p>

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
  const jar = jarStatus({
    base,
    privateSpent,
    myShare,
    extras,
    ...pace,
  })
  const friendly = profile.viewMode === 'friendly'
  const stage = plantStage(jar.percentLeft, jar.tone === 'empty')
  const phraseTone = jar.tone === 'green' ? 'text-good' : jar.tone === 'empty' ? 'text-muted' : 'text-alert-ink'
  const amountTone = pocket.remaining < 0 ? 'text-alert-ink' : 'text-good'

  async function changeMode(mode: ViewMode) {
    await saveViewMode(meId, mode)
    await refreshProfile()
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm font-bold text-muted">
          <AppIcon name="house" className="mr-1.5" /> Hola, {profile.displayName}
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
        <div className="mb-3 grid grid-cols-4 gap-2">
          {FINANCE_SECTION_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl bg-card text-[11px] font-extrabold text-primary shadow-card"
            >
              <AppIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
      <MonthSwitcher heading />
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
          <div className="flex items-center gap-2">
            <Plant stage={stage} />
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-muted">
                <AppIcon name="seedling" className="text-good" /> Me queda
              </h2>
              {jar.tone === 'empty' ? (
                <Link to="/sueldo" className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary">
                  Cargar sueldo base
                </Link>
              ) : (
                <p className={`font-display text-3xl font-bold leading-none ${amountTone}`}>{formatMoney(pocket.remaining)}</p>
              )}
              <p className={`mt-1 text-base font-bold ${phraseTone}`}>{jar.message}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-muted">Me queda</h2>
              <p className={`font-display text-3xl font-bold leading-none ${amountTone}`}>{formatMoney(pocket.remaining)}</p>
            </div>
            <div className="mt-4 space-y-2">
              <Row label="Sueldo base" value={formatMoney(pocket.base)} />
              <Row label="Extras" value={formatMoney(pocket.extras)} />
              <Row label="Ingresos" value={formatMoney(pocket.income)} strong />
            </div>
            <div className="my-3 border-t border-line" />
            <div className="space-y-2">
              <Row label="Mi parte compartidos" value={formatMoney(pocket.sharedShare)} />
              <Row label="Privados" value={formatMoney(pocket.privateSpent)} />
              <Row label="Gastos del mes" value={formatMoney(pocket.spent)} strong />
            </div>
          </>
        )}
      </Card>
      <Link to="/se-me-fue" className="mb-3 inline-flex min-h-11 items-center text-base font-semibold text-primary">
        Ver gastos
      </Link>

      {hub ? null : <PartnerMemos />}
      {modules.error ? <p className="mb-3 text-center text-sm font-bold text-alert-ink">{modules.error}</p> : null}

      <Link to="/compartidos" className="block">
        <Card className="flex items-center gap-2.5 bg-debt">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush text-primary">
            <AppIcon name="handshake" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">{friendly ? 'Gastos compartidos' : 'Saldo compartidos'}</p>
            <p className="font-display text-[17px] font-semibold">{debtCopy(meId, split)}</p>
          </div>
          <AppIcon name="chevron-right" className="text-alert-ink" />
        </Card>
      </Link>

      {!otherId ? (
        <Card>
          <p className="font-display font-semibold">Invitá a tu compañera</p>
          <p className="text-sm text-muted">Pasale este código para que se sume al hogar.</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-widest text-primary">{data.inviteCode}</p>
        </Card>
      ) : null}

      {base <= 0 ? (
        <Card>
          <p className="font-display font-semibold">Falta tu sueldo base</p>
          <p className="text-base text-muted">Sin eso el reparto no sabe qué porcentaje te toca.</p>
          <Link to="/sueldo" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary">
            Cargarlo ahora
          </Link>
        </Card>
      ) : null}

      {error ? <p className="text-center text-sm font-bold text-alert-ink">{error}</p> : null}

      <Link
        to="/cargar"
        className="fixed bottom-24 right-[max(1.25rem,calc(50vw-190px))] z-30 grid h-[58px] w-[58px] place-items-center rounded-full bg-primary text-2xl text-white shadow-fab"
        aria-label="Cargar gasto"
      >
        <AppIcon name="plus" />
      </Link>
      <Toast>{toast}</Toast>
    </>
  )
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-base">
      <span className={strong ? 'font-extrabold' : 'font-semibold'}>{label}</span>
      <span className={`text-right font-display ${strong ? 'font-extrabold' : 'font-bold'}`}>{value}</span>
    </div>
  )
}
