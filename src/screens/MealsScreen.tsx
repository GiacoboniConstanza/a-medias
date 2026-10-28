import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { ModuleSwitch } from '../components/ModuleSwitch.tsx'
import { Sprout } from '../components/Sprout.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Chip, Progress, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import {
  MEAL_ICON,
  MEAL_LABEL,
  MEAL_TYPES,
  argentinaISO,
  asNumber,
  dayTotals,
  formatAmount,
  isMealType,
  parseMacro,
  proteinPercent,
  shiftArgentinaISO,
  type MacroInput,
  type MealType,
} from '../lib/meals.ts'
import { supabase } from '../lib/supabase.ts'

type Meal = MacroInput & {
  id: string
  eatenOn: string
  mealType: MealType
  name: string
}

type Goals = {
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
}

type SavedFood = MacroInput & { id: string; name: string }

type DayOffset = -1 | 0 | 1

const DAY_LABEL: Record<DayOffset, string> = { [-1]: 'Ayer', 0: 'Hoy', 1: 'Mañana' }

const MEAL_TONE: Record<MealType, string> = {
  desayuno: 'bg-[#FFF1C2] text-[#85503C]',
  almuerzo: 'bg-[#E3EED4] text-primary',
  merienda: 'bg-[#FCE6EA] text-[#85503C]',
  cena: 'bg-[#E3EED4] text-primary',
  snack: 'bg-[#FFF1C2] text-[#85503C]',
}

const EMPTY_GOALS: Goals = { proteinG: null, carbsG: null, fatG: null, kcal: null }

