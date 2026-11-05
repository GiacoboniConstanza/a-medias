import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { MoneyField } from '../components/MoneyField.tsx'
import { Plant } from '../components/Plant.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, Chip, ErrorText } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { loadSettledMonths } from '../lib/api.ts'
import { partnerId } from '../lib/derive.ts'
import { clampNotes, formatMoney, moneyDraftFromAmount, normalizeMoney, parseMoney } from '../lib/format.ts'
import {
  deleteLoan,
  deleteRepayment,
  loadLoanBalances,
  loadRepayments,
  matchesLoanFilter,
  monthIsSettled,
  repaymentIsLocked,
  repaymentRoom,
  saveLoan,
  saveRepayment,
  signedLoanBalance,
  type Loan,
  type LoanFilter,
  type LoanRepayment,
} from '../lib/loans.ts'
import { monthKey, monthName, monthTitle, shiftMonth, shortDate, todayISO } from '../lib/month.ts'
import { periodFromDate } from '../lib/period.ts'

const FILTERS: { id: LoanFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'open', label: 'Pendientes' },
  { id: 'settled', label: 'Saldados' },
]

const SETTLED_HELP = 'Los meses saldados están cerrados. Para cargar ahí, deshacé el saldo en Compartidos.'

export function LoansScreen() {
  const { profile } = useAuth()
  const { data, loading } = useFinance()
  const [loans, setLoans] = useState<Loan[]>([])
  const [settledMonths, setSettledMonths] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<LoanFilter>('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Loan | null>(null)
  const [detail, setDetail] = useState<Loan | null>(null)
  const [repaying, setRepaying] = useState<Loan | null>(null)
  const [editingRepayment, setEditingRepayment] = useState<LoanRepayment | null>(null)

  const meId = profile?.id
  const otherId = data && meId ? partnerId(data, meId) : null
  const partnerName = (otherId && data?.names[otherId]) || null

  useEffect(() => {
    if (!meId) return
    let active = true
    Promise.all([loadLoanBalances(), loadSettledMonths()])
      .then(([rows, months]) => {
        if (!active) return
        setLoans(rows)
        setSettledMonths(months)
        setError('')
        setDetail((current) => (current ? rows.find((loan) => loan.id === current.id) ?? null : null))
      })
      .catch((caught) => {
        if (!active) return
        setError(caught instanceof Error ? caught.message : 'No pude cargar los préstamos.')
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [meId])

  if (!profile) return null
  if ((loading && !data) || !ready) return <p className="py-16 text-center text-base font-semibold text-muted">Cargando…</p>

  const userId = profile.id
  const signed = signedLoanBalance(userId, loans)
  const visible = loans.filter((loan) => matchesLoanFilter(loan.status, filter))

  async function refresh() {
    const [rows, months] = await Promise.all([loadLoanBalances(), loadSettledMonths()])
    setLoans(rows)
    setSettledMonths(months)
    setDetail((current) => (current ? rows.find((loan) => loan.id === current.id) ?? null : null))
  }

  return (
    <>
      <SectionHeader lead="crumb" aside={<NotificationBell />} />
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Préstamos">
        {FILTERS.map((option) => (
          <Chip key={option.id} active={filter === option.id} onClick={() => setFilter(option.id)}>
            {option.label}
          </Chip>
        ))}
      </div>
      <Card className="border-ciruela-ink bg-ciruela-claro">
        <div className="flex items-center gap-3.5">
          <Plant stage={signed === 0 ? 'lush' : 'steady'} />
          <LoanSummary partnerName={partnerName} signed={signed} />
        </div>
      </Card>
      {visible.length === 0 ? (
        <p className="mb-3 text-base font-semibold text-muted">
          {filter === 'settled' ? 'No hay préstamos saldados.' : 'Todavía no hay préstamos para ver.'}
        </p>
      ) : (
        visible.map((loan) => (
          <LoanCard
            key={loan.id}
            loan={loan}
            mine={loan.lenderId === profile.id}
            partnerName={partnerName}
            onOpen={() => setDetail(loan)}
            onRepay={() => setRepaying(loan)}
          />
        ))
      )}
      <Button
        type="button"
        aria-disabled={!otherId}
        onClick={() => {
          if (otherId) setCreating(true)
        }}
      >
        Nuevo préstamo
      </Button>
      {!otherId ? <p className="mt-1.5 text-sm font-medium text-gris">Primero vinculá a tu pareja.</p> : null}
      <ErrorText>{error}</ErrorText>
      {creating && otherId && partnerName ? (
        <LoanEditor
          borrowerId={otherId}
          borrowerName={partnerName}
          settledMonths={settledMonths}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false)
            await refresh()
          }}
        />
      ) : null}
      {editing && otherId ? (
        <LoanEditor
          loan={editing}
          borrowerId={editing.borrowerId}
          borrowerName={data?.names[editing.borrowerId] ?? 'tu compañera'}
          settledMonths={settledMonths}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await refresh()
          }}
        />
      ) : null}
      {repaying ? (
        <RepaymentEditor
          loan={repaying}
          settledMonths={settledMonths}
          onClose={() => setRepaying(null)}
          onSaved={async () => {
            setRepaying(null)
            await refresh()
          }}
        />
      ) : null}
      {detail ? (
        <LoanDetail
          loan={detail}
          meId={profile.id}
          names={data?.names ?? {}}
          settledMonths={settledMonths}
          onClose={() => setDetail(null)}
          onEdit={() => setEditing(detail)}
          onRepay={() => setRepaying(detail)}
          onEditRepayment={(repayment) => setEditingRepayment(repayment)}
          onChanged={refresh}
        />
      ) : null}
      {editingRepayment && detail ? (
        <RepaymentEditor
          loan={detail}
          repayment={editingRepayment}
          settledMonths={settledMonths}
          onClose={() => setEditingRepayment(null)}
          onSaved={async () => {
            setEditingRepayment(null)
            await refresh()
          }}
        />
      ) : null}
    </>
  )
}

