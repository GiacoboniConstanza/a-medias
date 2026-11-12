import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { CompositionBar, CompositionSwatch } from '../components/CompositionBar.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Sprout } from '../components/Sprout.tsx'
import { Button, Progress, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import {
  deleteMeal,
  loadMealsForDay,
  loadNutritionGoals,
  saveProteinGoal,
  updateMeal,
  type MealRow,
} from '../lib/api.ts'
import {
  MEAL_ICON,
  MEAL_LABEL,
  MEAL_TYPES,
  argentinaISO,
  compositionPhrase,
  compositionShares,
  compositionSheetSubtitle,
  dayCaloriesLabel,
  dayTotals,
  foodRowSubtitle,
  formatAmount,
  formatLongDate,
  hasCompositionData,
  isManualLegacy,
  mealTypeForContext,
  moreThanAnythingLabel,
  parseMacro,
  proteinPercent,
  proteinRemainingLabel,
  resolvedKcal,
  shiftArgentinaISO,
  topContributors,
  type MealType,
} from '../lib/meals.ts'
import { MealPortionSheet, type PortionDraft } from '../components/MealPortionSheet.tsx'

type DayOffset = -1 | 0 | 1

const DAY_LABEL: Record<DayOffset, string> = { [-1]: 'Ayer', 0: 'Hoy', 1: 'Mañana' }

const MEAL_TONE: Record<MealType, string> = {
  desayuno: 'bg-mostaza-claro text-tinta',
  almuerzo: 'bg-salvia-claro text-mostaza-ink',
  merienda: 'bg-rosa-claro text-rosa-texto',
  cena: 'bg-salvia-claro text-mostaza-ink',
  snack: 'bg-mostaza-claro text-tinta',
}

export function MealsScreen() {
  const { profile } = useAuth()
  const { enabled, ready } = useModules()
  const location = useLocation()
  const today = argentinaISO()
  const [offset, setOffset] = useState<DayOffset>(0)
  const [meals, setMeals] = useState<MealRow[]>([])
  const [proteinGoal, setProteinGoal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [whatOpen, setWhatOpen] = useState(false)
  const [compositionOpen, setCompositionOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [editing, setEditing] = useState<MealRow | null>(null)
  const [toast, setToast] = useState<{ message: string; undo?: () => Promise<void> } | null>(null)
  const eatenOn = shiftArgentinaISO(today, offset)
  const fabMealType = mealTypeForContext(eatenOn)

  const reloadDay = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await loadMealsForDay(eatenOn)
      setMeals(rows)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos traer tus comidas.')
      setMeals([])
    } finally {
      setLoading(false)
    }
  }, [eatenOn])

  useEffect(() => {
    if (!profile) return
    let active = true
    loadNutritionGoals()
      .then((goals) => {
        if (active) setProteinGoal(goals.proteinG)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    void reloadDay()
  }, [profile, reloadDay])

  useEffect(() => {
    const notice = (location.state as { notice?: string } | null)?.notice
    if (notice) setToast({ message: notice })
  }, [location.state])

  const totals = useMemo(() => dayTotals(meals), [meals])
  const shares = useMemo(() => compositionShares(meals), [meals])
  const phrase = compositionPhrase(shares)
  const proteinRatio = proteinPercent(totals.protein, proteinGoal)

  if (!profile) return null
  if (ready && !enabled.includes('comidas')) return <Navigate to="/" replace />

  async function removeMeal(meal: MealRow) {
    setMeals((current) => current.filter((item) => item.id !== meal.id))
    setEditing(null)
    try {
      await deleteMeal(meal.id)
      setToast({
        message: `Quitaste ${meal.name}.`,
        undo: async () => {
          // Reinsert via create would change id; keep simple restore by reload after undo insert
          const { createMeal } = await import('../lib/api.ts')
          const restored = await createMeal({
            ownerId: profile!.id,
            eatenOn: meal.eatenOn,
            mealType: meal.mealType,
            name: meal.name,
            proteinG: meal.proteinG,
            carbsG: meal.carbsG,
            fatG: meal.fatG,
            kcal: meal.kcal,
            portionLabel: meal.portionLabel,
            portionQty: meal.portionQty,
            portionGrams: meal.portionGrams,
            foodSource: meal.foodSource,
            foodRef: meal.foodRef,
            brand: meal.brand,
          })
          setMeals((current) => [...current, restored].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar.')
      setMeals((current) => [...current, meal])
    }
  }

  return (
    <>
      <SectionHeader
        lead="crumb"
        module="comidas"
        aside={
          <>
            <span className="inline-flex items-center gap-1 rounded-2xl bg-rosa-claro px-3 py-1.5 text-sm font-semibold text-tinta">
              <AppIcon name="lock" /> Solo vos
            </span>
            <button
              type="button"
              aria-label="¿Qué es cada cosa? Calorías, proteína, hidratos y grasas"
              onClick={() => setWhatOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full bg-card text-tinta shadow-soft"
            >
              <AppIcon name="circle-question" className="text-lg" />
            </button>
          </>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Día anterior"
          aria-disabled={offset === -1}
          disabled={offset === -1}
          onClick={() => setOffset((current) => (current === 1 ? 0 : -1))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-mostaza-ink shadow-soft disabled:text-gris-claro disabled:opacity-100"
        >
          <AppIcon name="chevron-left" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="font-display text-[2.125rem] font-semibold leading-none">{DAY_LABEL[offset]}</h1>
          <p className="mt-1 text-sm font-semibold capitalize text-muted">{formatLongDate(eatenOn)}</p>
        </div>
        <button
          type="button"
          aria-label="Día siguiente"
          aria-disabled={offset === 1}
          disabled={offset === 1}
          onClick={() => setOffset((current) => (current === -1 ? 0 : 1))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-mostaza-ink shadow-soft disabled:text-gris-claro disabled:opacity-100"
        >
          <AppIcon name="chevron-right" />
        </button>
      </div>

      {loading ? <p className="py-6 text-center font-semibold text-muted">Cargando comidas…</p> : null}

      {!loading && error ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-4 text-center">
          <p className="font-semibold" role="alert">
            No pudimos traer tus comidas. Revisá la conexión y probá de nuevo.
          </p>
          <Button className="mt-3" variant="alt" onClick={() => void reloadDay()}>
            Probar de nuevo
          </Button>
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="mb-[13px] rounded-2xl border-2 border-azul-ink bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {proteinGoal != null && proteinGoal > 0 ? (
                <>
                  <p className="font-display text-[2.125rem] font-semibold leading-none">
                    {formatAmount(totals.protein)}{' '}
                    <span className="font-display text-lg font-semibold">de {formatAmount(proteinGoal)} g de proteína</span>
                  </p>
                  <div className="mt-2">
                    <Progress value={proteinRatio ?? 0} color="var(--color-rosa)" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{proteinRemainingLabel(totals.protein, proteinGoal)}</p>
                    <button
                      type="button"
                      onClick={() => setGoalOpen(true)}
                      className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-mostaza-ink"
                    >
                      <AppIcon name="bullseye" /> Objetivo
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-display text-[2.125rem] font-semibold leading-none">
                    {formatAmount(totals.protein)} <span className="font-display text-lg font-semibold">g de proteína</span>
                  </p>
                  <div className="mt-2 flex min-h-[34px] items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-muted">Sin objetivo.</p>
                    <button
                      type="button"
                      onClick={() => setGoalOpen(true)}
                      className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-mostaza-ink"
                    >
                      <AppIcon name="bullseye" /> Poner un objetivo
                    </button>
                  </div>
                </>
              )}
              <p className="mt-1 text-sm font-semibold text-muted">
                {dayCaloriesLabel(totals.kcal, offset, totals.incompleteCount)}
              </p>
            </div>
          </div>
          {meals.length > 0 && phrase ? (
            <button
              type="button"
              onClick={() => setCompositionOpen(true)}
              className="mt-3 flex h-11 w-full items-center justify-between gap-2 border-t border-dashed border-line pt-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-muted">De qué estuvo hecho</span>
                <span className="block text-sm font-bold">{phrase}</span>
              </span>
              <AppIcon name="chevron-right" className="text-muted" />
            </button>
          ) : null}
        </section>
      ) : null}

      {!loading && !error && meals.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-8 text-center">
          <Sprout module="comidas" size={72} />
          <p className="mt-3 font-display text-lg font-semibold">Todavía no anotaste nada {DAY_LABEL[offset].toLowerCase()}.</p>
          <p className="mt-1 max-w-xs text-sm font-semibold text-muted">
            Tocá el botón + y buscá lo que comiste. La app calcula sola de qué está hecho.
          </p>
        </div>
      ) : null}

      {!loading && !error
        ? MEAL_TYPES.map((type) => {
            const items = meals.filter((meal) => meal.mealType === type)
            if (items.length === 0) return null
            const mealShares = compositionShares(items)
            const mealTotals = dayTotals(items)
            const mealPhrase = compositionPhrase(mealShares)
            return (
              <section key={type} className="mb-3 rounded-2xl border-2 border-azul-ink bg-card p-3">
                <header className="mb-1 flex h-[49px] items-center gap-2.5 px-1">
                  <span className={`grid h-10 w-10 place-items-center rounded-full ${MEAL_TONE[type]}`}>
                    <AppIcon name={MEAL_ICON[type]} />
                  </span>
                  <h2 className="font-display text-lg font-semibold">{MEAL_LABEL[type]}</h2>
                </header>
                <ul>
                  {items.map((meal) => {
                    const legacy = isManualLegacy(meal)
                    const complete = hasCompositionData(meal)
                    return (
                      <li key={meal.id}>
                        <button
                          type="button"
                          onClick={() => setEditing(meal)}
                          className="flex min-h-[52px] w-full flex-col items-start justify-center px-1 py-2 text-left"
                        >
                          <span className="text-sm font-bold">{meal.name}</span>
                          <span className="text-sm font-semibold text-muted">
                            {foodRowSubtitle({
                              label: meal.portionLabel,
                              qty: meal.portionQty,
                              grams: meal.portionGrams,
                              proteinG: meal.proteinG,
                              foodSource: meal.foodSource,
                              manualLegacy: legacy,
                            })}
                          </span>
                          {legacy && !complete && meal.kcal != null ? (
                            <span className="text-sm font-semibold text-muted">
                              Sus {formatAmount(meal.kcal)} calorías no suman: no tiene hidratos ni grasas.
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-1 border-t border-dashed border-line px-1 pt-2">
                  {mealShares ? (
                    <>
                      <CompositionBar shares={mealShares} scope={MEAL_LABEL[type].toLowerCase()} />
                      <p className="mt-1.5 text-sm font-semibold">{mealPhrase}</p>
                      <p className="text-sm font-semibold text-muted">
                        {formatAmount(mealTotals.protein)} g de proteína · {formatAmount(mealTotals.kcal)} calorías.
                      </p>
                      {mealTotals.incompleteCount > 0 ? (
                        <p className="text-sm font-semibold text-muted">
                          La barra y las calorías no cuentan lo cargado a mano.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-muted">
                      {formatAmount(mealTotals.protein)} g de proteína. Sin hidratos ni grasas, no se puede mostrar de qué
                      estuvo hecho.
                    </p>
                  )}
                </div>
              </section>
            )
          })
        : null}

      <FabSpace />
      <Fab
        to="/comidas/agregar"
        label="Agregar comida"
        state={{ eatenOn, mealType: fabMealType }}
      />

      {toast ? (
        <Toast aboveFab onUndo={toast.undo} onDone={() => setToast(null)}>
          {toast.message}
        </Toast>
      ) : null}

      <WhatIsSheet open={whatOpen} onClose={() => setWhatOpen(false)} />
      <CompositionSheet
        open={compositionOpen}
        onClose={() => setCompositionOpen(false)}
        onWhat={() => {
          setCompositionOpen(false)
          setWhatOpen(true)
        }}
        offset={offset}
        eatenOn={eatenOn}
        meals={meals}
        shares={shares}
        phrase={phrase}
        totals={totals}
      />
      <GoalSheet
        open={goalOpen}
        ownerId={profile.id}
        proteinGoal={proteinGoal}
        onClose={() => setGoalOpen(false)}
        onSaved={(next) => {
          setProteinGoal(next)
          setGoalOpen(false)
        }}
      />
      {editing ? (
        <MealPortionSheet
          open
          mode="edit"
          mealType={editing.mealType}
          draft={mealToDraft(editing)}
          onClose={() => setEditing(null)}
          onRemove={() => void removeMeal(editing)}
          onSave={async (draft, _saveFood) => {
            const updated = await updateMeal(editing.id, {
              name: draft.name,
              proteinG: draft.proteinG,
              carbsG: draft.carbsG,
              fatG: draft.fatG,
              kcal: draft.kcal,
              portionLabel: draft.portionLabel,
              portionQty: draft.portionQty,
              portionGrams: draft.portionGrams,
              foodSource: draft.foodSource,
              foodRef: draft.foodRef,
              brand: draft.brand,
            })
            setMeals((current) => current.map((item) => (item.id === updated.id ? updated : item)))
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}

function mealToDraft(meal: MealRow): PortionDraft {
  return {
    name: meal.name,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    kcal: meal.kcal ?? resolvedKcal(meal),
    portionLabel: meal.portionLabel,
    portionQty: meal.portionQty ?? 1,
    portionGrams: meal.portionGrams,
    foodSource: meal.foodSource,
    foodRef: meal.foodRef,
    brand: meal.brand,
    originLabel: meal.foodSource === 'common'
      ? 'de la lista de todos los días'
      : meal.foodSource === 'off'
        ? meal.brand
          ? `${meal.brand} · Open Food Facts`
          : 'Open Food Facts'
        : meal.foodSource === 'manual' || isManualLegacy(meal)
          ? 'Cargado a mano'
          : 'de mis alimentos',
    attribution:
      meal.foodSource === 'common'
        ? 'Datos: ARGENFOODS, Universidad Nacional de Luján'
        : meal.foodSource === 'off'
          ? 'Datos de productos: Open Food Facts.'
          : null,
    portions:
      meal.portionLabel && meal.portionGrams
        ? [{ label: meal.portionLabel, grams: meal.portionGrams / (meal.portionQty ?? 1), suggested: true }]
        : [],
    per100: null,
    savedInMine: false,
  }
}

function CompositionSheet({
  open,
  onClose,
  onWhat,
  offset,
  eatenOn,
  meals,
  shares,
  phrase,
  totals,
}: {
  open: boolean
  onClose: () => void
  onWhat: () => void
  offset: DayOffset
  eatenOn: string
  meals: MealRow[]
  shares: ReturnType<typeof compositionShares>
  phrase: string
  totals: ReturnType<typeof dayTotals>
}) {
  const complete = meals.filter(hasCompositionData)
  return (
    <Sheet
      open={open}
      title="De qué estuvo hecho"
      onClose={onClose}
      footer={
        <Button variant="alt" onClick={onWhat}>
          <span className="inline-flex items-center justify-center gap-2">
            <AppIcon name="circle-question" /> ¿Qué es cada cosa?
          </span>
        </Button>
      }
    >
      <p className="mb-3 text-sm font-semibold text-muted">{compositionSheetSubtitle(offset, eatenOn)}</p>
      {shares ? (
        <>
          <p className="font-display text-lg font-semibold">{phrase}</p>
          <CompositionBar shares={shares} className="mt-3" />
          <ul className="mt-4 space-y-3">
            {(
              [
                ['proteína', shares.proteinPct, shares.proteinG],
                ['hidratos', shares.carbsPct, shares.carbsG],
                ['grasas', shares.fatPct, shares.fatG],
              ] as const
            ).map(([part, pct, grams]) => (
              <li key={part} className="flex gap-2">
                <CompositionSwatch part={part} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold capitalize">{part}</span>
                    <span className="text-sm font-semibold text-muted">
                      {pct}&nbsp;% · {formatAmount(grams)} g
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-muted">
                    {moreThanAnythingLabel(topContributors(complete, part))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {totals.incompleteCount > 0 ? (
            <p className="mt-3 text-sm font-semibold text-muted">
              {totals.incompleteProtein > 0
                ? `Los ${formatAmount(totals.protein)} g de proteína del día incluyen ${formatAmount(totals.incompleteProtein)} g de ${totals.incompleteCount} alimentos cargados a mano. La barra no los cuenta porque no tienen hidratos ni grasas.`
                : `La barra no cuenta ${totals.incompleteCount} alimentos cargados a mano: no tienen hidratos ni grasas.`}
            </p>
          ) : null}
          <p className="mt-3 text-sm font-semibold text-muted">
            {totals.incompleteCount > 0
              ? `${formatAmount(totals.kcal)} calorías, sin esos ${totals.incompleteCount} alimentos.`
              : `${formatAmount(totals.kcal)} calorías.`}
          </p>
        </>
      ) : (
        <p className="text-sm font-semibold text-muted">Todavía no hay datos para armar la composición.</p>
      )}
    </Sheet>
  )
}

function WhatIsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      title="¿Qué es cada cosa?"
      onClose={onClose}
      footer={<Button onClick={onClose}>Entendido</Button>}
    >
      <p className="mb-4 text-sm font-semibold leading-snug">
        Lo que comés tiene tres partes: proteína, hidratos y grasas. Las tres dan energía, y esa energía se mide en calorías.
      </p>
      <div className="mb-4 flex gap-2">
        <AppIcon name="bolt" className="mt-0.5" />
        <div>
          <p className="text-sm font-bold">Calorías</p>
          <p className="text-sm font-semibold leading-snug">
            Es la energía que te da lo que comés. Cada gramo de proteína o de hidratos da 4 calorías; cada gramo de grasa, 9.
          </p>
          <p className="text-sm font-semibold text-muted">
            Por ejemplo: 10 g de hidratos son 40 calorías y 10 g de grasa, 90.
          </p>
        </div>
      </div>
      <div className="mb-4 flex gap-2">
        <CompositionSwatch part="proteína" />
        <div>
          <p className="text-sm font-bold">Proteína</p>
          <p className="text-sm font-semibold leading-snug">
            Es lo que el cuerpo usa para armar y reparar músculos, piel y pelo. Es la que tiene objetivo en la app.
          </p>
          <p className="text-sm font-semibold text-muted">Carne, pollo, pescado, huevo, leche, yogur, queso, lentejas.</p>
          <p className="text-sm font-semibold text-muted">En la barra: rosa liso.</p>
        </div>
      </div>
      <div className="mb-4 flex gap-2">
        <CompositionSwatch part="hidratos" />
        <div>
          <p className="text-sm font-bold">Hidratos</p>
          <p className="text-sm font-semibold leading-snug">Es la energía más rápida.</p>
          <p className="text-sm font-semibold text-muted">Pan, fideos, arroz, papa, fruta, azúcar, galletitas, facturas.</p>
          <p className="text-sm font-semibold text-muted">En la barra: rayas mostaza.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <CompositionSwatch part="grasas" />
        <div>
          <p className="text-sm font-bold">Grasas</p>
          <p className="text-sm font-semibold leading-snug">
            Es energía de reserva. Con poco se suma mucho, porque cada gramo da más del doble que uno de hidratos.
          </p>
          <p className="text-sm font-semibold text-muted">Aceite, manteca, queso, palta, maní, nueces, fritos.</p>
          <p className="text-sm font-semibold text-muted">En la barra: puntos azules.</p>
        </div>
      </div>
    </Sheet>
  )
}

function GoalSheet({
  open,
  ownerId,
  proteinGoal,
  onClose,
  onSaved,
}: {
  open: boolean
  ownerId: string
  proteinGoal: number | null
  onClose: () => void
  onSaved: (goal: number | null) => void
}) {
  const [value, setValue] = useState('')
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open) return
    setValue(proteinGoal == null ? '' : String(proteinGoal).replace('.', ','))
    setFormError('')
  }, [open, proteinGoal])

  async function save() {
    const trimmed = value.trim()
    const parsed = trimmed ? parseMacro(trimmed) : null
    if (trimmed && parsed == null) {
      setFormError('Los gramos tienen que ser 0 o más.')
      return
    }
    setPending(true)
    try {
      await saveProteinGoal(ownerId, parsed)
      onSaved(parsed)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Tu objetivo de proteína"
      onClose={onClose}
      footer={
        <Button disabled={pending} onClick={() => void save()}>
          Guardar
        </Button>
      }
    >
      <p className="mb-3 text-sm font-semibold leading-snug text-muted">
        Cuántos gramos de proteína querés comer por día. Si lo dejás vacío, ves lo que comiste, pero sin la barra.
      </p>
      <label className="block text-sm font-bold">
        <span className="mb-1 block text-muted">Gramos por día</span>
        <input value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" className={inputClass} />
      </label>
      {formError ? <p className="mt-2 text-sm font-bold text-tinta">{formError}</p> : null}
    </Sheet>
  )
}
