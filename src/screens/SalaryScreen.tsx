import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { amountFromDigits } from '../lib/format.ts'
import { MoneyField } from '../components/MoneyField.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, Chip, FieldError, Toast, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { deleteSalaryRevision, previewSalarySplit, saveSalaryRevision, type SalaryPreview } from '../lib/api.ts'
import { formatMoney, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import { monthKey, monthTitle, shiftMonth } from '../lib/month.ts'
import { isHubHome } from '../lib/modules.ts'
import {
  effectiveSalary,
  pocketDelta,
  salariesForMonth,
  salaryMonthError,
  salaryRowIcon,
  salaryRowLabel,
  type SalaryPoint,
} from '../lib/salary.ts'
import { iconSurface } from '../lib/icons.ts'

type WhenChoice = 'this' | 'next'

export function SalaryScreen() {
  const { profile } = useAuth()
  const { enabled } = useModules()
  const { month } = useMonth()
  const { data, refresh } = useFinance()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SalaryPoint | null>(null)
  const [digits, setDigits] = useState('')
  const [name, setName] = useState('')
  const [when, setWhen] = useState<WhenChoice>('this')
  const [amountError, setAmountError] = useState('')
  const [whenError, setWhenError] = useState('')
  const [formError, setFormError] = useState('')
  const [preview, setPreview] = useState<SalaryPreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const todayMonth = monthKey()
  const history = data?.salaryHistory ?? []
  const sheetMonth = editing?.effectiveFrom ?? (when === 'this' ? month : shiftMonth(month, 1))
  const effectiveFrom = editing?.effectiveFrom ?? (when === 'this' ? month : shiftMonth(month, 1))
  const replacing = Boolean(editing?.id)
  const amount = normalizeMoney(amountFromDigits(digits))
  const monthRows = salariesForMonth(history, month)
  const monthTotal = effectiveSalary(history, month)

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

  const ids = Object.keys(data.names).sort()
  const liveMonthError = effectiveFrom ? salaryMonthError(history, effectiveFrom, editing?.id ?? null) : ''
  const monthLabel = monthTitle(month)

  function openCreate() {
    setEditing(null)
    setDigits('')
    setName('')
    setWhen(month === todayMonth ? 'this' : 'this')
    setAmountError('')
    setWhenError('')
    setFormError('')
    setConfirmId(null)
    setOpen(true)
  }

  function openEdit(row: SalaryPoint) {
    setEditing(row)
    setDigits(moneyDraftFromAmount(row.amount))
    setName(row.label?.trim() ?? '')
    setWhen(row.effectiveFrom === month ? 'this' : row.effectiveFrom === shiftMonth(month, 1) ? 'next' : 'this')
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
        id: editing?.id ?? null,
        userId: profile.id,
        amount,
        effectiveFrom,
        label: name,
      })
      closeSheet()
      setDigits('')
      setToast(editing ? 'Listo, actualicé el sueldo.' : 'Listo, registré el sueldo.')
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
      setToast('Saqué ese sueldo del mes.')
      await refresh()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'No pude eliminar el sueldo.')
    } finally {
      setSaving(false)
    }
  }

  const oldBase = effectiveSalary(history, effectiveFrom || month)
  const delta =
    preview && effectiveFrom
      ? pocketDelta({
          ids,
          meId: profile.id,
          oldPercentById: percentMap(ids, profile.id, preview.myOldPercent, preview.partnerOldPercent),
          newPercentById: percentMap(ids, profile.id, preview.myNewPercent, preview.partnerNewPercent),
          oldBase,
          newBase: oldBase + amount - (editing?.amount ?? 0),
          sharedTotal: preview.sharedTotal,
        })
      : 0
  const alone = ids.length < 2
  const sheetTitle = editing ? 'Editar sueldo' : 'Agregar un sueldo'
  const confirmMonth = monthTitle(month).toLowerCase()

  return (
    <>
      <SectionHeader lead="back" backTo={isHubHome(enabled) ? '/finanzas' : '/'} title="Mi sueldo" screenTitle />
      <MonthSwitcher />

      <Card>
        <p className="text-sm font-semibold text-muted">Sueldos de {monthLabel.toLowerCase()}</p>
        {monthRows.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-muted">
            Todavía no cargaste un sueldo este mes. El reparto usa lo que dice el panel.
          </p>
        ) : (
          <ul className="mt-2">
            {monthRows.map((row, index) => {
              const label = salaryRowLabel(row, index, monthRows.length)
              const surface = iconSurface(salaryRowIcon(label))
              return (
                <li key={row.id} className="border-b border-dashed border-line py-3 last:border-0">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="grid min-h-[68px] w-full grid-cols-[auto_1fr_auto] items-center gap-3 text-left"
                    aria-label={`${label}, ${formatMoney(row.amount)}`}
                  >
                    <span
                      className="grid h-10 w-10 place-items-center rounded-full border-2"
                      style={{ background: surface.background, color: surface.color, borderColor: surface.border }}
                    >
                      <AppIcon name={salaryRowIcon(label)} />
                    </span>
                    <span className="font-display text-lg font-semibold text-title">{label}</span>
                    <span className="font-display text-lg font-semibold text-title">{formatMoney(row.amount)}</span>
                  </button>
                  {confirmId === row.id ? (
                    <div className="mt-2 rounded-2xl bg-sand p-3">
                      <p className="text-sm font-semibold text-title">¿Sacar este sueldo de {confirmMonth}?</p>
                      <div className="mt-2 flex gap-2">
                        <Button type="button" className="flex-1" disabled={saving} onClick={() => void remove(row.id)}>
                          Eliminar
                        </Button>
                        <Button type="button" variant="alt" className="flex-1" onClick={() => setConfirmId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mt-1 min-h-11 px-1 text-sm font-semibold text-tinta"
                      onClick={() => setConfirmId(row.id)}
                    >
                      Eliminar
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {monthRows.length > 0 ? (
          <>
            <div className="my-3 border-t border-dashed border-line" />
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-semibold text-title">Total del mes</p>
              <p className="font-display text-lg font-semibold text-title">{formatMoney(monthTotal)}</p>
            </div>
          </>
        ) : null}
        <Button type="button" tall className="mt-3" onClick={openCreate}>
          Agregar un sueldo
        </Button>
        <p className="mt-3 text-sm font-semibold text-muted">Vale solo para este mes. No se copia solo al que viene.</p>
      </Card>

      <Link
        to="/reparto"
        className="mb-3 inline-flex min-h-11 w-full items-center justify-between text-sm font-bold text-mostaza-ink"
      >
        <span className="inline-flex items-center gap-2">
          <AppIcon name="scale-balanced" />
          Cómo se reparte con {(ids.length > 1 && data.names[ids.find((id) => id !== profile.id) ?? '']?.trim()) || 'tu compañera'}
        </span>
        <AppIcon name="chevron-right" />
      </Link>

      <Sheet
        open={open}
        title={sheetTitle}
        onClose={closeSheet}
        footer={
          <>
            <Button type="button" className="min-h-[52px]" onClick={() => void save()} disabled={saving}>
              <span className="inline-flex items-center justify-center gap-1">
                <AppIcon name="check" /> Guardar
              </span>
            </Button>
            <Button type="button" variant="alt" className="mt-2" onClick={closeSheet}>
              Cancelar
            </Button>
          </>
        }
      >
        <label className="mb-3 block text-sm font-semibold text-muted">
          Nombre (opcional)
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="Oficina, Clases…"
          />
        </label>
        <MoneyField
          draft={digits}
          onDraft={(value) => {
            setAmountError('')
            setDigits(value)
          }}
          error={amountError}
          size="display"
        />
        <p className="mb-2 mt-4 font-display text-base font-semibold">¿De qué mes?</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mes del sueldo">
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
        </div>
        <FieldError>{whenError || liveMonthError}</FieldError>
        {preview && amount > 0 ? (
          <div className="mt-3 rounded-2xl bg-sand p-3 text-sm font-semibold text-title">
            <p>
              {alone
                ? 'Cuando se sume tu compañera, calculamos el porcentaje.'
                : `Con este sueldo, en ${monthTitle(sheetMonth).toLowerCase()} sumás ${formatMoney(oldBase + amount - (editing?.amount ?? 0))}. Te toca el ${preview.myNewPercent} % de los compartidos.`}
            </p>
            {!alone && preview.myOldPercent !== preview.myNewPercent ? (
              <p className="mt-1">{pocketSentence(delta)}</p>
            ) : null}
          </div>
        ) : null}
        <FieldError>{previewError || formError}</FieldError>
      </Sheet>

      <Toast onDone={() => setToast('')}>{toast}</Toast>
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