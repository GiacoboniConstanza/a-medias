import { useEffect, useId, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { Plantita } from '../components/Adornos.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { ModuleTitle } from '../components/ModulePill.tsx'
import { ModuleSwitch } from '../components/ModuleSwitch.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, FieldError, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { partnerId } from '../lib/derive.ts'
import {
  MEMO_LABEL_COLORS,
  MEMO_LABEL_COLOR_NAMES,
  MEMO_LABEL_MAX,
  MEMO_LABEL_NAME_MAX,
  canToggleMemoLabel,
  defaultMemoLabelColor,
  deleteLabelBody,
  duplicateLabelNameError,
  groupMemos,
  isMemoGoneMessage,
  isMemoLabelColor,
  labelChipClasses,
  labelCountText,
  labelFilterLive,
  memoCharHint,
  memoDeleteError,
  memoLabelAttachError,
  memoLabelCreateError,
  memoLabelDeleteError,
  memoLabelDetachError,
  memoLabelRenameError,
  memoLoadError,
  memoSaveError,
  memoShareDetail,
  memoToggleError,
  memoUndoError,
  withLabelCounts,
  type MemoItem,
  type MemoLabel,
  type MemoLabelColor,
} from '../lib/memos.ts'
import { supabase } from '../lib/supabase.ts'

const EMPTY: MemoItem[] = []
const EMPTY_LABELS: MemoLabel[] = []

type MemoRow = {
  id: string
  owner_id: string
  text: string
  done: boolean
  shared: boolean
  updated_at: string
  created_at: string
  done_at: string | null
}

type LabelRow = {
  id: string
  name: string
  color: string
  created_at: string
}

type LinkRow = {
  memo_id: string
  label_id: string
}

function mapRow(row: MemoRow, labelIds: string[] = []): MemoItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    text: row.text,
    done: row.done,
    shared: row.shared,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    doneAt: row.done_at,
    labelIds,
  }
}

function mapLabels(rows: LabelRow[], memos: MemoItem[]): MemoLabel[] {
  return withLabelCounts(
    rows
      .filter((row) => isMemoLabelColor(row.color))
      .map((row) => ({ id: row.id, name: row.name, color: row.color as MemoLabelColor })),
    memos,
  )
}

function linksByMemo(links: LinkRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const link of links) {
    const current = map.get(link.memo_id) ?? []
    current.push(link.label_id)
    map.set(link.memo_id, current)
  }
  return map
}

const MEMO_SELECT = 'id, owner_id, text, done, shared, updated_at, created_at, done_at'

async function fetchMemosWithLabels(): Promise<
  { memos: MemoItem[]; error?: undefined } | { memos: MemoItem[]; error: string }
> {
  const [memosRes, linksRes] = await Promise.all([
    supabase.from('memos').select(MEMO_SELECT).order('created_at', { ascending: false }),
    supabase.from('memo_label_links').select('memo_id, label_id'),
  ])
  if (memosRes.error) return { memos: EMPTY, error: memosRes.error.message }
  const byMemo = linksByMemo((linksRes.data ?? []) as LinkRow[])
  return {
    memos: ((memosRes.data ?? []) as MemoRow[]).map((row) => mapRow(row, byMemo.get(row.id) ?? [])),
  }
}

function BusyMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-[2.5px] border-tinta border-t-transparent"
    />
  )
}

