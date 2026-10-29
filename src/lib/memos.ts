export type MemoItem = {
  id: string
  ownerId: string
  text: string
  done: boolean
  shared: boolean
  updatedAt: string
}

export function partnerPendingMemos(memos: readonly MemoItem[], meId: string): MemoItem[] {
  return memos.filter((memo) => memo.shared && !memo.done && memo.ownerId !== meId)
}

function pendingFirst(memos: readonly MemoItem[]): MemoItem[] {
  return memos.filter((memo) => !memo.done).concat(memos.filter((memo) => memo.done))
}

export function groupMemos(memos: readonly MemoItem[], meId: string): { shared: MemoItem[]; solo: MemoItem[] } {
  return {
    shared: pendingFirst(memos.filter((memo) => memo.shared)),
    solo: pendingFirst(memos.filter((memo) => !memo.shared && memo.ownerId === meId)),
  }
}

export function memoCounts(memos: readonly MemoItem[]): { pending: number; sharedPending: number } {
  const pending = memos.filter((memo) => !memo.done)
  return {
    pending: pending.length,
    sharedPending: pending.filter((memo) => memo.shared).length,
  }
}

export function pendingLabel(count: number): string {
  return count === 1 ? '1 pendiente' : `${count} pendientes`
}

function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = start.getDay()
  const mondayOffset = weekday === 0 ? 6 : weekday - 1
  start.setDate(start.getDate() - mondayOffset)
  return start
}

export function checkedThisWeek(memos: readonly MemoItem[], meId: string, now = new Date()): number {
  const start = startOfWeek(now).getTime()
  return memos.filter((memo) => {
    if (!memo.done || memo.ownerId !== meId) return false
    const updated = new Date(memo.updatedAt).getTime()
    return Number.isFinite(updated) && updated >= start
  }).length
}

export function plantLine(pending: number, checkedWeek: number): { title: string; detail: string } {
  if (pending > 0) {
    const detail = pending === 1 ? 'Tenés 1 memo pendiente.' : `Tenés ${pending} memos pendientes.`
    return { title: 'Tu plantita', detail }
  }
  if (checkedWeek > 0) {
    const detail = checkedWeek === 1 ? 'Esta semana tachaste 1.' : `Esta semana tachaste ${checkedWeek}.`
    return { title: 'Tu plantita florece', detail }
  }
  return { title: 'Tu plantita', detail: 'Cuando anotes un memo, suma una flor.' }
}

export function weekCheer(checkedWeek: number): string {
  if (checkedWeek <= 0) return 'Cuando taches uno, tu plantita florece.'
  if (checkedWeek === 1) return 'Esta semana tachaste 1. Tu plantita florece.'
  return `Esta semana tachaste ${checkedWeek}. Tu plantita florece.`
}
