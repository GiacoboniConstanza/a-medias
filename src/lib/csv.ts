import { formatMoney, normalizeMoney } from './format.ts'
import type { SplitResult } from './split.ts'

export type CsvExpense = {
  date: string
  title: string
  payer: string
  amount: number
}

function cell(value: string): string {
  if (/[;"\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function csvMoney(value: number): string {
  return normalizeMoney(value).toFixed(2).replace('.', ',')
}

export function buildSharedCsv(expenses: CsvExpense[], split: SplitResult): string {
  const lines = ['Fecha;Gasto;Pagó;Monto']
  for (const expense of expenses) {
    lines.push(
      [cell(expense.date), cell(expense.title), cell(expense.payer), csvMoney(expense.amount)].join(';'),
    )
  }
  lines.push(`;;Total;${csvMoney(split.total)}`)
  lines.push('')
  lines.push('Persona;Porcentaje;Le toca;Pagó')
  for (const row of split.rows) {
    lines.push(`${cell(row.name)};${row.percent};${csvMoney(row.share)};${csvMoney(row.paid)}`)
  }
  lines.push('')
  lines.push(`Saldo;${split.amount === 0 ? 'A mano' : formatMoney(split.amount)}`)
  return `\uFEFF${lines.join('\n')}`
}

export function downloadText(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