function ColorDot({ color, className = '' }: { color: MemoLabelColor; className?: string }) {
  const classes = labelChipClasses(color)
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 rounded-full border-[1.5px] ${classes.bg} ${classes.border} ${className}`}
    />
  )
}

function LabelPill({ label }: { label: MemoLabel }) {
  const classes = labelChipClasses(label.color)
  return (
    <span
      className={`inline-flex h-[var(--alto-chip)] items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold ${classes.bg} ${classes.ink}`}
    >
      <AppIcon name="tag" /> {label.name}
    </span>
  )
}

export function MemosScreen() {
  const { profile } = useAuth()
  const { data } = useFinance()
  const { enabled, ready } = useModules()
  const [params, setParams] = useSearchParams()
  const [memos, setMemos] = useState<MemoItem[]>(EMPTY)
  const [labels, setLabels] = useState<MemoLabel[]>(EMPTY_LABELS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MemoItem | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [undoMemo, setUndoMemo] = useState<MemoItem | null>(null)

  const filterId = params.get('etiqueta')
  const filterLabel = filterId ? labels.find((label) => label.id === filterId) ?? null : null
  const activeFilterId = filterLabel ? filterLabel.id : null

  async function loadLabels(nextMemos: MemoItem[]) {
    const { data: rows, error: loadError } = await supabase
      .from('memo_labels')
      .select('id, name, color, created_at')
      .order('created_at', { ascending: true })
    if (loadError) return { error: loadError.message as string | undefined, labels: EMPTY_LABELS }
    return { labels: mapLabels((rows ?? []) as LabelRow[], nextMemos) }
  }

  async function reload() {
    if (!profile) return
    const loadedMemos = await fetchMemosWithLabels()
    if (loadedMemos.error) {
      setError(memoLoadError())
      setMemos(EMPTY)
      setLabels(EMPTY_LABELS)
      return
    }
    const loaded = await loadLabels(loadedMemos.memos)
    setError('')
    setMemos(loadedMemos.memos)
    setLabels(loaded.labels)
  }

  useEffect(() => {
    if (!profile) return
    let active = true
    setLoading(true)
    void (async () => {
      const loadedMemos = await fetchMemosWithLabels()
      if (!active) return
      if (loadedMemos.error) {
        setError(memoLoadError())
        setMemos(EMPTY)
        setLabels(EMPTY_LABELS)
        setLoading(false)
        return
      }
      const loaded = await loadLabels(loadedMemos.memos)
      if (!active) return
      setError('')
      setMemos(loadedMemos.memos)
      setLabels(loaded.labels)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    if (!filterId) return
    if (labels.some((label) => label.id === filterId)) return
    if (loading) return
    const nextParams = new URLSearchParams(params)
    nextParams.delete('etiqueta')
    setParams(nextParams, { replace: true })
  }, [filterId, labels, loading, params, setParams])

  useEffect(() => {
    if (!toast) return
    const node = document.querySelector<HTMLElement>('[role="status"]')
    node?.focus()
  }, [toast])

  if (!profile) return null
  if (ready && !enabled.includes('memos')) return <Navigate to="/" replace />

  const otherId = data ? partnerId(data, profile.id) : null
  const partnerName = (otherId && data?.names[otherId]) || 'tu compañera'
  const groups = groupMemos(memos, profile.id, activeFilterId)
  const filteredCount = activeFilterId
    ? memos.filter((memo) => (memo.labelIds ?? []).includes(activeFilterId)).length
    : memos.length
  const labelsWithCounts = withLabelCounts(labels, memos)

  function setFilter(nextId: string | null) {
    const nextParams = new URLSearchParams(params)
    if (!nextId) nextParams.delete('etiqueta')
    else nextParams.set('etiqueta', nextId)
    setParams(nextParams, { replace: true })
  }

  function patchMemoLabels(memoId: string, labelIds: string[]) {
    setMemos((current) => current.map((item) => (item.id === memoId ? { ...item, labelIds } : item)))
  }

  async function toggleDone(memo: MemoItem) {
    const next = !memo.done
    const stamp = next ? new Date().toISOString() : null
    setMemos((current) =>
      current.map((item) =>
        item.id === memo.id
          ? { ...item, done: next, doneAt: stamp, updatedAt: new Date().toISOString() }
          : item,
      ),
    )
    const { data: rows, error: saveError } = await supabase
      .from('memos')
      .update({ done: next })
      .eq('id', memo.id)
      .select(MEMO_SELECT)
    const errMsg = saveError ? saveError.message : undefined
    if (saveError || !rows?.length) {
      setMemos((current) =>
        current.map((item) =>
          item.id === memo.id
            ? { ...item, done: memo.done, doneAt: memo.doneAt, updatedAt: memo.updatedAt }
            : item,
        ),
      )
      if (!rows?.length || isMemoGoneMessage(errMsg)) {
        setError('Ese memo ya no está o cambió. Actualicé la lista.')
        void reload()
      } else {
        setError(memoToggleError(errMsg))
      }
      return
    }
    const row = rows[0]! as MemoRow
    setMemos((current) =>
      current.map((item) =>
        item.id === memo.id ? mapRow(row, item.labelIds ?? memo.labelIds ?? []) : item,
      ),
    )
  }

  function addMemo(memo: MemoItem) {
    setMemos((current) => [memo, ...current])
    setOpen(false)
  }

  function replaceMemo(memo: MemoItem) {
    setMemos((current) => current.map((item) => (item.id === memo.id ? memo : item)))
    setEditing(null)
  }

  function removeMemo(id: string) {
    setMemos((current) => current.filter((item) => item.id !== id))
  }

  function openMemo(memo: MemoItem) {
    setError('')
    setEditing(memo)
  }

  async function undoDelete() {
    const householdId = profile?.householdId
    if (!undoMemo || !householdId) {
      setError(memoUndoError())
      return false
    }
    const { data: row, error: saveError } = await supabase
      .from('memos')
      .insert({
        id: undoMemo.id,
        owner_id: undoMemo.ownerId,
        household_id: householdId,
        text: undoMemo.text,
        shared: undoMemo.shared,
        done: undoMemo.done,
        created_at: undoMemo.createdAt,
        done_at: undoMemo.doneAt ?? null,
      })
      .select(MEMO_SELECT)
      .single()
    if (saveError || !row) {
      setError(memoUndoError())
      return false
    }
    const restoredIds = [...(undoMemo.labelIds ?? [])]
    if (restoredIds.length > 0) {
      const { error: linkError } = await supabase.from('memo_label_links').insert(
        restoredIds.map((labelId) => ({ memo_id: (row as MemoRow).id, label_id: labelId })),
      )
      if (linkError) {
        setError(memoUndoError())
        return false
      }
    }
    const restored = mapRow(row as MemoRow, restoredIds)
    setMemos((current) => {
      const next = [restored, ...current.filter((item) => item.id !== restored.id)]
      return next.sort((a, b) => {
        const aTime = a.createdAt ?? a.updatedAt
        const bTime = b.createdAt ?? b.updatedAt
        return bTime.localeCompare(aTime)
      })
    })
    setUndoMemo(null)
    return true
  }

  function onLabelsChanged(next: MemoLabel[]) {
    setLabels(next)
    if (activeFilterId && !next.some((label) => label.id === activeFilterId)) {
      setFilter(null)
    }
  }

  return (
    <>
      <header className="mb-4 flex min-h-11 items-center">
        <ModuleTitle module="memos" />
      </header>
      <h1 className="mt-2 font-display text-[34px] font-semibold leading-tight">Mis memos</h1>
      <div className="mb-1 mt-2 flex items-center gap-3 text-sm font-medium text-gris">
        <Plantita width={46} height={60} />
        <span>Cuando taches uno, tu plantita florece.</span>
      </div>
      {labelsWithCounts.length > 0 ? (
        <LabelFilterRow
          labels={labelsWithCounts}
          activeId={activeFilterId}
          onSelect={setFilter}
          onEdit={() => setManageOpen(true)}
        />
      ) : null}
      {activeFilterId && filterLabel ? (
        <p className="sr-only" aria-live="polite">
          {labelFilterLive(filteredCount, filterLabel.name)}
        </p>
      ) : null}
      {loading ? <p className="py-8 text-center font-semibold text-muted">Cargando memos…</p> : null}
      {!loading && activeFilterId && filterLabel && filteredCount === 0 ? (
        <div className="mt-7 px-2 text-center">
          <p className="text-base font-semibold text-tinta">No hay memos con «{filterLabel.name}».</p>
          <p className="mt-1 text-sm font-semibold text-gris">
            Cuando le pongas «{filterLabel.name}» a un memo, aparece acá.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex h-11 items-center rounded-full border-[1.5px] border-azul-ink bg-tarjeta px-4 text-sm font-semibold text-tinta"
            onClick={() => setFilter(null)}
          >
            Ver todos
          </button>
        </div>
      ) : null}
      {!loading && !activeFilterId && groups.shared.length === 0 && groups.solo.length === 0 ? (
        <p className="py-8 text-center font-semibold text-muted">Todavía no hay memos.</p>
      ) : null}
      <MemoGroup
        title="Con"
        accent={partnerName}
        accentClass="text-salvia-ink"
        memos={groups.shared}
        labels={labelsWithCounts}
        meId={profile.id}
        partnerName={partnerName}
        onToggle={toggleDone}
        onOpen={openMemo}
      />
      <MemoGroup
        title="Solo"
        accent="vos"
        accentClass="text-rosa-texto"
        memos={groups.solo}
        labels={labelsWithCounts}
        meId={profile.id}
        partnerName={partnerName}
        onToggle={toggleDone}
        onOpen={openMemo}
      />
      {error ? <p className="text-center text-sm font-bold text-tinta">{error}</p> : null}
      <FabSpace avisos={Boolean(toast)} />
      <Fab label="Nuevo memo" onClick={() => setOpen(true)} />
      {toast ? (
        <Toast
          aboveFab
          onUndo={undoMemo ? () => undoDelete() : undefined}
          onDone={() => {
            setToast('')
            setUndoMemo(null)
          }}
        >
          {toast}
        </Toast>
      ) : null}
      <MemoFormSheet
        open={open}
        partnerName={partnerName}
        canShare={Boolean(otherId && profile.householdId)}
        ownerId={profile.id}
        householdId={profile.householdId ?? ''}
        labels={labelsWithCounts}
        onLabelsChanged={onLabelsChanged}
        onClose={() => setOpen(false)}
        onSaved={addMemo}
        onGone={() => {
          setOpen(false)
          setError('Ese memo ya no está o cambió. Actualicé la lista.')
          void reload()
        }}
      />
      {editing && editing.ownerId === profile.id ? (
        <MemoFormSheet
          open
          memo={editing}
          partnerName={partnerName}
          canShare={Boolean(otherId && profile.householdId)}
          ownerId={profile.id}
          householdId={profile.householdId ?? ''}
          labels={labelsWithCounts}
          onLabelsChanged={onLabelsChanged}
          onMemoLabels={patchMemoLabels}
          onClose={() => setEditing(null)}
          onSaved={replaceMemo}
          onDeleted={(memo) => {
            setEditing(null)
            removeMemo(memo.id)
            setUndoMemo(memo)
            setToast('Eliminé el memo.')
          }}
          onGone={() => {
            setEditing(null)
            setError('Ese memo ya no está o cambió. Actualicé la lista.')
            void reload()
          }}
        />
      ) : null}
      {editing && editing.ownerId !== profile.id ? (
        <PartnerMemoSheet
          open
          memo={editing}
          partnerName={partnerName}
          householdId={profile.householdId ?? ''}
          labels={labelsWithCounts}
          onLabelsChanged={onLabelsChanged}
          onMemoLabels={patchMemoLabels}
          onClose={() => setEditing(null)}
          onToggle={() => {
            void toggleDone(editing)
            setEditing(null)
          }}
        />
      ) : null}
      <ManageLabelsSheet
        open={manageOpen}
        myName={profile.displayName || 'vos'}
        partnerName={partnerName}
        householdId={profile.householdId ?? ''}
        labels={labelsWithCounts}
        onClose={() => setManageOpen(false)}
        onLabelsChanged={onLabelsChanged}
        onToast={(message) => setToast(message)}
      />
    </>
  )
}

function LabelFilterRow({
  labels,
  activeId,
  onSelect,
  onEdit,
}: {
  labels: MemoLabel[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onEdit: () => void
}) {
  useEffect(() => {
    const selected = document.querySelector<HTMLElement>('[data-label-filter][aria-checked="true"]')
    selected?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [activeId, labels])

  return (
    <div className="-mx-4 mb-3 mt-3">
      <div
        className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-label="Filtrar por etiqueta"
        style={{ scrollPaddingInline: 16 }}
      >
        <button
          type="button"
          role="radio"
          data-label-filter
          aria-checked={!activeId}
          className={`inline-flex h-11 shrink-0 items-center gap-1 rounded-full border-[1.5px] px-3 text-sm ${
            !activeId
              ? 'border-azul-ink bg-azul-claro font-bold text-tinta'
              : 'border-azul-ink bg-tarjeta font-semibold text-tinta'
          }`}
          onClick={(event) => {
            onSelect(null)
            event.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
          }}
        >
          {!activeId ? <AppIcon name="check" /> : null}
          Todas
        </button>
        {labels.map((label) => {
          const selected = activeId === label.id
          return (
            <button
              key={label.id}
              type="button"
              role="radio"
              data-label-filter
              aria-checked={selected}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-sm ${
                selected
                  ? 'border-azul-ink bg-azul-claro font-bold text-tinta'
                  : 'border-azul-ink bg-tarjeta font-semibold text-tinta'
              }`}
              onClick={(event) => {
                onSelect(label.id)
                event.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
              }}
            >
              {selected ? <AppIcon name="check" /> : <ColorDot color={label.color} />}
              {label.name}
            </button>
          )
        })}
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-azul-ink bg-tarjeta px-3 text-sm font-semibold text-tinta"
          onClick={onEdit}
        >
          <AppIcon name="pen" /> Editar etiquetas
        </button>
      </div>
    </div>
  )
}

