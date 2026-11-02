import { useEffect, useState } from 'react'
import { AppIcon } from '../components/AppIcon.tsx'
import { MoneyField } from '../components/MoneyField.tsx'
import { Plant } from '../components/Plant.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'
import { SectionHeader } from '../components/SectionHeader.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Card, Chip, ErrorText, FilterBar, Progress } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { partnerId } from '../lib/derive.ts'
import { clampNotes, formatMoney, moneyDraftFromAmount, parseMoney } from '../lib/format.ts'
import {
  deleteLoan,
  deleteRepayment,
  friendlyLoanSummary,
  loadLoanBalances,
  loadRepayments,
  matchesLoanFilter,
  repaymentRoom,
  saveLoan,
  saveRepayment,
  signedLoanBalance,
  type Loan,
  type LoanFilter,
  type LoanRepayment,
} from '../lib/loans.ts'
import { monthKey, monthTitle, shiftMonth, shortDate, todayISO } from '../lib/month.ts'
import { periodFromDate } from '../lib/period.ts'
const FILTERS: { id: LoanFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'open', label: 'Pendientes' },
  { id: 'settled', label: 'Saldados' },
]

export function LoansScreen() {
  const { profile } = useAuth()
  const { data, loading } = useFinance()
  const [loans, setLoans] = useState<Loan[]>([])
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
    loadLoanBalances()
      .then((rows) => {
        if (!active) return
        setLoans(rows)
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
  if ((loading && !data) || !ready) return <p className="py-16 text-center font-bold text-muted">Cargando…</p>

  const friendly = true // S11: siempre Amigable, aunque el modo guardado sea Contable.
  const userId = profile.id
  const signed = signedLoanBalance(userId, loans)
  const visible = loans.filter((loan) => matchesLoanFilter(loan.status, filter))
  const openLoan = editing ?? (creating ? null : undefined)

  async function refresh() {
    const rows = await loadLoanBalances()
    setLoans(rows)
    setDetail((current) => (current ? rows.find((loan) => loan.id === current.id) ?? null : null))
  }

  return (
    <>
      <SectionHeader lead="crumb" aside={<NotificationBell />} />
      <FilterBar label="Préstamos" options={FILTERS} value={filter} onChange={(id) => setFilter(id as LoanFilter)} />
      {friendly ? (
        <Card>
          <div className="flex items-center gap-2">
            <Plant stage={signed === 0 ? 'lush' : 'steady'} />
            <p className="min-w-0 font-display text-2xl font-semibold leading-tight text-primary">
              {friendlyLoanSummary(partnerName, signed)}
            </p>
          </div>
        </Card>
      ) : null}
      {visible.length === 0 ? (
        <p className="mb-3 text-base font-semibold text-muted">
          {filter === 'settled' ? 'No hay préstamos saldados.' : 'Todavía no hay préstamos para ver.'}
        </p>
      ) : friendly ? (
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
      ) : (
        <>
          <div className="sm:hidden">
            {visible.map((loan) => (
              <LoanAccountRow
                key={loan.id}
                loan={loan}
                lender={data?.names[loan.lenderId] ?? 'Alguien'}
                borrower={data?.names[loan.borrowerId] ?? 'alguien'}
                mine={loan.lenderId === profile.id}
                onOpen={() => setDetail(loan)}
              />
            ))}
          </div>
          <Card className="hidden sm:block">
            <table className="w-full border-collapse text-left text-base">
              <thead>
                <tr className="text-muted">
                  <th className="py-3 pr-4 font-bold">Fecha</th>
                  <th className="px-3 py-3 font-bold">Prestó</th>
                  <th className="px-3 py-3 font-bold">Recibió</th>
                  <th className="px-3 py-3 text-right font-bold">Monto</th>
                  <th className="px-3 py-3 text-right font-bold">Devuelto</th>
                  <th className="py-3 pl-4 text-right font-bold">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((loan) => (
                  <tr key={loan.id} className="border-t border-line">
                    <td className="py-3 pr-4">
                      <button type="button" className="min-h-11 font-semibold text-primary" onClick={() => setDetail(loan)}>
                        {shortDate(loan.lentOn)}
                      </button>
                    </td>
                    <td className="px-3 py-3">{data?.names[loan.lenderId] ?? '—'}</td>
                    <td className="px-3 py-3">{data?.names[loan.borrowerId] ?? '—'}</td>
                    <td className="px-3 py-3 text-right">{formatMoney(loan.amount)}</td>
                    <td className="px-3 py-3 text-right">{formatMoney(loan.repaid)}</td>
                    <td className="py-3 pl-4 text-right">{formatMoney(loan.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
      <Button type="button" onClick={() => setCreating(true)} disabled={!otherId}>
        Nuevo préstamo
      </Button>
      {!otherId ? <p className="mt-2 text-center text-sm font-semibold text-muted">Cuando se sume tu compañera, van a poder prestarse.</p> : null}
      <ErrorText>{error}</ErrorText>
      {creating && otherId && partnerName ? (
        <LoanEditor
          borrowerId={otherId}
          borrowerName={partnerName}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false)
            await refresh()
          }}
        />
      ) : null}
      {openLoan && otherId ? (
        <LoanEditor
          loan={openLoan}
          borrowerId={openLoan.borrowerId}
          borrowerName={data?.names[openLoan.borrowerId] ?? 'tu compañera'}
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
          onClose={() => setDetail(null)}
          onEdit={() => setEditing(detail)}
          onRepay={() => setRepaying(detail)}
          onEditRepayment={(repayment) => {
            setEditingRepayment(repayment)
          }}
          onChanged={refresh}
        />
      ) : null}
      {editingRepayment && detail ? (
        <RepaymentEditor
          loan={detail}
          repayment={editingRepayment}
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
  const progress = loan.amount > 0 ? (loan.repaid / loan.amount) * 100 : 0
  const who = mine ? `Le prestaste a ${partnerName ?? 'ella'}` : `${partnerName ?? 'Ella'} te prestó`
  return (
    <article className="mb-3 rounded-3xl bg-card p-4 shadow-card">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-muted">{who}</span>
            <span className="mt-1 block font-display text-2xl font-bold">{formatMoney(loan.amount)}</span>
          </span>
          <span className="text-sm font-semibold text-muted">{shortDate(loan.lentOn)}</span>
        </span>
        {loan.notes ? <span className="mt-1 block text-sm font-semibold text-muted">{loan.notes}</span> : null}
        <span className="mt-3 block">
          <Progress value={progress} color="var(--color-good)" />
        </span>
        <span className="mt-1 block text-sm font-bold text-muted">
          Devuelto {formatMoney(loan.repaid)} · falta {formatMoney(loan.pending)}
        </span>
      </button>
      {loan.pending > 0 ? (
        <button type="button" onClick={onRepay} className="mt-3 min-h-11 w-full rounded-2xl bg-sand font-semibold text-primary">
          Registrar devolución
        </button>
      ) : (
        <p className="mt-3 text-sm font-bold text-primary">Saldado</p>
      )}
    </article>
  )
}

const LOAN_STATUS: Record<Loan['status'], { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-warn-soft text-title' },
  parcial: { label: 'Parcial', className: 'bg-copper-soft text-alert-ink' },
  saldado: { label: 'Saldado', className: 'bg-sage-light text-primary' },
}

function LoanAccountRow({
  loan,
  lender,
  borrower,
  mine,
  onOpen,
}: {
  loan: Loan
  lender: string
  borrower: string
  mine: boolean
  onOpen: () => void
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<LoanRepayment[] | null>(null)
  const [error, setError] = useState('')
  const status = LOAN_STATUS[loan.status]
  const who = mine ? `Prestaste a ${borrower}` : `${lender} → ${borrower}`

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next || rows) return
    loadRepayments(loan.id)
      .then(setRows)
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'No pude cargar las devoluciones.')
      })
  }

  return (
    <article className="mb-3 rounded-3xl bg-card p-4 shadow-card">
      <button type="button" onClick={toggle} className="flex min-h-11 w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block text-base font-bold">{who}</span>
          <span className="mt-1 block text-base font-semibold text-muted">
            {shortDate(loan.lentOn)} · {formatMoney(loan.amount)} · devuelto {formatMoney(loan.repaid)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-2xl font-bold leading-none">{formatMoney(loan.pending)}</span>
          <span className={`mt-2 inline-flex min-h-11 items-center rounded-full px-3 text-base font-bold ${status.className}`}>{status.label}</span>
        </span>
      </button>
      {open ? (
        <div className="mt-3 border-t border-dashed border-line pt-2">
          {error ? <p className="text-base font-semibold text-alert-ink">{error}</p> : null}
          {rows && rows.length === 0 ? <p className="text-base font-semibold text-muted">Todavía no hay devoluciones.</p> : null}
          <ul>
            {(rows ?? []).map((repayment) => (
              <li key={repayment.id} className="flex min-h-11 items-center justify-between gap-3 text-base font-semibold">
                <span>{shortDate(repayment.paidOn)}</span>
                <span>{formatMoney(repayment.amount)}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onOpen} className="mt-1 min-h-11 font-semibold text-primary">
            Ver el préstamo
          </button>
        </div>
      ) : null}
    </article>
  )
}

function LoanDetail({
  loan,
  meId,
  names,
  onClose,
  onEdit,
  onRepay,
  onEditRepayment,
  onChanged,
}: {
  loan: Loan
  meId: string
  names: Record<string, string>
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
    <Sheet
      open
      title="Préstamo"
      onClose={onClose}
      footer={
        confirming === 'loan' ? (
          <Confirm
            label="¿Eliminar este préstamo? También se borran las devoluciones."
            onYes={() => void removeLoan()}
            onNo={() => setConfirming(null)}
          />
        ) : (
          <div className="space-y-2">
            {loan.pending > 0 ? (
              <Button type="button" onClick={onRepay}>
                Registrar devolución
              </Button>
            ) : null}
            {lender ? (
              <>
                <Button type="button" variant="alt" onClick={onEdit}>
                  Editar préstamo
                </Button>
                <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-alert-ink" onClick={() => setConfirming('loan')}>
                  <AppIcon name="trash" /> Eliminar
                </button>
              </>
            ) : null}
          </div>
        )
      }
    >
      <p className="font-display text-3xl font-bold">{formatMoney(loan.amount)}</p>
      <p className="mt-1 text-sm font-semibold text-muted">
        {names[loan.lenderId] ?? 'Alguien'} le prestó a {names[loan.borrowerId] ?? 'alguien'} · {shortDate(loan.lentOn)}
      </p>
      <p className="mt-1 text-sm font-semibold text-muted">
        Devuelto {formatMoney(loan.repaid)} · pendiente {formatMoney(loan.pending)}
      </p>
      {loan.notes ? <p className="mt-2 text-sm font-semibold">{loan.notes}</p> : null}
      <h3 className="mb-2 mt-4 font-display text-lg font-semibold">Devoluciones</h3>
      {rows.length === 0 ? <p className="text-sm font-semibold text-muted">Todavía no hay devoluciones.</p> : null}
      <ul>
        {rows.map((repayment) => (
          <li key={repayment.id} className="border-t border-dashed border-line py-2">
            <p className="flex justify-between gap-3 text-sm font-bold">
              <span>{shortDate(repayment.paidOn)}</span>
              <span>{formatMoney(repayment.amount)}</span>
            </p>
            {repayment.notes ? <p className="text-sm font-semibold text-muted">{repayment.notes}</p> : null}
            {repayment.createdBy === meId && !repayment.settlementId && confirming !== repayment.id ? (
              <p className="mt-1 flex gap-3">
                <button type="button" className="min-h-11 font-semibold text-primary" onClick={() => onEditRepayment(repayment)}>
                  Editar
                </button>
                <button type="button" className="min-h-11 font-semibold text-alert-ink" onClick={() => setConfirming(repayment.id)}>
                  Eliminar
                </button>
              </p>
            ) : null}
            {confirming === repayment.id ? (
              <Confirm
                label="¿Eliminar esta devolución?"
                onYes={() => void removeRepayment(repayment.id)}
                onNo={() => setConfirming(null)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <ErrorText>{error}</ErrorText>
    </Sheet>
  )
}

function LoanEditor({
  loan,
  borrowerId,
  borrowerName,
  onClose,
  onSaved,
}: {
  loan?: Loan
  borrowerId: string
  borrowerName: string
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
    <Sheet
      open
      title={loan ? 'Editar préstamo' : 'Nuevo préstamo'}
      onClose={onClose}
      footer={
        confirming ? (
          <Confirm
            label="¿Eliminar este préstamo? También se borran las devoluciones."
            busy={saving}
            onYes={() => void remove()}
            onNo={() => setConfirming(false)}
          />
        ) : (
          <div className="space-y-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            {loan ? (
              <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-alert-ink" onClick={() => setConfirming(true)} disabled={saving}>
                <AppIcon name="trash" /> Eliminar
              </button>
            ) : null}
          </div>
        )
      }
    >
      <p className="mb-3 text-sm font-semibold text-muted">Se lo prestás a {borrowerName}.</p>
      <MoneyField draft={draft} onDraft={setDraft} error={error && parseMoney(draft) == null ? error : undefined} />
      <label className="mb-3 block text-sm font-bold text-muted">
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
        onChange={(next) => {
          setPeriodTouched(true)
          setPeriod(next)
        }}
      />
      <NotesField value={notes} onChange={setNotes} />
      {error && parseMoney(draft) != null ? <ErrorText>{error}</ErrorText> : null}
    </Sheet>
  )
}

function RepaymentEditor({
  loan,
  repayment,
  onClose,
  onSaved,
}: {
  loan: Loan
  repayment?: LoanRepayment
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
    <Sheet
      open
      title={repayment ? 'Editar devolución' : 'Registrar devolución'}
      onClose={onClose}
      footer={
        confirming ? (
          <Confirm
            label="¿Eliminar esta devolución?"
            busy={saving}
            onYes={() => void remove()}
            onNo={() => setConfirming(false)}
          />
        ) : (
          <div className="space-y-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            {repayment ? (
              <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-alert-ink" onClick={() => setConfirming(true)} disabled={saving}>
                <AppIcon name="trash" /> Eliminar
              </button>
            ) : null}
          </div>
        )
      }
    >
      <p className="mb-3 text-sm font-semibold text-muted">Falta {formatMoney(loan.pending)}. Podés devolver una parte.</p>
      <MoneyField draft={draft} onDraft={setDraft} />
      <label className="mb-3 block text-sm font-bold text-muted">
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
        onChange={(next) => {
          setPeriodTouched(true)
          setPeriod(next)
        }}
      />
      <NotesField value={notes} onChange={setNotes} />
      <ErrorText>{error}</ErrorText>
    </Sheet>
  )
}

function PeriodField({ value, onChange }: { value: string; onChange: (period: string) => void }) {
  const todayMonth = monthKey()
  const choices = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, 1)]
  const [other, setOther] = useState(!choices.includes(value))
  return (
    <div className="mb-3">
      <p className="mb-1 text-sm font-bold text-muted">Corresponde a</p>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice, index) => (
          <Chip
            key={choice}
            active={value === choice && !other}
            onClick={() => {
              setOther(false)
              onChange(choice)
            }}
          >
            {index === 0 ? 'Mes anterior' : index === 1 ? 'Mes actual' : 'Mes siguiente'}
          </Chip>
        ))}
        <Chip active={other} onClick={() => setOther(true)}>
          Elegir otro
        </Chip>
      </div>
      {other ? (
        <label className="mt-2 block text-sm font-bold text-muted">
          {monthTitle(value)}
          <input
            type="month"
            value={value.slice(0, 7)}
            onChange={(event) => {
              if (!event.target.value) return
              onChange(`${event.target.value}-01`)
            }}
            className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-sand px-3 py-2 text-base font-semibold"
          />
        </label>
      ) : null}
    </div>
  )
}

function NotesField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-3 block text-sm font-bold text-muted">
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

function Confirm({
  label,
  busy,
  onYes,
  onNo,
}: {
  label: string
  busy?: boolean
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-bold">{label}</p>
      <Button type="button" onClick={onYes} disabled={busy}>
        {busy ? 'Eliminando…' : 'Eliminar'}
      </Button>
      <button type="button" className="min-h-11 w-full rounded-2xl text-base font-semibold text-primary" onClick={onNo}>
        Seguir
      </button>
    </div>
  )
}
