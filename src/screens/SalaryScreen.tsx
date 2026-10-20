import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { amountFromDigits, applyKey, Keypad } from '../components/Keypad.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, Chip, FieldError } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import {
  deleteSalaryRevision,
  previewSalarySplit,
  saveSalaryRevision,
  type SalaryPreview,
} from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { monthKey, shiftMonth } from '../lib/month.ts'
import { effectiveSalary, latestSalary, pocketDelta, salaryMonthError, sinceLabel, type SalaryPoint } from '../lib/salary.ts'

type WhenChoice = 'this' | 'next' | 'pick'

export function SalaryScreen() {
  const { profile, signOut } = useAuth()
  const { data, refresh } = useFinance()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SalaryPoint | null>(null)
  const [digits, setDigits] = useState('')
  const [when, setWhen] = useState<WhenChoice>('next')
  const [picked, setPicked] = useState('')
  const [amountError, setAmountError] = useState('')
  const [whenError, setWhenError] = useState('')
  const [formError, setFormError] = useState('')
  const [preview, setPreview] = useState<SalaryPreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const todayMonth = monthKey()
  const history = data?.salaryHistory ?? []
  const latest = latestSalary(history)
  const effectiveFrom = when === 'this' ? todayMonth : when === 'next' ? shiftMonth(todayMonth, 1) : picked ? `${picked}-01` : ''
  const targetId = editing?.id ?? (latest && latest.effectiveFrom === effectiveFrom ? latest.id : null)
  const replacing = targetId !== null
  const amount = amountFromDigits(digits)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!open || amount <= 0 || !effectiveFrom || salaryMonthError(history, effectiveFrom, editing?.id ?? null)) {
      setPreview(null)
      setPreviewError('')
      return
    }
    let cancelled = false
    previewSalarySplit({ amount, effectiveFrom, replacing })
      .then((next) => {
        if (cancelled) return
        setPreview(next)
        setPreviewError('')
      })
      .catch((caught) => {
        if (cancelled) return
        setPreview(null)
        setPreviewError(caught instanceof Error ? caught.message : 'No pude calcular el reparto.')
      })
    return () => {
      cancelled = true
    }
  }, [open, amount, effectiveFrom, replacing, history, editing?.id])

  if (!profile?.householdId || !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>

  const vigente = [...history]
    .filter((row) => row.effectiveFrom <= todayMonth)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
  const current = effectiveSalary(history, todayMonth)
  const ids = Object.keys(data.names).sort()
  const liveMonthError = effectiveFrom ? salaryMonthError(history, effectiveFrom, editing?.id ?? null) : ''

  function openCreate() {
    setEditing(null)
    setDigits('')
    setWhen('next')
    setPicked('')
    setAmountError('')
    setWhenError('')
    setFormError('')
    setConfirmId(null)
    setOpen(true)
  }

  function openEdit(row: SalaryPoint) {
    const nextMonth = shiftMonth(todayMonth, 1)
    setEditing(row)
    setDigits(String(row.amount))
    if (row.effectiveFrom === todayMonth) setWhen('this')
    else if (row.effectiveFrom === nextMonth) setWhen('next')
    else {
      setWhen('pick')
      setPicked(row.effectiveFrom.slice(0, 7))
    }
    setAmountError('')
    setWhenError('')
    setFormError('')
    setOpen(true)
  }

  function closeSheet() {
    setOpen(false)
    setEditing(null)
  }

  async function save() {
    const nextAmountError = amount <= 0 ? 'El sueldo tiene que ser mayor a cero.' : ''
    const nextWhenError = salaryMonthError(history, effectiveFrom, editing?.id ?? null)
    setAmountError(nextAmountError)
    setWhenError(nextWhenError)
    setFormError('')
    if (nextAmountError || nextWhenError || !profile) return
    setSaving(true)
    try {
      await saveSalaryRevision({
        id: targetId,
        userId: profile.id,
        amount,
        effectiveFrom,
      })
      closeSheet()
      setDigits('')
      setToast(editing ? 'Listo, actualicé el sueldo.' : 'Listo, registré el aumento.')
      await refresh()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'No pude guardar el sueldo.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setSaving(true)
    setFormError('')
    try {
      await deleteSalaryRevision(id)
      setConfirmId(null)
      setToast('Saqué ese sueldo del historial.')
      await refresh()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'No pude eliminar el sueldo.')
    } finally {
      setSaving(false)
    }
  }

  const oldBase = effectiveSalary(history, effectiveFrom || todayMonth)
  const delta =
    preview && effectiveFrom
      ? pocketDelta({
          ids,
          meId: profile.id,
          oldPercentById: percentMap(ids, profile.id, preview.myOldPercent, preview.partnerOldPercent),
          newPercentById: percentMap(ids, profile.id, preview.myNewPercent, preview.partnerNewPercent),
          oldBase,
          newBase: amount,
          sharedTotal: preview.sharedTotal,
        })
      : 0
  const alone = ids.length < 2

  return (
    <>
      <header className="mb-3 flex items-center justify-between">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1 font-semibold text-text">
          <AppIcon name="chevron-left" /> Inicio
        </Link>
        <span className="font-display font-semibold text-primary">A Medias</span>
      </header>
      <h1 className="mb-3 font-display text-[22px] font-semibold">Mi sueldo</h1>
      <Card>
        <p className="text-sm font-semibold text-muted">Sueldo vigente</p>
        <p className="font-display text-3xl font-bold">{formatMoney(current)}</p>
        {vigente ? (
          <p className="mt-1 text-sm font-semibold text-muted">desde {sinceLabel(vigente.effectiveFrom)}</p>
        ) : (
          <p className="mt-1 text-sm font-semibold text-muted">Todavía no cargaste un sueldo.</p>
        )}
        <button
          type="button"
          onClick={openCreate}
          className="mt-3 block min-h-[52px] w-full rounded-2xl bg-primary text-base font-semibold text-white"
        >
          Registrar aumento
        </button>
      </Card>

      <section className="mb-3">
        <button
          type="button"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((currentOpen) => !currentOpen)}
          className="flex min-h-11 w-full items-center justify-between rounded-3xl bg-card px-4 text-left shadow-card"
        >
          <span className="font-display text-base font-semibold">Historial</span>
          <span className="text-sm font-semibold text-muted">{historyOpen ? 'Ocultar' : 'Ver'}</span>
        </button>
        {historyOpen ? (
          <div className="mt-2 rounded-3xl bg-card px-4 py-1 shadow-card">
            {history.length === 0 ? <p className="py-4 text-sm font-semibold text-muted">Todavía no hay sueldos.</p> : null}
            <ul>
              {history.map((row) => {
                const canChange = latest?.id === row.id
                return (
                  <li key={row.id} className="border-b border-dashed border-line py-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg font-semibold">{formatMoney(row.amount)}</p>
                        <p className="text-sm font-semibold text-muted">desde {sinceLabel(row.effectiveFrom)}</p>
                      </div>
                      {canChange && confirmId !== row.id ? (
                        <div className="flex shrink-0 gap-1">
                          <button type="button" className="min-h-11 px-2 text-sm font-semibold text-primary" onClick={() => openEdit(row)}>
                            <AppIcon name="pen" /> Editar
                          </button>
                          <button type="button" className="min-h-11 px-2 text-sm font-semibold text-alert-ink" onClick={() => setConfirmId(row.id)}>
                            Eliminar
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {confirmId === row.id ? (
                      <div className="mt-2 rounded-2xl bg-sand p-3">
                        <p className="text-sm font-semibold text-text">¿Sacar este sueldo? Vuelve a valer el anterior.</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="min-h-11 flex-1 rounded-2xl bg-primary text-sm font-semibold text-white disabled:opacity-50"
                            disabled={saving}
                            onClick={() => void remove(row.id)}
                          >
                            Eliminar
                          </button>
                          <button
                            type="button"
                            className="min-h-11 flex-1 rounded-2xl bg-card text-sm font-semibold text-primary"
                            onClick={() => setConfirmId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <FieldError>{confirmId ? formError : ''}</FieldError>
          </div>
        ) : null}
      </section>

      <button type="button" className="mt-8 w-full text-center text-sm font-extrabold text-muted" onClick={() => void signOut()}>
        Cerrar sesión
      </button>

      <Sheet
        open={open}
        title={editing ? 'Editar sueldo' : 'Registrar aumento'}
        onClose={closeSheet}
        footer={
          <>
            <Button type="button" className="min-h-[52px]" onClick={() => void save()} disabled={saving}>
              Guardar
            </Button>
            <Button type="button" variant="alt" className="mt-2" onClick={closeSheet}>
              Cancelar
            </Button>
          </>
        }
      >
        <p className="text-center font-display text-4xl font-bold" aria-live="polite">
          {formatMoney(amount)}
        </p>
        <FieldError>{amountError}</FieldError>
        <div className="mt-3">
          <Keypad
            onKey={(key) => {
              setAmountError('')
              setDigits((value) => applyKey(value, key))
            }}
          />
        </div>
        <p className="mb-2 mt-4 font-display text-base font-semibold">¿Desde cuándo?</p>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={when === 'this'}
            onClick={() => {
              setWhenError('')
              setWhen('this')
            }}
          >
            Este mes
          </Chip>
          <Chip
            active={when === 'next'}
            onClick={() => {
              setWhenError('')
              setWhen('next')
            }}
          >
            El mes que viene
          </Chip>
          <Chip
            active={when === 'pick'}
            onClick={() => {
              setWhenError('')
              setWhen('pick')
            }}
          >
            Elegir mes
          </Chip>
        </div>
        {when === 'pick' ? (
          <label className="mt-3 block text-sm font-semibold text-muted">
            Mes
            <input
              type="month"
              value={picked}
              onChange={(event) => {
                setWhenError('')
                setPicked(event.target.value)
              }}
              className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-sand px-3 py-2 font-semibold text-text"
            />
          </label>
        ) : null}
        <FieldError>{whenError || liveMonthError}</FieldError>
        {preview && amount > 0 ? (
          <div className="mt-3 rounded-2xl bg-sand p-3 text-sm font-semibold text-text">
            <p>
              {alone
                ? 'Cuando se sume tu compañera, calculamos el porcentaje.'
                : preview.myOldPercent === preview.myNewPercent
                  ? `Tu parte de los compartidos sigue en ${preview.myNewPercent}%.`
                  : `Tu parte de los compartidos pasa de ${preview.myOldPercent}% a ${preview.myNewPercent}%.`}
            </p>
            <p className="mt-1">{pocketSentence(delta)}</p>
          </div>
        ) : null}
        <FieldError>{previewError || formError}</FieldError>
      </Sheet>

      {toast ? (
        <p
          role="status"
          className="fixed bottom-28 left-1/2 z-50 max-w-[20rem] -translate-x-1/2 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-fab"
        >
          {toast}
        </p>
      ) : null}
    </>
  )
}

function percentMap(ids: string[], meId: string, mine: number, partner: number): Record<string, number> {
  const map: Record<string, number> = {}
  for (const id of ids) map[id] = id === meId ? mine : partner
  return map
}

function pocketSentence(delta: number): string {
  if (delta > 0) return `Te quedan ${formatMoney(delta)} más por mes.`
  if (delta < 0) return `Te quedan ${formatMoney(Math.abs(delta))} menos por mes.`
  return 'Te queda lo mismo por mes.'
}
