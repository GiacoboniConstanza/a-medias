import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sprout } from '../components/Sprout.tsx'
import { Button, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { loadRecipes, type RecipeRow } from '../lib/api.ts'
import { formatAmount } from '../lib/meals.ts'
import { MEAL_ROUTES } from '../lib/modules.ts'
import {
  incompleteNote,
  macrosPerServing,
  recipeCardMeta,
} from '../lib/recipes.ts'

export function RecipesScreen() {
  const { profile } = useAuth()
  const { enabled, ready } = useModules()
  const location = useLocation()
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; undo?: () => Promise<void> } | null>(null)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await loadRecipes()
      setRecipes(rows)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos traer las recetas.')
      setRecipes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    void reload()
  }, [profile, reload])

  useEffect(() => {
    const notice = (location.state as { notice?: string; undoRecipe?: RecipeRow } | null)
    if (notice?.notice) {
      setToast({
        message: notice.notice,
        undo: notice.undoRecipe
          ? async () => {
              const { createRecipe } = await import('../lib/api.ts')
              if (!profile?.householdId || !notice.undoRecipe) return
              await createRecipe({
                householdId: profile.householdId,
                name: notice.undoRecipe.name,
                servings: notice.undoRecipe.servings,
                notes: notice.undoRecipe.notes,
                ingredients: notice.undoRecipe.ingredients.map((item, index) => ({
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
                })),
              })
              await reload()
            }
          : undefined,
      })
      window.history.replaceState({}, '')
    }
  }, [location.state, profile, reload])

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

  const rows = useMemo(() => {
    const sorted = [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return sorted.map((recipe) => {
      const per = macrosPerServing(recipe.ingredients, recipe.servings)
      return {
        recipe,
        meta: recipeCardMeta({
          servings: recipe.servings,
          ingredientCount: recipe.ingredients.length,
        }),
        proteinG: per.proteinG,
        kcal: per.kcal,
        incomplete: incompleteNote(per.incompleteCount),
      }
    })
  }, [recipes])

  if (!profile) return null
  if (ready && !enabled.includes('comidas')) return <Navigate to="/" replace />

  const countLabel =
    rows.length === 1 ? '1 receta guardada' : rows.length > 1 ? `${rows.length} recetas guardadas` : null

  return (
    <>
      <SectionHeader
        lead="crumb"
        module="comidas"
        aside={
          <>
            <span className="inline-flex h-[27px] items-center gap-1 rounded-full bg-azul-claro px-3 text-sm font-semibold text-azul-ink">
              <AppIcon name="user-group" /> Las dos
            </span>
            <button
              type="button"
              aria-label="¿Qué es cada cosa?"
              className="grid h-11 w-11 place-items-center rounded-full bg-card text-tinta shadow-soft"
              onClick={() => undefined}
            >
              <AppIcon name="circle-question" className="text-lg" />
            </button>
          </>
        }
      />

      <div className="mb-4">
        <h1 className="font-display text-[2.125rem] font-semibold leading-none">Recetas</h1>
        {!loading && countLabel ? (
          <p className="mt-1 text-sm font-semibold text-muted">{countLabel}</p>
        ) : null}
      </div>

      {!online ? (
        <p role="status" className="mb-3 rounded-2xl bg-rosa-claro px-3 py-3 text-sm font-semibold">
          Estás sin conexión. Para armar o cambiar recetas hace falta internet.
        </p>
      ) : null}

      {loading ? (
        <p className="py-6 text-center text-sm font-semibold text-muted" role="status">
          Cargando las recetas…
        </p>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-4 text-center">
          <p className="font-semibold" role="alert">
            No pudimos traer las recetas. Revisá la conexión y probá de nuevo.
          </p>
          <Button className="mt-3" variant="alt" onClick={() => void reload()}>
            Probar de nuevo
          </Button>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-8 text-center">
          <Sprout module="comidas" size={72} />
          <p className="mt-3 font-display text-lg font-semibold">Todavía no armaste recetas.</p>
          <p className="mt-1 max-w-xs text-sm font-semibold text-muted">
            Armá una vez tus platos de siempre, con sus ingredientes, y después los anotás por porción.
          </p>
          <Link
            to={MEAL_ROUTES.recetaNueva}
            className={`mt-4 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-[1.5px] border-tinta bg-mostaza px-5 text-lg font-semibold text-tinta ${
              !online ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-disabled={!online || undefined}
          >
            <AppIcon name="plus" /> Armar una receta
          </Link>
        </div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <ul className="space-y-3">
            {rows.map(({ recipe, meta, proteinG, kcal, incomplete }) => (
              <li key={recipe.id}>
                <Link
                  to={`${MEAL_ROUTES.recetas}/${recipe.id}`}
                  aria-label={`${recipe.name}. ${meta}. Por porción, ${
                    proteinG == null ? 'sin proteína' : `${formatAmount(proteinG)} gramos de proteína`
                  }${kcal != null ? ` y ${formatAmount(kcal)} calorías` : ''}. Ver o cambiar`}
                  aria-disabled={!online || undefined}
                  className={`block rounded-2xl border-2 border-azul-ink bg-card px-4 py-3.5 ${
                    !online ? 'pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`font-display text-lg font-semibold leading-tight ${
                          online ? 'text-tinta' : 'text-gris'
                        }`}
                      >
                        {recipe.name}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-muted">{meta}</p>
                    </div>
                    <AppIcon name="chevron-right" className="mt-1 shrink-0 text-tinta" />
                  </div>
                  <div className="mt-2 border-t border-dashed border-line pt-2">
                    <p className="text-sm font-semibold text-muted">Por porción</p>
                    <p className="mt-0.5">
                      <span className="font-display text-lg font-semibold">
                        {proteinG == null ? 'Sin proteína' : `${formatAmount(proteinG)} g de proteína`}
                      </span>
                      {kcal != null ? (
                        <span className="ml-2 text-sm font-semibold text-muted">
                          {formatAmount(kcal)} calorías
                        </span>
                      ) : null}
                    </p>
                    {incomplete ? (
                      <p className="mt-1 inline-flex items-start gap-1.5 text-sm font-semibold text-muted">
                        <AppIcon name="circle-exclamation" className="mt-0.5 shrink-0" />
                        {incomplete}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 text-sm font-semibold text-muted">
            <p>Las ven y las usan las dos. Lo que cada una anota en su día es solo suyo.</p>
            <p>Para anotar una, tocá + en Día y buscala por su nombre.</p>
          </div>
        </>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <FabSpace />
          {online ? (
            <Fab to={MEAL_ROUTES.recetaNueva} label="Nueva receta" />
          ) : (
            <button
              type="button"
              disabled
              aria-label="Nueva receta"
              aria-disabled="true"
              className="fixed right-[max(16px,calc((100vw-var(--ancho-columna))/2+16px))] z-30 grid h-[var(--alto-fab)] w-[var(--alto-fab)] place-items-center rounded-full border-[1.5px] border-tinta bg-mostaza text-lg text-tinta opacity-50 bottom-[calc(var(--espacio-fab-abajo)+env(safe-area-inset-bottom))]"
            >
              <AppIcon name="plus" className="text-xl" />
            </button>
          )}
        </>
      ) : null}

      {toast ? (
        <Toast aboveFab onUndo={toast.undo} onDone={() => setToast(null)}>
          {toast.message}
        </Toast>
      ) : null}
    </>
  )
}
