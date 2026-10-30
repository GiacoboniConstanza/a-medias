import { useEffect, useState } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { PartnerMemos } from '../components/PartnerMemos.tsx'
import { Plant, plantStage } from '../components/Plant.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { SplitNotice } from '../components/SplitNotice.tsx'
import { ExpenseEditor } from '../components/ExpenseEditor.tsx'
import { ExpenseLine } from '../components/ExpenseLine.tsx'
import { Card, Toast } from '../components/ui.tsx'
import type { ExpenseItem } from '../lib/api.ts'
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
  const [editing, setEditing] = useState<ExpenseItem | null>(null)
  const [toast, setToast] = useState('')
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
  const modules = useModules()
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
    ...pace,
  })
  const friendly = profile.viewMode === 'friendly'
  const stage = plantStage(jar.percentLeft, jar.tone === 'empty')
  const phraseTone = jar.tone === 'green' ? 'text-good' : jar.tone === 'empty' ? 'text-muted' : 'text-alert-ink'
  const amountTone = pocket.remaining < 0 ? 'text-alert-ink' : 'text-good'
  const sharedWidth = pocket.spent > 0 ? (pocket.sharedShare / pocket.spent) * 100 : 0
  const privateWidth = pocket.spent > 0 ? (pocket.privateSpent / pocket.spent) * 100 : 0

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
              <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-muted">
                <AppIcon name="seedling" className="text-good" /> Me queda
              </h2>
              {jar.tone === 'empty' ? (
                <Link to="/sueldo" className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary">
                  Cargar sueldo base
                </Link>
              ) : (
                <p className={`font-display text-3xl font-bold leading-none ${amountTone}`}>{formatMoney(jar.remaining)}</p>
              )}
              <p className={`mt-1 text-xs font-bold ${phraseTone}`}>{jar.message}</p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-muted">
              <AppIcon name="wallet" className="text-good" /> Me queda
            </h2>
            <p className={`mt-1 font-display text-3xl font-bold leading-none ${amountTone}`}>{formatMoney(pocket.remaining)}</p>
            <Row label="Sueldo base" value={formatMoney(pocket.base)} />
            <Row label={`− Mi parte compartidos (${mine?.percent ?? 0}%)`} value={`− ${formatMoney(pocket.sharedShare)}`} tone="alert" />
            <Row label="− Privados" value={`− ${formatMoney(pocket.privateSpent)}`} tone="alert" />
            <Row label="= Me queda" value={formatMoney(pocket.remaining)} tone={pocket.remaining < 0 ? 'alert' : 'good'} strong />
          </>
        )}
      </Card>

      {hub ? null : <PartnerMemos />}
      {modules.error ? <p className="mb-3 text-center text-sm font-bold text-alert-ink">{modules.error}</p> : null}

      <Card>
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-muted">
          <AppIcon name={friendly ? 'basket-shopping' : 'receipt'} className="text-alert" /> Gastos del mes
        </h2>
        {friendly ? (
          <>
            <p className="mt-1 font-display text-[22px] font-bold leading-none">{formatMoney(pocket.spent)}</p>
            <div className="my-1.5 flex h-2.5 overflow-hidden rounded-full bg-sand">
              <i className="bg-lavender" style={{ width: `${sharedWidth}%` }} />
              <i className="bg-blush" style={{ width: `${privateWidth}%` }} />
            </div>
            <div className="flex justify-between gap-2 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1">
                <AppIcon name="circle" className="text-[8px] text-lavender" /> Compartidos {formatMoney(pocket.sharedShare)}
              </span>
              <span className="inline-flex items-center gap-1">
                <AppIcon name="circle" className="text-[8px] text-blush" /> Privados {formatMoney(pocket.privateSpent)}
              </span>
            </div>
          </>
        ) : (
          <>
            <Row label="Compartidos (mi parte)" value={formatMoney(pocket.sharedShare)} />
            <Row label="Privados" value={formatMoney(pocket.privateSpent)} />
            <Row label="Total" value={formatMoney(pocket.spent)} strong />
          </>
        )}
        {data.monthExpenses.length > 0 ? (
          <ul className="mt-2 border-t border-dashed border-line">
            {data.monthExpenses.map((expense) => {
              const category = data.categories.find((item) => item.id === expense.categoryId)
              return (
                <li key={expense.id} className="border-b border-dashed border-line last:border-0">
                  <ExpenseLine
                    expense={expense}
                    categoryName={category?.name ?? 'Otros'}
                    categoryIcon={category?.icon || 'tag'}
                    onOpen={() => setEditing(expense)}
                  />
                </li>
              )
            })}
          </ul>
        ) : null}
      </Card>

      <Card>
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-muted">
          <AppIcon name={friendly ? 'sun' : 'sack-dollar'} className="text-warn" /> Ingresos
        </h2>
        {friendly ? (
          <div className="mt-1 flex justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Sueldo base</p>
              <p className="font-display text-lg font-bold">{formatMoney(pocket.base)}</p>
              <Link to="/sueldo" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                Mi sueldo
              </Link>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">
                Extras · <AppIcon name="bag-shopping" /> a la bolsa
              </p>
              <p className="font-display text-lg font-bold text-alert-ink">{formatMoney(pocket.extras)}</p>
            </div>
          </div>
        ) : (
          <>
            <Row label="Sueldo base" value={formatMoney(pocket.base)} />
            <Link to="/sueldo" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
              Mi sueldo
            </Link>
            <Row label="Extras (a la bolsa, no cuenta)" value={formatMoney(pocket.extras)} tone="alert" />
          </>
        )}
      </Card>

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
          <p className="text-sm text-muted">Sin eso el reparto no sabe qué porcentaje te toca. Los extras no entran en la cuenta.</p>
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
      {editing ? (
        <ExpenseEditor
          presentation="sheet"
          expense={editing}
          onClose={() => setEditing(null)}
          onDone={async (notice) => {
            setEditing(null)
            setToast(notice)
          }}
        />
      ) : null}
    </>
  )
}

function Row({
  label,
  value,
  tone = 'text',
  strong = false,
}: {
  label: string
  value: string
  tone?: 'text' | 'alert' | 'good'
  strong?: boolean
}) {
  const color = tone === 'alert' ? 'text-alert-ink' : tone === 'good' ? 'text-good' : 'text-text'
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-line py-1 text-[13px] last:border-0">
      <span className={strong ? 'font-extrabold' : ''}>{label}</span>
      <b className={`${color} ${strong ? 'font-extrabold' : 'font-bold'}`}>{value}</b>
    </div>
  )
}
