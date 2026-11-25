import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Button, Card, FieldError, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import {
  loadHouseholdSalaries,
  loadHouseholdSplitSetting,
  saveHouseholdSplitSetting,
  type HouseholdSplitSetting,
} from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { isHubHome } from '../lib/modules.ts'
import { partnerId } from '../lib/derive.ts'
import { useModules } from '../context/ModulesProvider.tsx'
import { effectiveSalary, salariesForMonth, salaryLabelsCaption, salaryPercents, type SalaryPoint } from '../lib/salary.ts'

type SplitMode = HouseholdSplitSetting['mode']

const MODES: { id: SplitMode; title: string; hint: string }[] = [
  { id: 'proportional', title: 'Según los sueldos', hint: 'Se parte según lo que cargaron este mes.' },
  { id: 'even', title: 'En partes iguales', hint: 'Siempre 50 y 50, aunque una cobre más.' },
  { id: 'manual', title: 'Porcentaje a mano', hint: 'Ustedes eligen el porcentaje.' },
]

export function SplitScreen() {
  const { profile } = useAuth()
  const { enabled } = useModules()
  const { month } = useMonth()
  const { data, refresh } = useFinance()
  const backTo = isHubHome(enabled) ? '/finanzas' : '/'

  const [setting, setSetting] = useState<HouseholdSplitSetting | null>(null)
  const [byUser, setByUser] = useState<Record<string, SalaryPoint[]>>({})
  const [mode, setMode] = useState<SplitMode>('proportional')
  const [myPercent, setMyPercent] = useState(50)
  const [draftPercent, setDraftPercent] = useState('50')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const meId = profile?.id ?? ''
  const otherId = data && meId ? partnerId(data, meId) : null
  const myName = (meId && data?.names[meId]) || 'Vos'
  const partnerName = (otherId && data?.names[otherId]) || 'Maru'

  useEffect(() => {
    if (!profile?.householdId) return
    let cancelled = false
    setLoading(true)
    setLoadError('')
    Promise.all([loadHouseholdSplitSetting(month), loadHouseholdSalaries(profile.householdId)])
      .then(([nextSetting, salaries]) => {
        if (cancelled) return
        setSetting(nextSetting)
        setByUser(salaries)
        setMode(nextSetting.mode)
        const mine = nextSetting.percentByUser[meId]
        if (nextSetting.mode === 'manual' && mine) {
          setMyPercent(mine)
          setDraftPercent(String(mine))
        }
      })
      .catch((caught) => {
        if (cancelled) return
        setLoadError(caught instanceof Error ? caught.message : 'No pude cargar el reparto.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile?.householdId, month, meId])

  const myRows = salariesForMonth(byUser[meId] ?? data?.salaryHistory ?? [], month)
  const partnerRows = otherId ? salariesForMonth(byUser[otherId] ?? [], month) : []
  const myBase = effectiveSalary(byUser[meId] ?? data?.salaryHistory ?? [], month)
  const partnerBase = otherId ? effectiveSalary(byUser[otherId] ?? [], month) : 0
  const missingMine = myBase <= 0
  const missingPartner = Boolean(otherId) && partnerBase <= 0
  const missingAny = missingMine || missingPartner
  const missingBoth = missingMine && missingPartner

  const previewPercents = useMemo(() => {
    if (!otherId) return { mine: 50, partner: 50, fallbackEven: false }
    if (mode === 'even') return { mine: 50, partner: 50, fallbackEven: false }
    if (mode === 'manual') return { mine: myPercent, partner: 100 - myPercent, fallbackEven: false }
    if (missingAny) return { mine: 50, partner: 50, fallbackEven: true }
    const ordered = [meId, otherId].sort()
    const bases = ordered.map((id) => (id === meId ? myBase : partnerBase))
    const percents = salaryPercents(bases)
    const mine = percents[ordered.indexOf(meId)] ?? 50
    const partner = percents[ordered.indexOf(otherId)] ?? 50
    return { mine, partner, fallbackEven: false }
  }, [mode, myPercent, myBase, partnerBase, missingAny, meId, otherId])

  const banner = useMemo(() => {
    if (!otherId || !missingAny) return ''
    if (mode === 'proportional') {
      if (missingBoth) {
        return 'Este mes faltan los sueldos de las dos. Mientras tanto, se reparte en partes iguales. Cuando los carguen, el porcentaje se calcula de nuevo.'
      }
      if (missingMine) {
        return 'Este mes falta tu sueldo. Mientras tanto, se reparte en partes iguales. Cuando lo cargues, el porcentaje se calcula de nuevo.'
      }
      return `Este mes falta el sueldo de ${partnerName}. Mientras tanto, se reparte en partes iguales. Cuando ${partnerName} lo cargue, el porcentaje se calcula de nuevo.`
    }
    if (missingBoth) return 'Este mes faltan los sueldos de las dos.'
    const modeLabel = mode === 'even' ? 'partes iguales' : `${previewPercents.mine} / ${previewPercents.partner}`
    if (missingMine) return `Este mes falta tu sueldo. El reparto sigue en ${modeLabel}, como lo eligieron.`
    return `Este mes falta el sueldo de ${partnerName}. El reparto sigue en ${modeLabel}, como lo eligieron.`
  }, [mode, missingAny, missingBoth, missingMine, missingPartner, otherId, partnerName, previewPercents.mine, previewPercents.partner])

  const previewTitle = useMemo(() => {
    if (!otherId) return 'Cuando se sume tu compañera, calculamos el porcentaje.'
    if (previewPercents.fallbackEven) return 'Este mes se reparte 50 / 50'
    return `Este mes te toca el ${previewPercents.mine} %`
  }, [otherId, previewPercents.fallbackEven, previewPercents.mine])

  const dirty = useMemo(() => {
    if (!setting) return false
    if (mode !== setting.mode) return true
    if (mode === 'manual') return (setting.percentByUser[meId] ?? 50) !== myPercent
    return false
  }, [setting, mode, myPercent, meId])

  const canSave = dirty && !saving && !(mode === 'manual' && !otherId)

  async function save() {
    if (!canSave) return
    setSaving(true)
    setFormError('')
    try {
      await saveHouseholdSplitSetting({
        mode,
        myPercent: mode === 'manual' ? myPercent : undefined,
        effectiveFrom: month,
      })
      setToast('Listo, guardamos el reparto.')
      await refresh()
      const next = await loadHouseholdSplitSetting(month)
      setSetting(next)
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'No pude guardar el reparto.')
    } finally {
      setSaving(false)
    }
  }

  if (!profile?.householdId || !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (loading && !setting) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>

  return (
    <>
      <SectionHeader
        lead="back"
        backTo={backTo}
        title="Reparto"
        screenTitle
        aside={
          <>
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-azul-claro px-2.5 text-sm font-bold text-azul-ink">
              <AppIcon name="user-group" className="text-xs" />
              Las dos
            </span>
            <Link
              to="/reparto/ayuda"
              aria-label="¿Cómo funciona el reparto?"
              className="grid h-11 w-11 place-items-center text-tinta"
            >
              <AppIcon name="circle-info" />
            </Link>
          </>
        }
      />

      <p className="mb-3.5 text-sm font-semibold text-muted">
        Vale para las dos, hasta que lo cambien. Los gastos personales no se parten.
      </p>

      {banner ? (
        <div className="mb-3 rounded-2xl bg-mostaza-claro px-3.5 py-3 text-sm font-semibold text-title" role="status">
          <AppIcon name="circle-info" className="mr-1.5 inline text-mostaza-ink" />
          {banner}
        </div>
      ) : null}

      <div role="radiogroup" aria-label="Modo de reparto" className="mb-3 space-y-2">
        {MODES.map((option) => {
          const active = mode === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setMode(option.id)
                setFormError('')
              }}
              className={`grid min-h-[68px] w-full grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border-[1.5px] p-3.5 text-left ${
                active ? 'border-2 border-azul-ink bg-azul-claro' : 'border-azul-ink bg-tarjeta'
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border-2 ${
                  active ? 'border-tinta bg-tinta text-card' : 'border-azul-ink bg-tarjeta'
                }`}
              >
                {active ? <AppIcon name="check" className="text-xs" /> : null}
              </span>
              <span>
                <span className="block font-display text-base font-semibold text-title">{option.title}</span>
                <span className="mt-0.5 block text-sm font-semibold text-muted">{option.hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      {mode === 'manual' ? (
        <Card className="mb-3 !p-3.5">
          <label className="block text-sm font-semibold text-muted">
            Tu parte
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={draftPercent}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, '').slice(0, 2)
                  setDraftPercent(value)
                  const parsed = Number(value)
                  if (parsed >= 1 && parsed <= 99) setMyPercent(parsed)
                }}
                className="min-h-11 flex-1 rounded-2xl border border-line bg-sand-soft px-3 font-display text-lg font-semibold text-title"
              />
              <span className="font-display text-lg font-semibold text-title">%</span>
            </div>
          </label>
          <p className="mt-3 text-sm font-semibold text-muted">
            La de {partnerName}: <span className="font-display text-base font-semibold text-title">{100 - myPercent} %</span>
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-semibold text-title">
          <AppIcon name="scale-balanced" className="text-mostaza-ink" />
          {previewTitle}
        </h2>
        <PreviewPerson
          name={myName}
          amount={missingMine && mode === 'proportional' && previewPercents.fallbackEven ? null : myBase}
          caption={
            missingMine && mode === 'proportional' && previewPercents.fallbackEven
              ? 'Todavía no cargaste este mes'
              : myRows.length > 0
                ? salaryLabelsCaption(myRows)
                : myBase > 0
                  ? 'Sueldo'
                  : 'Todavía no cargaste este mes'
          }
        />
        {otherId ? (
          <>
            <div className="my-3 border-t border-dashed border-line" />
            <PreviewPerson
              name={partnerName}
              amount={missingPartner && mode === 'proportional' && previewPercents.fallbackEven ? null : partnerBase}
              caption={
                missingPartner && mode === 'proportional' && previewPercents.fallbackEven
                  ? 'Todavía no cargó este mes'
                  : partnerRows.length > 0
                    ? salaryLabelsCaption(partnerRows)
                    : partnerBase > 0
                      ? 'Sueldo'
                      : 'Todavía no cargó este mes'
              }
            />
            <SplitBar mine={previewPercents.mine} partner={previewPercents.partner} />
          </>
        ) : null}
        <p className="mt-3 text-sm font-semibold text-muted">Los ingresos puntuales no entran en este porcentaje.</p>
      </Card>

      <div className="pb-[calc(72px+env(safe-area-inset-bottom))]">
        <Button type="button" className="mt-2" disabled={!canSave} onClick={() => void save()}>
          Guardar
        </Button>
        <FieldError>{loadError || formError}</FieldError>
      </div>

      <Toast onDone={() => setToast('')}>{toast}</Toast>
    </>
  )
}

function PreviewPerson({ name, amount, caption }: { name: string; amount: number | null; caption: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-lg font-semibold text-title">{name}</p>
        <p className="font-display text-lg font-semibold text-title">{amount === null ? 'Sin sueldo' : formatMoney(amount)}</p>
      </div>
      <p className="text-sm font-semibold text-muted">{caption}</p>
    </div>
  )
}

function SplitBar({ mine, partner }: { mine: number; partner: number }) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-sm font-semibold text-muted">
        {mine} % · {partner} %
      </p>
      <div className="flex h-[var(--alto-barra-reparto)] overflow-hidden rounded-full bg-azul-claro">
        <div className="h-full bg-rosa" style={{ width: `${mine}%` }} />
        <div className="h-full bg-salvia" style={{ width: `${partner}%` }} />
      </div>
    </div>
  )
}