function MemoGroup({
  title,
  accent,
  accentClass,
  memos,
  labels,
  meId,
  partnerName,
  onToggle,
  onOpen,
}: {
  title: string
  accent: string
  accentClass: string
  memos: MemoItem[]
  labels: MemoLabel[]
  meId: string
  partnerName: string
  onToggle: (memo: MemoItem) => void
  onOpen: (memo: MemoItem) => void
}) {
  if (memos.length === 0) return null
  const byId = new Map(labels.map((label) => [label.id, label]))
  return (
    <section>
      <h2 className="mb-2 mt-[18px] text-sm font-bold text-gris">
        {title} <span className={accentClass}>{accent}</span>
      </h2>
      {memos.map((memo, index) => {
        const mine = memo.ownerId === meId
        const memoLabels = (memo.labelIds ?? [])
          .map((id) => byId.get(id))
          .filter((label): label is MemoLabel => Boolean(label))
        const showMeta = memo.shared || memo.done || memoLabels.length > 0
        return (
          <article
            key={memo.id}
            className={`flex min-h-[86px] items-center gap-2 border-t-[1.5px] border-dashed px-0 ${index === 0 ? 'border-transparent' : 'border-line'}`}
          >
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center"
              aria-label={memo.done ? `Marcar pendiente: ${memo.text}` : `Marcar hecho: ${memo.text}`}
              aria-pressed={memo.done}
              onClick={() => onToggle(memo)}
            >
              <span
                className={`grid h-[var(--alto-casilla)] w-[var(--alto-casilla)] place-items-center rounded-[var(--radio-casilla)] border-2 border-azul-ink text-sm text-azul-ink ${
                  memo.done ? 'bg-azul-claro' : 'bg-transparent'
                }`}
              >
                {memo.done ? <AppIcon name="check" /> : null}
              </span>
            </button>
            <button
              type="button"
              className="group min-w-0 flex-1 rounded-2xl py-2.5 pl-2 text-left active:bg-azul-claro"
              aria-label={mine ? `Editar: ${memo.text}` : `Ver memo de ${partnerName}: ${memo.text}`}
              onClick={() => onOpen(memo)}
            >
              <p
                className={`line-clamp-3 text-lg font-medium leading-[1.375] ${memo.done ? 'text-gris line-through' : 'text-tinta'}`}
              >
                {memo.text}
              </p>
              {showMeta ? (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-gris">
                  {memo.shared ? (
                    <span className="inline-flex h-[var(--alto-chip)] items-center gap-1.5 rounded-full bg-azul-claro px-2.5 text-sm font-semibold text-azul-ink group-active:bg-tarjeta">
                      <AppIcon name="user-group" /> Las dos
                    </span>
                  ) : null}
                  {memo.done ? <span>Hecho</span> : null}
                  {memo.shared && memo.ownerId !== meId ? (
                    <span className="inline-flex h-[var(--alto-chip)] items-center rounded-full bg-azul-claro px-2.5 text-sm font-semibold text-azul-ink">
                      De <span className="ml-1 font-bold text-salvia-ink">{partnerName}</span>
                    </span>
                  ) : null}
                  {memoLabels.map((label) => (
                    <LabelPill key={label.id} label={label} />
                  ))}
                </p>
              ) : null}
            </button>
          </article>
        )
      })}
    </section>
  )
}

