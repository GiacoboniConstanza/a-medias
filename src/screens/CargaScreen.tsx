import { useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { FixedExpenseCreatePanel } from '../components/FixedExpenseCreatePanel.tsx'
import { MovementForm, type MovementPrefill, type MovementType } from '../components/MovementForm.tsx'
import { PlanItemCreatePanel } from '../components/PlanItemCreatePanel.tsx'
import {
  CARGA_GRUPOS,
  CARGA_TIPOS,
  TOAST_GUARDADO,
  afterSavePath,
  cargaPath,
  isMovementCargaTipo,
  parseCargaTipo,
  readLastCargaTipo,
  rememberCargaTipo,
  shouldSkipStep1,
  step2Title,
  type CargaTipo,
} from '../lib/carga.ts'

export type CargaLocationState = {
  tipo?: string
  from?: string
  savingId?: string
  planItemId?: string
  amount?: number
  title?: string
  notes?: string | null
  isShared?: boolean
  categoryId?: string | null
  savingKind?: 'aporte' | 'retiro'
  skipStep1?: boolean
  /** Tras «Cargar otro» se queda en el mismo tipo. */
  repeat?: boolean
}

function prefillFromState(state: CargaLocationState | null): MovementPrefill | undefined {
  if (!state) return undefined
  if (state.planItemId) {
    return {
      tipo: 'gasto',
      planItemId: state.planItemId,
      amount: state.amount,
      title: state.title,
      notes: state.notes,
      isShared: state.isShared,
      categoryId: state.categoryId,
    }
  }
  const tipo = parseCargaTipo(state.tipo)
  if (state.savingId || (tipo && isMovementCargaTipo(tipo))) {
    return {
      tipo: (tipo && isMovementCargaTipo(tipo) ? tipo : undefined) as MovementType | undefined,
      savingId: state.savingId,
      savingKind: state.savingKind,
      amount: state.amount,
      title: state.title,
      notes: state.notes,
      isShared: state.isShared,
      categoryId: state.categoryId,
    }
  }
  return undefined
}

function stateFromPrefill(prefill: MovementPrefill | undefined): CargaLocationState | null {
  if (!prefill) return null
  return {
    tipo: prefill.tipo,
    savingId: prefill.savingId ?? undefined,
    planItemId: prefill.planItemId ?? undefined,
    amount: prefill.amount ?? undefined,
    title: prefill.title ?? undefined,
    notes: prefill.notes,
    isShared: prefill.isShared,
    categoryId: prefill.categoryId,
    savingKind: prefill.savingKind,
    skipStep1: true,
  }
}

/** Paso 1: elegir tipo. Paso 2: formulario en /cargar/:tipo. */
export function CargaScreen({
  prefillOverride,
  onCancel,
  onDone,
}: {
  prefillOverride?: MovementPrefill
  onCancel?: () => void
  onDone?: () => void
} = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { tipo: tipoParam } = useParams<{ tipo?: string }>()
  const state = useMemo(() => {
    const fromLocation = (location.state as CargaLocationState | null) ?? null
    const fromPrefill = stateFromPrefill(prefillOverride)
    return fromPrefill ? { ...fromLocation, ...fromPrefill } : fromLocation
  }, [location.state, prefillOverride])

  const tipoFromUrl = parseCargaTipo(tipoParam)
  const impliedTipo = useMemo<CargaTipo | null>(() => {
    if (tipoFromUrl) return tipoFromUrl
    const fromState = parseCargaTipo(state?.tipo)
    if (fromState) return fromState
    if (state?.planItemId || prefillOverride?.planItemId) return 'gasto'
    if (state?.savingId || prefillOverride?.savingId) return 'ahorro'
    return null
  }, [tipoFromUrl, state, prefillOverride])

  const skip = shouldSkipStep1({
    tipo: impliedTipo,
    from: state?.from,
    planItemId: state?.planItemId ?? prefillOverride?.planItemId,
    savingId: state?.savingId ?? prefillOverride?.savingId,
    skipStep1: state?.skipStep1 || Boolean(prefillOverride),
  })

  // /cargar sin tipo + origen que implica tipo → ir directo al paso 2 (reemplaza history).
  if (!tipoFromUrl && impliedTipo && skip) {
    return <Navigate to={cargaPath(impliedTipo)} replace state={{ ...state, tipo: impliedTipo, skipStep1: true }} />
  }

  if (!tipoFromUrl) {
    return (
      <CargaStep1
        onBack={() => {
          if (onCancel) onCancel()
          else if (state?.from) navigate(state.from)
          else navigate(-1)
        }}
        onPick={(tipo) => {
          navigate(cargaPath(tipo), { state: { ...state, tipo } })
        }}
      />
    )
  }

  if (!impliedTipo) {
    return <Navigate to="/cargar" replace state={state} />
  }

  return (
    <CargaStep2
      tipo={impliedTipo}
      state={state}
      skipStep1={skip}
      prefill={prefillOverride ?? prefillFromState(state)}
      onCancel={onCancel}
      onDone={onDone}
    />
  )
}

function CargaStep1({
  onBack,
  onPick,
}: {
  onBack: () => void
  onPick: (tipo: CargaTipo) => void
}) {
  const last = readLastCargaTipo()

  return (
    <div className="min-h-dvh bg-crema">
      <section className="scallop-b bg-azul px-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Volver"
            className="-ml-3 inline-flex min-h-12 min-w-11 items-center justify-center text-tinta"
            onClick={onBack}
          >
            <AppIcon name="chevron-left" />
          </button>
          <p className="text-sm font-semibold text-tinta">1 de 2</p>
        </div>
        <h1 className="font-display text-[34px] font-semibold text-tinta">Cargar</h1>
      </section>

      <div className="space-y-6 px-4 pb-10 pt-[calc(var(--feston-alto)+1rem)]">
        {CARGA_GRUPOS.map((grupo) => {
          const items = CARGA_TIPOS.filter((tipo) => tipo.group === grupo.id)
          return (
            <section key={grupo.id}>
              <h2 className="mb-2 text-sm font-semibold text-gris">{grupo.title}</h2>
              <div className="grid grid-cols-2 items-start gap-2">
                {items.map((option) => {
                  const isLast = last === option.id
                  const half = grupo.id === 'adelante'
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`flex min-h-16 items-start gap-2 rounded-2xl border-[1.5px] border-azul-ink bg-tarjeta px-2.5 py-2.5 text-left ${
                        half ? 'col-span-1' : ''
                      }`}
                      onClick={() => onPick(option.id)}
                    >
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${option.ring} ${option.soft} ${option.ink}`}
                      >
                        <AppIcon name={option.icon} className="text-[15px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-tinta">{option.label}</span>
                          {isLast ? (
                            <span className="rounded-full bg-azul-claro px-1.5 py-0.5 text-[11px] font-semibold text-azul-ink">
                              Último
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-sm font-medium text-gris">{option.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function CargaStep2({
  tipo,
  state,
  skipStep1,
  prefill,
  onCancel,
  onDone,
}: {
  tipo: CargaTipo
  state: CargaLocationState | null
  skipStep1: boolean
  prefill?: MovementPrefill
  onCancel?: () => void
  onDone?: () => void
}) {
  const navigate = useNavigate()
  const stepBadge = skipStep1 ? null : '2 de 2'
  const title = step2Title(tipo)
  const fromPath = state?.from

  function back() {
    if (onCancel) {
      onCancel()
      return
    }
    if (skipStep1) {
      if (fromPath) navigate(fromPath)
      else navigate(-1)
      return
    }
    navigate('/cargar', { state })
  }

  async function afterNonMovementSaved() {
    rememberCargaTipo(tipo)
    await onDone?.()
    const path = afterSavePath(tipo)
    navigate(path, { replace: true, state: { toast: TOAST_GUARDADO } })
  }

  if (isMovementCargaTipo(tipo)) {
    return (
      <MovementForm
        key={tipo}
        prefill={prefill}
        lockedTipo={tipo}
        hideTypeSelector
        titleOverride={title}
        stepBadge={stepBadge}
        onClose={back}
        onDone={async () => {
          rememberCargaTipo(tipo)
          await onDone?.()
        }}
      />
    )
  }

  if (tipo === 'fijo' || tipo === 'cuotas') {
    return (
      <FixedExpenseCreatePanel
        key={tipo}
        kind={tipo === 'cuotas' ? 'installments' : 'fixed'}
        title={title}
        stepBadge={stepBadge}
        onBack={back}
        onSaved={afterNonMovementSaved}
      />
    )
  }

  return (
    <PlanItemCreatePanel
      title={title}
      stepBadge={stepBadge}
      onBack={back}
      onSaved={afterNonMovementSaved}
    />
  )
}

/** Atajo tipado para navegar al paso 2 desde otras pantallas. */
export function linkToCarga(tipo: CargaTipo, state?: CargaLocationState) {
  return { to: cargaPath(tipo), state: { ...state, tipo, skipStep1: state?.skipStep1 } }
}
