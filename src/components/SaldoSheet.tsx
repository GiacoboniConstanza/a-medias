import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from './AppIcon.tsx'
import { Plantita } from './Adornos.tsx'
import { ConfirmSheet } from './ConfirmSheet.tsx'
import { Sheet } from './Sheet.tsx'
import { Button, Toast } from './ui.tsx'
import { settleMonth, undoSettlement, type FinanceData } from '../lib/api.ts'
import { debtCopy, monthSplit, partnerId } from '../lib/derive.ts'
import { formatMoney, formatPercent } from '../lib/format.ts'
import { monthName } from '../lib/month.ts'
import { planMonthSettlement } from '../lib/settle.ts'
import type { SplitResult, SplitRow } from '../lib/split.ts'

export function SaldoSheet({
  open,
  onClose,
  data,
  meId,
  month,
  onRefresh,
}: {
  open: boolean
  onClose: () => void
  data: FinanceData
  meId: string
  month: string
  onRefresh: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState<'settle' | 'undo' | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [settledNote, setSettledNote] = useState(false)

  const otherId = partnerId(data, meId)
  const split = monthSplit(data)
  const plan = planMonthSettlement({
    month,
    meId,
    partnerId: otherId,
    split,
    alreadySettled: Boolean(data.settlement),
  })
  const people = [...split.rows].sort((a, b) => personRank(a.name) - personRank(b.name))
  const partner = people.find((row) => row.id !== meId) ?? null
  const aMano = plan.amount === 0 && !data.settlement
  const settled = Boolean(data.settlement)

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
      })
      setConfirm(null)
      setSettledNote(true)
      await onRefresh()
    } catch {
      setMessage('No se pudo saldar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmUndo() {
    if (!data.settlement) return false
    setSaving(true)
    setMessage('')
    try {
      await undoSettlement(data.settlement.id)
      setConfirm(null)
      setSettledNote(false)
      await onRefresh()
      return true
    } catch {
      setMessage('No se pudo deshacer. Probá de nuevo.')
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet open={open} title={`Saldo de ${monthName(month)}`} onClose={onClose}>
        <div className="space-y-6 px-1">
          <div className="rounded-2xl bg-azul p-4 text-tinta">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg font-semibold">Reparto</p>
              <StatusChip settled={settled} />
            </div>
            {aMano ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="font-display text-[36px] font-semibold leading-none">Están a mano</p>
                <Plantita width={46} height={60} />
              </div>
            ) : (
              <>
                <p className="mt-2 text-lg font-semibold">{partner ? debtCopy(meId, split) : 'Sin compañera'}</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="whitespace-nowrap font-display text-[36px] font-semibold leading-none">
                    {formatMoney(plan.amount || split.amount)}
                  </p>
                  <Plantita width={46} height={60} />
                </div>
              </>
            )}
            {settled ? (
              <div className="mt-4 space-y-2">
                <p className="rounded-2xl border-[1.5px] border-tinta bg-azul-claro px-3 py-2 text-sm font-semibold">Mes saldado.</p>
                <Button type="button" variant="alt" onClick={() => setConfirm('undo')} disabled={saving}>
                  Deshacer saldo
                </Button>
              </div>
            ) : aMano ? null : (
              <Button type="button" className="mt-4" tall onClick={() => setConfirm('settle')} disabled={saving || !plan.canSettle}>
                Saldar mes
              </Button>
            )}
          </div>

          <div>
            <h3 className="font-display text-lg font-semibold text-tinta">Cómo se reparte</h3>
            <p className="mt-1 text-sm font-medium text-gris">{shareCaption(split, people)}</p>
            <div className="mt-4 space-y-4">
              {people.map((row) => (
                <PersonShare key={row.id} row={row} meId={meId} aMano={aMano} />
              ))}
            </div>
          </div>

          <Link
            to="/movimientos?tipo=gastos&scope=shared"
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-between border-t border-dashed border-linea-punteada font-bold text-mostaza-ink"
          >
            Ver gastos compartidos
            <AppIcon name="chevron-right" />
          </Link>
        </div>
        {settledNote ? (
          <div className="sticky bottom-0 mt-4 border-t border-linea-punteada bg-tarjeta px-1 py-3">
            <Toast
              onUndo={() => confirmUndo()}
              onDone={() => setSettledNote(false)}
            >
              Mes saldado. Si te equivocaste, lo podés deshacer.
            </Toast>
          </div>
        ) : null}
        {message ? <p className="mt-3 text-sm font-bold text-tinta" role="alert">{message}</p> : null}
      </Sheet>

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
            <p className="font-display text-2xl font-semibold text-tinta">{debtCopy(meId, split)}</p>
            <p className="mt-2 text-base font-semibold text-gris">Eso no cambia lo que te queda.</p>
            <p className="mt-3 text-base font-semibold text-gris">
              El mes queda marcado como saldado. Si te equivocás, lo podés deshacer.
            </p>
          </>
        ) : null}
      </ConfirmSheet>

      <ConfirmSheet
        open={confirm === 'undo'}
        title={`¿Deshacer el saldo de ${monthName(month)}?`}
        onClose={() => setConfirm(null)}
        confirmLabel="Sí, deshacer"
        onConfirm={() => void confirmUndo()}
        disabled={saving}
      >
        <p className="text-base font-semibold text-tinta">El mes vuelve a quedar sin saldar.</p>
      </ConfirmSheet>
    </>
  )
}

function StatusChip({ settled }: { settled: boolean }) {
  return (
    <span
      className={`inline-flex h-[var(--alto-chip)] items-center gap-1 rounded-full border-[1.5px] border-tinta px-2.5 text-sm font-semibold ${
        settled ? 'bg-azul-claro text-azul-ink' : 'bg-crema text-tinta'
      }`}
    >
      {settled ? <AppIcon name="check" /> : <AppIcon name="circle" className="text-[10px]" />}
      {settled ? 'Saldado' : 'Sin saldar'}
    </span>
  )
}

function PersonShare({ row, meId, aMano }: { row: SplitRow; meId: string; aMano: boolean }) {
  const mine = row.id === meId
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-tinta">
        <span>{mine ? `Yo (${row.name})` : row.name}</span>
        <span>{aMano ? 'A mano' : `${formatPercent(row.percent)} · ${formatMoney(row.share)}`}</span>
      </div>
      <BarLine percent={row.percent} tone={mine ? 'rosa' : 'salvia'} />
    </div>
  )
}

function BarLine({ percent, tone }: { percent: number; tone: 'rosa' | 'salvia' }) {
  const fill = tone === 'rosa' ? 'bg-rosa' : 'bg-salvia'
  return (
    <div className="mt-2 h-[var(--alto-barra-reparto)] overflow-hidden rounded-full bg-azul-claro">
      <div className={`h-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  )
}

function shareCaption(split: SplitResult, people: SplitRow[]): string {
  if (split.usedEvenSplit) return 'Falta algún sueldo base: por ahora, en partes iguales. Los extras no entran.'
  const parts = people.map((row) => `${row.name} ${row.percent}%`).join(' · ')
  return parts ? `Según sueldo base: ${parts}` : 'Los extras no entran en este porcentaje.'
}

function personRank(name: string): number {
  const key = name.trim().toLowerCase()
  if (key === 'maru') return 0
  if (key === 'coty') return 1
  return 2
}
