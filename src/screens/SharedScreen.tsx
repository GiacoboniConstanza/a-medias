import { useEffect, useState } from 'react'
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
import { monthSplit } from '../lib/derive.ts'
import { loadLoanBalances, settlementPhrases, signedLoanBalance, type SettlementPhrases } from '../lib/loans.ts'
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
  const [loanSigned, setLoanSigned] = useState<number | null>(null)

  useEffect(() => {
    if (!profile || !data) return
    let active = true
    loadLoanBalances()
      .then((rows) => {
        if (!active) return
        setLoanSigned(signedLoanBalance(profile.id, rows))
      })
      .catch(() => {
        if (active) setLoanSigned(null)
      })
    return () => {
      active = false
    }
  }, [profile, data])

  if (!profile) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-alert-ink">{error}</p>

  const shared = data.monthExpenses.filter((expense) => expense.isShared)
  const split = monthSplit(data)
  const balance = pairBalance(profile.id, split)
  const phrases = settlementPhrases(profile.id, split, loanSigned ?? 0)
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
          phrases={phrases}
          even={phrases.totalLine === 'Están a mano'}
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
          phrases={phrases}
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
  phrases,
  even,
  myPaid,
  partnerPaid,
  partnerName,
  expenses,
  names,
  categories,
  onOpen,
}: {
  phrases: SettlementPhrases
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
        <div className="flex items-start gap-2">
          <Plant stage={even ? 'lush' : 'steady'} />
          <div className="min-w-0 flex-1">
            <SettlementCopy phrases={phrases} />
          </div>
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
  phrases,
  settlement,
}: {
  shared: ExpenseItem[]
  names: Record<string, string>
  categories: { id: string; icon: string }[]
  split: ReturnType<typeof monthSplit>
  phrases: SettlementPhrases
  settlement: { amount: number } | null
}) {
  return (
    <>
      <SharedExpenseList shared={shared} names={names} categories={categories} total={split.total} />
      <Card>
        <h2 className="font-display text-xl font-semibold">Paso 1. Cuánto pagó cada una</h2>
        <p className="mt-1 text-base font-semibold text-muted">Suma de los gastos compartidos del mes que pagó cada una.</p>
        <div className="mt-2">
          {split.rows.map((row) => (
            <MoneyLine key={row.id} label={`${row.name} pagó`} amount={formatMoney(row.paid)} />
          ))}
          <MoneyLine label="Total" amount={formatMoney(split.total)} strong />
        </div>
      </Card>
      <Card>
        <h2 className="font-display text-xl font-semibold">Paso 2. Cuánto le toca a cada una</h2>
        <p className="mt-1 text-base font-semibold text-muted">{shareExplanation(split)}</p>
        <div className="mt-2">
          {split.rows.map((row) => (
            <MoneyLine
              key={row.id}
              label={`${row.name} (${row.percent}%) le toca`}
              amount={formatMoney(row.share)}
            />
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-display text-xl font-semibold">Paso 3. Quién le debe a quién</h2>
        <div className="mt-2">
          <SettlementCopy phrases={phrases} />
        </div>
        {settlement ? (
          <p className="mt-3 text-base font-bold text-good">Mes saldado por {formatMoney(settlement.amount)}.</p>
        ) : null}
      </Card>
    </>
  )
}

function SharedExpenseList({
  shared,
  names,
  categories,
  total,
}: {
  shared: ExpenseItem[]
  names: Record<string, string>
  categories: { id: string; icon: string }[]
  total: number
}) {
  return (
    <>
      <div className="sm:hidden">
        {shared.length === 0 ? (
          <p className="mb-3 text-base font-semibold text-muted">Este mes no hay gastos compartidos.</p>
        ) : (
          shared.map((expense) => {
            const category = categories.find((item) => item.id === expense.categoryId)
            const payer = names[expense.payerId] ?? 'Sin nombre'
            return (
              <div key={expense.id} className="mb-3 rounded-3xl bg-card p-4 shadow-card">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-2 text-base font-semibold">
                    <AppIcon name={category?.icon || DEFAULT_ICON} className="shrink-0 text-primary" />
                    <span className="min-w-0">{expense.title}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-display text-base font-bold">{formatMoney(expense.amount)}</span>
                </div>
                <p className="mt-1 flex min-h-11 flex-wrap items-center gap-x-2 text-base font-semibold text-muted">
                  <span>{shortDate(expense.spentOn)}</span>
                  <span>Pagó {payer}</span>
                  <PeriodTag expense={expense} readable />
                </p>
              </div>
            )
          })
        )}
        <SharedTotal total={total} />
      </div>
      <Card className="hidden overflow-x-auto sm:block">
        {shared.length === 0 ? (
          <p className="mb-2 text-base font-semibold text-muted">Este mes no hay gastos compartidos.</p>
        ) : null}
        <table className="w-full border-collapse text-left text-base">
          <thead>
            <tr className="text-muted">
              <th className="py-3 pr-3 font-bold">Fecha</th>
              <th className="px-3 py-3 font-bold">Gasto</th>
              <th className="px-3 py-3 font-bold">Pagó</th>
              <th className="py-3 pl-3 text-right font-bold">Monto</th>
            </tr>
          </thead>
          <tbody>
            {shared.map((expense) => {
              const category = categories.find((item) => item.id === expense.categoryId)
              return (
                <tr key={expense.id} className="border-t border-line">
                  <td className="min-h-11 py-3 pr-3 whitespace-nowrap">{shortDate(expense.spentOn)}</td>
                  <td className="min-h-11 px-3 py-3">
                    <span className="inline-flex items-center gap-2">
                      <AppIcon name={category?.icon || DEFAULT_ICON} className="text-primary" />
                      {expense.title}
                      <PeriodTag expense={expense} readable />
                    </span>
                  </td>
                  <td className="min-h-11 px-3 py-3 whitespace-nowrap">{names[expense.payerId]}</td>
                  <td className="min-h-11 py-3 pl-3 text-right font-bold whitespace-nowrap">{formatMoney(expense.amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <SharedTotal total={total} bordered />
      </Card>
    </>
  )
}

function SharedTotal({ total, bordered = false }: { total: number; bordered?: boolean }) {
  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-3 text-base font-bold ${
        bordered ? 'border-t border-line py-3' : 'mb-3'
      }`}
    >
      <span>Total de gastos compartidos del mes</span>
      <span className="shrink-0 whitespace-nowrap">{formatMoney(total)}</span>
    </div>
  )
}

function MoneyLine({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className={`flex min-h-11 items-center justify-between gap-3 text-base ${strong ? 'font-bold' : 'font-semibold'}`}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 whitespace-nowrap font-display font-bold">{amount}</span>
    </div>
  )
}

function shareExplanation(split: ReturnType<typeof monthSplit>): string {
  if (split.usedEvenSplit) {
    return 'Falta algún sueldo base: por ahora partimos en partes iguales. Los extras no entran en este porcentaje.'
  }
  const parts = split.rows.map((row) => `${row.name} ${row.percent}%`)
  const who = parts.length === 2 ? `${parts[0]} y ${parts[1]}` : parts.join(', ')
  if (!who) return 'Los extras no entran en este porcentaje.'
  return `Los gastos se reparten según el sueldo base de cada una: ${who}. Los extras no entran en este porcentaje.`
}

function SettlementCopy({ phrases }: { phrases: SettlementPhrases }) {
  return (
    <>
      <p className="text-base font-bold">Por gastos</p>
      <p className="text-base font-semibold">{phrases.expenseLine}</p>
      {phrases.loanLine ? (
        <>
          <p className="mt-3 text-base font-bold">Por préstamos</p>
          <p className="text-base font-semibold">{phrases.loanLine}</p>
        </>
      ) : null}
      <p className="mt-3 text-base font-bold text-muted">Total a saldar</p>
      <p className="font-display text-3xl font-semibold leading-tight text-primary">{phrases.totalLine}</p>
      {phrases.breakdown ? <p className="mt-1 text-base font-semibold text-muted">{phrases.breakdown}</p> : null}
    </>
  )
}
