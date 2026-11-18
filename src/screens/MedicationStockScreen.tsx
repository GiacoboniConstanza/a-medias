import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Sprout } from '../components/Sprout.tsx'
import { Button, Card, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import {
  addMedicationStock,
  adjustMedicationStock,
  loadMedicationPeriods,
  loadMedications,
  loadMedicationSchedules,
  type MedicationPeriodRow,
  type MedicationRow,
  type MedicationScheduleRow,
} from '../lib/api.ts'
import { argentinaISO } from '../lib/meals.ts'
import {
  currentPeriod,
  estimateStock,
  formatStockDate,
  isTreatmentInCourse,
  isTreatmentUpcoming,
  sortStockCards,
  stockHeaderSummary,
  type StockCardModel,
} from '../lib/medications.ts'

function subtitleFor(card: StockCardModel): string {
  const parts: string[] = []
  if (card.medication.doseNotes) parts.push(card.medication.doseNotes)
  const tomas = card.scheduleCount === 1 ? '1 toma/día' : `${card.scheduleCount} tomas/día`
  parts.push(tomas)
  if (card.medication.unitsPerDose > 1) parts.push(`${card.medication.unitsPerDose} por toma`)
  return parts.join(' · ')
}

function estimateLine(card: StockCardModel): string {
  if (card.medication.stockQty == null) return 'Sin stock registrado'
  if (card.estimate.outOfStock) return 'Se terminó. Reponé cuando compres.'
  if (card.estimate.reachesUntilEnd) return 'Te alcanza hasta el final del tratamiento'
  if (card.estimate.estimatedOn) return `Se termina aprox. el ${formatStockDate(card.estimate.estimatedOn)}`
  return 'Sin stock registrado'
}

export function MedicationStockScreen() {
  const { profile } = useAuth()
  const today = argentinaISO()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [medications, setMedications] = useState<MedicationRow[]>([])
  const [periods, setPeriods] = useState<MedicationPeriodRow[]>([])
  const [schedules, setSchedules] = useState<MedicationScheduleRow[]>([])
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)
  const [reponer, setReponer] = useState<StockCardModel | null>(null)

  const reload = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    try {
      const [meds, pers, scheds] = await Promise.all([
        loadMedications(profile.id),
        loadMedicationPeriods(profile.id),
        loadMedicationSchedules(profile.id),
      ])
      setMedications(meds)
      setPeriods(pers)
      setSchedules(scheds)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude traer tu stock.')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void reload()
  }, [reload])

  const cards = useMemo(() => {
    const list: StockCardModel[] = []
    for (const med of medications) {
      const inCourse = isTreatmentInCourse(med, periods)
      const upcoming = isTreatmentUpcoming(med, periods)
      if (!inCourse && !upcoming) continue
      const open = currentPeriod(periods, med.id)
      const future = periods
        .filter((row) => row.medicationId === med.id && row.startsOn > today && !row.endedAt)
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0]
      const startsOn = open?.startsOn ?? future?.startsOn ?? null
      const endsOn = open?.endsOn ?? future?.endsOn ?? null
      const scheduleCount = schedules.filter((row) => row.medicationId === med.id).length
      list.push({
        medication: med,
        scheduleCount,
        startsOn,
        endsOn,
        upcoming: upcoming && !inCourse,
        estimate: estimateStock(med.stockQty, scheduleCount, med.unitsPerDose, today, startsOn, endsOn),
      })
    }
    return sortStockCards(list)
  }, [medications, periods, schedules, today])

  const summary = stockHeaderSummary(cards)
  const hasAnyMeds = medications.length > 0

  return (
    <>
      <section className="scallop-b -mx-4 mb-4 bg-azul px-4 pb-4 pt-2 text-tinta">
        <SectionHeader
          lead="crumb"
          module="medicamentos"
          aside={
            <NotificationBell
              to="/notificaciones?desde=medicamentos"
              label="Notificaciones de Medicamentos"
              showCount={false}
            />
          }
        />
        <div className="mt-1 flex items-start justify-between gap-2">
          <h1 className="font-display text-[34px] font-semibold text-tinta">Stock</h1>
          <span className="inline-flex items-center gap-1 rounded-2xl bg-ciruela-claro px-3 py-1.5 text-sm font-semibold text-tinta">
            <AppIcon name="lock" /> Solo vos
          </span>
        </div>
        {summary ? <p className="mt-2 text-sm font-bold text-tinta">{summary}</p> : null}
      </section>

      {loading ? <p className="py-6 text-center font-semibold text-muted">Cargando tu stock…</p> : null}

      {!loading && error ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-4 text-center">
          <p className="font-semibold" role="alert">
            <AppIcon name="circle-exclamation" className="mr-1" />
            No pude traer tu stock. Revisá la conexión.
          </p>
          <Button className="mt-3" variant="alt" onClick={() => void reload()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!loading && !error && !hasAnyMeds ? (
        <div className="mb-3 flex flex-col items-center py-8 text-center">
          <Sprout module="medicamentos" />
          <p className="mt-3 font-display text-xl font-semibold">Todavía no cargaste medicamentos.</p>
          <p className="mt-2 text-sm font-semibold text-muted">Cuando sumes uno, acá ves cuánto te queda.</p>
          <Link to="/medicamentos/agregar?from=/medicamentos/stock" className="mt-4">
            <Button tall>Agregar un medicamento</Button>
          </Link>
        </div>
      ) : null}

      {!loading && !error && hasAnyMeds && cards.length === 0 ? (
        <div className="rounded-2xl border-2 border-azul-ink bg-card p-4 text-center">
          <p className="font-semibold">No tenés medicamentos en curso ni por empezar. Los archivados no aparecen acá.</p>
          <Link to="/medicamentos/tratamientos" className="mt-3 inline-flex min-h-11 items-center font-semibold">
            Tus tratamientos
          </Link>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-3 pb-[173px]">
          {cards.map((card) => {
            const low = card.medication.stockQty != null && card.estimate.lowStock
            const registered = card.medication.stockQty != null
            const qty = card.medication.stockQty
            const aria = registered
              ? `${card.medication.name}: ${
                  qty === 1 ? 'queda 1 unidad' : `quedan ${qty} unidades`
                }, ${estimateLine(card)}${low ? ', stock bajo' : ''}`
              : `${card.medication.name}: sin stock registrado`
            return (
              <Card
                key={card.medication.id}
                className={`relative ${low ? '!border-tinta' : ''}`}
              >
                <div aria-label={aria}>
                {low ? (
                  <span className="absolute right-3 top-3 inline-flex h-[27px] items-center gap-1 rounded-full border-2 border-tinta bg-mostaza-claro px-2 text-sm font-semibold text-tinta">
                    <AppIcon name="triangle-exclamation" />
                    {card.estimate.outOfStock ? 'Sin unidades' : 'Stock bajo'}
                  </span>
                ) : null}
                <p className="font-display text-lg font-semibold pr-28">{card.medication.name}</p>
                <p className="text-sm font-semibold text-muted">{subtitleFor(card)}</p>
                {card.upcoming && card.startsOn ? (
                  <p className="mt-1 text-sm font-semibold text-muted">
                    Empieza el {formatLongDay(card.startsOn)}.
                  </p>
                ) : null}
                <div className="my-3 border-t border-dashed border-azul-ink/40" />
                {registered ? (
                  <>
                    <p className="text-sm font-bold">
                      {qty === 1 ? 'Queda' : 'Quedan'}{' '}
                      <span className="font-display text-[34px] font-semibold leading-none">{qty}</span>{' '}
                      <span className="font-display text-lg font-semibold">
                        {qty === 1 ? 'unidad' : 'unidades'}
                      </span>
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {estimateLine(card)}
                      {card.estimate.reachesUntilEnd && card.endsOn ? (
                        <span className="mt-1 block font-semibold text-muted">
                          Termina el {formatLongDay(card.endsOn)}.
                        </span>
                      ) : null}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-lg font-semibold text-muted">Sin stock registrado</p>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      Cargá cuántas tenés y te digo hasta cuándo te alcanza.
                    </p>
                  </>
                )}
                <Button
                  className="mt-3 w-full"
                  variant="alt"
                  onClick={() => setReponer(card)}
                >
                  <AppIcon name={registered ? 'plus' : 'box-open'} className="mr-2" />
                  {registered ? 'Reponer' : 'Gestionar stock'}
                </Button>
                </div>
              </Card>
            )
          })}
          {cards.length > 0 ? (
            <p className="pt-2 text-center text-sm font-semibold text-muted">
              Están los medicamentos en curso y los que empiezan más adelante. Los archivados no aparecen acá.
            </p>
          ) : null}
        </div>
      ) : null}

      {reponer ? (
        <ReponerSheet
          card={reponer}
          today={today}
          onClose={() => setReponer(null)}
          onSaved={(message, undo) => {
            setReponer(null)
            setToast({ text: message, undo })
            void reload()
          }}
        />
      ) : null}

      {toast ? (
        <Toast
          aboveFab
          onUndo={
            toast.undo
              ? async () => {
                  toast.undo?.()
                  await reload()
                }
              : undefined
          }
          onDone={() => setToast(null)}
        >
          {toast.text}
        </Toast>
      ) : null}
    </>
  )
}

function formatLongDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
  return label
}

function ReponerSheet({
  card,
  today,
  onClose,
  onSaved,
}: {
  card: StockCardModel
  today: string
  onClose: () => void
  onSaved: (message: string, undo?: () => void) => void
}) {
  const registered = card.medication.stockQty != null
  const [mode, setMode] = useState<'sumar' | 'ajustar'>(registered ? 'sumar' : 'ajustar')
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const current = card.medication.stockQty

  const parsed = raw === '' ? null : Number(raw)
  const invalidDecimal = raw !== '' && !/^\d+$/.test(raw)
  const overMax = parsed != null && !invalidDecimal && parsed > 9999
  const previewQty =
    mode === 'sumar'
      ? current != null && parsed != null && !invalidDecimal
        ? current + parsed
        : null
      : parsed != null && !invalidDecimal
        ? parsed
        : null

  const previewEstimate =
    previewQty != null
      ? estimateStock(
          previewQty,
          card.scheduleCount,
          card.medication.unitsPerDose,
          today,
          card.startsOn,
          card.endsOn,
        )
      : null
  const beforeEstimate = estimateStock(
    current,
    card.scheduleCount,
    card.medication.unitsPerDose,
    today,
    card.startsOn,
    card.endsOn,
  )

  const canSave =
    !busy &&
    !invalidDecimal &&
    !overMax &&
    (mode === 'sumar'
      ? parsed != null && parsed > 0 && current != null && (current + parsed) <= 9999
      : registered
        ? parsed != null && parsed !== current
        : parsed != null)

  async function save() {
    if (!canSave || parsed == null) return
    setBusy(true)
    setError('')
    const previous = current
    try {
      if (mode === 'sumar') {
        const result = await addMedicationStock({ medicationId: card.medication.id, units: parsed })
        onSaved(`Sumaste ${parsed} a ${card.medication.name}. Ahora tenés ${result.stockQty}.`, () => {
          void adjustMedicationStock({ medicationId: card.medication.id, units: previous ?? 0 })
        })
      } else {
        const result = await adjustMedicationStock({ medicationId: card.medication.id, units: parsed })
        onSaved(`Ajustaste ${card.medication.name} a ${result.stockQty}.`, () => {
          void adjustMedicationStock({ medicationId: card.medication.id, units: previous })
        })
      }
    } catch {
      setError('No pude guardar el stock. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function stopTracking() {
    setBusy(true)
    setError('')
    const previous = current
    try {
      await adjustMedicationStock({ medicationId: card.medication.id, units: null })
      onSaved(`Dejaste de registrar el stock de ${card.medication.name}.`, () => {
        void adjustMedicationStock({ medicationId: card.medication.id, units: previous })
      })
    } catch {
      setError('No pude guardar el stock. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const title = registered ? `Reponer ${card.medication.name}` : `Stock de ${card.medication.name}`
  const sub = [
    card.medication.doseNotes,
    card.scheduleCount === 1 ? '1 toma/día' : `${card.scheduleCount} tomas/día`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Sheet
      open
      title={
        <div>
          <p className="font-display text-lg font-semibold">{title}</p>
          <p className="text-sm font-semibold text-muted">{sub}</p>
        </div>
      }
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {error ? (
            <p className="text-center text-sm font-bold text-tinta" role="alert">
              {error}
            </p>
          ) : null}
          <Button tall className="w-full" disabled={!canSave} onClick={() => void save()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button className="w-full" variant="alt" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      {registered ? (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 font-semibold ${
              mode === 'sumar' ? 'border-tinta bg-ciruela-claro' : 'border-azul-ink bg-card'
            }`}
            onClick={() => {
              setMode('sumar')
              setRaw('')
              setError('')
            }}
          >
            <AppIcon name="plus" /> Sumar
          </button>
          <button
            type="button"
            className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 font-semibold ${
              mode === 'ajustar' ? 'border-tinta bg-ciruela-claro' : 'border-azul-ink bg-card'
            }`}
            onClick={() => {
              setMode('ajustar')
              setRaw('')
              setError('')
            }}
          >
            <AppIcon name="pen" /> Ajustar
          </button>
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          {mode === 'sumar' ? 'Cuántas sumás' : 'Cuántas tenés ahora'}
        </span>
        <div className="relative">
          <input
            inputMode="numeric"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            className="w-full rounded-2xl border-2 border-azul-ink bg-card px-3 py-3 pr-24 font-semibold"
            placeholder="Ej: 30"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
            unidades
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-muted">
          {mode === 'sumar'
            ? 'Las de la caja nueva. Se suman a las que te quedan.'
            : 'Contá las que te quedan. Este número reemplaza al de la app.'}
        </p>
        {invalidDecimal ? (
          <p className="mt-1 text-sm font-bold text-tinta">Usá números enteros.</p>
        ) : null}
        {mode === 'sumar' && parsed === 0 ? (
          <p className="mt-1 text-sm font-bold text-tinta">Poné cuántas sumás.</p>
        ) : null}
        {overMax ? <p className="mt-1 text-sm font-bold text-tinta">Hasta 9999 unidades.</p> : null}
      </label>

      <div className="mt-4 rounded-2xl border-2 border-azul-ink bg-sand p-3.5">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-muted">Stock actual</p>
            <p className="font-display text-2xl font-semibold">
              {current == null ? 'sin registrar' : current}
            </p>
          </div>
          {previewQty != null ? (
            <>
              <AppIcon name="arrow-right" className="mb-2" />
              <div className="text-right">
                <p className="text-sm font-semibold text-muted">Nuevo stock</p>
                <p className="font-display text-[34px] font-semibold leading-none">{previewQty}</p>
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold text-muted">
              {mode === 'sumar' ? 'Escribí cuántas sumás.' : 'Escribí cuántas tenés.'}
            </p>
          )}
        </div>
        <div className="my-3 border-t border-dashed border-azul-ink/40" />
        {previewEstimate && previewQty != null ? (
          <>
            <p className="text-sm font-bold">
              {previewEstimate.outOfStock
                ? 'Se terminó. Reponé cuando compres.'
                : previewEstimate.reachesUntilEnd
                  ? 'Te alcanza hasta el final del tratamiento'
                  : previewEstimate.estimatedOn
                    ? `Se termina aprox. el ${formatStockDate(previewEstimate.estimatedOn)}`
                    : null}
            </p>
            {beforeEstimate.estimatedOn && !beforeEstimate.outOfStock ? (
              <p className="mt-1 text-sm font-semibold text-muted">
                Antes, el {formatStockDate(beforeEstimate.estimatedOn)}.
              </p>
            ) : null}
          </>
        ) : current != null ? (
          <p className="text-sm font-semibold text-muted">Stock actual: {current}</p>
        ) : null}
      </div>

      {registered && mode === 'ajustar' ? (
        <button
          type="button"
          className="mt-4 inline-flex min-h-11 items-center font-semibold text-mostaza-ink"
          disabled={busy}
          onClick={() => void stopTracking()}
        >
          Dejar de registrar stock
        </button>
      ) : null}

    </Sheet>
  )
}
