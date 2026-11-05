import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { Bird, OrnamentDivider, Plantita } from '../components/Adornos.tsx'
import { Progress } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { monthPocket, monthSplit, myPrivateSpent, partnerId } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import { todayCounterLabel, todayProgress, type Habit, type HabitCheck } from '../lib/habits.ts'
import { argentinaISO, asNumber, dayTotals, proteinLabel, proteinPercent, type MacroInput } from '../lib/meals.ts'
import { checkedThisWeek, memoCounts, pendingLabel, type MemoItem } from '../lib/memos.ts'
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
  const [foodMeals, setFoodMeals] = useState<MacroInput[]>([])
  const [foodGoal, setFoodGoal] = useState<number | null>(null)
  const [foodReady, setFoodReady] = useState(false)
  const [foodError, setFoodError] = useState('')

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

  useEffect(() => {
    if (!profile || !enabled.includes('comidas')) {
      setFoodMeals([])
      setFoodGoal(null)
      setFoodError('')
      setFoodReady(true)
      return
    }
    const day = argentinaISO()
    let active = true
    setFoodReady(false)
    Promise.all([
      supabase.from('meals').select('protein_g, carbs_g, fat_g, kcal').eq('eaten_on', day),
      supabase.from('nutrition_goals').select('protein_g').maybeSingle(),
    ]).then(([mealsResult, goalsResult]) => {
      if (!active) return
      if (mealsResult.error || goalsResult.error) {
        setFoodError(mealsResult.error?.message || goalsResult.error?.message || 'No se pudieron cargar las comidas.')
        setFoodMeals([])
        setFoodGoal(null)
        setFoodReady(true)
        return
      }
      setFoodError('')
      setFoodMeals(
        (mealsResult.data ?? []).map((row) => ({
          proteinG: asNumber(row.protein_g) ?? 0,
          carbsG: asNumber(row.carbs_g),
          fatG: asNumber(row.fat_g),
          kcal: asNumber(row.kcal),
        })),
      )
      setFoodGoal(asNumber(goalsResult.data?.protein_g ?? null))
      setFoodReady(true)
    })
    return () => {
      active = false
    }
  }, [profile, enabled])

  if (!profile) return null

  const counts = memoCounts(memos)
  const habitsOn = enabled.includes('habitos')
  const foodOn = enabled.includes('comidas')
  const progress = todayProgress(habits, habitChecks, new Date())
  const foodTotals = dayTotals(foodMeals)
  const checkedWeek = checkedThisWeek(memos, profile.id)
  const line = hubPlantCopy({
    habitsOn,
    memosOn: enabled.includes('memos'),
    foodOn,
    done: progress.done,
    total: progress.total,
    pending: counts.pending,
    checkedWeek,
    protein: foodTotals.protein,
    foodGoal,
  })
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
      <section className="scallop-b -mx-5 mb-2 min-h-[282px] bg-azul px-5 pb-5 pt-4 text-tinta">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-tinta">Hola, {profile.displayName}</p>
            <h1 className="font-display text-[34px] font-semibold leading-tight text-tinta">{hubDayLabel()}</h1>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <Link to="/modulos" aria-label="Mis módulos" className="grid h-11 w-11 place-items-center text-tinta">
              <AppIcon name="sliders" />
            </Link>
            <Bird />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-azul-ink bg-card px-3 py-2 text-tinta">
          <Plantita width={66} height={86} />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold leading-tight text-tinta">{line.title}</h2>
            {line.detail ? <p className="mt-1 text-sm font-semibold text-tinta">{line.detail}</p> : null}
          </div>
        </div>
      </section>
      <OrnamentDivider />
      {error || memoError || habitError || foodError ? (
        <p className="mb-3 text-center text-sm font-bold text-tinta">{error || memoError || habitError || foodError}</p>
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
          foodReady={foodReady}
          foodProtein={foodTotals.protein}
          foodGoal={foodGoal}
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
  foodReady,
  foodProtein,
  foodGoal,
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
  foodReady: boolean
  foodProtein: number
  foodGoal: number | null
}) {
  const meta = MODULE_META[module]
  return (
    <Link to={meta.to} className={`mb-2.5 flex min-h-[74px] items-center gap-3.5 rounded-2xl border-2 bg-card px-4 py-3 ${MODULE_BORDER[module]}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${meta.tone} ${meta.ink}`} aria-hidden="true">
        <AppIcon name={meta.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-semibold text-muted">{meta.label}</span>
        {module === 'finanzas' ? (
          <span className="block font-display text-xl font-semibold leading-tight">
            {spentReady ? formatMoney(spent) : '…'}{' '}
            <span className="font-sans text-sm font-bold text-muted">gastado en {month}</span>
          </span>
        ) : null}
        {module === 'memos' ? (
          <>
            <span className="block font-display text-xl font-semibold leading-tight">{pendingLabel(pending)}</span>
            {sharedPending > 0 ? (
              <span className="mt-0.5 block text-sm font-bold text-azul-ink">
                <AppIcon name="user-group" className="mr-1 text-sm" />
                {sharedPending} con {partnerName}
              </span>
            ) : null}
          </>
        ) : null}
        {module === 'habitos' ? (
          <>
            <span className="block font-display text-xl font-semibold leading-tight">
              {habitTotal > 0 ? `${todayCounterLabel(habitDone, habitTotal)} hoy` : 'Nada para hoy'}
            </span>
            {habitTotal > 0 ? (
              <span className="mt-1.5 flex gap-1">
                {Array.from({ length: habitTotal }, (_, index) => (
                  <i
                    key={index}
                    className={`h-2 min-w-1 flex-1 rounded-full ${index < habitDone ? 'bg-azul' : 'bg-sand'}`}
                  />
                ))}
              </span>
            ) : null}
          </>
        ) : null}
        {module === 'comidas' ? (
          foodReady ? (
            <>
              <span className="block font-display text-xl font-semibold leading-tight">{proteinLabel(foodProtein, foodGoal)}</span>
              {foodGoal != null && foodGoal > 0 ? (
                <span className="mt-1.5 block">
                  <Progress value={proteinPercent(foodProtein, foodGoal) ?? 0} color="var(--color-rosa-hondo)" />
                </span>
              ) : null}
            </>
          ) : (
            <span className="block font-display text-xl font-semibold leading-tight">…</span>
          )
        ) : null}
      </span>
      <AppIcon name="chevron-right" className="text-muted" />
    </Link>
  )
}

const MODULE_BORDER: Record<ModuleId, string> = {
  finanzas: 'border-mostaza-ink',
  habitos: 'border-salvia-ink',
  comidas: 'border-rosa-hondo',
  memos: 'border-azul-ink',
}

function hubPlantCopy({
  habitsOn,
  memosOn,
  foodOn,
  done,
  total,
  pending,
  checkedWeek,
  protein,
  foodGoal,
}: {
  habitsOn: boolean
  memosOn: boolean
  foodOn: boolean
  done: number
  total: number
  pending: number
  checkedWeek: number
  protein: number
  foodGoal: number | null
}): { title: string; detail: string } {
  if (habitsOn && (total > 0 || !memosOn)) {
    if (total <= 0) return { title: 'Hoy', detail: 'Nada para hoy' }
    return { title: 'Hoy', detail: `${todayCounterLabel(done, total)} hábitos.` }
  }
  if (memosOn) {
    if (pending > 0) {
      return { title: 'Tus memos', detail: pending === 1 ? 'Tenés 1 memo pendiente.' : `Tenés ${pending} memos pendientes.` }
    }
    if (checkedWeek > 0) {
      return { title: 'Tus memos', detail: checkedWeek === 1 ? 'Esta semana tachaste 1.' : `Esta semana tachaste ${checkedWeek}.` }
    }
    return { title: 'Tus memos', detail: 'Todavía no hay memos.' }
  }
  if (foodOn) return { title: 'Hoy', detail: `${proteinLabel(protein, foodGoal)}.` }
  return { title: 'Hoy', detail: '' }
}
