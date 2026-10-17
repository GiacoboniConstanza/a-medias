import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { amountFromDigits, applyKey, Keypad } from '../components/Keypad.tsx'
import { Button, Card, ErrorText } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { saveBaseSalary } from '../lib/api.ts'
import { monthSplit } from '../lib/derive.ts'
import { formatMoney } from '../lib/format.ts'

export function SalaryScreen() {
  const { profile, signOut } = useAuth()
  const { month, label } = useMonth()
  const { data, refresh } = useFinance()
  const [digits, setDigits] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!profile?.householdId || !data) return <p className="py-16 text-center font-extrabold text-muted">Cargando…</p>

  const current = data.bases[profile.id] ?? 0
  const previewBases = { ...data.bases, [profile.id]: amountFromDigits(digits) || current }
  const preview = monthSplit({ ...data, bases: previewBases })
  const mine = preview.rows.find((row) => row.id === profile.id)

  async function save() {
    const amount = amountFromDigits(digits)
    if (amount <= 0) {
      setMessage('El sueldo base tiene que ser mayor a cero.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await saveBaseSalary({
        userId: profile?.id as string,
        householdId: profile?.householdId as string,
        month,
        amount,
      })
      setDigits('')
      await refresh()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'No pude guardar el sueldo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="mb-3 flex items-center justify-between">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1 font-semibold text-ink">
          <AppIcon name="chevron-left" /> Inicio
        </Link>
        <span className="font-black text-brand">A Medias</span>
      </header>
      <h1 className="text-[22px] font-extrabold">Sueldo base de {label.toLowerCase()}</h1>
      <p className="mb-3 text-sm text-muted">Este monto define tu porcentaje de los gastos compartidos. Los extras van a la bolsa y no cuentan acá.</p>
      <Card>
        <p className="text-sm text-muted">Cargado ahora</p>
        <p className="text-3xl font-black">{formatMoney(current)}</p>
        <p className="mt-2 text-sm font-bold">
          {mine ? `Con esto te toca el ${mine.percent}% de los compartidos.` : 'Cuando estén las dos, se calcula el porcentaje.'}
        </p>
        {preview.usedEvenSplit ? <p className="text-sm text-warn">Si alguna no carga sueldo, partimos 50/50.</p> : null}
      </Card>
      <p className="text-center text-4xl font-black">{formatMoney(amountFromDigits(digits))}</p>
      <div className="mt-3">
        <Keypad onKey={(key) => setDigits((value) => applyKey(value, key))} />
      </div>
      <Button type="button" className="mt-3" onClick={() => void save()} disabled={saving}>
        Guardar sueldo
      </Button>
      <ErrorText>{message}</ErrorText>
      <button type="button" className="mt-8 w-full text-center text-sm font-extrabold text-muted" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </>
  )
}