function MemoLabelPicker({
  labels,
  selectedIds,
  disabled = false,
  onChange,
  onCreate,
}: {
  labels: MemoLabel[]
  selectedIds: string[]
  disabled?: boolean
  onChange: (next: string[]) => void
  onCreate: () => void
}) {
  const helpId = useId()
  const atCap = selectedIds.length >= MEMO_LABEL_MAX

  function toggle(label: MemoLabel) {
    if (disabled) return
    const selected = selectedIds.includes(label.id)
    if (!selected && !canToggleMemoLabel(selectedIds, label.id)) return
    const next = selected ? selectedIds.filter((id) => id !== label.id) : [...selectedIds, label.id]
    onChange(next)
  }

  return (
    <div className="mt-3.5">
      <p className="mb-2 text-sm font-semibold text-gris">Etiquetas</p>
      {labels.length === 0 ? (
        <p className="mb-2 text-sm font-semibold text-gris">Todavía no tenés etiquetas. Sirven para filtrar la lista.</p>
      ) : null}
      <div role="group" aria-label="Etiquetas" className="flex flex-wrap gap-2">
        {labels.map((label) => {
          const pressed = selectedIds.includes(label.id)
          const blocked = !pressed && atCap
          const classes = labelChipClasses(label.color)
          return (
            <button
              key={label.id}
              type="button"
              aria-pressed={pressed}
              aria-disabled={blocked || disabled || undefined}
              aria-describedby={blocked ? helpId : undefined}
              disabled={disabled}
              onClick={() => {
                if (blocked) return
                toggle(label)
              }}
              className={`inline-flex h-11 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-sm font-semibold ${
                blocked
                  ? 'border-dashed border-gris-claro bg-fondo-desactivado text-gris'
                  : pressed
                    ? `${classes.bg} ${classes.border} ${classes.ink}`
                    : `border-azul bg-tarjeta text-tinta`
              }`}
            >
              {pressed ? <AppIcon name="check" /> : <ColorDot color={label.color} />}
              {label.name}
            </button>
          )
        })}
        <button
          type="button"
          aria-disabled={atCap || disabled || undefined}
          aria-describedby={atCap ? helpId : undefined}
          disabled={disabled}
          onClick={() => {
            if (atCap) return
            onCreate()
          }}
          className={`inline-flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-dashed px-3 text-sm font-semibold ${
            atCap ? 'border-gris-claro bg-fondo-desactivado text-gris' : 'border-azul-ink bg-tarjeta text-tinta'
          }`}
        >
          <AppIcon name="plus" /> Nueva etiqueta
        </button>
      </div>
      {atCap ? (
        <p id={helpId} className="mt-2 text-sm font-semibold text-gris">
          Hasta 3 etiquetas por memo. Sacá una para poner otra o crear una nueva.
        </p>
      ) : null}
    </div>
  )
}

