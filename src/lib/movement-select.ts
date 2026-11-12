import { savingBalances } from './saving-balance.ts'
import type { ExpenseItem, SavingItem, SavingMove } from './api.ts'
import type { Transfer } from './transfers.ts'

function dayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  const date = new Date(year, month - 1, day)
  const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(date)
  return `${weekday} ${day}`
}

export type SelectableKind = 'gasto' | 'ingreso' | 'transferencia' | 'aporte' | 'retiro' | 'sueldo'

export type SelectableInputRow = {
  id: string
  kind: SelectableKind
  title: string
  amount: number
  spentOn: string
  period: string
  isShared: boolean
  expense?: ExpenseItem | null
  extraId?: string | null
  transfer?: Transfer | null
  savingMove?: SavingMove | null
  /** Fila sintética de sueldo. */
  isSalary?: boolean
  mpOperationId?: string | null
}

export type Selectability = {
  canDelete: boolean
  reason: string | null
}

export type SelectableContext = {
  meId: string
  partnerName: string
  /** expenseId → true si es pago de gasto fijo. */
  fixedExpenseIds: ReadonlySet<string>
  savingsById: ReadonlyMap<string, SavingItem>
  /** Todos los movimientos de ahorro del hogar (para saldo). */
  allSavingMoves: readonly SavingMove[]
}

/** ¿Se puede eliminar esta fila (lote o de a uno)? */
export function movementSelectability(row: SelectableInputRow, ctx: SelectableContext): Selectability {
  if (row.isSalary || row.kind === 'sueldo') {
    return { canDelete: false, reason: 'Es tu sueldo: se cambia en Sueldo.' }
  }
  if (row.expense && ctx.fixedExpenseIds.has(row.expense.id)) {
    return { canDelete: false, reason: 'Es el pago de un gasto fijo: se deshace en Avisos.' }
  }
  if (row.transfer) {
    if (row.transfer.createdBy && row.transfer.createdBy !== ctx.meId) {
      return {
        canDelete: false,
        reason: `La cargó ${ctx.partnerName}: solo ella la puede eliminar.`,
      }
    }
  }
  if (row.savingMove) {
    const saving = ctx.savingsById.get(row.savingMove.savingId)
    if (saving?.archivedAt) {
      return { canDelete: false, reason: 'El ahorro está archivado.' }
    }
  }
  return { canDelete: true, reason: null }
}

export type NegativeSavingWarning = {
  savingId: string
  savingName: string
  aporteRowId: string
  retiroRowId: string
  aporteDay: string
  retiroDay: string
  negativeAmount: number
}

/**
 * Si borrar los aportes elegidos (sin sus retiros) deja la parte en negativo.
 * Recalcula con cada tilde.
 */
export function negativeSavingWarnings(
  selectedIds: ReadonlySet<string>,
  rows: readonly SelectableInputRow[],
  ctx: SelectableContext,
): NegativeSavingWarning[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const selectedMoves = [...selectedIds]
    .map((id) => byId.get(id)?.savingMove)
    .filter((move): move is SavingMove => Boolean(move))

  const aporteIds = new Set(
    selectedMoves.filter((move) => move.kind === 'aporte').map((move) => move.id),
  )
  if (aporteIds.size === 0) return []

  const selectedRetiroIds = new Set(
    selectedMoves.filter((move) => move.kind === 'retiro').map((move) => move.id),
  )

  const warnings: NegativeSavingWarning[] = []
  const savingIds = new Set(selectedMoves.map((move) => move.savingId))

  for (const savingId of savingIds) {
    const saving = ctx.savingsById.get(savingId)
    if (!saving) continue
    const remaining = ctx.allSavingMoves.filter((move) => {
      if (move.savingId !== savingId) return false
      if (aporteIds.has(move.id)) return false
      if (selectedRetiroIds.has(move.id)) return false
      return true
    })
    const bal = savingBalances(saving.openings, remaining)
    const mine = bal.byUser[ctx.meId] ?? 0
    if (mine >= -0.0001) continue

    const aporteRow = rows.find(
      (row) => row.savingMove && aporteIds.has(row.savingMove.id) && row.savingMove.savingId === savingId,
    )
    const retiroRow = rows.find(
      (row) =>
        row.savingMove?.kind === 'retiro' &&
        row.savingMove.savingId === savingId &&
        !selectedRetiroIds.has(row.savingMove.id),
    )
    if (!aporteRow || !retiroRow?.savingMove) continue
    warnings.push({
      savingId,
      savingName: saving.name,
      aporteRowId: aporteRow.id,
      retiroRowId: retiroRow.id,
      aporteDay: dayLabel(aporteRow.spentOn),
      retiroDay: dayLabel(retiroRow.spentOn),
      negativeAmount: Math.abs(mine),
    })
  }
  return warnings
}

export function countSelectable(rows: readonly SelectableInputRow[], ctx: SelectableContext): number {
  return rows.filter((row) => movementSelectability(row, ctx).canDelete).length
}
