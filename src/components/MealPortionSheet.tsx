import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { CompositionBar, CompositionLegendShort } from './CompositionBar.tsx'
import { ModuleSwitch } from './ModuleSwitch.tsx'
import { Sheet } from './Sheet.tsx'
import { Button, Chip, inputClass } from './ui.tsx'
import {
  MEAL_LABEL,
  compositionPhrase,
  compositionShares,
  formatAmount,
  formatPortionQty,
  parseMacro,
  roundMacro,
  scaleByQuantity,
  scalePer100,
  stepQuantity,
  type FoodPortion,
  type FoodSource,
  type MealType,
} from '../lib/meals.ts'

export type PortionDraft = {
  name: string
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  kcal: number | null
  portionLabel: string | null
  portionQty: number | null
  portionGrams: number | null
  foodSource: FoodSource | null
  foodRef: string | null
  brand: string | null
  originLabel: string
  attribution: string | null
  portions: FoodPortion[]
  per100: { protein: number | null; carbs: number | null; fat: number | null; kcal: number | null } | null
  savedInMine: boolean
  missing?: Array<'proteína' | 'hidratos' | 'grasas'>
}

export function MealPortionSheet({
  open,
  mode,
  mealType,
  draft,
  onClose,
  onSave,
  onRemove,
  onRemoveFromSaved,
}: {
  open: boolean
  mode: 'add' | 'edit' | 'saved'
  mealType: MealType
  draft: PortionDraft
  onClose: () => void
  onSave: (draft: PortionDraft, saveInMine: boolean) => Promise<void>
  onRemove?: () => void
  onRemoveFromSaved?: () => Promise<void>
}) {
  const gramsOnly = draft.portions.length === 0
  const [portionIndex, setPortionIndex] = useState(0)
  const [useGrams, setUseGrams] = useState(gramsOnly)
  const [qty, setQty] = useState(1)
  const [grams, setGrams] = useState(100)
  const [saveInMine, setSaveInMine] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [proteinFill, setProteinFill] = useState('')
  const [carbsFill, setCarbsFill] = useState('')
  const [fatFill, setFatFill] = useState('')

  useEffect(() => {
    if (!open) return
    const suggested = Math.max(
      0,
      draft.portions.findIndex((portion) => portion.suggested) >= 0
        ? draft.portions.findIndex((portion) => portion.suggested)
        : 0,
    )
    const match = draft.portionLabel
      ? draft.portions.findIndex((portion) => portion.label === draft.portionLabel)
      : -1
    setPortionIndex(match >= 0 ? match : suggested)
    setUseGrams(gramsOnly || draft.portionLabel === 'Gramos')
    setQty(draft.portionQty && draft.portionQty > 0 ? draft.portionQty : 1)
    setGrams(draft.portionGrams && draft.portionGrams > 0 ? draft.portionGrams : draft.portions[0]?.grams ?? 100)
    setSaveInMine(draft.savedInMine)
    setProteinFill(draft.proteinG == null ? '' : String(draft.proteinG))
    setCarbsFill(draft.carbsG == null ? '' : String(draft.carbsG))
    setFatFill(draft.fatG == null ? '' : String(draft.fatG))
    setError('')
    setPending(false)
  }, [open, draft, gramsOnly])

  const selectedPortion = draft.portions[portionIndex] ?? null

  const filledPer100 = useMemo(() => {
    if (!draft.per100) return null
    return {
      protein: parseMacro(proteinFill) ?? draft.per100.protein,
      carbs: parseMacro(carbsFill) ?? draft.per100.carbs,
      fat: parseMacro(fatFill) ?? draft.per100.fat,
      kcal: draft.per100.kcal,
    }
  }, [draft.per100, proteinFill, carbsFill, fatFill])

  const macros = useMemo(() => {
    if (useGrams || gramsOnly) {
      if (filledPer100) return scalePer100(filledPer100, grams)
      if (draft.per100) return scalePer100(draft.per100, grams)
      return scaleByQuantity(
        {
          proteinG: draft.proteinG,
          carbsG: draft.carbsG,
          fatG: draft.fatG,
          kcal: draft.kcal,
        },
        grams / Math.max(1, draft.portionGrams ?? 100),
      )
    }
    if (filledPer100 && selectedPortion) return scaleByQuantity(scalePer100(filledPer100, selectedPortion.grams), qty)
    if (draft.per100 && selectedPortion) return scaleByQuantity(scalePer100(draft.per100, selectedPortion.grams), qty)
    return scaleByQuantity(
      {
        proteinG: draft.proteinG,
        carbsG: draft.carbsG,
        fatG: draft.fatG,
        kcal: draft.kcal,
      },
      qty / Math.max(0.5, draft.portionQty ?? 1),
    )
  }, [useGrams, gramsOnly, filledPer100, draft, grams, selectedPortion, qty])

  const totalGrams = useGrams || gramsOnly ? grams : roundMacro((selectedPortion?.grams ?? 0) * qty)
  const shares = compositionShares([macros])
  const phrase = compositionPhrase(shares)
  const missing = draft.missing ?? []
  const incomplete = missing.length > 0 && (macros.proteinG == null || macros.carbsG == null || macros.fatG == null)

  async function save() {
    setPending(true)
    setError('')
    try {
      const next: PortionDraft = {
        ...draft,
        proteinG: macros.proteinG,
        carbsG: macros.carbsG,
        fatG: macros.fatG,
        kcal: macros.kcal,
        portionLabel: useGrams || gramsOnly ? 'Gramos' : selectedPortion?.label ?? draft.portionLabel,
        portionQty: useGrams || gramsOnly ? 1 : qty,
        portionGrams: totalGrams,
      }
      await onSave(next, saveInMine)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar. Probá de nuevo.')
    } finally {
      setPending(false)
    }
  }

  const titleExtra =
    mode === 'edit' ? `En el ${MEAL_LABEL[mealType].toLowerCase()} · ${draft.originLabel}` : draft.originLabel

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
          {mode === 'saved' && onRemoveFromSaved ? (
            <button
              type="button"
              onClick={() => void onRemoveFromSaved()}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-mostaza-ink"
            >
              <AppIcon name="trash-can" /> Quitar de mis alimentos
            </button>
          ) : null}
          <Button disabled={pending} onClick={() => void save()}>
            {mode === 'edit' ? 'Guardar cambios' : `Agregar al ${MEAL_LABEL[mealType].toLowerCase()}`}
          </Button>
        </div>
      }
    >
      <p className="text-sm font-semibold text-muted">{titleExtra}</p>
      {draft.attribution ? <p className="mb-3 text-sm font-semibold text-muted">{draft.attribution}</p> : <div className="mb-3" />}

      {missing.length > 0 ? (
        <div className="mb-3 rounded-2xl bg-rosa-claro px-3 py-3 text-sm font-semibold">
          <p className="inline-flex items-start gap-2">
            <AppIcon name="circle-exclamation" className="mt-0.5 shrink-0" />
            <span>
              En Open Food Facts este producto no dice {missing.length === 1 ? `cuánta ${missing[0]}` : `cuánta ${missing.slice(0, -1).join(', ')} ni cuánta ${missing.at(-1)}`} tiene.
              {draft.per100?.carbs != null || draft.kcal != null
                ? ' Sí dice los hidratos y las calorías.'
                : ''}
            </span>
          </p>
          <p className="mt-2">Si tenés el paquete, copiá lo que dice la tabla «cada 100 g»:</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="text-sm font-bold">
              Proteína
              <input value={proteinFill} onChange={(e) => setProteinFill(e.target.value)} inputMode="decimal" placeholder="—" className={`${inputClass} mt-1`} />
            </label>
            <label className="text-sm font-bold">
              Hidratos
              <input value={carbsFill} onChange={(e) => setCarbsFill(e.target.value)} inputMode="decimal" placeholder="—" className={`${inputClass} mt-1`} />
            </label>
            <label className="text-sm font-bold">
              Grasas
              <input value={fatFill} onChange={(e) => setFatFill(e.target.value)} inputMode="decimal" placeholder="—" className={`${inputClass} mt-1`} />
            </label>
          </div>
        </div>
      ) : null}

      <p className="mb-2 text-sm font-bold text-muted">¿Cuánto comiste?</p>
      {gramsOnly ? (
        <>
          <p className="mb-2 text-sm font-semibold text-muted">
            Este producto no trae porciones caseras. Si no lo pesaste, el paquete suele decir cuánto pesa cada unidad.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {[50, 100, 150].map((value) => (
              <Chip key={value} active={grams === value} onClick={() => setGrams(value)}>
                {value} g
              </Chip>
            ))}
          </div>
        </>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2">
          {draft.portions.map((portion, index) => (
            <Chip
              key={portion.label}
              active={!useGrams && portionIndex === index}
              onClick={() => {
                setUseGrams(false)
                setPortionIndex(index)
              }}
            >
              {!useGrams && portionIndex === index ? '✓ ' : ''}
              {portion.label} · {formatAmount(portion.grams)} g
            </Chip>
          ))}
          <Chip
            active={useGrams}
            onClick={() => {
              setUseGrams(true)
              setGrams(selectedPortion?.grams ?? 100)
            }}
          >
            Gramos
          </Chip>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Menos"
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink bg-card"
          onClick={() => {
            if (useGrams || gramsOnly) setGrams((current) => stepQuantity(current, -10, 'grams'))
            else setQty((current) => stepQuantity(current, -0.5, 'portion'))
          }}
        >
          <AppIcon name="minus" />
        </button>
        <input
          value={useGrams || gramsOnly ? String(grams) : formatPortionQty(qty)}
          onChange={(event) => {
            const parsed = parseMacro(event.target.value)
            if (parsed == null) return
            if (useGrams || gramsOnly) setGrams(Math.max(1, roundMacro(parsed)))
            else setQty(Math.max(0.5, Math.round(parsed * 2) / 2))
          }}
          inputMode="decimal"
          className={`${inputClass} w-[84px] text-center`}
        />
        <button
          type="button"
          aria-label="Más"
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-azul-ink bg-card"
          onClick={() => {
            if (useGrams || gramsOnly) setGrams((current) => stepQuantity(current, 10, 'grams'))
            else setQty((current) => stepQuantity(current, 0.5, 'portion'))
          }}
        >
          <AppIcon name="plus" />
        </button>
        <span className="text-sm font-bold">= {formatAmount(totalGrams)} g</span>
      </div>

      <div className="mb-4 rounded-2xl bg-mostaza-claro/60 px-3 py-3">
        {incomplete || !shares ? (
          <>
            <p className="font-display text-lg font-semibold">Esto suma, con lo que hay</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm font-semibold">
              <span>Proteína {macros.proteinG == null ? 'sin dato' : `${formatAmount(macros.proteinG)} g`}</span>
              <span>Hidratos {macros.carbsG == null ? 'sin dato' : `${formatAmount(macros.carbsG)} g`}</span>
              <span>Grasas {macros.fatG == null ? 'sin dato' : `${formatAmount(macros.fatG)} g`}</span>
            </div>
            {macros.kcal != null ? (
              <p className="mt-2 text-sm font-semibold text-muted">
                {formatAmount(macros.kcal)} calorías según el paquete. Sin la proteína y las grasas no se puede mostrar de qué
                está hecho, y no suma en el día.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="font-display text-lg font-semibold">{phrase}</p>
            <CompositionBar shares={shares} scope="esta porción" className="mt-2" />
            <CompositionLegendShort shares={shares} />
            <p className="mt-2 text-sm font-semibold">{formatAmount(shares.kcal)} calorías</p>
          </>
        )}
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-base font-semibold">
          {saveInMine && mode === 'saved' ? 'Guardado en mis alimentos' : 'Guardar en mis alimentos'}
        </span>
        <ModuleSwitch
          on={saveInMine}
          label="Guardar en mis alimentos"
          onToggle={() => setSaveInMine((current) => !current)}
        />
      </div>
    </Sheet>
  )
}