function LoanSummary({ partnerName, signed }: { partnerName: string | null; signed: number }) {
  const amount = normalizeMoney(signed)
  if (!partnerName) return <p className="text-sm font-medium text-tinta">Cuando se sume tu compañera, van a poder prestarse.</p>
  if (amount === 0) return <p className="text-lg font-medium text-tinta">Están a mano.</p>
  const maru = partnerName.trim().toLowerCase() === 'maru'
  const name = <span className={`font-bold ${maru ? 'text-salvia-ink' : 'text-rosa-texto'}`}>{partnerName}</span>
  if (amount < 0) {
    return (
      <p className="text-lg font-medium text-tinta">
        Le debés <span className="whitespace-nowrap font-display font-semibold">{formatMoney(-amount)}</span> a {name}.
      </p>
    )
  }
  return (
    <div className="min-w-0">
      <p className="text-lg font-medium text-tinta">{name} te debe</p>
      <p className="mt-1 whitespace-nowrap font-display text-[36px] font-semibold leading-none text-tinta">{formatMoney(amount)}</p>
      <p className="mt-1.5 text-sm font-medium text-tinta">en préstamos</p>
    </div>
  )
}

function LoanCard({
  loan,
  mine,
  partnerName,
  onOpen,
  onRepay,
}: {
  loan: Loan
  mine: boolean
  partnerName: string | null
  onOpen: () => void
  onRepay: () => void
}) {
  const who = mine ? `Le prestaste a ${partnerName ?? 'ella'}` : `${partnerName ?? 'Ella'} te prestó`
  return (
    <article className="mb-3 rounded-2xl border-2 border-ciruela-ink bg-card p-4">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gris">{who}</span>
            <span className="mt-1.5 block whitespace-nowrap font-display text-lg font-semibold text-ciruela-ink">
              {formatMoney(loan.amount)}
            </span>
          </span>
          <span className="text-base font-semibold text-muted">{shortDate(loan.lentOn)}</span>
        </span>
        {loan.notes ? <span className="mt-1 block text-base font-semibold text-muted">{loan.notes}</span> : null}
        <span className="mt-1 block whitespace-nowrap text-base font-semibold text-muted">
          Devuelto {formatMoney(loan.repaid)} · falta {formatMoney(loan.pending)}
        </span>
      </button>
      {loan.pending > 0 ? (
        <button type="button" onClick={onRepay} className="mt-1 min-h-11 text-base font-semibold text-mostaza-ink">
          Registrar devolución
        </button>
      ) : (
        <p className="mt-1 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-mostaza-ink">
          <AppIcon name="check" /> Saldado
        </p>
      )}
    </article>
  )
}

