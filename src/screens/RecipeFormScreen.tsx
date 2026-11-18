import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import type { AppChromeContext } from '../components/AppShell.tsx'
import { AppIcon } from '../components/AppIcon.tsx'
import { CompositionBar, CompositionLegendShort } from '../components/CompositionBar.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Chip, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import {
  RecipeConflictError,
  RecipeDeletedConflictError,
  createRecipe,
  deleteRecipe,
  loadHouseholdPartnerName,
  loadRecipe,
  searchCommonFoods,
  updateRecipe,
  type CommonFoodRow,
  type RecipeIngredientWrite,
  type RecipeRow,
} from '../lib/api.ts'
import {
  ARGENFOODS_ATTR_SHORT,
  OFF_ATTR,
  compositionPhrase,
  compositionShares,
  formatAmount,
  kcalFromGrams,
  parseMacro,
  roundMacro,
  scalePer100,
} from '../lib/meals.ts'
import { MEAL_ROUTES } from '../lib/modules.ts'
import { searchOpenFoodFacts, type OffProduct } from '../lib/openFoodFacts.ts'
import {
  GRAM_SHORTCUTS,
  conflictMessage,
  deletedConflictMessage,
  incompleteNote,
  macrosPerServing,
  normalizeIngredientGrams,
  normalizeRecipeServings,
  stepIngredientGrams,
  stepRecipeServings,
} from '../lib/recipes.ts'

type DraftIngredient = RecipeIngredientWrite & { key: string }

