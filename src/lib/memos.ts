export type MemoItem = {
  id: string
  ownerId: string
  text: string
  done: boolean
  shared: boolean
  updatedAt: string
  createdAt?: string
  /** Cuándo se tachó. undefined = no vino de la base (p. ej. Hub sin migrar el select). */
  doneAt?: string | null
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

function stampedAt(memo: MemoItem): string | null {
  if (memo.doneAt !== undefined) return memo.doneAt
  return memo.updatedAt
}

export function checkedThisWeek(memos: readonly MemoItem[], meId: string, now = new Date()): number {
  const start = startOfWeek(now).getTime()
  return memos.filter((memo) => {
    if (!memo.done || memo.ownerId !== meId) return false
    const raw = stampedAt(memo)
    if (!raw) return false
    const stamped = new Date(raw).getTime()
    return Number.isFinite(stamped) && stamped >= start
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

export function memoCharHint(length: number): string | null {
  if (length < 350) return null
  if (length >= 400) return 'Llegaste a los 400 caracteres.'
  const left = 400 - length
  return left === 1 ? 'Te queda 1 carácter.' : `Te quedan ${left} caracteres.`
}

export function memoShareDetail(shared: boolean, wasShared: boolean, partnerName: string): string {
  if (!shared && wasShared) return `Cuando guardes, ${partnerName} deja de verlo`
  return 'Lo ve en su Inicio y cualquiera lo puede tachar'
}

export function isMemoGoneMessage(message: string | undefined): boolean {
  if (!message) return false
  return (
    message.includes('No podés editar este memo') ||
    message.includes('Solo podés marcarlo hecho') ||
    message.includes('Solo quien lo escribió puede borrarlo') ||
    message.includes('JSON object requested, multiple (or no) rows returned') ||
    message.includes('Contains 0 rows')
  )
}

export function memoLoadError(): string {
  return 'No pude cargar los memos. Revisá la conexión y probá de nuevo.'
}

export function memoSaveError(message?: string): string {
  if (isMemoGoneMessage(message)) return 'Ese memo ya no está o cambió. Actualicé la lista.'
  return 'No pude guardar los cambios. Revisá la conexión y probá de nuevo.'
}

export function memoDeleteError(message?: string): string {
  if (isMemoGoneMessage(message)) return 'Ese memo ya no está o cambió. Actualicé la lista.'
  return 'No pude eliminar el memo. Revisá la conexión y probá de nuevo.'
}

export function memoUndoError(): string {
  return 'No pude volver a traer el memo. Revisá la conexión.'
}

export function memoToggleError(message?: string): string {
  if (isMemoGoneMessage(message)) return 'Ese memo ya no está o cambió. Actualicé la lista.'
  return 'No pude actualizar el memo. Revisá la conexión y probá de nuevo.'
}
