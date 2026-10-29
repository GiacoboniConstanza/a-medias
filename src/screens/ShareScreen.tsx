import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon.tsx'
import { ExpenseScreen, type ExpensePrefill } from './ExpenseScreen.tsx'
import { extractShareText } from '../lib/extractShareText.ts'
import { parseMpReceipt } from '../lib/mpReceipt.ts'
import { clearPendingShare, readPendingShare } from '../lib/shareInbox.ts'

export function ShareScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const pending = params.get('pending') === '1'
  const [prefill, setPrefill] = useState<ExpensePrefill | null>(null)
  const [phase, setPhase] = useState<'wait' | 'read' | 'ready' | 'empty' | 'error'>(pending ? 'wait' : 'empty')
  const [readNote, setReadNote] = useState('')

  useEffect(() => {
    if (!pending) return
    let active = true
    setPhase('read')
    readPendingShare()
      .then(async (share) => {
        if (!active) return
        if (!share || (!share.text && !share.title && !share.url && !share.file)) {
          setPhase('empty')
          return
        }
        const text = await extractShareText(share)
        if (!active) return
        const receipt = parseMpReceipt(text)
        if (!text.trim()) setReadNote('No pude leer el archivo. Completá el gasto a mano.')
        setPrefill({
          amount: receipt.amount,
          title: receipt.merchant,
          spentOn: receipt.date,
          missingAmount: receipt.amount == null,
          missingTitle: receipt.merchant == null,
          missingDate: receipt.date == null,
        })
        setPhase('ready')
      })
      .catch(() => {
        if (!active) return
        setPhase('error')
      })
    return () => {
      active = false
    }
  }, [pending])

  async function finish() {
    await clearPendingShare().catch(() => undefined)
  }

  if (phase === 'ready' && prefill) {
    return (
      <>
        {readNote ? <p className="mb-3 rounded-2xl bg-[#FCE6EA] px-3 py-2 text-sm font-bold text-[#85503C]">{readNote}</p> : null}
        <ExpenseScreen
          prefill={prefill}
          onCancel={() => {
            void finish().then(() => navigate('/'))
          }}
          onDone={() => finish()}
        />
      </>
    )
  }

  return (
    <section className="py-10 text-center">
      <p className="font-display text-2xl font-semibold text-primary">
        <AppIcon name="receipt" className="mr-2" />
        Comprobante
      </p>
      {phase === 'read' || phase === 'wait' ? (
        <p className="mt-3 text-base font-bold text-muted">Leyendo el comprobante…</p>
      ) : null}
      {phase === 'empty' ? (
        <p className="mt-3 text-base font-bold leading-snug text-muted">
          Compartí un comprobante de Mercado Pago desde el menú Compartir del celular.
        </p>
      ) : null}
      {phase === 'error' ? (
        <p className="mt-3 text-base font-bold leading-snug text-[#85503C]">No pude recuperar el comprobante. Podés cargar el gasto a mano.</p>
      ) : null}
      {phase === 'empty' || phase === 'error' ? (
        <Link to="/cargar" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-4 font-semibold text-white">
          Nuevo gasto
        </Link>
      ) : null}
    </section>
  )
}
