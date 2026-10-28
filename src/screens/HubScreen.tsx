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
import { habitPlantCopy, todayCounterLabel, todayProgress, visibleLeaves, type Habit, type HabitCheck } from '../lib/habits.ts'
import { checkedThisWeek, memoCounts, pendingLabel, plantLine, type MemoItem } from '../lib/memos.ts'
import { hubDayLabel, MODULE_META, type ModuleId } from '../lib/modules.ts'
import { monthName, todayISO } from '../lib/month.ts'
import { supabase } from '../lib/supabase.ts'

export function HubScreen() {
  const { profile } = useAuth()
  const { enabled, error } = useModules()
  const { month } = useMonth()
  const { data, loading } = useFinance()
  const [memos, setMemos] = useState<MemoItem[]>([])
  const [memoError, setMemoError] = useState('')
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitChecks, setHabitChecks] = useState<HabitCheck[]>([])
  const [habitError, setHabitError] = useState('')

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

  useEffect(() => {
    if (!profile || !enabled.includes('habitos')) {
      setHabits([])
      setHabitChecks([])
      return
    }
    const day = todayISO()
    let active = true
    Promise.all([
      supabase.from('habits').select('id, name, icon_name, days_of_week, archived').eq('archived', false).order('created_at'),
      supabase.from('habit_checks').select('habit_id, day').eq('day', day),
    ]).then(([habitsResult, checksResult]) => {
      if (!active) return
      if (habitsResult.error || checksResult.error) {
        setHabitError(habitsResult.error?.message || checksResult.error?.message || 'No se pudieron cargar los hábitos.')
        setHabits([])
        setHabitChecks([])
        return
      }
      setHabitError('')
      setHabits(
        (habitsResult.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          iconName: row.icon_name,
          daysOfWeek: row.days_of_week,
          archived: row.archived,
        })),
      )
      setHabitChecks((checksResult.data ?? []).map((row) => ({ habitId: row.habit_id, day: row.day })))
    })
    return () => {
      active = false
    }
  }, [profile, enabled])

  if (!profile) return null

  const counts = memoCounts(memos)
  const habitsOn = enabled.includes('habitos')
  const progress = todayProgress(habits, habitChecks, new Date())
  const leaves = habitsOn ? visibleLeaves(progress.done, progress.total) : { solid: 3, dashed: 0 }
  const line =
    habitsOn && (progress.total > 0 || !enabled.includes('memos'))
      ? habitPlantCopy(progress.done, progress.total)
      : plantLine(counts.pending, checkedThisWeek(memos, profile.id))
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
        <HubPlant bloom={counts.pending + checkedThisWeek(memos, profile.id) > 0} solid={leaves.solid} dashed={leaves.dashed} />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold leading-tight text-good">{line.title}</h2>
          <p className="mt-1.5 text-xs font-bold text-muted">{line.detail}</p>
        </div>
      </section>
      {error || memoError || habitError ? (
        <p className="mb-3 text-center text-sm font-bold text-alert-ink">{error || memoError || habitError}</p>
      ) : null}
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
          habitDone={progress.done}
          habitTotal={progress.total}
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
  habitDone,
  habitTotal,
}: {
  module: ModuleId
  spent: number
  spentReady: boolean
  month: string
  pending: number
  sharedPending: number
  partnerName: string
  habitDone: number
  habitTotal: number
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
        {module === 'habitos' ? (
          <>
            <span className="block font-display text-xl font-bold leading-tight">
              {habitTotal > 0 ? `${todayCounterLabel(habitDone, habitTotal)} hoy` : 'Nada para hoy'}
            </span>
            {habitTotal > 0 ? (
              <span className="mt-1.5 flex gap-1">
                {Array.from({ length: habitTotal }, (_, index) => (
                  <i
                    key={index}
                    className={`h-2 min-w-1 flex-1 rounded-full ${index < habitDone ? 'bg-good' : 'bg-[#F2EADF]'}`}
                  />
                ))}
              </span>
            ) : null}
          </>
        ) : null}
        {module === 'comidas' ? <span className="block font-display text-xl font-bold leading-tight">Próximamente</span> : null}
      </span>
      <AppIcon name="chevron-right" className="text-[#c9b9a3]" />
    </Link>
  )
}