function MemoFormSheet({
  open,
  memo,
  partnerName,
  canShare,
  ownerId,
  householdId,
  labels,
  onLabelsChanged,
  onMemoLabels,
  onClose,
  onSaved,
  onDeleted,
  onGone,
}: {
  open: boolean
  memo?: MemoItem
  partnerName: string
  canShare: boolean
  ownerId: string
  householdId: string
  labels: MemoLabel[]
  onLabelsChanged: (labels: MemoLabel[]) => void
  onMemoLabels?: (memoId: string, labelIds: string[]) => void
  onClose: () => void
  onSaved: (memo: MemoItem) => void
  onDeleted?: (memo: MemoItem) => void
  onGone?: () => void
}) {
  const [text, setText] = useState('')
  const [shared, setShared] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [labelError, setLabelError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [newLabelOpen, setNewLabelOpen] = useState(false)
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  const editing = Boolean(memo)
  const busy = saving || deleting
  const trimmed = text.trim()
  const dirty = editing
    ? trimmed !== (memo?.text ?? '') || shared !== Boolean(memo?.shared)
    : trimmed.length > 0
  const empty = trimmed.length === 0
  const canSave = !busy && !empty && dirty
  const charHint = memoCharHint(text.length)

  useEffect(() => {
    if (!open) return
    setText(memo?.text ?? '')
    setShared(memo?.shared ?? false)
    setSelectedIds([...(memo?.labelIds ?? [])])
    setError('')
    setLabelError('')
    setDeleteError('')
    setSaving(false)
    setDeleting(false)
    setSaveFailed(false)
    setDeleteFailed(false)
    setNewLabelOpen(false)
  }, [open, memo])

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${Math.max(88, field.scrollHeight)}px`
  }, [text, open])

  async function persistToggle(nextIds: string[], previous: string[]) {
    if (!memo || !onMemoLabels) {
      setSelectedIds(nextIds)
      return
    }
    const added = nextIds.find((id) => !previous.includes(id))
    const removed = previous.find((id) => !nextIds.includes(id))
    const label = labels.find((item) => item.id === (added ?? removed))
    setSelectedIds(nextIds)
    onMemoLabels(memo.id, nextIds)
    if (added) {
      const { error: saveError } = await supabase
        .from('memo_label_links')
        .insert({ memo_id: memo.id, label_id: added })
      if (saveError) {
        setSelectedIds(previous)
        onMemoLabels(memo.id, previous)
        setLabelError(memoLabelAttachError(label?.name ?? 'la etiqueta'))
      }
      return
    }
    if (removed) {
      const { error: saveError } = await supabase
        .from('memo_label_links')
        .delete()
        .eq('memo_id', memo.id)
        .eq('label_id', removed)
      if (saveError) {
        setSelectedIds(previous)
        onMemoLabels(memo.id, previous)
        setLabelError(memoLabelDetachError(label?.name ?? 'la etiqueta'))
      }
    }
  }

  async function save() {
    if (!canSave || !householdId) return
    setSaving(true)
    setError('')
    setSaveFailed(false)
    if (memo) {
      const { data, error: saveError } = await supabase
        .from('memos')
        .update({ text: trimmed, shared })
        .eq('id', memo.id)
        .select(MEMO_SELECT)
      setSaving(false)
      const errMsg = saveError ? saveError.message : undefined
      if (saveError || !data?.length) {
        if (!data?.length || isMemoGoneMessage(errMsg)) {
          onGone?.()
          return
        }
        setError(memoSaveError(errMsg))
        setSaveFailed(true)
        return
      }
      onSaved(mapRow(data[0]! as MemoRow, selectedIds))
      return
    }
    const { data, error: saveError } = await supabase
      .from('memos')
      .insert({ owner_id: ownerId, household_id: householdId, text: trimmed, shared, done: false })
      .select(MEMO_SELECT)
      .single()
    if (saveError || !data) {
      setSaving(false)
      setError(memoSaveError(saveError ? saveError.message : undefined))
      setSaveFailed(true)
      return
    }
    const created = data as MemoRow
    if (selectedIds.length > 0) {
      const { error: linkError } = await supabase
        .from('memo_label_links')
        .insert(selectedIds.map((labelId) => ({ memo_id: created.id, label_id: labelId })))
      if (linkError) {
        setSaving(false)
        setError(memoSaveError(linkError.message))
        setSaveFailed(true)
        return
      }
    }
    setSaving(false)
    onSaved(mapRow(created, selectedIds))
  }

  async function remove() {
    if (!memo || busy) return
    setDeleting(true)
    setDeleteError('')
    setDeleteFailed(false)
    const { data, error: removeError } = await supabase
      .from('memos')
      .delete()
      .eq('id', memo.id)
      .select('id')
    setDeleting(false)
    const errMsg = removeError ? removeError.message : undefined
    if (removeError || !data?.length) {
      if (!data?.length || isMemoGoneMessage(errMsg)) {
        onGone?.()
        return
      }
      setDeleteError(memoDeleteError(errMsg))
      setDeleteFailed(true)
      return
    }
    onDeleted?.({ ...memo, labelIds: selectedIds })
  }

  const saveLabel = saving ? 'Guardando…' : saveFailed ? 'Probar de nuevo' : editing ? 'Guardar cambios' : 'Guardar'

  return (
    <>
      <Sheet open={open} title={editing ? 'Editar memo' : 'Nuevo memo'} onClose={busy ? () => undefined : onClose} footer={
        <div className="space-y-2">
          {error ? <FieldError>{error}</FieldError> : null}
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!canSave && !saveFailed}
            aria-busy={saving || undefined}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {saving ? <BusyMark /> : <AppIcon name="check" />}
              {saveLabel}
            </span>
          </Button>
        </div>
      }>
        {memo?.done ? (
          <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-gris">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-azul-claro text-azul-ink">
              <AppIcon name="check" />
            </span>
            Está hecho. Sigue tachado cuando guardes.
          </p>
        ) : null}
        <label className="block">
          <span className="sr-only">Texto del memo</span>
          <textarea
            ref={fieldRef}
            value={text}
            maxLength={400}
            rows={3}
            placeholder="Anotá algo para acordarte"
            disabled={busy}
            onChange={(event) => {
              setText(event.target.value)
              setSaveFailed(false)
              setError('')
            }}
            className={`min-h-[88px] w-full resize-none overflow-hidden rounded-[20px] border-2 px-4 py-3.5 text-base font-bold outline-none placeholder:font-semibold placeholder:text-muted focus-visible:border-azul-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-ink ${
              busy
                ? 'border-dashed border-gris-claro bg-fondo-desactivado text-gris'
                : 'border-azul bg-sand-soft text-title'
            }`}
          />
        </label>
        {charHint ? (
          <p
            aria-live="polite"
            className={`mt-1.5 text-right text-sm ${text.length >= 400 ? 'font-bold text-tinta' : 'font-semibold text-gris'}`}
          >
            {charHint}
          </p>
        ) : null}
        {editing && empty ? (
          <p aria-live="polite" className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-tinta">
            <AppIcon name="circle-info" className="mt-0.5 shrink-0 text-azul-ink" />
            <span>Escribí algo para guardar. Si ya no lo necesitás, eliminalo.</span>
          </p>
        ) : null}
        {canShare ? (
          <div
            className={`mt-2.5 flex min-h-16 items-center gap-3 rounded-[20px] px-3.5 py-3 ${
              shared ? 'bg-azul-claro' : 'border-[1.5px] border-azul bg-card'
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-azul-claro text-azul-ink">
              <AppIcon name="user-group" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Compartir con {partnerName}</span>
              <span className="block text-sm font-semibold text-muted">
                {memoShareDetail(shared, Boolean(memo?.shared), partnerName)}
              </span>
            </span>
            <ModuleSwitch
              on={shared}
              tone="azul"
              disabled={busy}
              label={`Compartir con ${partnerName}`}
              onToggle={() => {
                setShared((current) => !current)
                setSaveFailed(false)
                setError('')
              }}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-muted">Cuando se sume tu compañera vas a poder compartir memos.</p>
        )}
        <MemoLabelPicker
          labels={labels}
          selectedIds={selectedIds}
          disabled={busy}
          onChange={(next) => {
            setLabelError('')
            if (editing) void persistToggle(next, selectedIds)
            else setSelectedIds(next)
          }}
          onCreate={() => setNewLabelOpen(true)}
        />
        {labelError ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-bold text-tinta">
            <AppIcon name="triangle-exclamation" className="mt-0.5 shrink-0" />
            <span>{labelError}</span>
          </p>
        ) : null}
        {editing ? (
          <div className="mt-3">
            {deleteError ? <FieldError>{deleteError}</FieldError> : null}
            <button
              type="button"
              disabled={busy && !deleting}
              aria-busy={deleting || undefined}
              onClick={() => void remove()}
              className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-base font-semibold ${
                deleting ? 'text-tinta' : busy ? 'text-gris' : 'text-tinta'
              }`}
            >
              {deleting ? <BusyMark /> : <AppIcon name="trash" />}
              {deleting ? 'Eliminando…' : deleteFailed ? 'Probar de nuevo: eliminar' : 'Eliminar memo'}
            </button>
          </div>
        ) : null}
      </Sheet>
      <NewLabelSheet
        open={newLabelOpen}
        householdId={householdId}
        labels={labels}
        applyOnCreate
        onClose={() => setNewLabelOpen(false)}
        onCreated={(label) => {
          const nextLabels = [...labels, { ...label, count: 0 }]
          onLabelsChanged(nextLabels)
          const nextIds = canToggleMemoLabel(selectedIds, label.id)
            ? [...selectedIds, label.id]
            : selectedIds
          if (editing && nextIds !== selectedIds) {
            void persistToggle(nextIds, selectedIds)
          } else {
            setSelectedIds(nextIds)
          }
          setNewLabelOpen(false)
        }}
      />
    </>
  )
}

function PartnerMemoSheet({
  open,
  memo,
  partnerName,
  householdId,
  labels,
  onLabelsChanged,
  onMemoLabels,
  onClose,
  onToggle,
}: {
  open: boolean
  memo: MemoItem
  partnerName: string
  householdId: string
  labels: MemoLabel[]
  onLabelsChanged: (labels: MemoLabel[]) => void
  onMemoLabels: (memoId: string, labelIds: string[]) => void
  onClose: () => void
  onToggle: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([...(memo.labelIds ?? [])])
  const [labelError, setLabelError] = useState('')
  const [newLabelOpen, setNewLabelOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedIds([...(memo.labelIds ?? [])])
    setLabelError('')
    setNewLabelOpen(false)
  }, [open, memo])

  async function persistToggle(nextIds: string[], previous: string[]) {
    const added = nextIds.find((id) => !previous.includes(id))
    const removed = previous.find((id) => !nextIds.includes(id))
    const label = labels.find((item) => item.id === (added ?? removed))
    setSelectedIds(nextIds)
    onMemoLabels(memo.id, nextIds)
    setLabelError('')
    if (added) {
      const { error: saveError } = await supabase
        .from('memo_label_links')
        .insert({ memo_id: memo.id, label_id: added })
      if (saveError) {
        setSelectedIds(previous)
        onMemoLabels(memo.id, previous)
        setLabelError(memoLabelAttachError(label?.name ?? 'la etiqueta'))
      }
      return
    }
    if (removed) {
      const { error: saveError } = await supabase
        .from('memo_label_links')
        .delete()
        .eq('memo_id', memo.id)
        .eq('label_id', removed)
      if (saveError) {
        setSelectedIds(previous)
        onMemoLabels(memo.id, previous)
        setLabelError(memoLabelDetachError(label?.name ?? 'la etiqueta'))
      }
    }
  }

  return (
    <>
      <Sheet
        open={open}
        title={`Memo de ${partnerName}`}
        onClose={onClose}
        footer={
          <Button type="button" onClick={onToggle}>
            <span className="inline-flex items-center justify-center gap-2">
              <AppIcon name="check" />
              {memo.done ? 'Marcar pendiente' : 'Marcar hecho'}
            </span>
          </Button>
        }
      >
        <p className="text-lg font-medium text-tinta">{memo.text}</p>
        <p className="mt-2">
          <span className="inline-flex h-[var(--alto-chip)] items-center gap-1.5 rounded-full bg-azul-claro px-2.5 text-sm font-semibold text-azul-ink">
            <AppIcon name="user-group" /> Las dos
          </span>
        </p>
        <p className="mt-4 flex items-start gap-2 rounded-[20px] bg-azul-claro px-3.5 py-3 text-base font-semibold text-tinta">
          <AppIcon name="lock" className="mt-0.5 shrink-0 text-azul-ink" />
          <span>
            Lo escribió {partnerName}. Solo ella lo puede cambiar o eliminar. Vos lo podés tachar y cambiarle las
            etiquetas.
          </span>
        </p>
        <MemoLabelPicker
          labels={labels}
          selectedIds={selectedIds}
          onChange={(next) => void persistToggle(next, selectedIds)}
          onCreate={() => setNewLabelOpen(true)}
        />
        {labelError ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-bold text-tinta">
            <AppIcon name="triangle-exclamation" className="mt-0.5 shrink-0" />
            <span>{labelError}</span>
          </p>
        ) : null}
      </Sheet>
      <NewLabelSheet
        open={newLabelOpen}
        householdId={householdId}
        labels={labels}
        applyOnCreate
        onClose={() => setNewLabelOpen(false)}
        onCreated={(label) => {
          const nextLabels = [...labels, { ...label, count: 0 }]
          onLabelsChanged(nextLabels)
          if (canToggleMemoLabel(selectedIds, label.id)) {
            void persistToggle([...selectedIds, label.id], selectedIds)
          }
          setNewLabelOpen(false)
        }}
      />
    </>
  )
}

function ColorRadios({
  value,
  onChange,
  name,
}: {
  value: MemoLabelColor
  onChange: (color: MemoLabelColor) => void
  name: string
}) {
  return (
    <div role="radiogroup" aria-label="Color" className="mt-2 flex gap-2.5">
      {MEMO_LABEL_COLORS.map((color) => {
        const selected = value === color
        const classes = labelChipClasses(color)
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={MEMO_LABEL_COLOR_NAMES[color]}
            className={`grid h-11 w-11 place-items-center rounded-full border-[1.5px] ${classes.bg} ${classes.border} ${
              selected ? `outline outline-[2.5px] outline-offset-2 ${classes.outline}` : ''
            }`}
            onClick={() => onChange(color)}
          >
            {selected ? <AppIcon name="check" className={classes.ink} /> : null}
          </button>
        )
      })}
      <span className="sr-only">{name}</span>
    </div>
  )
}

function NewLabelSheet({
  open,
  householdId,
  labels,
  applyOnCreate,
  onClose,
  onCreated,
}: {
  open: boolean
  householdId: string
  labels: MemoLabel[]
  applyOnCreate: boolean
  onClose: () => void
  onCreated: (label: { id: string; name: string; color: MemoLabelColor }) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<MemoLabelColor>('menta')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setColor(defaultMemoLabelColor(labels.map((label) => label.color)))
    setSaving(false)
    setError('')
  }, [open, labels])

  async function create() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    if (labels.some((label) => label.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(duplicateLabelNameError(trimmed))
      return
    }
    if (!householdId) {
      setError(memoLabelCreateError())
      return
    }
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('memo_labels')
      .insert({ household_id: householdId, name: trimmed, color })
      .select('id, name, color')
      .single()
    setSaving(false)
    if (saveError || !data || !isMemoLabelColor(data.color)) {
      setError(memoLabelCreateError(saveError?.message))
      return
    }
    onCreated({ id: data.id, name: data.name, color: data.color })
  }

  const trimmed = name.trim()
  const canCreate = trimmed.length > 0 && !saving

  return (
    <Sheet
      open={open}
      layer="confirm"
      title="Nueva etiqueta"
      onClose={saving ? () => undefined : onClose}
      footer={
        <div className="space-y-2">
          {error ? <FieldError>{error}</FieldError> : null}
          <Button type="button" onClick={() => void create()} disabled={!canCreate} aria-busy={saving || undefined}>
            <span className="inline-flex items-center justify-center gap-2">
              {saving ? <BusyMark /> : <AppIcon name="check" />}
              {applyOnCreate ? 'Crear y poner' : 'Crear'}
            </span>
          </Button>
        </div>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-gris">Nombre</span>
        <input
          value={name}
          maxLength={MEMO_LABEL_NAME_MAX}
          aria-label="Nombre de la etiqueta"
          onChange={(event) => {
            setName(event.target.value)
            setError('')
          }}
          className="min-h-11 w-full rounded-2xl border-2 border-azul-ink bg-sand-soft px-4 py-3 text-base font-bold text-title outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-ink"
        />
      </label>
      <p className="mt-1.5 text-right text-sm font-semibold text-gris">Hasta 24 caracteres.</p>
      <p className="mt-3 text-sm font-semibold text-gris">Color</p>
      <ColorRadios value={color} onChange={setColor} name={`Color`} />
    </Sheet>
  )
}

function ManageLabelsSheet({
  open,
  myName,
  partnerName,
  householdId,
  labels,
  onClose,
  onLabelsChanged,
  onToast,
}: {
  open: boolean
  myName: string
  partnerName: string
  householdId: string
  labels: MemoLabel[]
  onClose: () => void
  onLabelsChanged: (labels: MemoLabel[]) => void
  onToast: (message: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<MemoLabelColor>('menta')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<MemoLabel | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEditingId(null)
    setError('')
    setNewOpen(false)
    setPendingDelete(null)
    setDeleteError(null)
  }, [open])

  function startEdit(label: MemoLabel) {
    setEditingId(label.id)
    setEditName(label.name)
    setEditColor(label.color)
    setError('')
  }

  async function saveEdit() {
    if (!editingId || saving) return
    const trimmed = editName.trim()
    if (!trimmed) return
    if (
      labels.some(
        (label) => label.id !== editingId && label.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setError(duplicateLabelNameError(trimmed))
      return
    }
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('memo_labels')
      .update({ name: trimmed, color: editColor })
      .eq('id', editingId)
      .select('id, name, color')
      .single()
    setSaving(false)
    if (saveError || !data || !isMemoLabelColor(data.color)) {
      setError(memoLabelRenameError(saveError?.message))
      return
    }
    onLabelsChanged(
      labels.map((label) =>
        label.id === editingId ? { ...label, name: data.name, color: data.color } : label,
      ),
    )
    setEditingId(null)
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setDeleteError(null)
    const { error: removeError } = await supabase.from('memo_labels').delete().eq('id', pendingDelete.id)
    setDeleting(false)
    if (removeError) {
      setDeleteError(memoLabelDeleteError())
      return
    }
    const name = pendingDelete.name
    onLabelsChanged(labels.filter((label) => label.id !== pendingDelete.id))
    setPendingDelete(null)
    onToast(`Eliminé la etiqueta «${name}».`)
  }

  return (
    <>
      <Sheet open={open} title="Etiquetas" onClose={onClose}>
        <p className="mb-2 text-sm font-semibold text-gris">
          Las comparten {myName} y {partnerName}.
        </p>
        {error ? <FieldError>{error}</FieldError> : null}
        <ul>
          {labels.map((label, index) => {
            const classes = labelChipClasses(label.color)
            const editing = editingId === label.id
            return (
              <li
                key={label.id}
                className={`min-h-[60px] border-t-[1.5px] border-dashed py-2 ${index === 0 ? 'border-transparent' : 'border-line'}`}
              >
                {editing ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        maxLength={MEMO_LABEL_NAME_MAX}
                        aria-label="Nombre de la etiqueta"
                        onChange={(event) => setEditName(event.target.value)}
                        className="min-h-11 min-w-0 flex-1 rounded-2xl border-2 border-azul-ink bg-sand-soft px-3 py-2 text-base font-bold outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-ink"
                      />
                      <button
                        type="button"
                        aria-label="Guardar nombre y color"
                        disabled={saving || editName.trim().length === 0}
                        onClick={() => void saveEdit()}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-tinta bg-mostaza text-tinta"
                      >
                        {saving ? <BusyMark /> : <AppIcon name="check" />}
                      </button>
                    </div>
                    <ColorRadios
                      value={editColor}
                      onChange={setEditColor}
                      name={`Color de «${label.name}»`}
                    />
                    <p className="mt-2 text-sm font-semibold text-gris">Cambia también para {partnerName}.</p>
                  </div>
                ) : (
                  <div className="flex min-h-11 items-center gap-2">
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${classes.bg} ${classes.ink}`}
                    >
                      <AppIcon name="tag" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-tinta">{label.name}</span>
                      <span className="block text-sm font-semibold text-gris">{labelCountText(label.count)}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Cambiar «${label.name}»`}
                      className="grid h-11 w-11 place-items-center text-gris"
                      onClick={() => startEdit(label)}
                    >
                      <AppIcon name="pen" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar «${label.name}»`}
                      className="grid h-11 w-11 place-items-center text-gris"
                      onClick={() => {
                        setPendingDelete(label)
                        setDeleteError(null)
                      }}
                    >
                      <AppIcon name="trash" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-azul-ink px-3 text-sm font-semibold text-tinta"
          onClick={() => setNewOpen(true)}
        >
          <AppIcon name="plus" /> Nueva etiqueta
        </button>
      </Sheet>
      <NewLabelSheet
        open={newOpen}
        householdId={householdId}
        labels={labels}
        applyOnCreate={false}
        onClose={() => setNewOpen(false)}
        onCreated={(label) => {
          onLabelsChanged([...labels, { ...label, count: 0 }])
          setNewOpen(false)
        }}
      />
      <ConfirmSheet
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `¿Eliminar «${pendingDelete.name}»?` : '¿Eliminar?'}
        onClose={() => {
          if (!deleting) setPendingDelete(null)
        }}
        confirmLabel="Eliminar etiqueta"
        onConfirm={() => void confirmDelete()}
        busy={deleting}
        variant="danger"
        error={deleteError}
        note="No se puede deshacer."
      >
        {pendingDelete ? <p className="text-base font-semibold text-tinta">{deleteLabelBody(pendingDelete.count, partnerName)}</p> : null}
      </ConfirmSheet>
    </>
  )
}