type PickSource = {
  name: string
  foodSource: 'common' | 'off' | 'manual'
  foodRef: string | null
  brand: string | null
  per100: { protein: number | null; carbs: number | null; fat: number | null; kcal: number | null } | null
  /** RC9: macros ya de esa cantidad (a mano). */
  absolute: { proteinG: number | null; carbsG: number | null; fatG: number | null; kcal: number | null } | null
  absoluteBaseGrams: number | null
  attribution: string | null
  originLabel: string
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function RecipeFormScreen() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'nueva'
  const { profile } = useAuth()
  const { enabled, ready } = useModules()
  const navigate = useNavigate()
  const location = useLocation()
  const { setHideChrome } = useOutletContext<AppChromeContext>()
  const navState = (location.state as {
    presetName?: string
    fromAdd?: boolean
    eatenOn?: string
    mealType?: string
  } | null) ?? {}
  const presetName = navState.presetName ?? ''

  const [name, setName] = useState(presetName)
  const [servings, setServings] = useState(1)
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([])
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null)
  const [baseline, setBaseline] = useState('')
  const [partnerName, setPartnerName] = useState('Maru')
  const [loading, setLoading] = useState(!isNew)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; ingredients?: string }>({})
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [conflict, setConflict] = useState<RecipeRow | null>(null)
  const [deletedConflict, setDeletedConflict] = useState(false)

  const [pickOpen, setPickOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [common, setCommon] = useState<CommonFoodRow[]>([])
  const [offProducts, setOffProducts] = useState<OffProduct[]>([])
  const [offStatus, setOffStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualGrams, setManualGrams] = useState('100')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCarbs, setManualCarbs] = useState('')
  const [manualFat, setManualFat] = useState('')

  const [gramsPick, setGramsPick] = useState<PickSource | null>(null)
  const [grams, setGrams] = useState(100)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  useEffect(() => {
    setHideChrome(true)
    return () => setHideChrome(false)
  }, [setHideChrome])

  useEffect(() => {
    if (!profile?.householdId) return
    void loadHouseholdPartnerName(profile.householdId, profile.id)
      .then((value) => {
        if (value) setPartnerName(value)
      })
      .catch(() => undefined)
  }, [profile])

  useEffect(() => {
    if (isNew || !id) {
      setBaseline(snapshot('', 1, '', []))
      return
    }
    let active = true
    setLoading(true)
    loadRecipe(id)
      .then((recipe) => {
        if (!active) return
        if (!recipe) {
          setError('Esa receta ya no está.')
          return
        }
        applyRecipe(recipe)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, isNew])

  useEffect(() => {
    const q = query.trim()
    if (!q || !pickOpen) {
      setCommon([])
      return
    }
    let active = true
    searchCommonFoods(q)
      .then((rows) => {
        if (active) setCommon(rows)
      })
      .catch(() => {
        if (active) setCommon([])
      })
    return () => {
      active = false
    }
  }, [query, pickOpen])

  const perServing = useMemo(() => macrosPerServing(ingredients, servings), [ingredients, servings])
  const shares = useMemo(
    () =>
      compositionShares([
        {
          proteinG: perServing.proteinG,
          carbsG: perServing.carbsG,
          fatG: perServing.fatG,
          kcal: perServing.kcal,
        },
      ]),
    [perServing],
  )
  const phrase = compositionPhrase(shares)
  const note = incompleteNote(perServing.incompleteCount)
  const dirty = snapshot(name, servings, notes, ingredients) !== baseline

  if (!profile) return null
  if (ready && !enabled.includes('comidas')) return <Navigate to="/" replace />
  if (!profile.householdId) return <Navigate to="/hogar" replace />

  function applyRecipe(recipe: RecipeRow) {
    setName(recipe.name)
    setServings(recipe.servings)
    setNotes(recipe.notes ?? '')
    setExpectedUpdatedAt(recipe.updatedAt)
    const next = recipe.ingredients.map((item) => ({
      key: item.id,
      name: item.name,
      grams: item.grams,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      kcal: item.kcal,
      foodSource: item.foodSource,
      foodRef: item.foodRef,
      brand: item.brand,
      position: item.position,
    }))
    setIngredients(next)
    setBaseline(snapshot(recipe.name, recipe.servings, recipe.notes ?? '', next))
  }

  function openGrams(source: PickSource, existing?: DraftIngredient) {
    setGramsPick(source)
    setGrams(existing ? normalizeIngredientGrams(existing.grams) : source.absolute ? normalizeIngredientGrams(Number(manualGrams) || 100) : 100)
    setEditingKey(existing?.key ?? null)
    setPickOpen(false)
    setManualOpen(false)
  }

  function confirmGrams() {
    if (!gramsPick) return
    const amount = normalizeIngredientGrams(grams)
    let macros = { proteinG: null as number | null, carbsG: null as number | null, fatG: null as number | null, kcal: null as number | null }
    if (gramsPick.absolute) {
      const base = Math.max(1, gramsPick.absoluteBaseGrams ?? amount)
      const factor = amount / base
      macros = {
        proteinG: gramsPick.absolute.proteinG == null ? null : roundMacro(gramsPick.absolute.proteinG * factor),
        carbsG: gramsPick.absolute.carbsG == null ? null : roundMacro(gramsPick.absolute.carbsG * factor),
        fatG: gramsPick.absolute.fatG == null ? null : roundMacro(gramsPick.absolute.fatG * factor),
        kcal: gramsPick.absolute.kcal == null ? null : roundMacro(gramsPick.absolute.kcal * factor),
      }
      if (macros.proteinG != null && macros.carbsG != null && macros.fatG != null) {
        macros.kcal = roundMacro(kcalFromGrams(macros.proteinG, macros.carbsG, macros.fatG))
      }
    } else if (gramsPick.per100) {
      macros = scalePer100(gramsPick.per100, amount)
    }
    const next: DraftIngredient = {
      key: editingKey ?? newKey(),
      name: gramsPick.name.trim().slice(0, 120),
      grams: amount,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      kcal: macros.kcal,
      foodSource: gramsPick.foodSource,
      foodRef: gramsPick.foodRef,
      brand: gramsPick.brand,
    }
    setIngredients((current) => {
      if (editingKey) return current.map((item) => (item.key === editingKey ? next : item))
      return [...current, next]
    })
    setGramsPick(null)
    setEditingKey(null)
    setQuery('')
  }

  async function searchOff() {
    if (!query.trim()) return
    setOffStatus('loading')
    const result = await searchOpenFoodFacts(query)
    if (!result.ok) {
      setOffStatus('error')
      setOffProducts([])
      return
    }
    setOffProducts(result.products)
    setOffStatus('done')
  }

  function writePayload(): RecipeIngredientWrite[] {
    return ingredients.map((item, index) => ({
      name: item.name,
      grams: item.grams,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      kcal: item.kcal,
      foodSource: item.foodSource,
      foodRef: item.foodRef,
      brand: item.brand,
      position: index,
    }))
  }

  async function save(force = false) {
    const trimmed = name.trim()
    const nextErrors: { name?: string; ingredients?: string } = {}
    if (!trimmed) nextErrors.name = 'Poné el nombre.'
    if (ingredients.length === 0) nextErrors.ingredients = 'Sumá al menos un ingrediente.'
    setFieldErrors(nextErrors)
    if (nextErrors.name || nextErrors.ingredients) return

    setPending(true)
    setError('')
    try {
      if (isNew || deletedConflict) {
        const created = await createRecipe({
          householdId: profile!.householdId!,
          name: trimmed,
          servings: normalizeRecipeServings(servings),
          notes,
          ingredients: writePayload(),
        })
        if (navState.fromAdd) {
          navigate(MEAL_ROUTES.agregar, {
            replace: true,
            state: {
              openRecipeId: created.id,
              eatenOn: navState.eatenOn,
              mealType: navState.mealType,
            },
          })
          return
        }
        navigate(MEAL_ROUTES.recetas, {
          replace: true,
          state: { notice: `Guardaste ${created.name}.` },
        })
        return
      }
      const updated = await updateRecipe(id!, {
        name: trimmed,
        servings: normalizeRecipeServings(servings),
        notes,
        ingredients: writePayload(),
        expectedUpdatedAt: expectedUpdatedAt ?? '',
        force,
      })
      applyRecipe(updated)
      setConflict(null)
      setDeletedConflict(false)
      setToast({ message: `Guardaste ${updated.name}.` })
    } catch (err) {
      if (err instanceof RecipeConflictError) {
        setConflict(err.recipe)
        return
      }
      if (err instanceof RecipeDeletedConflictError) {
        setDeletedConflict(true)
        return
      }
      setError(err instanceof Error ? err.message : 'No se pudo guardar la receta. Probá de nuevo.')
    } finally {
      setPending(false)
    }
  }

  async function confirmDelete() {
    if (isNew || !id) return
    setPending(true)
    try {
      const snapshotRow = await loadRecipe(id)
      await deleteRecipe(id)
      navigate(MEAL_ROUTES.recetas, {
        replace: true,
        state: {
          notice: `Borraste ${name.trim() || 'la receta'}.`,
          undoRecipe: snapshotRow ?? undefined,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar. Probá de nuevo.')
      setPending(false)
    }
  }

  function removeIngredient(key: string) {
    const removed = ingredients.find((item) => item.key === key)
    if (!removed) return
    setIngredients((current) => current.filter((item) => item.key !== key))
    setToast({
      message: `Sacaste ${removed.name}.`,
      undo: () => setIngredients((current) => [...current, removed]),
    })
  }

  function leaveTarget() {
    if (navState.fromAdd) {
      return {
        to: MEAL_ROUTES.agregar,
        state: { eatenOn: navState.eatenOn, mealType: navState.mealType },
      }
    }
    return { to: MEAL_ROUTES.recetas, state: undefined }
  }

  function requestLeave() {
    if (dirty) setLeaveOpen(true)
    else {
      const target = leaveTarget()
      navigate(target.to, { state: target.state })
    }
  }

  if (loading) {
    return <p className="py-16 text-center font-semibold text-muted">Cargando…</p>
  }

  return (
    <div className="min-h-dvh bg-crema pb-28">
      <header className="scallop-b bg-azul px-4 pb-4 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Volver a Recetas"
            onClick={requestLeave}
            className="grid h-11 w-11 place-items-center text-tinta"
          >
            <AppIcon name="arrow-left" />
          </button>
          <h1 className="font-display text-[2.125rem] font-semibold leading-none text-tinta">
            {isNew ? 'Nueva receta' : 'Editar receta'}
          </h1>
        </div>
      </header>

      <div className="px-4 pt-4">
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold text-muted">Nombre</span>
          <input
            className={`${inputClass} ${fieldErrors.name ? 'border-2 border-tinta' : ''}`}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Por ejemplo, Tarta de verdura"
          />
          {fieldErrors.name ? (
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-tinta">
              <AppIcon name="circle-exclamation" /> {fieldErrors.name}
            </p>
          ) : null}
        </label>

        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-muted">¿Cuántas porciones rinde?</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Una porción menos"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink bg-card"
              onClick={() => setServings((current) => stepRecipeServings(current, -1))}
            >
              <AppIcon name="minus" />
            </button>
            <input
              value={String(servings)}
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(',', '.'))
                if (!Number.isFinite(parsed)) return
                setServings(normalizeRecipeServings(parsed))
              }}
              inputMode="numeric"
              className={`${inputClass} w-[84px] text-center`}
            />
            <button
              type="button"
              aria-label="Una porción más"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink bg-card"
              onClick={() => setServings((current) => stepRecipeServings(current, 1))}
            >
              <AppIcon name="plus" />
            </button>
            <span className="text-sm font-bold">porciones</span>
          </div>
        </div>

        <section className="mb-3">
          <h2 className="mb-2 font-display text-lg font-semibold">Ingredientes</h2>
          {ingredients.length === 0 ? (
            <p className="mb-3 text-sm font-semibold text-muted">Todavía no sumaste ingredientes.</p>
          ) : (
            <ul className="mb-3 overflow-hidden rounded-2xl border-2 border-azul-ink bg-card">
              {ingredients.map((item, index) => (
                <li
                  key={item.key}
                  className={`flex items-start gap-2 px-3 py-2 ${
                    index > 0 ? 'border-t border-dashed border-line' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="min-h-[62px] min-w-0 flex-1 py-1 text-left"
                    onClick={() =>
                      openGrams(
                        {
                          name: item.name,
                          foodSource: item.foodSource ?? 'manual',
                          foodRef: item.foodRef,
                          brand: item.brand,
                          per100: null,
                          absolute: {
                            proteinG: item.proteinG,
                            carbsG: item.carbsG,
                            fatG: item.fatG,
                            kcal: item.kcal,
                          },
                          absoluteBaseGrams: item.grams,
                          attribution: null,
                          originLabel: item.foodSource === 'manual' ? 'a mano' : '',
                        },
                        item,
                      )
                    }
                  >
                    <p className="font-display text-lg font-semibold">{item.name}</p>
                    <p className="text-sm font-semibold text-muted">
                      {formatAmount(item.grams)} g
                      {item.proteinG != null ? ` · ${formatAmount(item.proteinG)} g de proteína` : ''}
                      {item.foodSource === 'manual' ? ' · a mano' : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label={`Sacar ${item.name}`}
                    className="grid h-11 w-11 place-items-center text-tinta"
                    onClick={() => removeIngredient(item.key)}
                  >
                    <AppIcon name="xmark" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fieldErrors.ingredients ? (
            <p className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-tinta">
              <AppIcon name="circle-exclamation" /> {fieldErrors.ingredients}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setPickOpen(true)
              setQuery('')
              setOffProducts([])
              setOffStatus('idle')
            }}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-dashed border-azul-ink bg-card text-base font-semibold text-tinta"
          >
            <AppIcon name="plus" /> Sumar ingrediente
          </button>
        </section>

        <section className="mb-4 rounded-2xl bg-mostaza-claro/60 px-3 py-3">
          <p className="text-sm font-bold text-muted">Cada porción suma</p>
          {ingredients.length === 0 ? (
            <p className="mt-1 text-sm font-semibold text-muted">
              Cuando sumes ingredientes, acá ves cuánto suma cada porción.
            </p>
          ) : shares ? (
            <>
              <p className="mt-1 font-display text-lg font-semibold">{phrase}</p>
              <CompositionBar shares={shares} scope="cada porción" className="mt-2" />
              <CompositionLegendShort shares={shares} />
              <p className="mt-2 text-sm font-semibold">
                {formatAmount(shares.kcal)} calorías por porción
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-muted">
              {perServing.proteinG == null
                ? 'Sin proteína todavía'
                : `${formatAmount(perServing.proteinG)} g de proteína por porción`}
            </p>
          )}
          {note ? (
            <p className="mt-2 inline-flex items-start gap-1.5 text-sm font-semibold text-muted">
              <AppIcon name="circle-exclamation" className="mt-0.5 shrink-0" />
              {note}
            </p>
          ) : null}
        </section>

        {!isNew ? (
          <div className="mb-4 border-t border-dashed border-line pt-4">
            <Button type="button" variant="alt" onClick={() => setDeleteOpen(true)} disabled={pending}>
              <span className="inline-flex items-center justify-center gap-2">
                <AppIcon name="trash-can" /> Borrar receta
              </span>
            </Button>
            <p className="mt-2 text-sm font-semibold text-muted">
              Lo que ya anotaron con esta receta queda como está.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mb-3 text-sm font-bold text-tinta" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-crema px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          onClick={() => void save(false)}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? 'Guardando…' : isNew ? 'Guardar' : 'Guardar cambios'}
        </Button>
      </div>

      <Sheet
        open={pickOpen}
        title="Sumar ingrediente"
        onClose={() => setPickOpen(false)}
      >
        <p className="mb-3 text-sm font-semibold text-muted">Para {name.trim() || 'la receta'}</p>
        <label className="relative mb-3 block">
          <AppIcon name="magnifying-glass" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className={`${inputClass} border-2 border-azul-ink bg-card pl-10 pr-12`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOffStatus('idle')
              setOffProducts([])
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void searchOff()
              }
            }}
            placeholder="Buscá un ingrediente"
            autoFocus
          />
        </label>
        {common.length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-1 text-sm font-bold">De todos los días</h3>
            <ul className="space-y-2">
              {common.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border-[1.5px] border-azul bg-card px-3 py-3 text-left"
                    onClick={() =>
                      openGrams({
                        name: item.name.replace(/ \(ejemplo\)$/i, ''),
                        foodSource: 'common',
                        foodRef: item.id,
                        brand: null,
                        per100: {
                          protein: item.proteinPer100,
                          carbs: item.carbsPer100,
                          fat: item.fatPer100,
                          kcal: item.kcalPer100,
                        },
                        absolute: null,
                        absoluteBaseGrams: null,
                        attribution: ARGENFOODS_ATTR_SHORT,
                        originLabel: 'De la lista de todos los días',
                      })
                    }
                  >
                    <span>
                      <span className="block font-display text-lg font-semibold">
                        {item.name.replace(/ \(ejemplo\)$/i, '')}
                      </span>
                      <span className="block text-sm font-semibold text-muted">
                        Cada 100 g ·{' '}
                        {item.proteinPer100 == null
                          ? 'sin proteína'
                          : `${formatAmount(item.proteinPer100)} g de proteína`}
                      </span>
                    </span>
                    <AppIcon name="chevron-right" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-semibold text-muted">{ARGENFOODS_ATTR_SHORT}</p>
          </section>
        ) : null}
        {query.trim() ? (
          <button
            type="button"
            className="mb-3 flex min-h-[52px] w-full items-center justify-between gap-2 rounded-2xl border-[1.5px] border-azul-ink bg-card px-3 text-left font-semibold"
            onClick={() => void searchOff()}
          >
            <span className="inline-flex items-center gap-2">
              <AppIcon name="box-open" /> Buscar «{query.trim()}» en productos envasados
            </span>
            <AppIcon name="chevron-right" />
          </button>
        ) : null}
        {offStatus === 'done' && offProducts.length > 0 ? (
          <ul className="mb-3 space-y-2">
            {offProducts.map((product) => (
              <li key={product.code}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-2xl border-[1.5px] border-azul bg-card px-3 py-3 text-left"
                  onClick={() =>
                    openGrams({
                      name: product.name,
                      foodSource: 'off',
                      foodRef: product.code,
                      brand: product.brand,
                      per100: {
                        protein: product.proteinPer100,
                        carbs: product.carbsPer100,
                        fat: product.fatPer100,
                        kcal: product.kcalPer100,
                      },
                      absolute: null,
                      absoluteBaseGrams: null,
                      attribution: OFF_ATTR,
                      originLabel: product.brand
                        ? `${product.brand} · Open Food Facts`
                        : 'Open Food Facts',
                    })
                  }
                >
                  <span>
                    <span className="block font-display text-lg font-semibold">{product.name}</span>
                    <span className="block text-sm font-semibold text-muted">
                      Cada 100 g ·{' '}
                      {product.proteinPer100 == null
                        ? 'sin proteína'
                        : `${formatAmount(product.proteinPer100)} g de proteína`}
                    </span>
                  </span>
                  <AppIcon name="chevron-right" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="flex min-h-[52px] w-full items-center justify-between gap-2 rounded-2xl border-[1.5px] border-azul-ink bg-card px-3 font-semibold"
          onClick={() => {
            setManualName(query.trim())
            setManualGrams('100')
            setManualProtein('')
            setManualCarbs('')
            setManualFat('')
            setManualOpen(true)
          }}
        >
          <span className="inline-flex items-center gap-2">
            <AppIcon name="pen" /> Cargarlo a mano
          </span>
          <AppIcon name="chevron-right" />
        </button>
      </Sheet>

      <Sheet
        open={manualOpen}
        title="A mano"
        onClose={() => setManualOpen(false)}
        footer={
          <div className="space-y-2">
            <Button
              type="button"
              onClick={() => {
                const trimmed = manualName.trim()
                const g = normalizeIngredientGrams(Number(String(manualGrams).replace(',', '.')) || 0)
                if (!trimmed || g < 1) return
                const proteinG = parseMacro(manualProtein)
                const carbsG = parseMacro(manualCarbs)
                const fatG = parseMacro(manualFat)
                const kcal =
                  proteinG != null && carbsG != null && fatG != null
                    ? roundMacro(kcalFromGrams(proteinG, carbsG, fatG))
                    : null
                setIngredients((current) => [
                  ...current,
                  {
                    key: newKey(),
                    name: trimmed.slice(0, 120),
                    grams: g,
                    proteinG,
                    carbsG,
                    fatG,
                    kcal,
                    foodSource: 'manual',
                    foodRef: null,
                    brand: null,
                    position: current.length,
                  },
                ])
                setManualOpen(false)
                setPickOpen(false)
                setQuery('')
              }}
            >
              Sumar a la receta
            </Button>
            <Button type="button" variant="alt" onClick={() => setManualOpen(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm font-semibold text-muted">Para {name.trim() || 'la receta'}</p>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold text-muted">Nombre</span>
          <input className={inputClass} value={manualName} onChange={(e) => setManualName(e.target.value)} />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold text-muted">¿Cuánto lleva la receta?</span>
          <div className="flex items-center gap-2">
            <input
              className={inputClass}
              inputMode="decimal"
              value={manualGrams}
              onChange={(e) => setManualGrams(e.target.value)}
            />
            <span className="text-sm font-bold">g</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-muted">
            En gramos. Si no lo pesaste, poné un aproximado.
          </p>
        </label>
        <p className="mb-2 text-sm font-semibold text-muted">
          Si sabés los números de esos {manualGrams || '…'} g (opcional)
        </p>
        <div className="grid grid-cols-3 gap-2">
          <input className={inputClass} inputMode="decimal" placeholder="Prot." value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} />
          <input className={inputClass} inputMode="decimal" placeholder="Hidr." value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} />
          <input className={inputClass} inputMode="decimal" placeholder="Gras." value={manualFat} onChange={(e) => setManualFat(e.target.value)} />
        </div>
        <p className="mt-2 text-sm font-semibold text-muted">
          Están en la tabla del paquete. Si es algo casero y no los sabés, dejalos vacíos: queda como ingrediente sin datos.
        </p>
      </Sheet>

      <Sheet
        open={Boolean(gramsPick)}
        title={gramsPick?.name ?? 'Gramos'}
        onClose={() => setGramsPick(null)}
        footer={
          <div className="space-y-2">
            {editingKey ? (
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-mostaza-ink"
                onClick={() => {
                  if (editingKey) removeIngredient(editingKey)
                  setGramsPick(null)
                }}
              >
                <AppIcon name="trash-can" /> Sacar de la receta
              </button>
            ) : null}
            <Button type="button" onClick={confirmGrams}>
              {editingKey ? 'Guardar cambios' : 'Sumar a la receta'}
            </Button>
          </div>
        }
      >
        {gramsPick ? (
          <>
            <p className="text-sm font-semibold text-muted">{gramsPick.originLabel}</p>
            {gramsPick.attribution ? (
              <p className="mb-3 text-sm font-semibold text-muted">{gramsPick.attribution}</p>
            ) : (
              <div className="mb-3" />
            )}
            <p className="mb-2 text-sm font-bold text-muted">¿Cuánto lleva la receta?</p>
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Menos 10 gramos"
                className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink bg-card"
                onClick={() => setGrams((current) => stepIngredientGrams(current, -10))}
              >
                <AppIcon name="minus" />
              </button>
              <input
                value={String(grams)}
                onChange={(event) => {
                  const parsed = parseMacro(event.target.value)
                  if (parsed == null) return
                  setGrams(normalizeIngredientGrams(parsed))
                }}
                inputMode="decimal"
                className={`${inputClass} w-[84px] text-center`}
              />
              <button
                type="button"
                aria-label="Más 10 gramos"
                className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink bg-card"
                onClick={() => setGrams((current) => stepIngredientGrams(current, 10))}
              >
                <AppIcon name="plus" />
              </button>
              <span className="text-sm font-bold">g</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {GRAM_SHORTCUTS.map((value) => (
                <Chip key={value} active={grams === value} onClick={() => setGrams(value)}>
                  {value} g
                </Chip>
              ))}
            </div>
            <p className="mb-4 text-sm font-semibold text-muted">
              Si no lo pesaste, el paquete suele decir cuánto pesa cada unidad.
            </p>
            <IngredientSumPreview source={gramsPick} grams={grams} />
          </>
        ) : null}
      </Sheet>

      <ConfirmSheet
        open={deleteOpen}
        title={`¿Borrar ${name.trim() || 'esta receta'}?`}
        onClose={() => setDeleteOpen(false)}
        confirmLabel="Borrar"
        variant="danger"
        busy={pending}
        error={error || null}
        onConfirm={() => void confirmDelete()}
      >
        <p className="font-semibold text-tinta">
          Deja de aparecer en Recetas y en la búsqueda, también para {partnerName}. Lo que ya anotaron con ella queda
          como está.
        </p>
      </ConfirmSheet>

      <ConfirmSheet
        open={leaveOpen}
        title="¿Salir sin guardar?"
        onClose={() => setLeaveOpen(false)}
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        variant="danger"
        onConfirm={() => {
          const target = leaveTarget()
          navigate(target.to, { state: target.state })
        }}
      >
        <p className="font-semibold text-tinta">Se pierden los cambios de esta pantalla.</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={Boolean(conflict)}
        title={conflictMessage(partnerName)}
        onClose={() => setConflict(null)}
        confirmLabel="Guardar igual"
        busy={pending}
        onConfirm={() => void save(true)}
      >
        <p className="mb-3 font-semibold text-tinta">Si guardás, tus cambios reemplazan los de {partnerName}.</p>
        <Button
          type="button"
          variant="alt"
          onClick={() => {
            if (conflict) applyRecipe(conflict)
            setConflict(null)
            setToast({ message: `Estás viendo la de ${partnerName}.` })
          }}
        >
          {`Ver la de ${partnerName}`}
        </Button>
      </ConfirmSheet>

      <ConfirmSheet
        open={deletedConflict}
        title={deletedConflictMessage(partnerName)}
        onClose={() => setDeletedConflict(false)}
        confirmLabel="Guardar igual"
        busy={pending}
        onConfirm={() => void save(true)}
      >
        <Button type="button" variant="alt" onClick={() => navigate(MEAL_ROUTES.recetas)}>
          Salir sin guardar
        </Button>
      </ConfirmSheet>

      {toast ? (
        <Toast onUndo={toast.undo} onDone={() => setToast(null)}>
          {toast.message}
        </Toast>
      ) : null}
    </div>
  )
}

function snapshot(
  name: string,
  servings: number,
  notes: string,
  ingredients: DraftIngredient[],
): string {
  return JSON.stringify({
    name: name.trim(),
    servings,
    notes: notes.trim(),
    ingredients: ingredients.map((item) => ({
      name: item.name,
      grams: item.grams,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      kcal: item.kcal,
      foodSource: item.foodSource,
      foodRef: item.foodRef,
      brand: item.brand,
    })),
  })
}

function IngredientSumPreview({ source, grams }: { source: PickSource; grams: number }) {
  const display = useMemo(() => {
    if (source.per100) return scalePer100(source.per100, grams)
    if (source.absolute) {
      const base = Math.max(1, source.absoluteBaseGrams ?? grams)
      const factor = grams / base
      return {
        proteinG: source.absolute.proteinG == null ? null : roundMacro(source.absolute.proteinG * factor),
        carbsG: source.absolute.carbsG == null ? null : roundMacro(source.absolute.carbsG * factor),
        fatG: source.absolute.fatG == null ? null : roundMacro(source.absolute.fatG * factor),
        kcal: source.absolute.kcal == null ? null : roundMacro(source.absolute.kcal * factor),
      }
    }
    return { proteinG: null, carbsG: null, fatG: null, kcal: null }
  }, [source, grams])
  const shares = compositionShares([display])
  const phrase = compositionPhrase(shares)
  return (
    <div className="rounded-2xl bg-mostaza-claro/60 px-3 py-3">
      <p className="text-sm font-bold text-muted">Esto suma a la receta</p>
      {shares ? (
        <>
          <p className="mt-1 font-display text-lg font-semibold">{phrase}</p>
          <CompositionBar shares={shares} scope="este ingrediente" className="mt-2" />
          <CompositionLegendShort shares={shares} />
          <p className="mt-2 text-sm font-semibold">{formatAmount(shares.kcal)} calorías</p>
        </>
      ) : (
        <p className="mt-1 text-sm font-semibold text-muted">Sin datos completos todavía.</p>
      )}
    </div>
  )
}
