import { Link } from 'react-router-dom'
import { Jar } from '../components/Jar.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { Card } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { saveViewMode } from '../lib/api.ts'
import { debtCopy, monthSplit, myPrivateSpent, paceInput, partnerId } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import { jarStatus } from '../lib/jar.ts'
import { daysLeftInMonth, monthName } from '../lib/month.ts'
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
  const jar = jarStatus({
    base: data.bases[meId] ?? 0,
    privateSpent: myPrivateSpent(data, meId),
    myShare: mine?.share ?? 0,
    ...pace,
  })
  const days = pace.isCurrentMonth ? daysLeftInMonth() : 0

  async function changeMode(mode: ViewMode) {
    await saveViewMode(meId, mode)
    await refreshProfile()
  }

  return (
    <>
      <header className="mb-3 flex items-center justify-between">
        <span className="text-xl font-black text-brand">A Medias</span>
        <ViewToggle mode={profile.viewMode} onChange={(mode) => void changeMode(mode)} />
      </header>
      <MonthSwitcher />
      <p className="text-sm font-bold text-muted">Hola, {profile.displayName} 👋</p>
      <h1 className="mb-2 text-[22px] font-extrabold">Tu plata de {monthName(month)}</h1>

      {profile.viewMode === 'friendly' ? (
        <>
          <Jar percent={jar.percentLeft} tone={jar.tone} />
          <Card className={`text-center ${TONE_CARD[jar.tone]}`}>
            <p className="font-extrabold">{jar.message}</p>
            {jar.tone !== 'empty' ? (
              <p className="text-sm font-semibold text-muted">
                {jar.remaining >= 0 ? 'Quedan' : 'Te pasaste'} {formatMoney(Math.abs(jar.remaining))}
                {days > 0 ? ` para ${days} días` : ''}
              </p>
            ) : (
              <Link to="/sueldo" className="mt-1 inline-block font-extrabold text-brand">
                Cargar sueldo base
              </Link>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <p className="font-extrabold">Resumen contable</p>
          <p className="mt-2 text-sm text-muted">Compartidos del mes</p>
          <p className="text-2xl font-black">{formatMoney(split.total)}</p>
          <p className="mt-2 text-sm font-bold">
            Tu parte: {mine ? `${mine.percent}% · ${formatMoney(mine.share)}` : '—'}
          </p>
          <Link to="/compartidos" className="mt-3 block font-extrabold text-brand">
            Ver el detalle del reparto
          </Link>
        </Card>
      )}

      <Link to="/compartidos" className="block">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-muted">Gastos compartidos</p>
            <p className="text-lg font-extrabold">{debtCopy(meId, split)}</p>
          </div>
          <span className="text-3xl">🤝</span>
        </Card>
      </Link>

      {!otherId ? (
        <Card className="bg-chip">
          <p className="font-extrabold">Invitá a tu compañera</p>
          <p className="text-sm text-muted">Pasale este código para que se sume al hogar.</p>
          <p className="mt-2 text-2xl font-black tracking-widest text-brand">{data.inviteCode}</p>
        </Card>
      ) : null}

      {(data.bases[meId] ?? 0) <= 0 ? (
        <Card>
          <p className="font-extrabold">Falta tu sueldo base</p>
          <p className="text-sm text-muted">Sin eso el reparto no sabe qué porcentaje te toca. Los extras no entran en la cuenta.</p>
          <Link to="/sueldo" className="mt-2 inline-block font-extrabold text-brand">
            Cargarlo ahora
          </Link>
        </Card>
      ) : null}

      {error ? <p className="text-center text-sm font-bold text-bad">{error}</p> : null}

      <Link
        to="/cargar"
        className="fixed bottom-20 right-[max(1.25rem,calc(50vw-190px))] z-30 grid h-16 w-16 place-items-center rounded-full bg-pink text-4xl font-black text-white shadow-fab"
        aria-label="Cargar gasto"
      >
        +
      </Link>
    </>
  )
}
