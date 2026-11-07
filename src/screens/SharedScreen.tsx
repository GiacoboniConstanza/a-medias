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
import { debtCopy, monthSplit, partnerId } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'
import { DEFAULT_ICON } from '../lib/icons.ts'
import { loadLoanBalances } from '../lib/loans.ts'
import { monthName, shortDate } from '../lib/month.ts'
import { planMonthSettlement, returnSentences, type SettleLoan } from '../lib/settle.ts'
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

  useEffect(() => {
    if (!profile) return
    let active = true
    loadLoanBalances()
      .then((rows) => {
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
      })
      .catch(() => {
        if (!active) return
        setLoans([])
      })
    return () => {
      active = false
    }
  }, [profile, data])

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
  const gap = partner?.balance ?? 0
  const returnsNote = returnSentences(meId, partner?.name ?? 'tu compañera', plan.repayments)
  const friendly = profile.viewMode === 'friendly'
  const visible = friendly || payerFilter === 'all' ? shared : shared.filter((expense) => expense.payerId === payerFilter)
  const filters = [
    { id: 'all', label: `Todos (${shared.length})` },
    ...people.map((row) => ({
      id: row.id,
      label: `${row.id === meId ? 'Pagaste vos' : `Pagó ${row.name}`} (${shared.filter((expense) => expense.payerId === row.id).length})`,
    })),
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

      {shared.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-gris">Este mes no hay gastos compartidos.</p>
      ) : (
        <>
          <section
            className="relative left-1/2 mb-6 w-screen -translate-x-1/2 bg-azul py-4 text-tinta"
            style={{ paddingInline: 'max(16px, calc((100vw - var(--ancho-columna)) / 2 + 16px))' }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-semibold text-tinta">
                <AppIcon name="scale-balanced" /> Reparto
              </h2>
              <span
                className={`inline-flex h-[var(--alto-chip)] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-tinta px-2.5 text-sm font-semibold ${
                  settled ? 'bg-azul-claro text-azul-ink' : 'bg-crema text-tinta'
                }`}
              >
                {settled ? <AppIcon name="check" /> : <span className="inline-block h-3 w-3 rounded-full border-[1.5px] border-tinta bg-crema" />}
                {settled ? 'Saldado' : 'Sin saldar'}
              </span>
            </div>
            {gap === 0 || !partner ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="min-w-0 font-display text-[36px] font-semibold leading-none text-tinta">Están a mano</p>
                <Plantita width={46} height={60} />
              </div>
            ) : (
              <>
                <p className="mt-3 text-lg font-medium text-tinta">
                  <NameOnBlue name={partner.name} /> puso de {gap > 0 ? 'más' : 'menos'}
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="min-w-0 font-display text-[36px] font-semibold leading-none whitespace-nowrap text-tinta">{formatMoney(Math.abs(gap))}</p>
                  <Plantita width={46} height={60} />
                </div>
              </>
            )}
            {settled ? (
              <p className="mt-3 rounded-2xl border-[1.5px] border-tinta bg-azul-claro px-[18px] py-2.5 text-sm font-medium text-tinta">
                Mes saldado.
              </p>
            ) : null}
            {settled ? (
              <Button type="button" variant="alt" className="mt-2.5" onClick={() => setConfirm('undo')} disabled={saving}>
                Deshacer saldo
              </Button>
            ) : (
              <>
                <Button type="button" className="mt-2.5" onClick={() => setConfirm('settle')} disabled={saving || !plan.canSettle}>
                  Saldar mes
                </Button>
                {plan.blockedReason ? <p className="mt-1.5 text-sm font-medium text-tinta">{plan.blockedReason}</p> : null}
              </>
            )}
          </section>

          {friendly ? (
            <WhoPaid people={people} total={split.total} meId={meId} />
          ) : (
            <Card>
              <h2 className="font-display text-lg font-semibold text-tinta">Cómo se reparte</h2>
              <p className="mt-1 text-sm font-medium text-gris">{shareCaption(split, people)}</p>
              <ul className="mt-2">
                {people.map((row) => (
                  <PersonShare key={row.id} row={row} scale={shareScale(people)} />
                ))}
              </ul>
            </Card>
          )}

          {!friendly ? (
            <p className="mb-3 flex h-[52px] items-center justify-between rounded-2xl bg-azul-claro px-[18px] text-sm font-medium text-tinta">
              Total del mes
              <span className="whitespace-nowrap font-display text-lg font-semibold">{formatMoney(split.total)}</span>
            </p>
          ) : null}
          {!friendly ? <FilterBar label="Quién pagó" options={filters} value={payerFilter} onChange={setPayerFilter} /> : null}

          <div className="mb-1 mt-4 flex items-center justify-between gap-3">
            <h2 className="inline-flex min-w-0 items-center gap-2 font-display text-lg font-semibold text-tinta">
              <AppIcon name="receipt" /> <ListFlower /> Gastos compartidos
            </h2>
            <p className="shrink-0 text-sm font-medium text-gris">{shared.length} gastos</p>
          </div>
          {visible.length === 0 ? (
            <p className="mb-3 text-sm font-medium text-gris">Este mes no hay gastos compartidos.</p>
          ) : (
            <ul className="mb-3">
              {visible.map((expense) => {
                const category = data.categories.find((item) => item.id === expense.categoryId)
                const mine = expense.payerId === meId
                return (
                  <li key={expense.id} className="border-t-[1.5px] border-dashed border-line first:border-t-0">
                    <ExpenseLine
                      expense={expense}
                      categoryName={category?.name ?? 'Otros'}
                      categoryIcon={category?.icon || DEFAULT_ICON}
                      whoPaid={mine ? 'me' : 'partner'}
                      personName={mine ? (data.names[meId] ?? 'vos') : (data.names[expense.payerId] ?? 'Sin nombre')}
                      onOpen={() => setOpenExpense(expense)}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <button type="button" onClick={exportCsv} className="mx-auto flex min-h-[52px] items-center justify-center gap-2 text-lg font-semibold text-mostaza-ink">
            <AppIcon name="file-export" /> Exportar a planilla
          </button>
        </>
      )}
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
            <p className="font-display text-2xl font-semibold text-title">{debtCopy(meId, split)}</p>
            <p className="mt-2 text-base font-semibold text-muted">Eso no cambia lo que te queda.</p>
            {returnsNote ? (
              <p className="mt-3 text-base font-semibold text-title">Al saldar se anotan estas devoluciones: {returnsNote}.</p>
            ) : null}
            <p className="mt-3 text-base font-semibold text-muted">
              El mes queda marcado como saldado. Si te equivocás, lo podés deshacer.
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
      title: 'Reparto',
      titleClass: 'text-mostaza-ink',
      icon: 'scale-balanced',
      iconWrapClass: 'bg-salvia-claro text-mostaza-ink',
      body: 'Cuánto le toca a cada una. Si puso de más o de menos, es el reparto: no cambia la plata que te queda ni se suma a las transferencias.',
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
            Si pagó menos que su parte, <span className="text-rosa-texto">puso de menos</span>. Si pagó más,{' '}
            <span className="text-mostaza-ink">puso de más</span>.
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
      body: 'Marca el mes como saldado y anota la devolución de cada transferencia pendiente. El reparto no se convierte en una transferencia. Lo podés deshacer.',
    },
  ]
}

function shareScale(people: SplitRow[]): number {
  return Math.max(0, ...people.flatMap((row) => [row.paid, row.share]))
}

function NameOnBlue({ name }: { name: string }) {
  const maru = name.trim().toLowerCase() === 'maru'
  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-tinta">
      <span className={`inline-block h-3 w-3 rounded-full border-[1.5px] border-tinta ${maru ? 'bg-salvia' : 'bg-rosa'}`} aria-hidden="true" />
      {name}
    </span>
  )
}

function WhoPaid({ people, total, meId }: { people: SplitRow[]; total: number; meId: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-semibold text-tinta">
          <AppIcon name="wallet" /> Quién pagó
        </h2>
        <p className="whitespace-nowrap font-display text-lg font-semibold text-tinta">{formatMoney(total)}</p>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full border-[1.5px] border-tinta" role="img" aria-label="Quién pagó">
        {people.map((row) => (
          <div
            key={row.id}
            className={`h-full ${row.name.trim().toLowerCase() === 'maru' ? 'bg-salvia' : 'bg-rosa'}`}
            style={{ width: `${total > 0 ? (row.paid / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      {people.map((row) => {
        const maru = row.name.trim().toLowerCase() === 'maru'
        return (
          <div key={row.id} className="mt-2 flex min-h-[34px] items-center justify-between gap-3 border-t-[1.5px] border-dashed border-line text-sm first:border-t-0">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className={`inline-block h-3 w-3 shrink-0 rounded-full border-[1.5px] border-tinta ${maru ? 'bg-salvia' : 'bg-rosa'}`} aria-hidden="true" />
              <span className={`font-bold ${maru ? 'text-salvia-ink' : 'text-rosa-texto'}`}>{row.id === meId ? 'Pagaste vos' : `Pagó ${row.name}`}</span>
            </span>
            <span className="whitespace-nowrap font-display text-sm font-semibold text-tinta">{formatMoney(row.paid)}</span>
          </div>
        )
      })}
    </Card>
  )
}

function PersonShare({ row, scale }: { row: SplitRow; scale: number }) {
  const key = row.name.trim().toLowerCase()
  const maru = key === 'maru'
  const nameClass = maru ? 'text-salvia-ink' : key === 'coty' ? 'text-rosa-texto' : 'text-tinta'
  const debt = row.balance < 0
  const favor = row.balance > 0
  const chip = debt
    ? { label: `Puso de menos ${formatMoney(-row.balance)}`, icon: 'arrow-right-from-bracket' }
    : favor
      ? { label: `Puso de más ${formatMoney(row.balance)}`, icon: 'arrow-right-to-bracket' }
      : { label: 'A mano', icon: '' }
  const paidWidth = scale > 0 ? (row.paid / scale) * 100 : 0
  const shareWidth = scale > 0 ? (row.share / scale) * 100 : 0
  const tone = maru ? 'var(--color-salvia)' : 'var(--color-rosa)'
  return (
    <li className="border-t-[1.5px] border-dashed border-line py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`font-display text-lg font-semibold ${nameClass}`}>{row.name}</p>
        <span className="inline-flex h-[var(--alto-chip)] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-azul-claro px-2.5 text-sm font-semibold text-azul-ink">
          {chip.icon ? <AppIcon name={chip.icon} /> : null}
          {chip.label}
        </span>
      </div>
      <BarLine label="Pagó" amount={formatMoney(row.paid)} width={paidWidth} color={tone} />
      <BarLine label={`Su parte (${row.percent}%)`} amount={formatMoney(row.share)} width={shareWidth} color={tone} hatch />
    </li>
  )
}

function BarLine({
  label,
  amount,
  width,
  color,
  hatch = false,
}: {
  label: string
  amount: string
  width: number
  color: string
  hatch?: boolean
}) {
  return (
    <div className="mt-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm font-medium text-gris">
        <span className="min-w-0">{label}</span>
        <span className="shrink-0 whitespace-nowrap font-display text-sm font-semibold text-tinta">{amount}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full border-[1.5px] border-tinta bg-card">
        <div
          className="h-full"
          style={{
            width: `${width}%`,
            background: hatch ? `repeating-linear-gradient(45deg, ${color} 0 3px, var(--color-tarjeta) 3px 6px)` : color,
          }}
        />
      </div>
    </div>
  )
}
