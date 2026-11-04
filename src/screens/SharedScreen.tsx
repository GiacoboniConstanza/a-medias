import { useEffect, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { ListFlower, Plantita } from '../components/Adornos.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { ExpenseEditor } from '../components/ExpenseEditor.tsx'
import { ExpenseLine } from '../components/ExpenseLine.tsx'
import { HelpSheet, type HelpBlock } from '../components/HelpSheet.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { ViewOptions } from '../components/ViewOptions.tsx'
import { Button, Card, ErrorText, FilterBar, Toast } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { saveViewMode, settleMonth, undoSettlement, type ExpenseItem } from '../lib/api.ts'
import { buildSharedCsv, downloadText } from '../lib/csv.ts'
import { monthSplit, partnerId } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { loadLoanBalances, loadSettlementRepayments } from '../lib/loans.ts'
import { monthName, shortDate } from '../lib/month.ts'
import {
  linkedLoanAmount,
  passPhrase,
  planMonthSettlement,
  type SettleLoan,
} from '../lib/settle.ts'
import type { SplitResult, SplitRow } from '../lib/split.ts'
import type { ViewMode } from '../types/database.ts'

export function SharedScreen() {
  const { profile, refreshProfile } = useAuth()
  const { month } = useMonth()
  const { data, loading, error, refresh } = useFinance()
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [settledNote, setSettledNote] = useState(false)
  const [saving, setSaving] = useState(false)
  const [help, setHelp] = useState(false)
  const [confirm, setConfirm] = useState<'settle' | 'undo' | null>(null)
  const [openExpense, setOpenExpense] = useState<ExpenseItem | null>(null)
  const [payerFilter, setPayerFilter] = useState('all')
  const [loans, setLoans] = useState<SettleLoan[]>([])
  const [linked, setLinked] = useState<{ lenderId: string; borrowerId: string; amount: number }[]>([])

  const settlementId = data?.settlement?.id ?? null

  useEffect(() => {
    if (!profile) return
    let active = true
    Promise.all([loadLoanBalances(), settlementId ? loadSettlementRepayments(settlementId) : Promise.resolve([])])
      .then(([rows, linkedRows]) => {
        if (!active) return
        setLoans(
          rows.map((loan) => ({
            id: loan.id,
            lenderId: loan.lenderId,
            borrowerId: loan.borrowerId,
            pending: loan.pending,
            period: loan.period,
          })),
        )
        setLinked(linkedRows)
      })
      .catch(() => {
        if (!active) return
        setLoans([])
        setLinked([])
      })
    return () => {
      active = false
    }
  }, [profile, settlementId, data])

  if (!profile) return null
  if (loading && !data) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>
  if (!data) return <p className="py-16 text-center font-bold text-tinta">{error}</p>

  const meId = profile.id
  const otherId = partnerId(data, meId)
  const shared = data.monthExpenses.filter((expense) => expense.isShared)
  const split = monthSplit(data)
  const plan = planMonthSettlement({
    month,
    meId,
    partnerId: otherId,
    split,
    loans,
    alreadySettled: Boolean(data.settlement),
  })
  const people = [...split.rows].sort((a, b) => personRank(a.name) - personRank(b.name))
  const partner = people.find((row) => row.id !== meId) ?? null
  const settled = data.settlement
  const loanAmount = settled ? linkedLoanAmount(linked) : plan.loanAmount
  const expenseAmount = plan.expenseAmount
  const headlineAmount = settled ? settled.amount : plan.amount
  const creditorId = settled ? settled.creditorId : plan.creditorId
  const favor = headlineAmount > 0 && creditorId === meId
  const visible = payerFilter === 'all' ? shared : shared.filter((expense) => expense.payerId === payerFilter)
  const filters = [
    { id: 'all', label: 'Todos' },
    ...people.map((row) => ({ id: row.id, label: `Pagó ${row.name}` })),
  ]

  async function changeMode(mode: ViewMode) {
    if (!profile) return
    await saveViewMode(profile.id, mode)
    await refreshProfile()
  }

  async function confirmSettle() {
    if (!plan.canSettle || !plan.debtorId || !plan.creditorId) return
    setSaving(true)
    setMessage('')
    try {
      await settleMonth({
        month,
        debtorId: plan.debtorId,
        creditorId: plan.creditorId,
        amount: plan.amount,
        expenseAmount: plan.expenseAmount,
        expenseDebtorId: plan.expenseDebtorId,
        repayments: plan.repayments.map((row) => ({ loanId: row.loanId, amount: row.amount })),
      })
      setConfirm(null)
      setSettledNote(true)
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude saldar el mes.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmUndo() {
    if (!data?.settlement) return false
    setSaving(true)
    setMessage('')
    try {
      await undoSettlement(data.settlement.id)
      setConfirm(null)
      setSettledNote(false)
      await refresh()
      return true
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude deshacer el saldo.')
      return false
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
      <SectionHeader
        lead="crumb"
        aside={
          <>
            <NotificationBell />
            <ViewOptions mode={profile.viewMode} onChange={(mode) => void changeMode(mode)} onHelp={() => setHelp(true)} />
          </>
        }
      />
      <MonthSwitcher heading />

      <section className="scallop-b -mx-5 mb-6 bg-azul px-5 pb-5 pt-4 text-tinta">
        <div className="flex items-start justify-between gap-3">
          <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-semibold text-tinta">
            <AppIcon name="scale-balanced" /> Total a saldar
          </h2>
          <span
            className={`inline-flex h-[27px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-tinta ${
              settled ? 'bg-salvia-claro' : 'bg-mostaza'
            }`}
          >
            <AppIcon name="circle" />
            {settled ? 'Saldado' : 'Sin saldar'}
          </span>
        </div>
        {headlineAmount === 0 || !partner ? (
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="min-w-0 font-display text-[36px] font-semibold text-tinta">Están a mano</p>
            <Plantita width={46} height={60} />
          </div>
        ) : (
          <>
            <p className="mt-3 text-base font-semibold text-tinta">{favor ? `${partner.name} te debe` : `Le debés a ${partner.name}`}</p>
            <div className="flex items-end justify-between gap-3">
              <p className="min-w-0 font-display text-[36px] font-semibold whitespace-nowrap tabular-nums text-tinta">{formatMoney(headlineAmount)}</p>
              <Plantita width={46} height={60} />
            </div>
          </>
        )}
        <SplitBar expense={expenseAmount} loans={loanAmount} />
        <MoneyRow label="Por gastos" amount={formatMoney(expenseAmount)} dotClass="border-rosa-hondo bg-rosa" />
        <MoneyRow label="Por préstamos" amount={formatMoney(loanAmount)} dotClass="border-ciruela-ink bg-ciruela" />
        {settled ? (
          <Button type="button" variant="alt" className="mt-3" onClick={() => setConfirm('undo')} disabled={saving}>
            Deshacer
          </Button>
        ) : (
          <>
            <Button type="button" className="mt-3" onClick={() => setConfirm('settle')} disabled={saving || !plan.canSettle}>
              <span className="inline-flex items-center justify-center gap-2">
                <AppIcon name="check" /> Saldar mes
              </span>
            </Button>
            {plan.blockedReason ? <p className="mt-2 text-center text-sm font-semibold text-tinta">{plan.blockedReason}</p> : null}
          </>
        )}
      </section>

      <Card>
        <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-semibold text-tinta">
          <AppIcon name="chart-column" /> Cómo se reparte
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted">{shareCaption(split, people)}</p>
        <ul className="mt-2">
          {people.map((row) => (
            <PersonShare key={row.id} row={row} />
          ))}
        </ul>
      </Card>

      <section className="mb-3 rounded-2xl border-2 border-azul-ink bg-card px-4 py-3">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="inline-flex min-w-0 items-center gap-2 font-display text-lg font-semibold text-tinta">
            <ListFlower /> Gastos compartidos
          </h2>
          <p className="shrink-0 whitespace-nowrap font-display text-lg font-semibold tabular-nums text-tinta">{formatMoney(split.total)}</p>
        </div>
      <FilterBar label="Quién pagó" options={filters} value={payerFilter} onChange={setPayerFilter} />
      {visible.length === 0 ? (
        <p className="mb-3 text-base font-semibold text-muted">Este mes no hay gastos compartidos.</p>
      ) : (
        <ul className="mb-3">
          {visible.map((expense) => {
            const category = data.categories.find((item) => item.id === expense.categoryId)
            return (
              <li key={expense.id} className="border-b border-dashed border-line last:border-0">
                <ExpenseLine
                  expense={expense}
                  categoryName={category?.name ?? 'Otros'}
                  categoryIcon={category?.icon || DEFAULT_ICON}
                  payerName={data.names[expense.payerId] ?? 'Sin nombre'}
                  onOpen={() => setOpenExpense(expense)}
                />
              </li>
            )
          })}
        </ul>
      )}
      </section>

      <Button type="button" variant="alt" onClick={exportCsv}>
        <span className="inline-flex items-center justify-center gap-2">
          <AppIcon name="download" /> Exportar a planilla
        </span>
      </Button>
      <ErrorText>{message}</ErrorText>

      <Toast
        onUndo={settledNote ? () => confirmUndo() : undefined}
        onDone={() => {
          setSettledNote(false)
          setNotice('')
        }}
      >
        {settledNote ? 'Mes saldado. Si te equivocaste, lo podés deshacer.' : notice}
      </Toast>

      <HelpSheet
        open={help}
        onClose={() => setHelp(false)}
        kicker="Cómo leer Compartidos"
        intro="Primero el resultado, después la cuenta y al final el detalle."
        blocks={helpBlocks(split, people, monthName(month))}
      />
      <ConfirmSheet
        open={confirm === 'settle'}
        title={`¿Saldar ${monthName(month)}?`}
        onClose={() => setConfirm(null)}
        confirmLabel="Sí, saldar mes"
        onConfirm={() => void confirmSettle()}
        disabled={saving || !plan.canSettle}
        note="Lo podés deshacer desde el aviso de abajo."
      >
        {partner && plan.amount > 0 ? (
          <>
            <p className="font-display text-2xl font-semibold whitespace-nowrap text-title">
              {passPhrase(partner.name, plan.creditorId === meId, plan.amount)}
            </p>
            <MoneyRow label="Por gastos" amount={formatMoney(plan.expenseAmount)} amountClass="text-rosa-texto" dotClass="border-rosa-hondo bg-rosa" />
            <MoneyRow label="Por préstamos" amount={formatMoney(plan.loanAmount)} amountClass="text-ciruela-ink" dotClass="border-ciruela-ink bg-ciruela" />
            <p className="mt-3 text-base font-semibold text-muted">
              Los gastos y préstamos de {monthName(month)} quedan marcados como saldados. Si te equivocás, lo podés deshacer.
            </p>
          </>
        ) : null}
      </ConfirmSheet>
      <Sheet
        open={confirm === 'undo'}
        title="Deshacer saldo"
        onClose={() => setConfirm(null)}
        footer={
          <div className="space-y-2">
            <Button type="button" onClick={() => void confirmUndo()} disabled={saving}>
              Sí, deshacer
            </Button>
            <Button type="button" variant="alt" onClick={() => setConfirm(null)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        }
      >
        <p className="text-base font-semibold text-title">
          ¿Deshacer el saldo de {monthName(month)}? Se borran las devoluciones de este saldo. Las que cargaste a mano quedan.
        </p>
      </Sheet>
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

function personRank(name: string): number {
  const key = name.trim().toLowerCase()
  if (key === 'maru') return 0
  if (key === 'coty') return 1
  return 2
}

function shareCaption(split: SplitResult, people: SplitRow[]): string {
  if (split.usedEvenSplit) return 'Falta algún sueldo base: por ahora, en partes iguales. Los extras no entran.'
  const parts = people.map((row) => `${row.name} ${row.percent}%`).join(' · ')
  return parts ? `Según sueldo base: ${parts}` : 'Los extras no entran en este porcentaje.'
}

function helpBlocks(split: SplitResult, people: SplitRow[], monthLabel: string): HelpBlock[] {
  const base = split.usedEvenSplit
    ? 'en partes iguales, porque falta algún sueldo base'
    : people.map((row) => `${row.name} ${row.percent}%`).join(', ')
  return [
    {
      title: 'Total a saldar',
      titleClass: 'text-mostaza-ink',
      icon: 'scale-balanced',
      iconWrapClass: 'bg-salvia-claro text-mostaza-ink',
      body: 'Cuánta plata tiene que pasarle una a la otra este mes. Suma lo que falta por gastos y los préstamos pendientes.',
    },
    {
      title: 'Cómo se reparte',
      titleClass: 'text-tinta',
      icon: 'chart-column',
      iconWrapClass: 'bg-rosa-claro text-tinta',
      body: (
        <div className="rounded-2xl bg-sand-soft p-3">
          <p>
            <span className="font-bold text-title">Pagó:</span> lo que puso de su bolsillo en gastos compartidos.
          </p>
          <p className="mt-2">
            <span className="font-bold text-mostaza-ink">Su parte:</span> lo que le corresponde poner según su sueldo base: {base}.
          </p>
          <p className="mt-2">
            Si pagó menos que su parte, <span className="text-rosa-texto">debe</span> la diferencia. Si pagó más, la tiene{' '}
            <span className="text-mostaza-ink">a favor</span>.
          </p>
        </div>
      ),
    },
    {
      title: 'Gastos compartidos',
      titleClass: 'text-azul-ink',
      icon: 'receipt',
      iconWrapClass: 'bg-azul-claro text-azul-ink',
      body: `Los gastos que cuentan para este mes y quién los pagó. La etiqueta marca gastos de otra fecha que se cuentan en ${monthLabel}.`,
    },
    {
      title: 'Saldar mes',
      titleClass: 'text-mostaza-ink',
      icon: 'check',
      iconWrapClass: 'bg-mostaza-claro text-mostaza-ink',
      body: 'Tocalo cuando ya se pasaron la plata. Te pedimos confirmación antes de marcar el mes como saldado, y lo podés deshacer.',
    },
  ]
}

function SplitBar({ expense, loans }: { expense: number; loans: number }) {
  const total = expense + loans
  const expenseWidth = total > 0 ? (expense / total) * 100 : 0
  const loanWidth = total > 0 ? (loans / total) * 100 : 0
  return (
    <div className="mt-3 flex h-3 overflow-hidden rounded-full border-[1.5px] border-tinta bg-azul-claro" role="img" aria-label="Gastos y préstamos">
      <div className="h-full border-r-[1.5px] border-rosa-hondo bg-rosa" style={{ width: `${expenseWidth}%` }} />
      <div className="h-full bg-ciruela" style={{ width: `${loanWidth}%` }} />
    </div>
  )
}

function MoneyRow({
  label,
  amount,
  amountClass = 'text-tinta',
  dotClass,
}: {
  label: string
  amount: string
  amountClass?: string
  dotClass: string
}) {
  return (
    <div className="mt-2 flex min-h-11 items-center justify-between gap-3 border-t border-dashed border-line text-base font-semibold text-tinta first:border-t-0">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] ${dotClass}`} aria-hidden="true" />
        {label}
      </span>
      <span className={`shrink-0 whitespace-nowrap font-display font-semibold tabular-nums ${amountClass}`}>{amount}</span>
    </div>
  )
}

function PersonShare({ row }: { row: SplitRow }) {
  const key = row.name.trim().toLowerCase()
  const maru = key === 'maru'
  const nameClass = maru ? 'text-salvia-ink' : key === 'coty' ? 'text-rosa-texto' : 'text-tinta'
  const debt = row.balance < 0
  const favor = row.balance > 0
  const chip = debt
    ? { label: `Debe ${formatMoney(-row.balance)}`, className: 'bg-rosa-claro text-tinta', icon: 'arrow-down' }
    : favor
      ? { label: `A favor ${formatMoney(row.balance)}`, className: 'bg-salvia-claro text-salvia-ink', icon: 'arrow-up' }
      : { label: 'A mano', className: 'bg-sand text-muted', icon: '' }
  const scale = Math.max(row.paid, row.share)
  const paidWidth = scale > 0 ? (row.paid / scale) * 100 : 0
  const shareWidth = scale > 0 ? (row.share / scale) * 100 : 0
  return (
    <li className="border-t border-dashed border-line py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`font-display text-xl font-semibold ${nameClass}`}>{row.name}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap ${chip.className}`}>
          {chip.icon ? <AppIcon name={chip.icon} /> : null}
          {chip.label}
        </span>
      </div>
      <BarLine label="Pagó" amount={formatMoney(row.paid)} width={paidWidth} className={maru ? 'border-[1.5px] border-salvia-ink bg-salvia' : 'border-[1.5px] border-rosa-hondo bg-rosa'} />
      <BarLine
        label={`Su parte (${row.percent}%)`}
        amount={formatMoney(row.share)}
        width={shareWidth}
        className={maru ? '' : 'bg-rosa-claro'}
        hatch={maru}
      />
    </li>
  )
}

function BarLine({
  label,
  amount,
  width,
  className,
  hatch = false,
}: {
  label: string
  amount: string
  width: number
  className: string
  hatch?: boolean
}) {
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-3 text-sm font-semibold text-muted">
        <span className="min-w-0">{label}</span>
        <span className="shrink-0 whitespace-nowrap text-base font-bold text-title">{amount}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand">
        <div
          className={`h-full rounded-full ${className}`}
          style={{
            width: `${width}%`,
            ...(hatch
              ? {
                  backgroundImage:
                    'repeating-linear-gradient(-45deg, var(--color-salvia) 0 5px, var(--color-salvia-claro) 5px 9px)',
                }
              : {}),
          }}
        />
      </div>
    </div>
  )
}
