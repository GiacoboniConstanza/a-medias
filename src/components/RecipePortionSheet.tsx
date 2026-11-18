import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AppIcon } from './AppIcon.tsx'
import { CompositionBar, CompositionLegendShort } from './CompositionBar.tsx'
import { Sheet } from './Sheet.tsx'
import { Button, inputClass } from './ui.tsx'
import {
  MEAL_LABEL,
  compositionPhrase,
  compositionShares,
  formatAmount,
  parseMacro,
  type MealType,
} from '../lib/meals.ts'
import { MEAL_ROUTES } from '../lib/modules.ts'
import {
  formatRecipePortionsLabel,
  incompleteNote,
  macrosForPortions,
  macrosPerServing,
  rescaleLoggedRecipe,
  stepRecipePortions,
  type RecipeIngredientInput,
} from '../lib/recipes.ts'

export type RecipePortionDraft = {
  recipeId: string | null
  name: string
  servings: number
  ingredients: RecipeIngredientInput[]
  /** Si viene de una meal ya anotada, macros totales de esa fila. */
  logged?: {
    proteinG: number | null
    carbsG: number | null
    fatG: number | null
    kcal: number | null
    portionQty: number
  } | null
  recipeStillExists: boolean
}

export function RecipePortionSheet({
  open,
  mode,
  mealType,
  draft,
  initialQty = 1,
  onClose,
  onSave,
  onRemove,
}: {
  open: boolean
  mode: 'add' | 'edit'
  mealType: MealType
  draft: RecipePortionDraft
  initialQty?: number
  onClose: () => void
  onSave: (qty: number, macros: ReturnType<typeof macrosForPortions>) => Promise<void>
  onRemove?: () => void
}) {
  const [qty, setQty] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setQty(Math.max(0.5, initialQty))
    setPending(false)
    setError('')
  }, [open, initialQty, draft.recipeId, draft.name])

  const macros = useMemo(() => {
    if (draft.logged) {
      return rescaleLoggedRecipe(
        {
          proteinG: draft.logged.proteinG,
          carbsG: draft.logged.carbsG,
          fatG: draft.logged.fatG,
          kcal: draft.logged.kcal,
          portionQty: draft.logged.portionQty,
        },
        qty,
      )
    }
    return macrosForPortions(draft.ingredients, draft.servings, qty)
  }, [draft, qty])

  const perServing = useMemo(() => {
    if (draft.logged) {
      return rescaleLoggedRecipe(
        {
          proteinG: draft.logged.proteinG,
          carbsG: draft.logged.carbsG,
          fatG: draft.logged.fatG,
          kcal: draft.logged.kcal,
          portionQty: draft.logged.portionQty,
        },
        1,
      )
    }
    return macrosPerServing(draft.ingredients, draft.servings)
  }, [draft])

  const shares = useMemo(() => compositionShares([macros]), [macros])
  const phrase = compositionPhrase(shares)
  const incomplete = draft.logged
    ? 0
    : macrosPerServing(draft.ingredients, draft.servings).incompleteCount
  const note = incompleteNote(incomplete)

  const subtitle =
    mode === 'edit'
      ? `En el ${MEAL_LABEL[mealType].toLowerCase()} · receta de las dos`
      : `Receta de las dos · rinde ${draft.servings} ${draft.servings === 1 ? 'porción' : 'porciones'}`

  async function save() {
    setPending(true)
    setError('')
    try {
      await onSave(qty, macros)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar. Probá de nuevo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet
      open={open}
      title={draft.name}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {error ? (
            <p role="alert" className="text-center text-sm font-bold text-tinta">
              {error}
            </p>
          ) : null}
          {mode === 'edit' && onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-mostaza-ink"
            >
              <AppIcon name="trash-can" /> Quitar del {MEAL_LABEL[mealType].toLowerCase()}
            </button>
          ) : null}
          <Button disabled={pending} onClick={() => void save()}>
            {mode === 'edit'
              ? 'Guardar cambios'
              : `Agregar al ${MEAL_LABEL[mealType].toLowerCase()}`}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm font-semibold text-muted">{subtitle}</p>

      <p className="mb-2 text-sm font-bold text-muted">¿Cuántas porciones comiste?</p>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="Media porción menos"
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink bg-card"
          onClick={() => setQty((current) => stepRecipePortions(current, -0.5))}
        >
          <AppIcon name="minus" />
        </button>
        <input
          value={String(qty).replace('.', ',')}
          onChange={(event) => {
            const parsed = parseMacro(event.target.value)
            if (parsed == null) return
            setQty(Math.max(0.5, Math.round(parsed * 2) / 2))
          }}
          inputMode="decimal"
          className={`${inputClass} w-[84px] text-center`}
        />
        <button
          type="button"
          aria-label="Media porción más"
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink bg-card"
          onClick={() => setQty((current) => stepRecipePortions(current, 0.5))}
        >
          <AppIcon name="plus" />
        </button>
        <span className="text-sm font-bold">porciones</span>
      </div>
      <p className="mb-4 text-sm font-semibold text-muted">Con − y + sumás o restás media porción.</p>

      <div className="mb-4 rounded-2xl bg-mostaza-claro/60 px-3 py-3">
        <p className="text-sm font-bold text-muted">Esto suma</p>
        {shares ? (
          <>
            <p className="mt-1 font-display text-lg font-semibold">{phrase}</p>
            <CompositionBar shares={shares} scope="estas porciones" className="mt-2" />
            <CompositionLegendShort shares={shares} />
            <p className="mt-2 text-sm font-semibold">{formatAmount(shares.kcal)} calorías</p>
          </>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm font-semibold">
            <span>Proteína {macros.proteinG == null ? 'sin dato' : `${formatAmount(macros.proteinG)} g`}</span>
            <span>Hidratos {macros.carbsG == null ? 'sin dato' : `${formatAmount(macros.carbsG)} g`}</span>
            <span>Grasas {macros.fatG == null ? 'sin dato' : `${formatAmount(macros.fatG)} g`}</span>
          </div>
        )}
        {note ? (
          <p className="mt-2 inline-flex items-start gap-2 text-sm font-semibold text-muted">
            <AppIcon name="circle-exclamation" className="mt-0.5 shrink-0" />
            {note}
          </p>
        ) : null}
      </div>

      {draft.recipeStillExists && draft.recipeId ? (
        <Link
          to={`${MEAL_ROUTES.recetas}/${draft.recipeId}`}
          state={{ returnToAdd: true }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mostaza-ink"
        >
          <AppIcon name="pen" /> Ver o cambiar la receta
        </Link>
      ) : null}

      <p className="sr-only">
        {formatRecipePortionsLabel(qty)}. Por porción de referencia:{' '}
        {perServing.proteinG == null ? 'sin proteína' : `${formatAmount(perServing.proteinG)} g de proteína`}.
      </p>
    </Sheet>
  )
}
