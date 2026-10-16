import { useState } from 'react'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { Button, Card, ErrorText } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { settleMonth, undoSettlement } from '../lib/api.ts'
import { buildSharedCsv, downloadText } from '../lib/csv.ts'
import { debtCopy, monthSplit } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import { shortDate } from '../lib/month.ts'

export function SharedScreen() {
  const { profile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!profile) return null
  if (loading && !data) return <p className="py-16 text-center font-extrabold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-extrabold text-bad">{error}</p>

  const shared = data.monthExpenses.filter((expense) => expense.isShared)
  const split = monthSplit(data)
  const sentence = debtCopy(profile.id, split)

  async function settle() {
    if (!profile || !split.debtorId || !split.creditorId || split.amount <= 0) return
    setSaving(true)
    setMessage('')
    try {
      await settleMonth({
        householdId: profile.householdId as string,
        month,
        debtorId: split.debtorId,
        creditorId: split.creditorId,
        amount: split.amount,
        settledBy: profile.id,
      })
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude saldar el mes.')
    } finally {
      setSaving(false)
    }
  }

  async function undo() {
    if (!data?.settlement) return
    setSaving(true)
    setMessage('')
    try {
      await undoSettlement(data.settlement.id)
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude deshacer el saldo.')
    } finally {
      setSaving(false)
    }
  }

  function exportCsv() {
    const csv = buildSharedCsv(
      shared.map((expense) => ({
        date: shortDate(expense.spentOn),
        title: expense.title,
        payer: data?.names[expense.payerId] ?? '',
        amount: expense.amount,
      })),
      split,
    )
    downloadText(`a-medias-${month.slice(0, 7)}.csv`, csv)
  }

  return (
    <>
      <header className="mb-2">
        <span className="text-xl font-black text-brand">A Medias</span>
      </header>
      <h1 className="text-xl font-extrabold">Compartidos</h1>
      <MonthSwitcher />
      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="py-1.5 font-bold">Fecha</th>
              <th className="font-bold">Gasto</th>
              <th className="font-bold">Pagó</th>
              <th className="text-right font-bold">Monto</th>
            </tr>
          </thead>
          <tbody>
            {shared.map((expense) => (
              <tr key={expense.id} className="border-t border-line">
                <td className="py-1.5">{shortDate(expense.spentOn)}</td>
                <td>{expense.title}</td>
                <td>{data.names[expense.payerId]}</td>
                <td className="text-right">{formatMoney(expense.amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-line font-extrabold">
              <td className="py-1.5" colSpan={3}>
                Total
              </td>
              <td className="text-right">{formatMoney(split.total)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <Card>
        <b className="text-sm">Reparto por sueldo base</b>
        <p className="text-xs text-muted">Los extras no entran en este porcentaje.</p>
        {split.usedEvenSplit ? <p className="text-xs font-bold text-warn">Falta algún sueldo base: por ahora partimos en partes iguales.</p> : null}
        <table className="mt-2 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-bold" />
              <th className="font-bold">Base</th>
              <th className="font-bold">%</th>
              <th className="font-bold">Le toca</th>
              <th className="text-right font-bold">Pagó</th>
            </tr>
          </thead>
          <tbody>
            {split.rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-1.5">{row.name}</td>
                <td>{formatMoney(data.bases[row.id] ?? 0)}</td>
                <td>{row.percent}%</td>
                <td>{formatMoney(row.share)}</td>
                <td className="text-right">{formatMoney(row.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 font-extrabold text-brand">Saldo: {sentence}</p>
        {data.settlement ? (
          <p className="mt-1 text-sm font-bold text-good">Mes saldado por {formatMoney(data.settlement.amount)}.</p>
        ) : null}
      </Card>
      {data.settlement ? (
        <Button type="button" variant="alt" onClick={() => void undo()} disabled={saving}>
          Deshacer saldo
        </Button>
      ) : (
        <Button type="button" onClick={() => void settle()} disabled={saving || split.amount === 0 || split.rows.length < 2}>
          ✓ Saldar mes
        </Button>
      )}
      <Button type="button" variant="alt" className="mt-2" onClick={exportCsv}>
        ⬇ Exportar a planilla
      </Button>
      <ErrorText>{message}</ErrorText>
    </>
  )
}
