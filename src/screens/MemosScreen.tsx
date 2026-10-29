import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { ModuleSwitch } from '../components/ModuleSwitch.tsx'
import { Sprout } from '../components/Sprout.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useModules } from '../context/ModulesProvider.tsx'
import { partnerId } from '../lib/derive.ts'
import { checkedThisWeek, groupMemos, weekCheer, type MemoItem } from '../lib/memos.ts'
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
  const cheer = weekCheer(checkedThisWeek(memos, profile.id))

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
        <p className="text-[15px] font-semibold text-muted">
          <AppIcon name="note-sticky" className="mr-1.5" /> Memos
        </p>
      </header>
      <h1 className="font-display text-[1.8rem] font-bold leading-tight">Mis memos</h1>
      <div className="mb-1 mt-2 flex items-center gap-2 text-[13.5px] font-bold text-good">
        <Sprout module="memos" size={30} />
        <span>{cheer}</span>
      </div>
      {loading ? <p className="py-8 text-center font-extrabold text-muted">Cargando memos…</p> : null}
      {!loading && groups.shared.length === 0 && groups.solo.length === 0 ? (
        <p className="py-8 text-center font-extrabold text-muted">Todavía no hay memos.</p>
      ) : null}
      <MemoGroup title={`Con ${partnerName}`} memos={groups.shared} meId={profile.id} partnerName={partnerName} onToggle={toggleDone} />
      <MemoGroup title="Solo vos" memos={groups.solo} meId={profile.id} partnerName={partnerName} onToggle={toggleDone} />
      {error ? <p className="text-center text-sm font-bold text-alert-ink">{error}</p> : null}
      <button
        type="button"
        aria-label="Nuevo memo"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-[max(1.25rem,calc(50vw-190px))] z-30 grid h-[58px] w-[58px] place-items-center rounded-full bg-primary text-2xl text-white shadow-fab"
      >
        <AppIcon name="plus" />
      </button>
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
  memos,
  meId,
  partnerName,
  onToggle,
}: {
  title: string
  memos: MemoItem[]
  meId: string
  partnerName: string
  onToggle: (memo: MemoItem) => void
}) {
  if (memos.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 ml-1 mt-4 text-[13px] font-bold text-[#8a8370]">{title}</h2>
      {memos.map((memo) => (
        <article
          key={memo.id}
          className={`mb-2.5 flex items-center gap-1 rounded-[22px] py-1 pl-1 pr-3.5 shadow-card ${
            memo.shared ? 'bg-[#F6F3FB] shadow-[inset_4px_0_0_#A79BCB,0_4px_14px_#85503c12]' : 'bg-card'
          } ${memo.done ? 'text-[#a49c88]' : ''}`}
        >
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center"
            aria-label={memo.done ? `Marcar pendiente: ${memo.text}` : `Marcar hecho: ${memo.text}`}
            aria-pressed={memo.done}
            onClick={() => onToggle(memo)}
          >
            <span
              className={`grid h-7 w-7 place-items-center rounded-full border-[2.5px] text-[13px] text-white ${
                memo.done ? 'border-primary bg-primary' : 'border-[#cbbda8]'
              }`}
            >
              {memo.done ? <AppIcon name="check" /> : null}
            </span>
          </button>
          <div className="min-w-0 flex-1 py-2">
            <p className={`text-[15.5px] font-bold leading-snug ${memo.done ? 'line-through' : ''}`}>{memo.text}</p>
            {memo.shared || memo.done ? (
              <p className="mt-0.5 text-[12.5px] font-semibold text-muted">
                {memo.shared ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#ECE8F6] px-2 py-0.5 text-[11px] font-extrabold text-[#5f548c]">
                    <AppIcon name="user-group" /> Las dos
                  </span>
                ) : null}
                {memo.done ? <span className={memo.shared ? 'ml-2' : ''}>Hecho</span> : null}
                {memo.shared && memo.ownerId !== meId ? <span className="ml-2">De {partnerName}</span> : null}
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
          className="min-h-[88px] w-full rounded-[20px] border-2 border-sage-light bg-white px-4 py-3.5 text-base font-bold text-text outline-none placeholder:font-semibold placeholder:text-muted"
        />
      </label>
      {canShare ? (
        <div className={`mt-2.5 flex min-h-16 items-center gap-3 rounded-[20px] px-3.5 py-3 ${shared ? 'bg-[#F6F3FB]' : 'bg-card'}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ECE8F6] text-[#5f548c]">
            <AppIcon name="user-group" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">Compartir con {partnerName}</span>
            <span className="block text-[12.5px] font-semibold text-muted">Lo ve en su Inicio y cualquiera lo puede tachar</span>
          </span>
          <ModuleSwitch
            on={shared}
            tone="lavender"
            label={`Compartir con ${partnerName}`}
            onToggle={() => setShared((current) => !current)}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-muted">Cuando se sume tu compañera vas a poder compartir memos.</p>
      )}
      {error ? <p className="mt-3 text-sm font-bold text-alert-ink">{error}</p> : null}
    </Sheet>
  )
}
