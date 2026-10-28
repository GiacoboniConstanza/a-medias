import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { IconPicker } from '../components/IconPicker.tsx'
import { DaySprout } from '../components/Sprout.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import {
  addDays,
  ALL_DAYS,
  habitsForDay,
  normalizeDays,
  sproutStage,
  startOfWeek,
  todayCounterLabel,
  todayProgress,
  weekCounter,
  weekCounterLabel,
  weekSnapshots,
  weekTitle,
  WEEKDAYS,
  type Habit,
  type HabitCheck,
  type Weekday,
} from '../lib/habits.ts'
import { todayISO } from '../lib/month.ts'
import { supabase } from '../lib/supabase.ts'

export function HabitsScreen() {
  const { profile } = useAuth()
  const { enabled, ready } = useModules()
  const [habits, setHabits] = useState<Habit[]>([])
  const [checks, setChecks] = useState<HabitCheck[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sheetHabit, setSheetHabit] = useState<Habit | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    let active = true
    supabase
      .from('habits')
      .select('id, name, icon_name, days_of_week, archived')
      .eq('archived', false)
      .order('created_at')
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setError(loadError.message)
          setHabits([])
        } else {
          setHabits(
            (data ?? []).map((row) => ({
              id: row.id,
              name: row.name,
              iconName: row.icon_name,
              daysOfWeek: row.days_of_week,
              archived: row.archived,
            })),
          )
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    const today = new Date()
    const currentWeek = startOfWeek(today)
    const start = weekStart < currentWeek ? weekStart : currentWeek
    const end = addDays(weekStart, 6) > today ? addDays(weekStart, 6) : today
    let active = true
    supabase
      .from('habit_checks')
      .select('habit_id, day')
      .gte('day', todayISO(start))
      .lte('day', todayISO(end))
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setError(loadError.message)
          return
        }
        setChecks((data ?? []).map((row) => ({ habitId: row.habit_id, day: row.day })))
      })
    return () => {
      active = false
    }
  }, [profile, weekStart])

  if (!profile) return null
  if (ready && !enabled.includes('habitos')) return <Navigate to="/" replace />

  const today = new Date()
  const todayIso = todayISO(today)
  const progress = todayProgress(habits, checks, today)
  const days = weekSnapshots(habits, checks, weekStart, today)
  const counter = weekCounter(days)
  const todayHabits = habitsForDay(habits, today)
  const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(today)

  async function toggleDone(habit: Habit) {
    if (pendingId) return
    const exists = checks.some((check) => check.habitId === habit.id && check.day === todayIso)
    setPendingId(habit.id)
    setError('')
    setChecks((current) =>
      exists ? current.filter((check) => !(check.habitId === habit.id && check.day === todayIso)) : [...current, { habitId: habit.id, day: todayIso }],
    )
    const result = exists
      ? await supabase.from('habit_checks').delete().eq('habit_id', habit.id).eq('day', todayIso)
      : await supabase.from('habit_checks').insert({ habit_id: habit.id, day: todayIso })
    setPendingId(null)
    if (result.error) {
      setChecks((current) =>
        exists ? [...current, { habitId: habit.id, day: todayIso }] : current.filter((check) => !(check.habitId === habit.id && check.day === todayIso)),
      )
      setError(result.error.message)
    }
  }

  function openNew() {
    setSheetHabit(null)
    setSheetOpen(true)
  }

  function openEdit(habit: Habit) {
    setSheetHabit(habit)
    setSheetOpen(true)
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-muted">
          <AppIcon name="seedling" className="mr-1.5" /> Hábitos
        </p>
        <span className="inline-flex items-center gap-1 rounded-2xl bg-sage-light px-3 py-1.5 text-xs font-extrabold text-primary">
          <AppIcon name="lock" /> Solo vos
        </span>
      </header>
      <div className="mb-3 flex items-center justify-between gap-3">
        <button type="button" aria-label="Semana anterior" onClick={() => setWeekStart((current) => addDays(current, -7))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft">
          <AppIcon name="chevron-left" />
        </button>
        <h1 className="text-center font-display text-[1.75rem] font-bold leading-tight">{weekTitle(weekStart, today)}</h1>
        <button type="button" aria-label="Semana siguiente" onClick={() => setWeekStart((current) => addDays(current, 7))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft">
          <AppIcon name="chevron-right" />
        </button>
      </div>
      {todayISO(weekStart) !== todayISO(startOfWeek(today)) ? (
        <div className="mb-3 flex justify-center">
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="min-h-11 rounded-full bg-card px-4 text-sm font-semibold text-text shadow-soft">
            Hoy
          </button>
        </div>
      ) : null}
      <section className="mb-3 rounded-3xl bg-card px-3 py-3 shadow-card">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-muted">
            <AppIcon name="sun" className="text-warn" /> Tu semana en brotes
          </h2>
          <p className="text-xs font-extrabold text-good">{counter.elapsed > 0 ? weekCounterLabel(counter.touched, counter.elapsed) : 'Sin hábitos'}</p>
        </div>
        <div className="mt-1.5 flex justify-between">
          {days.map((day, index) => {
            const meta = WEEKDAYS[index]
            const stage = sproutStage(day.done, day.scheduled, day.when)
            const detail = day.when === 'future' || day.scheduled === 0 ? 'sin brote' : `${day.done} de ${day.scheduled}`
            return (
              <div
                key={day.iso}
                className={`flex w-10 flex-col items-center rounded-2xl py-1 ${day.when === 'today' ? 'bg-[#EEF4E6] text-primary' : 'text-[#a49c88]'}`}
                aria-label={`${meta?.name ?? ''}, ${detail}`}
              >
                <DaySprout stage={stage} />
                <span className="text-[11.5px] font-extrabold">{meta?.label}</span>
              </div>
            )
          })}
        </div>
      </section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-bold text-[#8a8370]">Hoy · {weekday}</h2>
        <p className="text-[13px] font-extrabold text-good">
          {progress.total > 0 ? `${todayCounterLabel(progress.done, progress.total)} hoy` : 'Nada para hoy'}
        </p>
      </div>
      {loading ? <p className="py-6 text-center font-extrabold text-muted">Cargando hábitos…</p> : null}
      {!loading && todayHabits.length === 0 ? <p className="py-4 text-center text-sm font-bold text-muted">Hoy no hay hábitos. Podés sumar uno.</p> : null}
      <ul>
        {todayHabits.map((habit) => {
          const done = checks.some((check) => check.habitId === habit.id && check.day === todayIso)
          return (
            <li key={habit.id} className="mb-2 flex min-h-[58px] items-center gap-2 rounded-[22px] bg-card py-1.5 pl-4 pr-2.5 shadow-card">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E3EED4] text-primary">
                <AppIcon name={habit.iconName} />
              </span>
              <button type="button" onClick={() => openEdit(habit)} className="min-h-11 min-w-0 flex-1 text-left text-[15.5px] font-bold">
                {habit.name}
              </button>
              <button
                type="button"
                disabled={pendingId === habit.id}
                onClick={() => void toggleDone(habit)}
                className={`inline-flex min-h-11 min-w-[92px] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-extrabold ${
                  done ? 'bg-primary text-white' : 'border-2 border-sage-light text-primary'
                }`}
              >
                {done ? (
                  <>
                    <AppIcon name="check" /> Hecho
                  </>
                ) : (
                  'Marcar'
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={openNew}
        className="mt-1 flex min-h-[52px] w-full items-center gap-3 rounded-[22px] border-2 border-dashed border-line px-4 text-left"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F2EADF] text-muted">
          <AppIcon name="plus" />
        </span>
        <span className="font-extrabold text-muted">Nuevo hábito</span>
      </button>
      {error ? <p className="mt-3 text-center text-sm font-bold text-alert-ink">{error}</p> : null}
      <HabitSheet
        open={sheetOpen}
        habit={sheetHabit}
        ownerId={profile.id}
        onClose={() => setSheetOpen(false)}
        onSaved={(habit) => {
          setHabits((current) => {
            const exists = current.some((item) => item.id === habit.id)
            return exists ? current.map((item) => (item.id === habit.id ? habit : item)) : [...current, habit]
          })
          setSheetOpen(false)
        }}
        onArchived={(id) => {
          setHabits((current) => current.filter((item) => item.id !== id))
          setSheetOpen(false)
        }}
      />
    </>
  )
}

function HabitSheet({
  open,
  habit,
  ownerId,
  onClose,
  onSaved,
  onArchived,
}: {
  open: boolean
  habit: Habit | null
  ownerId: string
  onClose: () => void
  onSaved: (habit: Habit) => void
  onArchived: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('seedling')
  const [days, setDays] = useState<Weekday[]>([...ALL_DAYS])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const nextDays = habit ? normalizeDays(habit.daysOfWeek) : [...ALL_DAYS]
    setName(habit?.name ?? '')
    setIcon(habit?.iconName || 'seedling')
    setDays(nextDays.length > 0 ? nextDays : [...ALL_DAYS])
    setError('')
    setSaving(false)
  }, [open, habit])

  function toggleDay(index: Weekday) {
    setDays((current) => {
      if (current.includes(index)) {
        if (current.length === 1) return current
        return current.filter((day) => day !== index)
      }
      return normalizeDays([...current, index])
    })
  }

  async function save() {
    const trimmed = name.trim()
    const chosen = normalizeDays(days)
    if (!trimmed || chosen.length === 0 || saving) return
    setSaving(true)
    setError('')
    if (habit) {
      const { data, error: saveError } = await supabase
        .from('habits')
        .update({ name: trimmed, icon_name: icon, days_of_week: chosen })
        .eq('id', habit.id)
        .select('id, name, icon_name, days_of_week, archived')
        .single()
      setSaving(false)
      if (saveError || !data) {
        setError(saveError?.message ?? 'No se pudo guardar el hábito.')
        return
      }
      onSaved({
        id: data.id,
        name: data.name,
        iconName: data.icon_name,
        daysOfWeek: data.days_of_week,
        archived: data.archived,
      })
      return
    }
    const { data, error: saveError } = await supabase
      .from('habits')
      .insert({ owner_id: ownerId, name: trimmed, icon_name: icon, days_of_week: chosen })
      .select('id, name, icon_name, days_of_week, archived')
      .single()
    setSaving(false)
    if (saveError || !data) {
      setError(saveError?.message ?? 'No se pudo guardar el hábito.')
      return
    }
    onSaved({
      id: data.id,
      name: data.name,
      iconName: data.icon_name,
      daysOfWeek: data.days_of_week,
      archived: data.archived,
    })
  }

  async function archive() {
    if (!habit || saving) return
    setSaving(true)
    setError('')
    const { error: saveError } = await supabase.from('habits').update({ archived: true }).eq('id', habit.id)
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    onArchived(habit.id)
  }

  return (
    <Sheet
      open={open}
      title={habit ? 'Editar hábito' : 'Nuevo hábito'}
      onClose={onClose}
      footer={
        <Button type="button" onClick={() => void save()} disabled={saving || name.trim().length === 0}>
          <span className="inline-flex items-center justify-center gap-2">
            <AppIcon name="check" /> Guardar
          </span>
        </Button>
      }
    >
      <label className="mb-3 block text-sm font-bold">
        <span className="mb-1 block text-muted">Nombre</span>
        <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Tomar agua" />
      </label>
      <p className="mb-2 text-sm font-bold text-muted">Ícono</p>
      <IconPicker value={icon} onChange={setIcon} layout="grid" />
      <p className="mb-2 mt-4 text-sm font-bold text-muted">Días</p>
      <div className="flex justify-between gap-1">
        {WEEKDAYS.map((day) => {
          const on = days.includes(day.index)
          return (
            <button
              key={day.index}
              type="button"
              aria-pressed={on}
              aria-label={day.name}
              onClick={() => toggleDay(day.index)}
              className={`grid h-11 w-11 place-items-center rounded-2xl text-sm font-extrabold ${on ? 'bg-primary text-white' : 'bg-sand text-muted'}`}
            >
              {day.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs font-semibold text-muted">Elegí al menos un día.</p>
      {habit ? (
        <button type="button" onClick={() => void archive()} disabled={saving} className="mt-4 min-h-11 w-full rounded-2xl border-2 border-line text-base font-extrabold text-alert-ink">
          Archivar
        </button>
      ) : null}
      {error ? <p className="mt-3 text-sm font-bold text-alert-ink">{error}</p> : null}
    </Sheet>
  )
}
