import { useState } from 'react'
import { Bubbles } from '../components/Bubbles.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { Card } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { saveViewMode } from '../lib/api.ts'
import { formatMoney } from '../lib/format.ts'
import { shortDate } from '../lib/month.ts'
import type { ViewMode } from '../types/database.ts'

export function BreakdownScreen() {
  const { profile, refreshProfile } = useAuth()
  const { data, loading, error } = useFinance()
  const [open, setOpen] = useState<string | null>(null)
  if (!profile) return null
  const me = profile
  if (loading && !data) return <p className="py-16 text-center font-extrabold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-extrabold text-bad">{error}</p>

  const mine = data.monthExpenses.filter((expense) => expense.payerId === me.id)
  const totals = new Map<string, { emoji: string; label: string; amount: number }>()
  for (const expense of mine) {
    const category = data.categories.find((item) => item.id === expense.categoryId)
    const current = totals.get(expense.categoryId) ?? {
      emoji: category?.emoji ?? '💸',
      label: category?.name ?? 'Otros',
      amount: 0,
    }
    current.amount += expense.amount
    totals.set(expense.categoryId, current)
  }
  const bubbles = [...totals.entries()].map(([id, item]) => ({ id, ...item }))
  const top = [...bubbles].sort((a, b) => b.amount - a.amount)[0]

  async function changeMode(mode: ViewMode) {
    await saveViewMode(me.id, mode)
    await refreshProfile()
  }

  return (
    <>
      <header className="mb-3 flex items-center justify-between">
        <span className="text-xl font-black text-brand">A Medias</span>
        <ViewToggle mode={me.viewMode} onChange={(mode) => void changeMode(mode)} />
      </header>
      <h1 className="text-[22px] font-extrabold">¿En qué se me fue?</h1>
      <p className="mb-2 text-sm font-semibold text-muted">Solo vos ves tus privados 🔒</p>
      <MonthSwitcher />
      {profile.viewMode === 'friendly' ? (
        <Bubbles items={bubbles} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="text-muted">
                <th className="py-1.5 font-bold">Fecha</th>
                <th className="font-bold">Gasto</th>
                <th className="text-right font-bold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((expense) => {
                const category = data.categories.find((item) => item.id === expense.categoryId)
                return (
                  <tr key={expense.id} className="border-t border-line">
                    <td className="py-1.5">{shortDate(expense.spentOn)}</td>
                    <td>
                      {category?.emoji} {expense.title}
                      {expense.isShared ? '' : ' 🔒'}
                    </td>
                    <td className="text-right font-bold">{formatMoney(expense.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {mine.length === 0 ? <p className="py-6 text-center font-bold text-muted">Nada anotado este mes.</p> : null}
        </Card>
      )}
      {top ? (
        <Card className="bg-warn-bg">
          <button type="button" className="w-full text-left" onClick={() => setOpen(open === top.id ? null : top.id)}>
            <b>💡 Este mes:</b> {top.label.toLowerCase()} fue tu gasto más grande ({formatMoney(top.amount)}).
          </button>
        </Card>
      ) : null}
    </>
  )
}