export function MealsScreen() {
  const { profile } = useAuth()
  const { enabled, ready } = useModules()
  const today = argentinaISO()
  const [offset, setOffset] = useState<DayOffset>(0)
  const [meals, setMeals] = useState<Meal[]>([])
  const [goals, setGoals] = useState<Goals>(EMPTY_GOALS)
  const [saved, setSaved] = useState<SavedFood[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mealOpen, setMealOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(false)

  const eatenOn = shiftArgentinaISO(today, offset)

  useEffect(() => {
    if (!profile) return
    let active = true
    Promise.all([
      supabase.from('nutrition_goals').select('protein_g, carbs_g, fat_g, kcal').maybeSingle(),
      supabase.from('saved_foods').select('id, name, protein_g, carbs_g, fat_g, kcal').order('name'),
    ]).then(([goalsResult, savedResult]) => {
      if (!active) return
      if (goalsResult.error || savedResult.error) {
        setError(goalsResult.error?.message || savedResult.error?.message || 'No se pudieron cargar las comidas.')
        return
      }
      const row = goalsResult.data
      setGoals(
        row
          ? {
              proteinG: asNumber(row.protein_g),
              carbsG: asNumber(row.carbs_g),
              fatG: asNumber(row.fat_g),
              kcal: asNumber(row.kcal),
            }
          : EMPTY_GOALS,
      )
      setSaved((savedResult.data ?? []).map(savedFromRow))
    })
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    let active = true
    setLoading(true)
    supabase
      .from('meals')
      .select('id, eaten_on, meal_type, name, protein_g, carbs_g, fat_g, kcal')
      .eq('eaten_on', eatenOn)
      .order('created_at')
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setError(loadError.message)
          setMeals([])
        } else {
          setMeals((data ?? []).map(mealFromRow))
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile, eatenOn])

  if (!profile) return null
  if (ready && !enabled.includes('comidas')) return <Navigate to="/" replace />

  const totals = dayTotals(meals)
  const proteinGoal = goals.proteinG
  const proteinRatio = proteinPercent(totals.protein, proteinGoal)

  async function removeMeal(meal: Meal) {
    setError('')
    setMeals((current) => current.filter((item) => item.id !== meal.id))
    const { error: deleteError } = await supabase.from('meals').delete().eq('id', meal.id)
    if (deleteError) {
      setError(deleteError.message)
      setMeals((current) => [...current, meal])
    }
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold text-muted">
          <AppIcon name="bowl-food" className="mr-1.5" /> Comidas
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGoalsOpen(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-card px-3 text-sm font-extrabold text-primary shadow-soft"
          >
            <AppIcon name="bullseye" /> Objetivos
          </button>
          <span className="inline-flex items-center gap-1 rounded-2xl bg-[#FCE6EA] px-3 py-1.5 text-xs font-extrabold text-[#85503C]">
            <AppIcon name="lock" /> Solo vos
          </span>
        </div>
      </header>
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Día anterior"
          disabled={offset === -1}
          onClick={() => setOffset((current) => (current === 1 ? 0 : -1))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft disabled:opacity-40"
        >
          <AppIcon name="chevron-left" />
        </button>
        <h1 className="text-center font-display text-[1.75rem] font-bold leading-tight">{DAY_LABEL[offset]}</h1>
        <button
          type="button"
          aria-label="Día siguiente"
          disabled={offset === 1}
          onClick={() => setOffset((current) => (current === -1 ? 0 : 1))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft disabled:opacity-40"
        >
          <AppIcon name="chevron-right" />
        </button>
      </div>
      <section className="mb-3 rounded-3xl bg-card p-4 shadow-card">
        <div className="flex items-center gap-3.5">
          <Sprout module="comidas" size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-muted">Proteína</p>
            <p className="font-display text-[1.7rem] font-bold leading-tight">
              {formatAmount(totals.protein)}{' '}
              <span className="font-sans text-base font-bold text-muted">
                {proteinGoal != null && proteinGoal > 0 ? `de ${formatAmount(proteinGoal)} g` : 'g'}
              </span>
            </p>
            {proteinRatio != null ? (
              <div className="mt-2">
                <Progress value={proteinRatio} color="#F7B7C4" />
              </div>
            ) : (
              <p className="mt-1 text-sm font-bold text-muted">Cargá un objetivo para ver la barra.</p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <MacroStat label="Carbos" text={`${formatAmount(totals.carbs)} g`} percent={proteinPercent(totals.carbs, goals.carbsG)} color="#F4C542" />
          <MacroStat label="Grasas" text={`${formatAmount(totals.fat)} g`} percent={proteinPercent(totals.fat, goals.fatG)} color="#DEC59E" />
          <MacroStat label="kcal" text={formatAmount(totals.kcal)} percent={proteinPercent(totals.kcal, goals.kcal)} color="#C7DDAE" />
        </div>
      </section>
      <h2 className="mb-2 px-1 text-[13px] font-bold text-[#8a8370]">Lo que comiste</h2>
      {loading ? <p className="py-6 text-center font-extrabold text-muted">Cargando comidas…</p> : null}
      {!loading && meals.length === 0 ? <p className="py-4 text-center text-sm font-bold text-muted">Todavía no hay comidas este día.</p> : null}
      {MEAL_TYPES.map((type) => {
        const items = meals.filter((meal) => meal.mealType === type)
        if (items.length === 0) return null
        return (
          <section key={type} className="mb-2">
            <h3 className="mb-1.5 px-1 text-[13px] font-extrabold text-primary">{MEAL_LABEL[type]}</h3>
            <ul>
              {items.map((meal) => (
                <li key={meal.id} className="mb-2 flex min-h-16 items-center gap-3 rounded-[22px] bg-card px-3 py-2 shadow-card">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${MEAL_TONE[meal.mealType]}`}>
                    <AppIcon name={MEAL_ICON[meal.mealType]} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-extrabold">{meal.name}</span>
                    <span className="block text-sm font-bold text-muted">{formatAmount(meal.proteinG)} g de proteína</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeMeal(meal)}
                    className="min-h-11 shrink-0 rounded-2xl px-2 text-sm font-extrabold text-muted"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <button
        type="button"
        onClick={() => setMealOpen(true)}
        className="mt-1 flex min-h-[52px] w-full items-center gap-3 rounded-[22px] border-2 border-dashed border-line px-4 text-left"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F2EADF] text-muted">
          <AppIcon name="plus" />
        </span>
        <span className="font-extrabold text-muted">Nueva comida</span>
      </button>
      {error ? <p className="mt-3 text-center text-sm font-bold text-alert-ink">{error}</p> : null}
      <MealSheet
        open={mealOpen}
        ownerId={profile.id}
        eatenOn={eatenOn}
        saved={saved}
        onClose={() => setMealOpen(false)}
        onSaved={(meal, frequent, notice) => {
          setMeals((current) => [...current, meal])
          if (frequent) setSaved((current) => [...current, frequent].sort((a, b) => a.name.localeCompare(b.name, 'es')))
          if (notice) setError(notice)
          setMealOpen(false)
        }}
      />
      <GoalsSheet
        open={goalsOpen}
        ownerId={profile.id}
        goals={goals}
        onClose={() => setGoalsOpen(false)}
        onSaved={(next) => {
          setGoals(next)
          setGoalsOpen(false)
        }}
      />
    </>
  )
}

function MacroStat({ label, text, percent, color }: { label: string; text: string; percent: number | null; color: string }) {
  return (
    <div>
      <span className="block text-[12px] font-bold text-muted">{label}</span>
      <b className="mt-0.5 block text-[15px] font-extrabold">{text}</b>
      {percent != null ? (
        <span className="mt-1.5 block">
          <Progress value={percent} color={color} />
        </span>
      ) : null}
    </div>
  )
}

function MealSheet({
  open,
  ownerId,
  eatenOn,
  saved,
  onClose,
  onSaved,
}: {
  open: boolean
  ownerId: string
  eatenOn: string
  saved: SavedFood[]
  onClose: () => void
  onSaved: (meal: Meal, frequent: SavedFood | null, notice?: string) => void
}) {
  const [mealType, setMealType] = useState<MealType>('desayuno')
  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [kcal, setKcal] = useState('')
  const [frequent, setFrequent] = useState(false)
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setMealType('desayuno')
    setName('')
    setProtein('')
    setCarbs('')
    setFat('')
    setKcal('')
    setFrequent(false)
    setFormError('')
  }, [open])

  function applySaved(food: SavedFood) {
    setName(food.name)
    setProtein(fieldFromNumber(food.proteinG))
    setCarbs(fieldFromNumber(food.carbsG))
    setFat(fieldFromNumber(food.fatG))
    setKcal(fieldFromNumber(food.kcal))
    setFormError('')
  }

  async function save() {
    const trimmed = name.trim()
    const proteinG = parseMacro(protein)
    const carbsG = readOptional(carbs)
    const fatG = readOptional(fat)
    const kcalValue = readOptional(kcal)
    if (!trimmed) {
      setFormError('Poné un nombre.')
      return
    }
    if (trimmed.length > 80) {
      setFormError('El nombre puede tener hasta 80 caracteres.')
      return
    }
    if (protein.trim() && proteinG == null) {
      setFormError('La proteína tiene que ser 0 o más.')
      return
    }
    if (proteinG == null) {
      setFormError('La proteína es obligatoria.')
      return
    }
    if (carbsG === undefined || fatG === undefined || kcalValue === undefined) {
      setFormError('Los números tienen que ser 0 o más.')
      return
    }
    setPending(true)
    setFormError('')
    const { data, error: insertError } = await supabase
      .from('meals')
      .insert({
        owner_id: ownerId,
        eaten_on: eatenOn,
        meal_type: mealType,
        name: trimmed,
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
        kcal: kcalValue,
      })
      .select('id, eaten_on, meal_type, name, protein_g, carbs_g, fat_g, kcal')
      .single()
    if (insertError || !data) {
      setPending(false)
      setFormError(insertError?.message || 'No se pudo guardar la comida.')
      return
    }
    let savedFood: SavedFood | null = null
    if (frequent) {
      const savedResult = await supabase
        .from('saved_foods')
        .insert({
          owner_id: ownerId,
          name: trimmed,
          protein_g: proteinG,
          carbs_g: carbsG,
          fat_g: fatG,
          kcal: kcalValue,
        })
        .select('id, name, protein_g, carbs_g, fat_g, kcal')
        .single()
      if (savedResult.error || !savedResult.data) {
        setPending(false)
        onSaved(mealFromRow(data), null, savedResult.error?.message || 'La comida quedó anotada, pero no se pudo guardar como frecuente.')
        return
      }
      savedFood = savedFromRow(savedResult.data)
    }
    setPending(false)
    onSaved(mealFromRow(data), savedFood)
  }

  return (
    <Sheet
      open={open}
      title="Nueva comida"
      onClose={onClose}
      footer={
        <Button disabled={pending} onClick={() => void save()}>
          Guardar comida
        </Button>
      }
    >
      {saved.length > 0 ? (
        <div className="mb-3">
          <p className="mb-1.5 text-sm font-bold text-muted">Frecuentes</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {saved.map((food) => (
              <button
                key={food.id}
                type="button"
                onClick={() => applySaved(food)}
                className="min-h-11 shrink-0 rounded-2xl bg-[#FCE6EA] px-3 text-sm font-extrabold text-[#85503C]"
              >
                {food.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mb-1.5 text-sm font-bold text-muted">Tipo</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {MEAL_TYPES.map((type) => (
          <Chip key={type} active={mealType === type} onClick={() => setMealType(type)}>
            {MEAL_LABEL[type]}
          </Chip>
        ))}
      </div>
      <MacroField label="Nombre" value={name} onChange={setName} />
      <MacroField label="Proteína (g)" value={protein} onChange={setProtein} numeric />
      <MacroField label="Carbos (g), opcional" value={carbs} onChange={setCarbs} numeric />
      <MacroField label="Grasas (g), opcional" value={fat} onChange={setFat} numeric />
      <MacroField label="Calorías, opcional" value={kcal} onChange={setKcal} numeric />
      <p className="mb-3 text-sm font-semibold leading-snug text-muted">
        Si dejás las calorías vacías, se calculan con 4 por gramo de proteína y de carbos, y 9 por gramo de grasa.
      </p>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-base font-extrabold">Guardar como frecuente</span>
        <ModuleSwitch on={frequent} label="Guardar como frecuente" onToggle={() => setFrequent((current) => !current)} />
      </div>
      {formError ? <p className="mt-3 text-sm font-bold text-alert-ink">{formError}</p> : null}
    </Sheet>
  )
}

function GoalsSheet({
  open,
  ownerId,
  goals,
  onClose,
  onSaved,
}: {
  open: boolean
  ownerId: string
  goals: Goals
  onClose: () => void
  onSaved: (goals: Goals) => void
}) {
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [kcal, setKcal] = useState('')
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setProtein(fieldFromNumber(goals.proteinG))
    setCarbs(fieldFromNumber(goals.carbsG))
    setFat(fieldFromNumber(goals.fatG))
    setKcal(fieldFromNumber(goals.kcal))
    setFormError('')
  }, [open, goals])

  async function save() {
    const proteinG = readOptional(protein)
    const carbsG = readOptional(carbs)
    const fatG = readOptional(fat)
    const kcalValue = readOptional(kcal)
    if (proteinG === undefined || carbsG === undefined || fatG === undefined || kcalValue === undefined) {
      setFormError('Los números tienen que ser 0 o más.')
      return
    }
    setPending(true)
    setFormError('')
    const next = { proteinG, carbsG, fatG, kcal: kcalValue }
    const { error: saveError } = await supabase.from('nutrition_goals').upsert({
      owner_id: ownerId,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      kcal: kcalValue,
    })
    setPending(false)
    if (saveError) {
      setFormError(saveError.message)
      return
    }
    onSaved(next)
  }

  return (
    <Sheet
      open={open}
      title="Objetivos"
      onClose={onClose}
      footer={
        <Button disabled={pending} onClick={() => void save()}>
          Guardar objetivos
        </Button>
      }
    >
      <p className="mb-3 text-sm font-semibold leading-snug text-muted">La proteína es la principal. El resto es opcional.</p>
      <MacroField label="Proteína (g)" value={protein} onChange={setProtein} numeric />
      <MacroField label="Carbos (g)" value={carbs} onChange={setCarbs} numeric />
      <MacroField label="Grasas (g)" value={fat} onChange={setFat} numeric />
      <MacroField label="Calorías" value={kcal} onChange={setKcal} numeric />
      {formError ? <p className="text-sm font-bold text-alert-ink">{formError}</p> : null}
    </Sheet>
  )
}

function MacroField({
  label,
  value,
  onChange,
  numeric = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  numeric?: boolean
}) {
  return (
    <label className="mb-3 block text-sm font-bold">
      <span className="mb-1 block text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={numeric ? 'decimal' : 'text'}
        className={inputClass}
      />
    </label>
  )
}

function fieldFromNumber(value: number | null): string {
  if (value == null) return ''
  return String(value).replace('.', ',')
}

function readOptional(value: string): number | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  return parseMacro(trimmed) ?? undefined
}

function mealFromRow(row: {
  id: string
  eaten_on: string
  meal_type: string
  name: string
  protein_g: number
  carbs_g: number | null
  fat_g: number | null
  kcal: number | null
}): Meal {
  return {
    id: row.id,
    eatenOn: row.eaten_on,
    mealType: isMealType(row.meal_type) ? row.meal_type : 'snack',
    name: row.name,
    proteinG: asNumber(row.protein_g) ?? 0,
    carbsG: asNumber(row.carbs_g),
    fatG: asNumber(row.fat_g),
    kcal: asNumber(row.kcal),
  }
}

function savedFromRow(row: {
  id: string
  name: string
  protein_g: number
  carbs_g: number | null
  fat_g: number | null
  kcal: number | null
}): SavedFood {
  return {
    id: row.id,
    name: row.name,
    proteinG: asNumber(row.protein_g) ?? 0,
    carbsG: asNumber(row.carbs_g),
    fatG: asNumber(row.fat_g),
    kcal: asNumber(row.kcal),
  }
}
