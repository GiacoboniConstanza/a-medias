import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { Jar } from '../components/Jar.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { Card } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { saveViewMode } from '../lib/api.ts'
import { debtCopy, monthPocket, monthSplit, myPrivateSpent, paceInput, partnerId } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import { jarStatus } from '../lib/jar.ts'
import { daysLeftInMonth } from '../lib/month.ts'
import type { ViewMode } from '../types/database.ts'

const TONE_CARD = {
  green: 'bg-good-bg text-good',
  yellow: 'bg-warn-bg text-warn',
  red: 'bg-bad-bg text-bad',
  empty: 'bg-chip text-brand',
}

export function HomeScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error } = useFinance()
  if (!profile) return null
  if (loading && !data) return <p className="py-16 text-center font-extrabold text-muted">Cargando tu mes…</p>
  if (!data) return <p className="py-16 text-center font-extrabold text-bad">{error}</p>

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
  const days = pace.isCurrentMonth ? daysLeftInMonth() : 0
  const friendly = profile.viewMode === 'friendly'

  async function changeMode(mode: ViewMode) {
    await saveViewMode(meId, mode)
    await refreshProfile()
  }

  return (
    <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xl font-black text-brand">A Medias</span>
        <ViewToggle mode={profile.viewMode} onChange={(mode) => void changeMode(mode)} />
      </header>
      <p className="text-sm font-semibold text-ink">Hola, {profile.displayName}</p>
      <MonthSwitcher heading />

      <Card>
        <h2 className="text-base font-semibold">Me queda</h2>
        {friendly ? (
          <>
            <Jar percent={jar.percentLeft} tone={jar.tone} />
            <div className={`rounded-2xl px-3 py-3 text-center ${TONE_CARD[jar.tone]}`}>
              <p className="font-semibold">{jar.message}</p>
              {jar.tone !== 'empty' ? (
                <p className="text-sm font-semibold text-ink">
                  {jar.remaining >= 0 ? 'Quedan' : 'Te pasaste'} {formatMoney(Math.abs(jar.remaining))}
                  {days > 0 ? ` para ${days} días` : ''}
                </p>
              ) : (
                <Link to="/sueldo" className="mt-1 inline-flex min-h-11 items-center font-semibold text-brand">
                  Cargar sueldo base
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-4xl font-black leading-none">{formatMoney(pocket.remaining)}</p>
            <ul className="mt-3 space-y-1 text-sm font-semibold text-ink">
              <li>Sueldo base {formatMoney(pocket.base)}</li>
              <li>Menos gastos privados {formatMoney(pocket.privateSpent)}</li>
              <li>Menos tu parte de los compartidos {formatMoney(pocket.sharedShare)}</li>
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Gastos</h2>
        <p className="mt-1 text-3xl font-black leading-none">{formatMoney(pocket.spent)}</p>
        <ul className="mt-3 space-y-1 text-sm font-semibold text-ink">
          <li>Compartidos, tu parte {formatMoney(pocket.sharedShare)}</li>
          <li>Privados {formatMoney(pocket.privateSpent)}</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Ingresos</h2>
        <p className="mt-1 text-3xl font-black leading-none">{formatMoney(pocket.income)}</p>
        <ul className="mt-3 space-y-1 text-sm font-semibold text-ink">
          <li>Sueldo base {formatMoney(pocket.base)}</li>
          <li>Extras {formatMoney(pocket.extras)} · a la bolsa</li>
        </ul>
      </Card>

      <Link to="/compartidos" className="block">
        <Card className="flex items-center justify-between bg-chip">
          <div>
            <p className="text-sm font-semibold text-ink">Saldo del mes</p>
            <p className="font-semibold">{debtCopy(meId, split)}</p>
          </div>
          <AppIcon name="handshake" className="text-2xl text-brand" />
        </Card>
      </Link>

      {!otherId ? (
        <Card className="bg-chip">
          <p className="font-extrabold">Invitá a tu compañera</p>
          <p className="text-sm text-ink">Pasale este código para que se sume al hogar.</p>
          <p className="mt-2 text-2xl font-black tracking-widest text-brand">{data.inviteCode}</p>
        </Card>
      ) : null}

      {base <= 0 ? (
        <Card>
          <p className="font-extrabold">Falta tu sueldo base</p>
          <p className="text-sm text-ink">Sin eso el reparto no sabe qué porcentaje te toca. Los extras no entran en la cuenta.</p>
          <Link to="/sueldo" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand">
            Cargarlo ahora
          </Link>
        </Card>
      ) : null}

      {error ? <p className="text-center text-sm font-bold text-bad">{error}</p> : null}

      <Link
        to="/cargar"
        className="fixed bottom-24 right-[max(1.25rem,calc(50vw-190px))] z-30 grid h-16 w-16 place-items-center rounded-full bg-pink text-2xl text-white shadow-fab"
        aria-label="Cargar gasto"
      >
        <AppIcon name="plus" />
      </Link>
    </>
  )
}
