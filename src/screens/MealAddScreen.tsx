import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useOutletContext } from 'react-router'
import type { AppChromeContext } from '../components/AppShell.tsx'
import { AppIcon } from '../components/AppIcon.tsx'
import { MealPortionSheet, type PortionDraft } from '../components/MealPortionSheet.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Chip, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import {
  createMeal,
  deleteMeal,
  deleteSavedFood,
  loadRecentMeals,
  loadSavedFoods,
  searchCommonFoods,
  upsertSavedFood,
  type CommonFoodRow,
  type MealRow,
  type SavedFoodRow,
} from '../lib/api.ts'
import {
  ARGENFOODS_ATTR,
  ARGENFOODS_ATTR_SHORT,
  MEAL_ICON,
  MEAL_LABEL,
  MEAL_TYPES,
  OFF_ATTR,
  addedSummaryNames,
  argentinaISO,
  foodRowSubtitle,
  isManualLegacy,
  matchesSearch,
  mealTypeForContext,
  parseMacro,
  recentFromMeals,
  roundMacro,
  scalePer100,
  type FoodSource,
  type MealType,
} from '../lib/meals.ts'
import { offRowMeta, searchOpenFoodFacts, type OffProduct } from '../lib/openFoodFacts.ts'

type Tab = 'recientes' | 'mios'
type LocationState = { eatenOn?: string; mealType?: MealType }

