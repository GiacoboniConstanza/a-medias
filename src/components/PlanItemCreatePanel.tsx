import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { PlanItemFormFields, type PlanItemDraft } from './PlanItemFormFields.tsx'
import { Button, ErrorText } from './ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { createPlanItem, loadPlanItems } from '../lib/api.ts'
import { amountFromDigits, normalizeMoney } from '../lib/format.ts'
import { planTags } from '../lib/plans.ts'

const emptyDraft = (): PlanItemDraft => ({
  title: '',
  digits: '',
  note: '',
  tag: '',
  isPrivate: false,
})

export function PlanItemCreatePanel({
  title,
  stepBadge,
  onBack,
  onSaved,
  chrome = true,
}: {
  title: string
  stepBadge?: string | null
  onBack: () => void
  onSaved: () => void | Promise<void>
  chrome?: boolean
}) {
  const { profile } = useAuth()
  const { refresh } = useFinance()
  const [draft, setDraft] = useState<PlanItemDraft>(emptyDraft)
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [keyboard, setKeyboard] = useState(0)
  const [footerH, setFooterH] = useState(88)
  const footerRef = useRef<HTMLDivElement>(null)

  const reloadTags = useCallback(async () => {
    if (!profile?.householdId) return
    try {
      const list = await loadPlanItems(profile.householdId)
      setTags(planTags(list))
    } catch {
      setTags([])
    }
  }, [profile?.householdId])

  useEffect(() => {
    void reloadTags()
  }, [reloadTags])

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

  const tagSuggestions = useMemo(() => {
    const q = draft.tag.trim().toLocaleLowerCase('es')
    if (!q) return tags.slice(0, 6)
    return tags.filter((tag) => tag.toLocaleLowerCase('es').includes(q)).slice(0, 6)
  }, [draft.tag, tags])

  async function save() {
    const amount = normalizeMoney(amountFromDigits(draft.digits))
    if (!draft.title.trim() || amount <= 0) {
      setError('Completá nombre e importe.')
      return
    }
    if (!profile?.householdId) return
    setSaving(true)
    setError('')
    try {
      await createPlanItem({
        householdId: profile.householdId,
        createdBy: profile.id,
        title: draft.title,
        amount,
        note: draft.note,
        tag: draft.tag,
        isPrivate: draft.isPrivate,
      })
      await refresh()
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar el ítem.')
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
        <PlanItemFormFields
          draft={draft}
          onChange={setDraft}
          tagSuggestions={tagSuggestions}
          showPrivateToggle
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