function LoanDetail({
  loan,
  meId,
  names,
  settledMonths,
  onClose,
  onEdit,
  onRepay,
  onEditRepayment,
  onChanged,
}: {
  loan: Loan
  meId: string
  names: Record<string, string>
  settledMonths: readonly string[]
  onClose: () => void
  onEdit: () => void
  onRepay: () => void
  onEditRepayment: (repayment: LoanRepayment) => void
  onChanged: () => Promise<void>
}) {
  const [rows, setRows] = useState<LoanRepayment[]>([])
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const lender = loan.lenderId === meId
  const locked = Boolean(loan.lockMonth)

  useEffect(() => {
    let active = true
    loadRepayments(loan.id)
      .then((next) => {
        if (active) setRows(next)
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'No pude cargar las devoluciones.')
      })
    return () => {
      active = false
    }
  }, [loan.id, loan.repaid])

  async function removeLoan() {
    setError('')
    try {
      await deleteLoan(loan.id)
      await onChanged()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude eliminar el préstamo.')
    }
  }

  async function removeRepayment(id: string) {
    setError('')
    try {
      await deleteRepayment(id)
      setConfirming(null)
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude eliminar la devolución.')
    }
  }

  return (
    <>
      <Sheet
        open
        title="Préstamo"
        onClose={onClose}
        footer={
          <div className="space-y-2">
            {loan.pending > 0 ? (
              <Button type="button" onClick={onRepay}>
                Registrar devolución
              </Button>
            ) : null}
            {lender && !locked ? (
              <>
                <Button type="button" variant="alt" onClick={onEdit}>
                  Editar préstamo
                </Button>
                <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-tinta" onClick={() => setConfirming('loan')}>
                  <AppIcon name="trash" /> Eliminar
                </button>
              </>
            ) : null}
          </div>
        }
      >
        {locked && loan.lockMonth ? (
          <div className="mb-3 rounded-2xl bg-azul-claro p-3 text-base font-semibold text-tinta">
            <AppIcon name="lock" className="mr-1" />
            {monthWord(loan.lockMonth)} ya está saldado. Para cambiar este préstamo, primero deshacé el saldo en Compartidos.
            <Link to="/compartidos" className="mt-2 flex min-h-11 items-center text-base font-bold text-mostaza-ink">
              Ir a Compartidos
            </Link>
          </div>
        ) : null}
        <p className="whitespace-nowrap font-display text-3xl font-semibold tabular-nums text-ciruela-ink">{formatMoney(loan.amount)}</p>
        <p className="mt-1 text-base font-semibold text-muted">
          {names[loan.lenderId] ?? 'Alguien'} le prestó a {names[loan.borrowerId] ?? 'alguien'} · {shortDate(loan.lentOn)}
        </p>
        <p className="mt-1 whitespace-nowrap text-base font-semibold text-muted">
          Devuelto {formatMoney(loan.repaid)} · pendiente {formatMoney(loan.pending)}
        </p>
        {loan.notes ? <p className="mt-2 text-base font-semibold">{loan.notes}</p> : null}
        <h3 className="mb-2 mt-4 font-display text-lg font-semibold">Devoluciones</h3>
        {rows.length === 0 ? <p className="text-base font-semibold text-muted">Todavía no hay devoluciones.</p> : null}
        <ul>
          {rows.map((repayment) => {
            const rowLocked = repaymentIsLocked(repayment, settledMonths)
            return (
              <li key={repayment.id} className="border-t border-dashed border-line py-2">
                <p className="flex justify-between gap-3 text-base font-semibold">
                  <span>{shortDate(repayment.paidOn)}</span>
                  <span className="whitespace-nowrap">{formatMoney(repayment.amount)}</span>
                </p>
                {repayment.notes ? <p className="text-base font-semibold text-muted">{repayment.notes}</p> : null}
                {repayment.createdBy === meId && !rowLocked ? (
                  <p className="mt-1 flex gap-3">
                    <button type="button" className="min-h-11 font-semibold text-mostaza-ink" onClick={() => onEditRepayment(repayment)}>
                      Editar
                    </button>
                    <button type="button" className="min-h-11 font-semibold text-tinta" onClick={() => setConfirming(repayment.id)}>
                      Eliminar
                    </button>
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
        <ErrorText>{error}</ErrorText>
      </Sheet>
      <ConfirmSheet
        open={confirming === 'loan'}
        title="¿Eliminar este préstamo?"
        confirmLabel="Eliminar"
        onClose={() => setConfirming(null)}
        onConfirm={() => void removeLoan()}
      >
        También se borran las devoluciones.
      </ConfirmSheet>
      <ConfirmSheet
        open={confirming !== null && confirming !== 'loan'}
        title="¿Eliminar esta devolución?"
        confirmLabel="Eliminar"
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) void removeRepayment(confirming)
        }}
      >
        ¿Eliminar esta devolución?
      </ConfirmSheet>
    </>
  )
}

function LoanEditor({
  loan,
  borrowerId,
  borrowerName,
  settledMonths,
  onClose,
  onSaved,
}: {
  loan?: Loan
  borrowerId: string
  borrowerName: string
  settledMonths: readonly string[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [draft, setDraft] = useState(loan ? moneyDraftFromAmount(loan.amount) : '')
  const [lentOn, setLentOn] = useState(loan?.lentOn ?? todayISO())
  const [period, setPeriod] = useState(loan?.period ?? periodFromDate(todayISO()))
  const [periodTouched, setPeriodTouched] = useState(Boolean(loan))
  const [notes, setNotes] = useState(loan?.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function save() {
    const amount = parseMoney(draft)
    if (amount == null || amount <= 0) {
      setError('El monto tiene que ser mayor a 0.')
      return
    }
    if (monthIsSettled(period, settledMonths)) {
      setError(SETTLED_HELP)
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveLoan({
        id: loan?.id,
        borrowerId,
        amount,
        lentOn,
        period,
        notes: clampNotes(notes),
      })
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar el préstamo.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!loan) return
    setSaving(true)
    setError('')
    try {
      await deleteLoan(loan.id)
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude eliminar el préstamo.')
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        open
        title={loan ? 'Editar préstamo' : 'Nuevo préstamo'}
        onClose={onClose}
        footer={
          <div className="space-y-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            {loan ? (
              <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-tinta" onClick={() => setConfirming(true)} disabled={saving}>
                <AppIcon name="trash" /> Eliminar
              </button>
            ) : null}
          </div>
        }
      >
        <p className="mb-3 text-base font-semibold text-muted">Se lo prestás a {borrowerName}.</p>
        <MoneyField draft={draft} onDraft={setDraft} error={error && parseMoney(draft) == null ? error : undefined} />
        <label className="mb-3 block text-base font-bold text-muted">
          Fecha
          <input
            type="date"
            value={lentOn}
            onChange={(event) => {
              const next = event.target.value
              setLentOn(next)
              if (!periodTouched) setPeriod(periodFromDate(next))
            }}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-sand px-3 py-2 text-base font-semibold"
          />
        </label>
        <PeriodField
          value={period}
          settledMonths={settledMonths}
          onChange={(next) => {
            setPeriodTouched(true)
            setError('')
            setPeriod(next)
          }}
          onReject={() => setError(SETTLED_HELP)}
        />
        <NotesField value={notes} onChange={setNotes} />
        {error && parseMoney(draft) != null ? <ErrorText>{error}</ErrorText> : null}
      </Sheet>
      <ConfirmSheet
        open={confirming}
        title="¿Eliminar este préstamo?"
        confirmLabel={saving ? 'Eliminando…' : 'Eliminar'}
        disabled={saving}
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
      >
        También se borran las devoluciones.
      </ConfirmSheet>
    </>
  )
}

function RepaymentEditor({
  loan,
  repayment,
  settledMonths,
  onClose,
  onSaved,
}: {
  loan: Loan
  repayment?: LoanRepayment
  settledMonths: readonly string[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const room = repaymentRoom(loan.pending, repayment?.amount ?? 0)
  const [draft, setDraft] = useState(moneyDraftFromAmount(repayment?.amount ?? room))
  const [paidOn, setPaidOn] = useState(repayment?.paidOn ?? todayISO())
  const [period, setPeriod] = useState(repayment?.period ?? periodFromDate(todayISO()))
  const [periodTouched, setPeriodTouched] = useState(Boolean(repayment))
  const [notes, setNotes] = useState(repayment?.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function save() {
    const amount = parseMoney(draft)
    if (amount == null || amount <= 0) {
      setError('El monto tiene que ser mayor a 0.')
      return
    }
    if (amount > room) {
      setError(`No podés devolver más de ${formatMoney(room)}.`)
      return
    }
    if (monthIsSettled(period, settledMonths)) {
      setError(SETTLED_HELP)
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveRepayment({
        id: repayment?.id,
        loanId: loan.id,
        amount,
        paidOn,
        period,
        notes: clampNotes(notes),
      })
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude guardar la devolución.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!repayment) return
    setSaving(true)
    try {
      await deleteRepayment(repayment.id)
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude eliminar la devolución.')
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        open
        title={repayment ? 'Editar devolución' : 'Registrar devolución'}
        onClose={onClose}
        footer={
          <div className="space-y-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            {repayment ? (
              <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-tinta" onClick={() => setConfirming(true)} disabled={saving}>
                <AppIcon name="trash" /> Eliminar
              </button>
            ) : null}
          </div>
        }
      >
        <p className="mb-3 text-base font-semibold text-muted">Falta {formatMoney(loan.pending)}. Podés devolver una parte.</p>
        <MoneyField draft={draft} onDraft={setDraft} />
        <label className="mb-3 block text-base font-bold text-muted">
          Fecha
          <input
            type="date"
            value={paidOn}
            onChange={(event) => {
              const next = event.target.value
              setPaidOn(next)
              if (!periodTouched) setPeriod(periodFromDate(next))
            }}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-sand px-3 py-2 text-base font-semibold"
          />
        </label>
        <PeriodField
          value={period}
          settledMonths={settledMonths}
          onChange={(next) => {
            setPeriodTouched(true)
            setError('')
            setPeriod(next)
          }}
          onReject={() => setError(SETTLED_HELP)}
        />
        <NotesField value={notes} onChange={setNotes} />
        <ErrorText>{error}</ErrorText>
      </Sheet>
      <ConfirmSheet
        open={confirming}
        title="¿Eliminar esta devolución?"
        confirmLabel={saving ? 'Eliminando…' : 'Eliminar'}
        disabled={saving}
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
      >
        ¿Eliminar esta devolución?
      </ConfirmSheet>
    </>
  )
}

function PeriodField({
  value,
  settledMonths,
  onChange,
  onReject,
}: {
  value: string
  settledMonths: readonly string[]
  onChange: (period: string) => void
  onReject: () => void
}) {
  const todayMonth = monthKey()
  const choices = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, 1)]
  const [other, setOther] = useState(!choices.includes(value))
  const anySettled = choices.some((choice) => monthIsSettled(choice, settledMonths)) || settledMonths.length > 0
  return (
    <div className="mb-3">
      <p className="mb-1 text-base font-bold text-muted">Corresponde a</p>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice, index) => {
          const closed = monthIsSettled(choice, settledMonths)
          const label = index === 0 ? 'Mes anterior' : index === 1 ? 'Mes actual' : 'Mes siguiente'
          return (
            <button
              key={choice}
              type="button"
              disabled={closed}
              aria-pressed={!closed && value === choice && !other}
              onClick={() => {
                setOther(false)
                onChange(choice)
              }}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl px-3 text-base font-semibold disabled:text-muted ${
                !closed && value === choice && !other ? 'border-[1.5px] border-tinta bg-mostaza text-tinta' : 'border border-line bg-card text-title'
              }`}
            >
              {closed ? <AppIcon name="lock" /> : null}
              {label}
              {closed ? <span>Saldado</span> : null}
            </button>
          )
        })}
        <Chip active={other} onClick={() => setOther(true)}>
          Elegir otro
        </Chip>
      </div>
      {other ? (
        <label className="mt-2 block text-base font-bold text-muted">
          {monthTitle(value)}
          <input
            type="month"
            value={value.slice(0, 7)}
            onChange={(event) => {
              if (!event.target.value) return
              const next = `${event.target.value}-01`
              if (monthIsSettled(next, settledMonths)) {
                onReject()
                return
              }
              onChange(next)
            }}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-sand px-3 py-2 text-base font-semibold"
          />
        </label>
      ) : null}
      {anySettled ? <p className="mt-2 text-base text-muted">{SETTLED_HELP}</p> : null}
    </div>
  )
}

function NotesField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-3 block text-base font-bold text-muted">
      Observaciones
      <textarea
        value={value}
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-24 w-full rounded-2xl border border-line bg-sand px-3 py-2 text-base font-semibold"
      />
    </label>
  )
}

function monthWord(period: string): string {
  const name = monthName(period)
  return name.charAt(0).toUpperCase() + name.slice(1)
}