export function MealAddScreen() {
  const { profile } = useAuth()
  const { enabled, ready } = useModules()
  const navigate = useNavigate()
  const location = useLocation()
  const { setHideChrome } = useOutletContext<AppChromeContext>()
  const state = (location.state as LocationState | null) ?? {}
  const eatenOn = state.eatenOn ?? argentinaISO()
  const [mealType, setMealType] = useState<MealType>(state.mealType ?? mealTypeForContext(eatenOn))
  const [mealPickerOpen, setMealPickerOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('recientes')
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<MealRow[]>([])
  const [saved, setSaved] = useState<SavedFoodRow[]>([])
  const [common, setCommon] = useState<CommonFoodRow[]>([])
  const [offProducts, setOffProducts] = useState<OffProduct[]>([])
  const [offStatus, setOffStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [draft, setDraft] = useState<PortionDraft | null>(null)
  const [sheetMode, setSheetMode] = useState<'add' | 'saved'>('add')
  const [manualOpen, setManualOpen] = useState(false)
  const [added, setAdded] = useState<MealRow[]>([])
  const [toast, setToast] = useState<{ message: string; undo?: () => Promise<void> } | null>(null)
  const [keyboardCompact, setKeyboardCompact] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setHideChrome(true)
    return () => setHideChrome(false)
  }, [setHideChrome])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => setKeyboardCompact(window.innerHeight - viewport.height > 120)
    sync()
    viewport.addEventListener('resize', sync)
    return () => viewport.removeEventListener('resize', sync)
  }, [])

  useEffect(() => {
    if (!profile) return
    let active = true
    Promise.all([loadRecentMeals(), loadSavedFoods()])
      .then(([meals, foods]) => {
        if (!active) return
        setRecent(recentFromMeals(meals))
        setSaved(foods)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setCommon([])
      setOffProducts([])
      setOffStatus('idle')
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
  }, [query])

  const filteredRecent = useMemo(
    () => (query.trim() ? recent.filter((item) => matchesSearch(item.name, query)) : recent),
    [recent, query],
  )
  const searching = query.trim().length > 0

  if (!profile) return null
  if (ready && !enabled.includes('comidas')) return <Navigate to="/" replace />

  async function quickAdd(from: MealRow | SavedFoodRow) {
    if (!online) return
    try {
      const meal = await createMeal({
        ownerId: profile!.id,
        eatenOn,
        mealType,
        name: from.name,
        proteinG: from.proteinG,
        carbsG: from.carbsG,
        fatG: from.fatG,
        kcal: from.kcal,
        portionLabel: from.portionLabel,
        portionQty: from.portionQty,
        portionGrams: from.portionGrams,
        foodSource: from.foodSource ?? ('saved' as FoodSource),
        foodRef: from.foodRef,
        brand: from.brand,
      })
      setAdded((current) => [...current, meal])
      setToast({
        message: `Sumaste ${meal.name}.`,
        undo: async () => {
          await deleteMeal(meal.id)
          setAdded((current) => current.filter((item) => item.id !== meal.id))
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar.')
    }
  }

  function openFromRecent(item: MealRow) {
    setSheetMode('add')
    setDraft({
      name: item.name,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      kcal: item.kcal,
      portionLabel: item.portionLabel,
      portionQty: item.portionQty ?? 1,
      portionGrams: item.portionGrams,
      foodSource: item.foodSource ?? 'manual',
      foodRef: item.foodRef,
      brand: item.brand,
      originLabel: item.foodSource === 'common' ? 'De la lista de todos los días' : 'Ya lo comiste',
      attribution: item.foodSource === 'common' ? ARGENFOODS_ATTR_SHORT : item.foodSource === 'off' ? OFF_ATTR : null,
      portions:
        item.portionLabel && item.portionGrams
          ? [{ label: item.portionLabel, grams: roundMacro(item.portionGrams / (item.portionQty ?? 1)), suggested: true }]
          : [],
      per100: null,
      savedInMine: false,
    })
  }

  function openFromSaved(item: SavedFoodRow) {
    setSheetMode('saved')
    const legacy = isManualLegacy(item) || item.foodSource === 'manual' || !item.portionLabel
    setDraft({
      name: item.name,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      kcal: item.kcal,
      portionLabel: item.portionLabel ?? 'porción',
      portionQty: item.portionQty ?? 1,
      portionGrams: item.portionGrams,
      foodSource: item.foodSource ?? 'manual',
      foodRef: item.foodRef,
      brand: item.brand,
      originLabel: 'De mis alimentos',
      attribution: item.foodSource === 'common' ? ARGENFOODS_ATTR_SHORT : null,
      portions:
        item.portions.length > 0
          ? item.portions
          : item.portionLabel && item.portionGrams
            ? [{ label: item.portionLabel, grams: item.portionGrams, suggested: true }]
            : legacy
              ? [{ label: 'porción', grams: item.portionGrams ?? 100, suggested: true }]
              : [],
      per100:
        item.proteinPer100 != null || item.carbsPer100 != null || item.fatPer100 != null
          ? {
              protein: item.proteinPer100,
              carbs: item.carbsPer100,
              fat: item.fatPer100,
              kcal: item.kcalPer100,
            }
          : null,
      savedInMine: true,
    })
  }

  function openFromCommon(item: CommonFoodRow) {
    const suggested = item.portions.find((portion) => portion.suggested) ?? item.portions[0]
    const macros = suggested
      ? scalePer100(
          { protein: item.proteinPer100, carbs: item.carbsPer100, fat: item.fatPer100, kcal: item.kcalPer100 },
          suggested.grams,
        )
      : { proteinG: null, carbsG: null, fatG: null, kcal: null }
    setSheetMode('add')
    setDraft({
      name: item.name.replace(/ \(ejemplo\)$/i, ''),
      ...macros,
      portionLabel: suggested?.label ?? null,
      portionQty: 1,
      portionGrams: suggested?.grams ?? null,
      foodSource: 'common',
      foodRef: item.id,
      brand: null,
      originLabel: 'De la lista de todos los días',
      attribution: ARGENFOODS_ATTR_SHORT,
      portions: item.portions,
      per100: {
        protein: item.proteinPer100,
        carbs: item.carbsPer100,
        fat: item.fatPer100,
        kcal: item.kcalPer100,
      },
      savedInMine: false,
    })
  }

  function openFromOff(product: OffProduct) {
    const suggested = product.portions[0]
    const macros = suggested
      ? scalePer100(
          {
            protein: product.proteinPer100,
            carbs: product.carbsPer100,
            fat: product.fatPer100,
            kcal: product.kcalPer100,
          },
          suggested.grams,
        )
      : { proteinG: null, carbsG: null, fatG: null, kcal: null }
    setSheetMode('add')
    setDraft({
      name: product.name,
      ...macros,
      portionLabel: suggested?.label ?? 'Gramos',
      portionQty: 1,
      portionGrams: suggested?.grams ?? 100,
      foodSource: 'off',
      foodRef: product.code,
      brand: product.brand,
      originLabel: product.brand ? `${product.brand} · Open Food Facts` : 'Open Food Facts',
      attribution: OFF_ATTR,
      portions: product.portions,
      per100: {
        protein: product.proteinPer100,
        carbs: product.carbsPer100,
        fat: product.fatPer100,
        kcal: product.kcalPer100,
      },
      savedInMine: false,
      missing: product.missing,
    })
  }

  async function searchOff() {
    if (!query.trim() || !online) return
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

  async function saveDraft(next: PortionDraft, saveInMine: boolean) {
    const meal = await createMeal({
      ownerId: profile!.id,
      eatenOn,
      mealType,
      name: next.name.trim().slice(0, 80),
      proteinG: next.proteinG,
      carbsG: next.carbsG,
      fatG: next.fatG,
      kcal: next.kcal,
      portionLabel: next.portionLabel,
      portionQty: next.portionQty,
      portionGrams: next.portionGrams,
      foodSource: next.foodSource,
      foodRef: next.foodRef,
      brand: next.brand,
    })
    if (saveInMine) {
      const savedFood = await upsertSavedFood({
        ownerId: profile!.id,
        name: next.name.trim().slice(0, 80),
        proteinG: next.proteinG,
        carbsG: next.carbsG,
        fatG: next.fatG,
        kcal: next.kcal,
        portionLabel: next.portionLabel,
        portionQty: next.portionQty,
        portionGrams: next.portionGrams,
        foodSource: next.foodSource,
        foodRef: next.foodRef,
        brand: next.brand,
        proteinPer100: next.per100?.protein ?? null,
        carbsPer100: next.per100?.carbs ?? null,
        fatPer100: next.per100?.fat ?? null,
        kcalPer100: next.per100?.kcal ?? null,
        portions: next.portions,
      })
      setSaved((current) => {
        const without = current.filter((item) => item.id !== savedFood.id && item.name.toLocaleLowerCase('es') !== savedFood.name.toLocaleLowerCase('es'))
        return [...without, savedFood].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      })
    } else if (sheetMode === 'saved') {
      await deleteSavedFoodByNameSafe(profile!.id, next.name)
      setSaved((current) => current.filter((item) => item.name.toLocaleLowerCase('es') !== next.name.toLocaleLowerCase('es')))
    }
    setAdded((current) => [...current, meal])
    setDraft(null)
    setQuery('')
    setToast({
      message: `Sumaste ${meal.name}.`,
      undo: async () => {
        await deleteMeal(meal.id)
        setAdded((current) => current.filter((item) => item.id !== meal.id))
      },
    })
  }

  const inactive = !online

  return (
    <div className="min-h-dvh bg-crema">
      <header className={`scallop-b bg-azul px-4 ${keyboardCompact ? 'pb-3 pt-4' : 'pb-5 pt-4'}`}>
        <div className="flex items-center gap-2">
          <Link to="/comidas" aria-label="Volver" className="grid h-11 w-11 place-items-center text-tinta">
            <AppIcon name="arrow-left" />
          </Link>
          <h1 className="font-display text-[2.125rem] font-semibold leading-none text-tinta">Agregar</h1>
        </div>
        {!keyboardCompact ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-tinta">Se suma a</span>
            <button
              type="button"
              onClick={() => setMealPickerOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-azul-ink bg-card px-3"
            >
              <AppIcon name={MEAL_ICON[mealType]} />
              <span className="font-semibold">{MEAL_LABEL[mealType]}</span>
              <AppIcon name="chevron-down" className="text-sm text-muted" />
            </button>
          </div>
        ) : null}
      </header>

      <div className="px-4 pt-4 pb-28">
        {!online ? (
          <p role="status" className="mb-3 rounded-2xl bg-rosa-claro px-3 py-3 text-sm font-semibold">
            Estás sin conexión. Para buscar y anotar hace falta internet. Cuando vuelva, seguí desde acá.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mb-3 text-sm font-bold text-tinta">
            {error}
          </p>
        ) : null}

        <label className="relative mb-3 block">
          <AppIcon name="magnifying-glass" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            disabled={inactive}
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
            placeholder="Buscá qué comiste"
            enterKeyHint="search"
            className={`${inputClass} border-2 border-azul-ink bg-card pl-10 pr-12 disabled:border-dashed disabled:bg-fondo-desactivado`}
          />
          {query ? (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center"
            >
              <AppIcon name="xmark" />
            </button>
          ) : null}
        </label>

        {!searching ? (
          <>
            <div className="mb-2 flex gap-2">
              <Chip active={tab === 'recientes'} onClick={() => setTab('recientes')}>
                Recientes
              </Chip>
              <Chip active={tab === 'mios'} onClick={() => setTab('mios')}>
                Mis alimentos
              </Chip>
            </div>
            {tab === 'recientes' ? (
              <>
                <p className="mb-2 text-sm font-semibold text-muted">
                  Con el + lo sumás con la misma porción de la última vez.
                </p>
                <FoodList
                  inactive={inactive}
                  items={filteredRecent.map((item) => ({
                    key: item.id,
                    name: item.name,
                    detail: foodRowSubtitle({
                      label: item.portionLabel,
                      qty: item.portionQty,
                      grams: item.portionGrams,
                      proteinG: item.proteinG,
                      foodSource: item.foodSource,
                      manualLegacy: isManualLegacy(item),
                    }),
                    onOpen: () => openFromRecent(item),
                    onQuick: () => void quickAdd(item),
                  }))}
                />
              </>
            ) : (
              <>
                <FoodList
                  inactive={inactive}
                  items={saved.map((item) => ({
                    key: item.id,
                    name: item.name,
                    detail: foodRowSubtitle({
                      label: item.portionLabel,
                      qty: item.portionQty,
                      grams: item.portionGrams,
                      proteinG: item.proteinG,
                      foodSource: item.foodSource,
                      manualLegacy: isManualLegacy(item) || item.foodSource === 'manual' || !item.portionLabel,
                    }),
                    onOpen: () => openFromSaved(item),
                  }))}
                />
                <p className="mt-3 text-sm font-semibold text-muted">
                  Para sumar uno, prendé «Guardar en mis alimentos» cuando elegís la porción.
                </p>
              </>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {filteredRecent.length > 0 ? (
              <section>
                <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-bold">
                  <AppIcon name="clock-rotate-left" /> Ya lo comiste
                </h2>
                <FoodList
                  inactive={inactive}
                  items={filteredRecent.map((item) => ({
                    key: item.id,
                    name: item.name,
                    detail: foodRowSubtitle({
                      label: item.portionLabel,
                      qty: item.portionQty,
                      grams: item.portionGrams,
                      proteinG: item.proteinG,
                      foodSource: item.foodSource,
                    }),
                    onOpen: () => openFromRecent(item),
                    onQuick: () => void quickAdd(item),
                  }))}
                />
              </section>
            ) : null}

            <section>
              <h2 className="mb-1 text-sm font-bold">De todos los días</h2>
              <FoodList
                inactive={inactive}
                items={common.map((item) => {
                  const portion = item.portions.find((entry) => entry.suggested) ?? item.portions[0]
                  const macros = portion
                    ? scalePer100(
                        {
                          protein: item.proteinPer100,
                          carbs: item.carbsPer100,
                          fat: item.fatPer100,
                          kcal: item.kcalPer100,
                        },
                        portion.grams,
                      )
                    : null
                  return {
                    key: item.id,
                    name: item.name.replace(/ \(ejemplo\)$/i, ''),
                    detail: portion
                      ? `1 ${portion.label.toLowerCase()}${portion.grams ? ` (${portion.grams} g)` : ''} · ${
                          macros?.proteinG != null ? `${macros.proteinG} g de proteína` : 'sin proteína'
                        }`
                      : 'Sin porción',
                    onOpen: () => openFromCommon(item),
                    chevron: true,
                  }
                })}
              />
              <p className="mt-2 text-sm font-semibold text-muted">{ARGENFOODS_ATTR}</p>
            </section>

            {offStatus === 'loading' ? (
              <section>
                <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-bold">
                  <AppIcon name="box-open" /> Productos envasados
                </h2>
                <div className="h-2.5 animate-pulse rounded-full bg-azul-claro" />
                <p className="mt-2 text-sm font-semibold text-muted">Buscando en productos envasados…</p>
              </section>
            ) : null}

            {offStatus === 'error' ? (
              <section className="rounded-2xl border-2 border-azul-ink bg-card p-3">
                <p className="text-sm font-semibold">
                  No pudimos buscar en productos envasados. Lo de la lista de todos los días sí está.
                </p>
                <Button className="mt-2" variant="alt" onClick={() => void searchOff()}>
                  Probar de nuevo
                </Button>
              </section>
            ) : null}

            {offStatus === 'done' ? (
              <section>
                <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-bold">
                  <AppIcon name="box-open" /> Productos envasados
                </h2>
                <FoodList
                  inactive={inactive}
                  items={offProducts.map((product) => {
                    const meta = offRowMeta(product)
                    return {
                      key: product.code,
                      name: product.name,
                      brand: product.brand,
                      detail: meta.detail,
                      onOpen: () => openFromOff(product),
                      chevron: true,
                    }
                  })}
                />
                <p className="mt-2 text-sm font-semibold text-muted">{OFF_ATTR}</p>
              </section>
            ) : null}

            {offStatus === 'done' && filteredRecent.length === 0 && common.length === 0 && offProducts.length === 0 ? (
              <div className="py-6 text-center">
                <p className="font-display text-lg font-semibold">No encontramos «{query.trim()}».</p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  No está en la lista de todos los días ni en productos envasados. Probá con menos palabras, por ejemplo «
                  {query.trim().split(/\s+/)[0]}».
                </p>
                <Button className="mt-3" variant="alt" onClick={() => setManualOpen(true)}>
                  Cargarlo a mano
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {searching && online && offStatus !== 'loading' && offStatus !== 'done' ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-crema px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button onClick={() => void searchOff()} disabled={inactive}>
            <span className="inline-flex items-center justify-center gap-2">
              <AppIcon name="box-open" /> Buscar «{query.trim()}» en productos envasados
            </span>
          </Button>
        </div>
      ) : null}

      {added.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-crema px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <p className="mb-2 text-sm font-semibold">
            <b>En el {MEAL_LABEL[mealType].toLowerCase()}:</b> {addedSummaryNames(added.map((item) => item.name))}
          </p>
          <Button onClick={() => navigate('/comidas')}>Listo</Button>
        </div>
      ) : null}

      {toast ? (
        <Toast onUndo={toast.undo} onDone={() => setToast(null)}>
          {toast.message}
        </Toast>
      ) : null}

      <Sheet open={mealPickerOpen} title="Se suma a" onClose={() => setMealPickerOpen(false)}>
        <ul>
          {MEAL_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => {
                  setMealType(type)
                  setMealPickerOpen(false)
                }}
                className={`mb-2 flex h-14 w-full items-center gap-3 rounded-2xl px-3 ${
                  type === mealType ? 'bg-azul-claro' : 'bg-card'
                }`}
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-card">
                  <AppIcon name={MEAL_ICON[type]} />
                </span>
                <span className="flex-1 text-left font-display text-lg font-semibold">{MEAL_LABEL[type]}</span>
                {type === mealType ? <AppIcon name="check" className="text-mostaza-ink" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {draft ? (
        <MealPortionSheet
          open
          mode={sheetMode}
          mealType={mealType}
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={saveDraft}
          onRemoveFromSaved={
            sheetMode === 'saved'
              ? async () => {
                  const match = saved.find((item) => item.name.toLocaleLowerCase('es') === draft.name.toLocaleLowerCase('es'))
                  if (match) {
                    await deleteSavedFood(match.id)
                    setSaved((current) => current.filter((item) => item.id !== match.id))
                  }
                  setDraft(null)
                  setToast({ message: `Quitaste ${draft.name} de tus alimentos.` })
                }
              : undefined
          }
        />
      ) : null}

      <ManualSheet
        open={manualOpen}
        mealType={mealType}
        initialName={query.trim()}
        onClose={() => setManualOpen(false)}
        onSave={async (next, saveInMine) => {
          await saveDraft(next, saveInMine)
          setManualOpen(false)
        }}
      />
    </div>
  )
}

async function deleteSavedFoodByNameSafe(ownerId: string, name: string) {
  const { deleteSavedFoodByName } = await import('../lib/api.ts')
  await deleteSavedFoodByName(ownerId, name)
}

function FoodList({
  items,
  inactive,
}: {
  inactive: boolean
  items: Array<{
    key: string
    name: string
    detail: string
    brand?: string | null
    onOpen: () => void
    onQuick?: () => void
    chevron?: boolean
  }>
}) {
  if (items.length === 0) return null
  return (
    <ul className="divide-y divide-dashed divide-line">
      {items.map((item) => (
        <li key={item.key} className="flex min-h-[52px] items-center gap-2 py-2">
          <button
            type="button"
            disabled={inactive}
            aria-disabled={inactive}
            onClick={item.onOpen}
            className="min-w-0 flex-1 text-left disabled:pointer-events-none"
          >
            <span className={`block font-display text-lg font-semibold ${inactive ? 'text-gris' : ''}`}>{item.name}</span>
            {item.brand ? <span className="block text-sm font-semibold text-muted">{item.brand}</span> : null}
            <span className="block text-sm font-semibold text-muted">{item.detail}</span>
          </button>
          {item.onQuick ? (
            <button
              type="button"
              aria-label={`Sumar ${item.name}`}
              disabled={inactive}
              onClick={item.onQuick}
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink disabled:border-dashed disabled:opacity-50"
            >
              <AppIcon name="plus" />
            </button>
          ) : item.chevron ? (
            <AppIcon name="chevron-right" className="text-muted" />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function ManualSheet({
  open,
  mealType,
  initialName,
  onClose,
  onSave,
}: {
  open: boolean
  mealType: MealType
  initialName: string
  onClose: () => void
  onSave: (draft: PortionDraft, saveInMine: boolean) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [portion, setPortion] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [saveInMine, setSaveInMine] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setPortion('')
    setProtein('')
    setCarbs('')
    setFat('')
    setSaveInMine(false)
    setFormError('')
  }, [open, initialName])

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Poné un nombre.')
      return
    }
    const proteinG = protein.trim() ? parseMacro(protein) : null
    const carbsG = carbs.trim() ? parseMacro(carbs) : null
    const fatG = fat.trim() ? parseMacro(fat) : null
    if ((protein.trim() && proteinG == null) || (carbs.trim() && carbsG == null) || (fat.trim() && fatG == null)) {
      setFormError('Los números tienen que ser 0 o más.')
      return
    }
    setPending(true)
    try {
      const kcal =
        proteinG != null && carbsG != null && fatG != null ? roundMacro(4 * proteinG + 4 * carbsG + 9 * fatG) : null
      await onSave(
        {
          name: trimmed.slice(0, 80),
          proteinG,
          carbsG,
          fatG,
          kcal,
          portionLabel: portion.trim() || 'porción',
          portionQty: 1,
          portionGrams: null,
          foodSource: 'manual',
          foodRef: null,
          brand: null,
          originLabel: 'A mano',
          attribution: null,
          portions: [],
          per100: null,
          savedInMine: saveInMine,
        },
        saveInMine,
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo agregar.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="A mano"
      onClose={onClose}
      footer={
        <Button disabled={pending} onClick={() => void save()}>
          Agregar al {MEAL_LABEL[mealType].toLowerCase()}
        </Button>
      }
    >
      <label className="mb-3 block text-sm font-bold">
        <span className="mb-1 block text-muted">Nombre</span>
        <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
      </label>
      <label className="mb-3 block text-sm font-bold">
        <span className="mb-1 block text-muted">¿Cuánto comiste? (opcional)</span>
        <input value={portion} onChange={(event) => setPortion(event.target.value)} className={inputClass} />
      </label>
      <p className="mb-2 text-sm font-bold text-muted">Si sabés los números (opcional)</p>
      <div className="mb-2 grid grid-cols-3 gap-2">
        <label className="text-sm font-bold">
          Proteína
          <input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
        </label>
        <label className="text-sm font-bold">
          Hidratos
          <input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
        </label>
        <label className="text-sm font-bold">
          Grasas
          <input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
        </label>
      </div>
      <p className="mb-3 text-sm font-semibold text-muted">
        Están en la tabla del paquete o de la receta. Si no los sabés, igual queda anotado.
      </p>
      <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
        <span className="text-base font-semibold">Guardar en mis alimentos</span>
        <Chip active={saveInMine} onClick={() => setSaveInMine((current) => !current)}>
          {saveInMine ? 'Sí' : 'No'}
        </Chip>
      </div>
      {formError ? <p className="text-sm font-bold text-tinta">{formError}</p> : null}
    </Sheet>
  )
}
