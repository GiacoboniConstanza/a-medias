export type MemoLabelColor = 'menta' | 'agua' | 'durazno' | 'lila' | 'avellana'

export const MEMO_LABEL_COLORS: readonly MemoLabelColor[] = [
  'menta',
  'agua',
  'durazno',
  'lila',
  'avellana',
] as const

export const MEMO_LABEL_COLOR_NAMES: Record<MemoLabelColor, string> = {
  menta: 'Menta',
  agua: 'Agua',
  durazno: 'Durazno',
  lila: 'Lila',
  avellana: 'Avellana',
}

export const MEMO_LABEL_MAX = 3
export const MEMO_LABEL_NAME_MAX = 24

export type MemoLabel = {
  id: string
  name: string
  color: MemoLabelColor
  count: number
}

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
  /** Etiquetas del memo. undefined = pantallas que aún no cargan uniones (p. ej. Hub). */
  labelIds?: string[]
}

export function partnerPendingMemos(memos: readonly MemoItem[], meId: string): MemoItem[] {
  return memos.filter((memo) => memo.shared && !memo.done && memo.ownerId !== meId)
}

function pendingFirst(memos: readonly MemoItem[]): MemoItem[] {
  return memos.filter((memo) => !memo.done).concat(memos.filter((memo) => memo.done))
}

export function groupMemos(
  memos: readonly MemoItem[],
  meId: string,
  labelId?: string | null,
): { shared: MemoItem[]; solo: MemoItem[] } {
  const filtered = labelId ? memos.filter((memo) => (memo.labelIds ?? []).includes(labelId)) : memos
  return {
    shared: pendingFirst(filtered.filter((memo) => memo.shared)),
    solo: pendingFirst(filtered.filter((memo) => !memo.shared && memo.ownerId === meId)),
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

export function isMemoLabelColor(value: string): value is MemoLabelColor {
  return (MEMO_LABEL_COLORS as readonly string[]).includes(value)
}

export function defaultMemoLabelColor(used: readonly MemoLabelColor[]): MemoLabelColor {
  return MEMO_LABEL_COLORS.find((color) => !used.includes(color)) ?? 'menta'
}

export function withLabelCounts(
  labels: readonly { id: string; name: string; color: MemoLabelColor }[],
  memos: readonly MemoItem[],
): MemoLabel[] {
  return labels.map((label) => ({
    ...label,
    count: memos.filter((memo) => (memo.labelIds ?? []).includes(label.id)).length,
  }))
}

export function labelCountText(count: number): string {
  if (count <= 0) return 'Sin memos'
  if (count === 1) return '1 memo'
  return `${count} memos`
}

export function labelFilterLive(count: number, name: string): string {
  if (count <= 0) return `No hay memos con «${name}».`
  if (count === 1) return `1 memo con «${name}»`
  return `${count} memos con «${name}»`
}

export function deleteLabelBody(count: number, partnerName: string): string {
  if (count <= 0) {
    return `No la ves en ningún memo. Se saca de todos los que la tienen, también de los de ${partnerName}.`
  }
  if (count === 1) {
    return `La ves en 1 memo. Se saca de todos los que la tienen, también de los de ${partnerName}; los memos quedan.`
  }
  return `La ves en ${count} memos. Se saca de todos los que la tienen, también de los de ${partnerName}; los memos quedan.`
}

export function memoLabelAttachError(name: string): string {
  return `No pude poner «${name}». Revisá la conexión y probá de nuevo.`
}

export function memoLabelDetachError(name: string): string {
  return `No pude sacar «${name}». Revisá la conexión y probá de nuevo.`
}

export function memoLabelCreateError(message?: string): string {
  if (message?.includes('Ya hay una etiqueta')) {
    const match = message.match(/Ya hay una etiqueta «([^»]+)»/)
    if (match?.[1]) return `Ya hay una etiqueta «${match[1]}».`
  }
  return 'No pude crear la etiqueta. Revisá la conexión y probá de nuevo.'
}

export function memoLabelRenameError(message?: string): string {
  if (message?.includes('Ya hay una etiqueta')) {
    const match = message.match(/Ya hay una etiqueta «([^»]+)»/)
    if (match?.[1]) return `Ya hay una etiqueta «${match[1]}».`
  }
  return 'No pude cambiar el nombre. Revisá la conexión y probá de nuevo.'
}

export function memoLabelDeleteError(): string {
  return 'No pude eliminar la etiqueta. Revisá la conexión y probá de nuevo.'
}

export function duplicateLabelNameError(name: string): string {
  return `Ya hay una etiqueta «${name}».`
}

export function canToggleMemoLabel(selectedIds: readonly string[], labelId: string): boolean {
  if (selectedIds.includes(labelId)) return true
  return selectedIds.length < MEMO_LABEL_MAX
}

const LABEL_CHIP: Record<MemoLabelColor, { bg: string; ink: string; border: string; outline: string }> = {
  menta: {
    bg: 'bg-cat-menta',
    ink: 'text-cat-menta-ink',
    border: 'border-cat-menta-ink',
    outline: 'outline-cat-menta-ink',
  },
  agua: {
    bg: 'bg-cat-agua',
    ink: 'text-cat-agua-ink',
    border: 'border-cat-agua-ink',
    outline: 'outline-cat-agua-ink',
  },
  durazno: {
    bg: 'bg-cat-durazno',
    ink: 'text-cat-durazno-ink',
    border: 'border-cat-durazno-ink',
    outline: 'outline-cat-durazno-ink',
  },
  lila: {
    bg: 'bg-cat-lila',
    ink: 'text-cat-lila-ink',
    border: 'border-cat-lila-ink',
    outline: 'outline-cat-lila-ink',
  },
  avellana: {
    bg: 'bg-cat-avellana',
    ink: 'text-cat-avellana-ink',
    border: 'border-cat-avellana-ink',
    outline: 'outline-cat-avellana-ink',
  },
}

export function labelChipClasses(color: MemoLabelColor): {
  bg: string
  ink: string
  border: string
  outline: string
} {
  return LABEL_CHIP[color]
}
