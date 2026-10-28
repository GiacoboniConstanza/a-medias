import { useEffect, useState } from 'react'
import { AppIcon } from './AppIcon.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { partnerPendingMemos, type MemoItem } from '../lib/memos.ts'
import { supabase } from '../lib/supabase.ts'

export function PartnerMemos() {
  const { profile } = useAuth()
  const { data } = useFinance()
  const [memos, setMemos] = useState<MemoItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    let active = true
    supabase
      .from('memos')
      .select('id, owner_id, text, done, shared, updated_at')
      .eq('shared', true)
      .eq('done', false)
      .order('created_at', { ascending: false })
      .then(({ data: rows, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setError(loadError.message)
          setMemos([])
          return
        }
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
      })
    return () => {
      active = false
    }
  }, [profile])

  if (!profile || !memos) return null
  const pending = partnerPendingMemos(memos, profile.id)
  if (pending.length === 0 && !error) return null

  async function markDone(memo: MemoItem) {
    setError('')
    const { error: saveError } = await supabase.from('memos').update({ done: true }).eq('id', memo.id)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setMemos((current) => (current ?? []).map((item) => (item.id === memo.id ? { ...item, done: true } : item)))
  }

  return (
    <div className="mb-3">
      {pending.map((memo) => {
        const author = data?.names[memo.ownerId] || 'tu compañera'
        return (
          <div
            key={memo.id}
            className="mb-2.5 flex items-center gap-1 rounded-[22px] bg-[#F6F3FB] py-1 pl-1 pr-3.5 shadow-[inset_4px_0_0_#A79BCB,0_4px_14px_#85503c12]"
          >
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center"
              aria-label={`Marcar hecho: ${memo.text}`}
              onClick={() => void markDone(memo)}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border-[2.5px] border-[#cbbda8]" />
            </button>
            <div className="min-w-0 flex-1 py-2">
              <p className="text-[15.5px] font-bold leading-snug">{memo.text}</p>
              <p className="mt-0.5 text-[12.5px] font-bold text-[#5f548c]">
                <AppIcon name="note-sticky" className="mr-1" /> Memo de {author}
              </p>
            </div>
          </div>
        )
      })}
      {error ? <p className="text-center text-sm font-bold text-alert-ink">{error}</p> : null}
    </div>
  )
}
