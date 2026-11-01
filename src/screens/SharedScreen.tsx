import { useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { ExpenseEditor } from '../components/ExpenseEditor.tsx'
import { PeriodTag } from '../components/ExpenseLine.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { Plant } from '../components/Plant.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import { Button, Card, ErrorText } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { saveViewMode, settleMonth, undoSettlement, type ExpenseItem } from '../lib/api.ts'
import { buildSharedCsv, downloadText } from '../lib/csv.ts'
import { debtCopy, monthSplit } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { shortDate } from '../lib/month.ts'
import { paidHalfCaption, pairBalance } from '../lib/split.ts'
import type { ViewMode } from '../types/database.ts'

export function SharedScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [openExpense, setOpenExpense] = useState<ExpenseItem | null>(null)

  if (!profile) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const shared = data.monthExpenses.filter((expense) => expense.isShared)
  const split = monthSplit(data)
  const balance = pairBalance(profile.id, split)
  const sentence = debtCopy(profile.id, split)
  const friendly = profile.viewMode === 'friendly'

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

  async function changeMode(mode: ViewMode) {
    if (!profile) return
    await saveViewMode(profile.id, mode)
    await refreshProfile()
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
      <SectionHeader icon="user-group" title="Compartidos" />
      <MonthSwitcher heading />
      <ViewToggle mode={profile.viewMode} onChange={(mode) => void changeMode(mode)} className="mb-3" />
      {friendly ? (
        <FriendlyShared
          sentence={balance.sentence}
          even={balance.even}
          myPaid={balance.myPaid}
          partnerPaid={balance.partnerPaid}
          partnerName={balance.partnerName}
          expenses={shared}
          names={data.names}
          categories={data.categories}
          onOpen={setOpenExpense}
        />
      ) : (
        <AccountingShared
          shared={shared}
          names={data.names}
          categories={data.categories}
          split={split}
          sentence={sentence}
          settlement={data.settlement}
        />
      )}
      {friendly && data.settlement ? (
        <p className="mb-2 text-base font-bold text-good">Mes saldado por {formatMoney(data.settlement.amount)}.</p>
      ) : null}
      {data.settlement ? (
        <Button type="button" variant="alt" onClick={() => void undo()} disabled={saving}>
          Deshacer saldo
        </Button>
      ) : (
        <Button type="button" onClick={() => void settle()} disabled={saving || split.amount === 0 || split.rows.length < 2}>
          <span className="inline-flex items-center justify-center gap-2">
            <AppIcon name="check" /> Saldar mes
          </span>
        </Button>
      )}
      <Button type="button" variant="alt" className="mt-2" onClick={exportCsv}>
        <span className="inline-flex items-center justify-center gap-2">
          <AppIcon name="download" /> Exportar a planilla
        </span>
      </Button>
      {notice ? <p className="mt-2 text-center text-base font-bold text-good">{notice}</p> : null}
      <ErrorText>{message}</ErrorText>
      {openExpense ? (
        <ExpenseEditor
          presentation="sheet"
          expense={openExpense}
          onClose={() => setOpenExpense(null)}
          onDone={(text) => {
            setOpenExpense(null)
            setNotice(text)
          }}
        />
      ) : null}
    </>
  )
}

function FriendlyShared({
  sentence,
  even,
  myPaid,
  partnerPaid,
  partnerName,
  expenses,
  names,
  categories,
  onOpen,
}: {
  sentence: string
  even: boolean
  myPaid: number
  partnerPaid: number
  partnerName: string | null
  expenses: ExpenseItem[]
  names: Record<string, string>
  categories: { id: string; name: string; icon: string }[]
  onOpen: (expense: ExpenseItem) => void
}) {
  return (
    <>
      <Card>
        <div className="flex items-center gap-2">
          <Plant stage={even ? 'lush' : 'steady'} />
          <p className="min-w-0 font-display text-3xl font-semibold leading-tight text-primary">{sentence}</p>
        </div>
      </Card>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <section className="rounded-3xl bg-card p-4 shadow-card">
          <p className="text-base font-semibold text-muted">Pagaste vos</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatMoney(myPaid)}</p>
        </section>
        <section className="rounded-3xl bg-card p-4 shadow-card">
          <p className="text-base font-semibold text-muted">{partnerName ? `Pagó ${partnerName}` : 'Tu compañera'}</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatMoney(partnerPaid)}</p>
        </section>
      </div>
      {expenses.length === 0 ? (
        <p className="mb-3 text-base font-semibold text-muted">Este mes no hay gastos compartidos.</p>
      ) : (
        expenses.map((expense) => {
          const category = categories.find((item) => item.id === expense.categoryId)
          const payer = names[expense.payerId] ?? 'Sin nombre'
          return (
            <button
              key={expense.id}
              type="button"
              onClick={() => onOpen(expense)}
              className="mb-3 w-full rounded-3xl bg-card p-4 text-left shadow-card"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-display text-xl font-semibold">
                  {expense.title}
                  <PeriodTag expense={expense} />
                  {expense.notes ? <AppIcon name="note-sticky" className="ml-1.5 text-base text-muted" /> : null}
                </span>
                <span className="shrink-0 font-display text-xl font-bold">{formatMoney(expense.amount)}</span>
              </span>
              <span className="mt-1 flex items-center gap-2 text-base font-semibold">
                <AppIcon name={category?.icon || DEFAULT_ICON} className="text-primary" />
                {category?.name ?? 'Otros'}
              </span>
              <span className="mt-1 block text-base font-semibold text-muted">{paidHalfCaption(payer, expense.amount)}</span>
            </button>
          )
        })
      )}
    </>
  )
}

function AccountingShared({
  shared,
  names,
  categories,
  split,
  sentence,
  settlement,
}: {
  shared: ExpenseItem[]
  names: Record<string, string>
  categories: { id: string; icon: string }[]
  split: ReturnType<typeof monthSplit>
  sentence: string
  settlement: { amount: number } | null
}) {
  return (
    <>
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
            {shared.map((expense) => {
              const category = categories.find((item) => item.id === expense.categoryId)
              return (
                <tr key={expense.id} className="border-t border-line">
                  <td className="py-1.5">{shortDate(expense.spentOn)}</td>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <AppIcon name={category?.icon || DEFAULT_ICON} /> {expense.title}
                      <PeriodTag expense={expense} />
                    </span>
                  </td>
                  <td>{names[expense.payerId]}</td>
                  <td className="text-right">{formatMoney(expense.amount)}</td>
                </tr>
              )
            })}
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
        {split.usedEvenSplit ? (
          <p className="text-xs font-bold text-alert-ink">Falta algún sueldo base: por ahora partimos en partes iguales.</p>
        ) : null}
        <table className="mt-2 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-bold" />
              <th className="font-bold">%</th>
              <th className="font-bold">Le toca</th>
              <th className="text-right font-bold">Pagó</th>
            </tr>
          </thead>
          <tbody>
            {split.rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-1.5">{row.name}</td>
                <td>{row.percent}%</td>
                <td>{formatMoney(row.share)}</td>
                <td className="text-right">{formatMoney(row.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 font-display text-lg font-semibold text-primary">Saldo: {sentence}</p>
        {settlement ? (
          <p className="mt-1 text-sm font-bold text-good">Mes saldado por {formatMoney(settlement.amount)}.</p>
        ) : null}
      </Card>
    </>
  )
}
