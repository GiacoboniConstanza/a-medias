import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { FixedExpenseFormFields } from './FixedExpenseFormFields.tsx'
import { Button, ErrorText } from './ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import {
  createFixedExpense,
  loadCategoryUsage,
  loadReminderPreferences,
  type CategoryUsageRow,
} from '../lib/api.ts'
import { categoryChipsForPicker } from '../lib/categories.ts'
import { firstMonthCaption } from '../lib/fixed.ts'
import {
  defaultDueDayForInstallments,
  installmentPlanFromDraft,
  resolveInstallmentAmount,
  resolveInstallmentTotal,
  validateFixedForm,
  type FixedFormDraft,
  type FixedKind,
} from '../lib/fixed-form.ts'
import { amountFromDigits, clampNotes, moneyDraftFromAmount, normalizeMoney } from '../lib/format.ts'
import { DEFAULT_REMINDER_PREFS } from '../lib/reminders.ts'

export function FixedExpenseCreatePanel({
  kind,
  title,
  stepBadge,
  onBack,
  onSaved,
  chrome = true,
}: {
  kind: FixedKind
  title: string
  stepBadge?: string | null
  onBack: () => void
  onSaved: () => void | Promise<void>
  /** false: solo cuerpo + footer (el padre pone el encabezado). */
  chrome?: boolean
}) {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, refresh } = useFinance()
  const [itemTitle, setItemTitle] = useState('')
  const [icon, setIcon] = useState(kind === 'installments' ? 'calendar-days' : 'house')
  const [digits, setDigits] = useState('')
  const [totalDigits, setTotalDigits] = useState('')
  const [dueDay, setDueDay] = useState('10')
  const [shared, setShared] = useState(true)
  const [remind, setRemind] = useState(true)
  const [notes, setNotes] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [countText, setCountText] = useState('2')
  const [currentText, setCurrentText] = useState('1')
  const [leadDays, setLeadDays] = useState(DEFAULT_REMINDER_PREFS.dueLeadDays)
  const [categoryUsage, setCategoryUsage] = useState<CategoryUsageRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [keyboard, setKeyboard] = useState(0)
  const [footerH, setFooterH] = useState(88)
  const footerRef = useRef<HTMLDivElement>(null)
  const remindId = useId()

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => {
      setKeyboard(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [])

  useEffect(() => {
    const node = footerRef.current
    if (!node) return
    const update = () => setFooterH(node.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    void loadReminderPreferences(profile.id).then((prefs) => setLeadDays(prefs.dueLeadDays))
    void loadCategoryUsage().then(setCategoryUsage).catch(() => setCategoryUsage([]))
  }, [profile?.id])

  useEffect(() => {
    if (categoryId && data) {
      const category = data.categories.find((row) => row.id === categoryId)
      if (category) setIcon(category.icon)
    }
  }, [categoryId, data])

  const amount = normalizeMoney(amountFromDigits(digits))
  const total = totalDigits ? normalizeMoney(amountFromDigits(totalDigits)) : null
  const count = Number(countText.replace(/\D/g, '')) || 0
  const currentNumber = Number(currentText.replace(/\D/g, '')) || 0
  const day = Number(dueDay.replace(/\D/g, '')) || 0

  const draft: FixedFormDraft = {
    kind,
    title: itemTitle,
    icon,
    amount,
    dueDay: kind === 'installments' ? defaultDueDayForInstallments() : day,
    shared,
    remind: kind === 'installments' ? true : remind,
    notes: kind === 'installments' ? null : clampNotes(notes),
    categoryId,
    count: kind === 'installments' ? count : null,
    currentNumber: kind === 'installments' ? currentNumber : null,
    total: kind === 'installments' ? total : null,
    amountChanged: false,
    applies: null,
  }

  const resolvedAmount =
    kind === 'installments' ? resolveInstallmentAmount({ amount, total, count }) : amount
  const resolvedTotal =
    kind === 'installments' ? resolveInstallmentTotal({ amount: resolvedAmount, total, count }) : null
  const plan = installmentPlanFromDraft(draft, month)
  const firstCaption =
    kind === 'installments' && plan && currentNumber > 1 ? firstMonthCaption(plan.firstMonth) : null

  const categoryChips = useMemo(
    () => categoryChipsForPicker(data?.categories ?? [], categoryUsage, categoryId, showAllCategories),
    [data?.categories, categoryUsage, categoryId, showAllCategories],
  )

  async function save() {
    if (!profile?.householdId) return
    const message = validateFixedForm(draft)
    if (message) {
      setError(message)
      return
    }
    setSaving(true)
    setError('')
    const remindDaysBefore = draft.remind ? leadDays : 0
    try {
      const effectiveFrom = kind === 'installments' && plan ? plan.firstMonth : month
      await createFixedExpense({
        householdId: profile.householdId,
        ownerId: draft.shared ? null : profile.id,
        categoryId: draft.categoryId,
        title: draft.title,
        icon: draft.icon,
        amount: resolvedAmount,
        dueDay: draft.dueDay,
        isShared: draft.shared,
        remindDaysBefore,
        remind: draft.remind,
        notes: draft.notes,
        effectiveFrom,
        createdBy: profile.id,
        installmentCount: kind === 'installments' ? draft.count : null,
        firstMonth: kind === 'installments' && plan ? plan.firstMonth : null,
        totalAmount: kind === 'installments' ? resolvedTotal : null,
      })
      await refresh()
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (!profile?.householdId) return null

  const body = (
      <div
        className={`space-y-4 px-4 ${chrome ? 'pt-[calc(var(--feston-alto)+1rem)]' : 'pt-4'}`}
        style={{ paddingBottom: `calc(${footerH}px + ${keyboard}px + 1rem)` }}
      >
        <FixedExpenseFormFields
          kind={kind}
          title={itemTitle}
          onTitle={setItemTitle}
          digits={digits}
          onDigits={setDigits}
          totalDigits={totalDigits}
          onTotalDigits={(value) => {
            setTotalDigits(value)
            const nextTotal = value ? normalizeMoney(amountFromDigits(value)) : 0
            if (nextTotal > 0 && count >= 2) {
              setDigits(
                moneyDraftFromAmount(
                  resolveInstallmentAmount({ amount: 0, total: nextTotal, count }),
                ),
              )
            }
          }}
          dueDay={dueDay}
          onDueDay={setDueDay}
          shared={shared}
          onShared={() => setShared((current) => !current)}
          remind={remind}
          onRemind={() => setRemind((current) => !current)}
          notes={notes}
          onNotes={setNotes}
          categoryId={categoryId}
          onCategoryId={setCategoryId}
          categoryChips={categoryChips}
          showAllCategories={showAllCategories}
          onShowAllCategories={() => setShowAllCategories(true)}
          categoriesTotal={data?.categories.length ?? 0}
          countText={countText}
          onCountText={setCountText}
          currentText={currentText}
          onCurrentText={setCurrentText}
          firstCaption={firstCaption}
          leadDays={leadDays}
          remindId={remindId}
          amountChanged={false}
          applies={null}
          onApplies={() => undefined}
          autoFocusAmount
        />
        <ErrorText>{error}</ErrorText>
      </div>
  )

  const footer = (
      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 border-t border-linea-punteada bg-crema px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
        style={{ bottom: keyboard }}
      >
        <Button type="button" tall disabled={saving} onClick={() => void save()}>
          <AppIcon name="check" /> {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
  )

  if (!chrome) {
    return (
      <>
        {body}
        {footer}
      </>
    )
  }

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
          {stepBadge ? <p className="text-sm font-semibold text-tinta">{stepBadge}</p> : null}
        </div>
        <h1 className="font-display text-[34px] font-semibold text-tinta">{title}</h1>
      </section>
      {body}
      {footer}
    </div>
  )
}
