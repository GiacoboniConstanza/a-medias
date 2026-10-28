import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { HubPlant, Sprout } from '../components/Sprout.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { monthPocket, monthSplit, myPrivateSpent, partnerId } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import { checkedThisWeek, memoCounts, pendingLabel, plantLine, type MemoItem } from '../lib/memos.ts'
import { hubDayLabel, MODULE_META, type ModuleId } from '../lib/modules.ts'
import { monthName } from '../lib/month.ts'
import { supabase } from '../lib/supabase.ts'

export function HubScreen() {
  const { profile } = useAuth()
  const { enabled, error } = useModules()
  const { month } = useMonth()
  const { data, loading } = useFinance()
  const [memos, setMemos] = useState<MemoItem[]>([])
  const [memoError, setMemoError] = useState('')

  useEffect(() => {
    if (!profile || !enabled.includes('memos')) {
      setMemos([])
      return
    }
    let active = true
    supabase
      .from('memos')
      .select('id, owner_id, text, done, shared, updated_at')
      .order('created_at', { ascending: false })
      .then(({ data: rows, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setMemoError(loadError.message)
          setMemos([])
          return
        }
        setMemoError('')
        setMemos(
          (rows ?? []).map((row) => ({
            id: row.id,
            ownerId: row.owner_id,
            text: row.text,
            done: row.done,
            shared: row.shared,
            updatedAt: row.updated_at,
          })),
        )
      })
    return () => {
      active = false
    }
  }, [profile, enabled])

  if (!profile) return null

  const counts = memoCounts(memos)
  const line = plantLine(counts.pending, checkedThisWeek(memos, profile.id))
  const otherId = data ? partnerId(data, profile.id) : null
  const partnerName = (otherId && data?.names[otherId]) || 'tu compañera'
  const showFinance = enabled.includes('finanzas')
  let spent = 0
  if (showFinance && data) {
    const split = monthSplit(data)
    const mine = split.rows.find((row) => row.id === profile.id)
    const pocket = monthPocket({
      base: data.bases[profile.id] ?? 0,
      privateSpent: myPrivateSpent(data, profile.id),
      myShare: mine?.share ?? 0,
      extras: data.extrasThisMonth.reduce((sum, extra) => sum + extra.amount, 0),
    })
    spent = pocket.spent
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-muted">
          <AppIcon name="seedling" className="mr-1.5" /> Hola, {profile.displayName}
        </p>
        <Link
          to="/modulos"
          aria-label="Mis módulos"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft"
        >
          <AppIcon name="sliders" />
        </Link>
      </header>
      <h1 className="font-display text-[1.8rem] font-bold leading-tight">{hubDayLabel()}</h1>
      <section className="mb-3 mt-3.5 flex items-center gap-1.5 rounded-3xl bg-gradient-to-br from-card to-[#EEF4E6] py-2.5 pl-0 pr-4 shadow-card">
        <HubPlant bloom={counts.pending + checkedThisWeek(memos, profile.id) > 0} />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold leading-tight text-good">{line.title}</h2>
          <p className="mt-1.5 text-xs font-bold text-muted">{line.detail}</p>
        </div>
      </section>
      {error || memoError ? <p className="mb-3 text-center text-sm font-bold text-alert-ink">{error || memoError}</p> : null}
      {enabled.map((module) => (
        <ModuleCard
          key={module}
          module={module}
          spent={spent}
          spentReady={showFinance && !loading && Boolean(data)}
          month={monthName(month)}
          pending={counts.pending}
          sharedPending={counts.sharedPending}
          partnerName={partnerName}
        />
      ))}
    </>
  )
}

function ModuleCard({
  module,
  spent,
  spentReady,
  month,
  pending,
  sharedPending,
  partnerName,
}: {
  module: ModuleId
  spent: number
  spentReady: boolean
  month: string
  pending: number
  sharedPending: number
  partnerName: string
}) {
  const meta = MODULE_META[module]
  return (
    <Link to={meta.to} className="mb-2.5 flex min-h-[74px] items-center gap-3.5 rounded-3xl bg-card px-4 py-3 shadow-card">
      <Sprout module={module} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-semibold text-muted">{meta.label}</span>
        {module === 'finanzas' ? (
          <span className="block font-display text-xl font-bold leading-tight">
            {spentReady ? formatMoney(spent) : '…'}{' '}
            <span className="font-sans text-[12.5px] font-bold text-muted">gastado en {month}</span>
          </span>
        ) : null}
        {module === 'memos' ? (
          <>
            <span className="block font-display text-xl font-bold leading-tight">{pendingLabel(pending)}</span>
            {sharedPending > 0 ? (
              <span className="mt-0.5 block text-[12.5px] font-bold text-[#5f548c]">
                <AppIcon name="user-group" className="mr-1 text-[10px]" />
                {sharedPending} con {partnerName}
              </span>
            ) : null}
          </>
        ) : null}
        {module === 'habitos' || module === 'comidas' ? (
          <span className="block font-display text-xl font-bold leading-tight">Próximamente</span>
        ) : null}
      </span>
      <AppIcon name="chevron-right" className="text-[#c9b9a3]" />
    </Link>
  )
}
