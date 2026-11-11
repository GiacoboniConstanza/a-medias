import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { Plantita } from '../components/Adornos.tsx'
import { Fab, FabSpace } from '../components/Fab.tsx'
import { ModuleTitle } from '../components/ModulePill.tsx'
import { ModuleSwitch } from '../components/ModuleSwitch.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { partnerId } from '../lib/derive.ts'
import { groupMemos, type MemoItem } from '../lib/memos.ts'
import { supabase } from '../lib/supabase.ts'

const EMPTY: MemoItem[] = []

export function MemosScreen() {
  const { profile } = useAuth()
  const { data } = useFinance()
  const { enabled, ready } = useModules()
  const [memos, setMemos] = useState<MemoItem[]>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    let active = true
    supabase
      .from('memos')
      .select('id, owner_id, text, done, shared, updated_at')
      .order('created_at', { ascending: false })
      .then(({ data: rows, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setError(loadError.message)
          setMemos(EMPTY)
        } else {
          setError('')
          setMemos(
            (rows ?? []).map((row) => ({
              id: row.id,
              ownerId: row.owner_id,
              text: row.text,
              done: row.done,
              shared: row.shared,
              updatedAt: row.updated_at,
            })),
          )
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile])

  if (!profile) return null
  if (ready && !enabled.includes('memos')) return <Navigate to="/" replace />

  const otherId = data ? partnerId(data, profile.id) : null
  const partnerName = (otherId && data?.names[otherId]) || 'tu compañera'
  const groups = groupMemos(memos, profile.id)

  async function toggleDone(memo: MemoItem) {
    const next = !memo.done
    setMemos((current) =>
      current.map((item) => (item.id === memo.id ? { ...item, done: next, updatedAt: new Date().toISOString() } : item)),
    )
    const { error: saveError } = await supabase.from('memos').update({ done: next }).eq('id', memo.id)
    if (saveError) {
      setMemos((current) =>
        current.map((item) => (item.id === memo.id ? { ...item, done: memo.done, updatedAt: memo.updatedAt } : item)),
      )
      setError(saveError.message)
    }
  }

  function addMemo(memo: MemoItem) {
    setMemos((current) => [memo, ...current])
    setOpen(false)
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
      <MemoGroup title="Con" accent={partnerName} accentClass="text-salvia-ink" memos={groups.shared} meId={profile.id} partnerName={partnerName} onToggle={toggleDone} />
      <MemoGroup title="Solo" accent="vos" accentClass="text-rosa-texto" memos={groups.solo} meId={profile.id} partnerName={partnerName} onToggle={toggleDone} />
      {error ? <p className="text-center text-sm font-bold text-tinta">{error}</p> : null}
      <FabSpace />
      <Fab label="Nuevo memo" onClick={() => setOpen(true)} />
      <NewMemoSheet
        open={open}
        partnerName={partnerName}
        canShare={Boolean(otherId && profile.householdId)}
        ownerId={profile.id}
        householdId={profile.householdId ?? ''}
        onClose={() => setOpen(false)}
        onSaved={addMemo}
      />
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
}: {
  title: string
  accent: string
  accentClass: string
  memos: MemoItem[]
  meId: string
  partnerName: string
  onToggle: (memo: MemoItem) => void
}) {
  if (memos.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 mt-[18px] text-sm font-bold text-gris">
        {title} <span className={accentClass}>{accent}</span>
      </h2>
      {memos.map((memo, index) => (
        <article
          key={memo.id}
          className={`flex h-[86px] items-center gap-2 border-t-[1.5px] border-dashed px-0 ${index === 0 ? 'border-transparent' : 'border-line'}`}
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
          <div className="min-w-0 flex-1">
            <p className={`text-lg font-medium leading-snug ${memo.done ? 'text-gris line-through' : 'text-tinta'}`}>{memo.text}</p>
            {memo.shared || memo.done ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-gris">
                {memo.shared ? (
                  <span className="inline-flex h-[var(--alto-chip)] items-center gap-1.5 rounded-full bg-azul-claro px-2.5 text-sm font-semibold text-azul-ink">
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
          </div>
        </article>
      ))}
    </section>
  )
}

function NewMemoSheet({
  open,
  partnerName,
  canShare,
  ownerId,
  householdId,
  onClose,
  onSaved,
}: {
  open: boolean
  partnerName: string
  canShare: boolean
  ownerId: string
  householdId: string
  onClose: () => void
  onSaved: (memo: MemoItem) => void
}) {
  const [text, setText] = useState('')
  const [shared, setShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setText('')
    setShared(false)
    setError('')
    setSaving(false)
  }, [open])

  async function save() {
    const trimmed = text.trim()
    if (!trimmed || saving || !householdId) return
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('memos')
      .insert({ owner_id: ownerId, household_id: householdId, text: trimmed, shared, done: false })
      .select('id, owner_id, text, done, shared, updated_at')
      .single()
    setSaving(false)
    if (saveError || !data) {
      setError(saveError?.message ?? 'No se pudo guardar el memo.')
      return
    }
    onSaved({
      id: data.id,
      ownerId: data.owner_id,
      text: data.text,
      done: data.done,
      shared: data.shared,
      updatedAt: data.updated_at,
    })
  }

  return (
    <Sheet
      open={open}
      title="Nuevo memo"
      onClose={onClose}
      footer={
        <Button type="button" onClick={() => void save()} disabled={saving || text.trim().length === 0}>
          <span className="inline-flex items-center justify-center gap-2">
            <AppIcon name="check" /> Guardar
          </span>
        </Button>
      }
    >
      <label className="block">
        <span className="sr-only">Texto del memo</span>
        <textarea
          value={text}
          maxLength={400}
          rows={3}
          placeholder="Anotá algo para acordarte"
          onChange={(event) => setText(event.target.value)}
          className="min-h-[88px] w-full rounded-[20px] border-2 border-azul bg-sand-soft px-4 py-3.5 text-base font-bold text-title outline-none placeholder:font-semibold placeholder:text-muted"
        />
      </label>
      {canShare ? (
        <div className={`mt-2.5 flex min-h-16 items-center gap-3 rounded-[20px] px-3.5 py-3 ${shared ? 'bg-azul-claro' : 'bg-card'}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-azul-claro text-azul-ink">
            <AppIcon name="user-group" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Compartir con {partnerName}</span>
            <span className="block text-sm font-semibold text-muted">Lo ve en su Inicio y cualquiera lo puede tachar</span>
          </span>
          <ModuleSwitch
            on={shared}
            tone="azul"
            label={`Compartir con ${partnerName}`}
            onToggle={() => setShared((current) => !current)}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-muted">Cuando se sume tu compañera vas a poder compartir memos.</p>
      )}
      {error ? <p className="mt-3 text-sm font-bold text-tinta">{error}</p> : null}
    </Sheet>
  )
}
