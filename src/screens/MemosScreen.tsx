import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { Plantita } from '../components/Adornos.tsx'
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
  groupMemos,
  isMemoGoneMessage,
  memoCharHint,
  memoDeleteError,
  memoLoadError,
  memoSaveError,
  memoShareDetail,
  memoToggleError,
  memoUndoError,
  type MemoItem,
} from '../lib/memos.ts'
import { supabase } from '../lib/supabase.ts'

const EMPTY: MemoItem[] = []

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

function mapRow(row: MemoRow): MemoItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    text: row.text,
    done: row.done,
    shared: row.shared,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    doneAt: row.done_at,
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

export function MemosScreen() {
  const { profile } = useAuth()
  const { data } = useFinance()
  const { enabled, ready } = useModules()
  const [memos, setMemos] = useState<MemoItem[]>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MemoItem | null>(null)
  const [toast, setToast] = useState('')
  const [undoMemo, setUndoMemo] = useState<MemoItem | null>(null)

  async function reload() {
    if (!profile) return
    const { data: rows, error: loadError } = await supabase
      .from('memos')
      .select('id, owner_id, text, done, shared, updated_at, created_at, done_at')
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(memoLoadError())
      setMemos(EMPTY)
      return
    }
    setError('')
    setMemos((rows ?? []).map(mapRow))
  }

  useEffect(() => {
    if (!profile) return
    let active = true
    setLoading(true)
    void supabase
      .from('memos')
      .select('id, owner_id, text, done, shared, updated_at, created_at, done_at')
      .order('created_at', { ascending: false })
      .then(({ data: rows, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setError(memoLoadError())
          setMemos(EMPTY)
        } else {
          setError('')
          setMemos((rows ?? []).map(mapRow))
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    if (!toast) return
    const node = document.querySelector<HTMLElement>('[role="status"]')
    node?.focus()
  }, [toast])

  if (!profile) return null
  if (ready && !enabled.includes('memos')) return <Navigate to="/" replace />

  const otherId = data ? partnerId(data, profile.id) : null
  const partnerName = (otherId && data?.names[otherId]) || 'tu compañera'
  const groups = groupMemos(memos, profile.id)

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
      .select('id, owner_id, text, done, shared, updated_at, created_at, done_at')
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
    setMemos((current) => current.map((item) => (item.id === memo.id ? mapRow(rows[0]!) : item)))
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
      .select('id, owner_id, text, done, shared, updated_at, created_at, done_at')
      .single()
    if (saveError || !row) {
      setError(memoUndoError())
      return false
    }
    setMemos((current) => {
      const next = [mapRow(row), ...current.filter((item) => item.id !== row.id)]
      return next.sort((a, b) => {
        const aTime = a.createdAt ?? a.updatedAt
        const bTime = b.createdAt ?? b.updatedAt
        return bTime.localeCompare(aTime)
      })
    })
    setUndoMemo(null)
    return true
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
      {loading ? <p className="py-8 text-center font-semibold text-muted">Cargando memos…</p> : null}
      {!loading && groups.shared.length === 0 && groups.solo.length === 0 ? (
        <p className="py-8 text-center font-semibold text-muted">Todavía no hay memos.</p>
      ) : null}
      <MemoGroup
        title="Con"
        accent={partnerName}
        accentClass="text-salvia-ink"
        memos={groups.shared}
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
          onClose={() => setEditing(null)}
          onToggle={() => {
            void toggleDone(editing)
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}

function MemoGroup({
  title,
  accent,
  accentClass,
  memos,
  meId,
  partnerName,
  onToggle,
  onOpen,
}: {
  title: string
  accent: string
  accentClass: string
  memos: MemoItem[]
  meId: string
  partnerName: string
  onToggle: (memo: MemoItem) => void
  onOpen: (memo: MemoItem) => void
}) {
  if (memos.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 mt-[18px] text-sm font-bold text-gris">
        {title} <span className={accentClass}>{accent}</span>
      </h2>
      {memos.map((memo, index) => {
        const mine = memo.ownerId === meId
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
              {memo.shared || memo.done ? (
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
                </p>
              ) : null}
            </button>
          </article>
        )
      })}
    </section>
  )
}

function MemoFormSheet({
  open,
  memo,
  partnerName,
  canShare,
  ownerId,
  householdId,
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
  onClose: () => void
  onSaved: (memo: MemoItem) => void
  onDeleted?: (memo: MemoItem) => void
  onGone?: () => void
}) {
  const [text, setText] = useState('')
  const [shared, setShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
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
    setError('')
    setDeleteError('')
    setSaving(false)
    setDeleting(false)
    setSaveFailed(false)
    setDeleteFailed(false)
  }, [open, memo])

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${Math.max(88, field.scrollHeight)}px`
  }, [text, open])

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
        .select('id, owner_id, text, done, shared, updated_at, created_at, done_at')
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
      onSaved(mapRow(data[0]!))
      return
    }
    const { data, error: saveError } = await supabase
      .from('memos')
      .insert({ owner_id: ownerId, household_id: householdId, text: trimmed, shared, done: false })
      .select('id, owner_id, text, done, shared, updated_at, created_at, done_at')
      .single()
    setSaving(false)
    if (saveError || !data) {
      setError(memoSaveError(saveError ? saveError.message : undefined))
      setSaveFailed(true)
      return
    }
    onSaved(mapRow(data))
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
    onDeleted?.(memo)
  }

  const saveLabel = saving ? 'Guardando…' : saveFailed ? 'Probar de nuevo' : editing ? 'Guardar cambios' : 'Guardar'

  return (
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
  )
}

function PartnerMemoSheet({
  open,
  memo,
  partnerName,
  onClose,
  onToggle,
}: {
  open: boolean
  memo: MemoItem
  partnerName: string
  onClose: () => void
  onToggle: () => void
}) {
  return (
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
      <p className="mt-4 flex items-start gap-2 text-base font-semibold text-tinta">
        <AppIcon name="lock" className="mt-0.5 shrink-0 text-azul-ink" />
        <span>
          Lo escribió {partnerName}. Solo ella lo puede cambiar o eliminar. Vos lo podés tachar.
        </span>
      </p>
    </Sheet>
  )
}
