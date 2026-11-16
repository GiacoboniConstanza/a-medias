/**
 * Signo para mostrar un gasto (siempre negativo) vs. si cuenta en «Salió».
 * Los compartidos que pagó la otra no suman a Salió, pero sí se ven con −.
 */
export function expenseDisplaySigned(amount: number): number {
  return -Math.abs(amount)
}

/** ¿Este gasto sale de mi plata este mes? (pagado por mí). */
export function expenseCountsAsOutflow(paidByMe: boolean): boolean {
  return paidByMe
}

export function expenseFlowSigned(amount: number, paidByMe: boolean): number | null {
  return paidByMe ? expenseDisplaySigned(amount) : null
}
