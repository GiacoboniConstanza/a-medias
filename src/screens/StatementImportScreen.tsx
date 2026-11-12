import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { AppIcon } from '../components/AppIcon.tsx'
import { ConfirmSheet } from '../components/ConfirmSheet.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Button, Chip, FieldError, inputClass } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import {
  importMpMovements,
  loadMpCounterpartAliases,
  loadMpCreditoFixedExists,
  loadMpImportedIds,
  loadMpMerchantPrefs,
  loadSettledMonths,
  type Category,
  type MpCounterpartAlias,
  type MpImportRow,
  type MpMerchantPrefRow,
} from '../lib/api.ts'
import { partnerId } from '../lib/derive.ts'
import { foldMerchant } from '../lib/mpStatement.ts'
import {
  buildReviewRows,
  creditoOfferText,
  dayHeaderLabel,
  groupRowsByDay,
  longDateLabel,
  periodRangeLabel,
  reviewCounts,
  rowIsDimmed,
  rowIsToggleable,
  rowSubtitle,
  summaryCountsLine,
  type MpReviewRow,
} from '../lib/mpImportReview.ts'
import { classifyMpMoves, parseMpStatement } from '../lib/mpStatement.ts'
import { pdfPositionedLines } from '../lib/pdfText.ts'
import { formatSignedMoney } from '../lib/transfers.ts'
import { settledSharedHelp } from '../lib/period.ts'

type Step = 'pick' | 'reading' | 'error' | 'review'

type EditDraft = {
  id: string
  checked: boolean
  title: string
  categoryId: string
  isShared: boolean
}

export function StatementImportScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const { data, refresh } = useFinance()
  const { goTo } = useMonth()
  const backTo = (location.state as { from?: string } | null)?.from || '/movimientos'
  const meId = profile?.id ?? ''
  const otherId = data ? partnerId(data, meId) : null
  const partnerNick = (otherId && data?.names[otherId]) || 'tu compañera'
  const categories = data?.categories ?? []

  const [step, setStep] = useState<Step>('pick')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<MpReviewRow[]>([])
  const [unrecognized, setUnrecognized] = useState<string[]>([])
  const [partnerAliasName, setPartnerAliasName] = useState<string | null>(null)
  const [rejectedNames, setRejectedNames] = useState<string[]>([])
  const [createCreditoMp, setCreateCreditoMp] = useState(true)
  const [creditoExists, setCreditoExists] = useState(false)
  const [settledMonths, setSettledMonths] = useState<string[]>([])
  const [maruOpen, setMaruOpen] = useState(false)
  const [maruPick, setMaruPick] = useState<string | 'none' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [prefs, setPrefs] = useState<MpMerchantPrefRow[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const blockedRef = useRef<HTMLDivElement>(null)

  const periodLabel = useMemo(() => {
    if (rows.length === 0) return ''
    const dates = rows.map((row) => row.date).sort()
    return periodRangeLabel(dates[0]!, dates[dates.length - 1]!)
  }, [rows])

  const counts = useMemo(() => reviewCounts(rows), [rows])
  const groups = useMemo(() => groupRowsByDay(rows), [rows])
  const creditoRows = rows.filter((row) => row.creditoMp && rowIsToggleable(row))
  const checkedCreditos = creditoRows.filter((row) => row.checked)
  const showCreditoCard = !creditoExists && checkedCreditos.length > 0
  const creditoMeta = useMemo(() => {
    if (checkedCreditos.length === 0) return null
    const first = [...checkedCreditos].sort((a, b) => a.date.localeCompare(b.date))[0]!
    const sum = checkedCreditos.reduce((acc, row) => acc + row.amount, 0)
    return creditoOfferText(first.date, sum, checkedCreditos.length)
  }, [checkedCreditos])

  const hasTransfers = rows.some(
    (row) => row.transferDirection != null || row.kind === 'transfer' || Boolean(row.counterpartName),
  )

  useEffect(() => {
    let active = true
    Promise.all([loadSettledMonths(), loadMpCreditoFixedExists(), loadMpMerchantPrefs(), loadMpCounterpartAliases()])
      .then(([settled, exists, merchantPrefs, aliases]) => {
        if (!active) return
        setSettledMonths(settled)
        setCreditoExists(exists)
        setPrefs(merchantPrefs)
        const partnerNames = aliases.filter((row) => row.userId).map((row) => row.normalizedName)
        const rejected = aliases.filter((row) => !row.userId).map((row) => row.normalizedName)
        setRejectedNames(rejected)
        if (partnerNames[0]) setPartnerAliasName(partnerNames[0])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function readFile(file: File) {
    setFileName(file.name)
    setStep('reading')
    setSaveError('')
    try {
      const lines = await pdfPositionedLines(file)
      const moves = parseMpStatement(lines)
      if (moves.length === 0) {
        setStep('error')
        return
      }
      const fromDate = moves.map((row) => row.date).sort()[0]!
      const toDate = moves.map((row) => row.date).sort()[moves.length - 1]!
      const [imported, aliases, merchantPrefs, settled, exists] = await Promise.all([
        loadMpImportedIds(fromDate, toDate),
        loadMpCounterpartAliases(),
        loadMpMerchantPrefs(),
        loadSettledMonths(),
        loadMpCreditoFixedExists(),
      ])
      setSettledMonths(settled)
      setCreditoExists(exists)
      setPrefs(merchantPrefs)
      const partnerNames = aliases.filter((row) => row.userId).map((row) => row.normalizedName)
      const rejected = aliases.filter((row) => !row.userId).map((row) => row.normalizedName)
      setRejectedNames(rejected)
      const partnerName = partnerNames[0] ?? null
      setPartnerAliasName(partnerName)
      const classified = classifyMpMoves(moves, {
        partnerAliases: partnerName ? [partnerName] : [],
        rejectedAliases: rejected,
        merchantPrefs: merchantPrefs.map((pref) => ({
          merchantKey: pref.merchantKey,
          categoryId: pref.categoryId,
          isShared: pref.isShared,
          title: pref.title,
        })),
        imported,
      })
      const review = buildReviewRows(classified.rows, settled).map((row) => ({
        ...row,
        checked: rowIsToggleable(row) ? row.checked : false,
      }))
      setRows(review)
      setUnrecognized(classified.unrecognizedTransferNames)
      setCreateCreditoMp(true)
      setStep('review')
      if (classified.unrecognizedTransferNames.length > 0) {
        setMaruPick(null)
        setMaruOpen(true)
      }
    } catch {
      setStep('error')
    }
  }

  function applyPartnerChoice(choice: string | 'none') {
    const names = unrecognized
    if (choice === 'none') {
      const nextRejected = [...new Set([...rejectedNames, ...names.map((name) => foldMerchant(name))])]
      setRejectedNames(nextRejected)
      setPartnerAliasName(null)
      setRows((current) =>
        rebuildWithAliases(current, null, nextRejected, prefs, settledMonths, partnerNick),
      )
      setUnrecognized([])
      setMaruOpen(false)
      return
    }
    setPartnerAliasName(choice)
    setRows((current) =>
      rebuildWithAliases(current, choice, rejectedNames, prefs, settledMonths, partnerNick),
    )
    setUnrecognized([])
    setMaruOpen(false)
  }

  function toggleRow(id: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id || !rowIsToggleable(row)) return row
        return { ...row, checked: !row.checked }
      }),
    )
  }

  function toggleDay(date: string) {
    setRows((current) => {
      const dayRows = current.filter((row) => row.date === date && rowIsToggleable(row))
      const allOn = dayRows.length > 0 && dayRows.every((row) => row.checked)
      return current.map((row) => {
        if (row.date !== date || !rowIsToggleable(row)) return row
        return { ...row, checked: !allOn }
      })
    })
  }

  function makePrivate(id: string) {
    setRows((current) =>
      current
        .map((row) => (row.id === id ? { ...row, isShared: false } : row))
        .map((row) => ({ ...row, settledBlocked: sharedSettledFlag(row, settledMonths) })),
    )
  }

  function makeAllBlockedPrivate() {
    setRows((current) =>
      current
        .map((row) => (row.settledBlocked && row.checked ? { ...row, isShared: false } : row))
        .map((row) => ({ ...row, settledBlocked: sharedSettledFlag(row, settledMonths) })),
    )
  }

  function openEdit(row: MpReviewRow) {
    if (rowIsDimmed(row) || !rowIsToggleable(row)) return
    setEditId(row.id)
    setEditDraft({
      id: row.id,
      checked: row.checked,
      title: row.title,
      categoryId: row.categoryId ?? '',
      isShared: row.isShared,
    })
  }

  function applyEdit() {
    if (!editDraft) return
    setRows((current) =>
      current
        .map((row) => {
          if (row.id !== editDraft.id) return row
          const category = categories.find((item) => item.id === editDraft.categoryId)
          return {
            ...row,
            checked: editDraft.checked,
            title: editDraft.title.trim() || row.title,
            categoryId: editDraft.categoryId || null,
            categoryName: category?.name ?? null,
            isShared: row.kind === 'expense' && !row.creditoMp ? editDraft.isShared : row.isShared,
          }
        })
        .map((row) => ({ ...row, settledBlocked: sharedSettledFlag(row, settledMonths) })),
    )
    setEditId(null)
    setEditDraft(null)
  }

  async function submit() {
    if (saving || counts.checkedLoadable === 0 || counts.blocked > 0) {
      if (counts.blocked > 0) blockedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const checked = rows.filter((row) => row.checked && rowIsToggleable(row) && !row.settledBlocked)
      const payload: MpImportRow[] = checked.map((row) => ({
        type: row.creditoMp && createCreditoMp ? 'credito_mp' : row.kind === 'income' ? 'income' : row.kind === 'transfer' ? 'transfer' : 'expense',
        date: row.date,
        amount: row.amount,
        title: row.kind === 'transfer' ? 'Transferencia' : row.title,
        categoryId: row.categoryId,
        isShared: row.kind === 'expense' ? row.isShared : false,
        mpOperationId: row.operationId,
        transferDirection: row.kind === 'transfer' ? row.transferDirection : null,
      }))

      const aliases: MpCounterpartAlias[] = []
      if (partnerAliasName && otherId) {
        aliases.push({ normalizedName: foldMerchant(partnerAliasName), userId: otherId })
      }
      for (const name of rejectedNames) {
        aliases.push({ normalizedName: foldMerchant(name), userId: null })
      }

      const merchantPrefs: MpMerchantPrefRow[] = []
      for (const row of checked) {
        if (!row.merchantKey) continue
        if (row.kind !== 'expense') continue
        merchantPrefs.push({
          merchantKey: row.merchantKey,
          categoryId: row.categoryId,
          isShared: row.isShared,
          title: row.title,
        })
      }

      const result = await importMpMovements({
        rows: payload,
        aliases,
        merchantPrefs,
        createCreditoMp: Boolean(showCreditoCard && createCreditoMp),
      })
      await refresh()
      const firstDate = checked.map((row) => row.date).sort()[0]
      if (firstDate) goTo(`${firstDate.slice(0, 7)}-01`)
      navigate('/movimientos', {
        replace: true,
        state: { from: backTo, import: { inserted: result.inserted, skipped: result.skipped } },
      })
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? 'No pude cargar los movimientos y no guardé ninguno. Revisá la conexión y probá de nuevo.'
          : 'No pude cargar los movimientos y no guardé ninguno. Revisá la conexión y probá de nuevo.',
      )
    } finally {
      setSaving(false)
    }
  }

  function requestLeave() {
    if (step === 'review' && rows.length > 0) setConfirmLeave(true)
    else navigate(backTo)
  }

  const editRow = editId ? rows.find((row) => row.id === editId) : null
  const disabledReason =
    counts.blocked > 0
      ? settledFooterReason(rows, settledMonths)
      : counts.checkedLoadable === 0
        ? counts.already === counts.total && counts.total > 0
          ? 'Este resumen ya está cargado'
          : 'Tildá al menos un movimiento para cargar.'
        : null

  return (
    <div className="min-h-dvh bg-crema">
      <section className="scallop-b bg-azul px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex min-h-11 items-center gap-1">
          <button
            type="button"
            aria-label="Volver"
            aria-disabled={saving || undefined}
            className="-ml-3 grid h-11 w-11 place-items-center text-tinta disabled:text-gris"
            disabled={saving}
            onClick={requestLeave}
          >
            <AppIcon name="chevron-left" />
          </button>
          <h1 className="font-display text-[34px] font-semibold leading-tight text-tinta">Subir resumen</h1>
        </div>
        {step === 'review' && periodLabel ? (
          <p className="mt-1 text-sm font-semibold text-tinta">{periodLabel}</p>
        ) : null}
      </section>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void readFile(file)
        }}
      />

      {step === 'pick' || step === 'reading' || step === 'error' ? (
        <div className="px-4 pb-8 pt-[calc(var(--feston-alto)+1rem)]">
          <div
            className="rounded-2xl border-2 border-azul-ink bg-tarjeta p-4"
            aria-busy={step === 'reading' || undefined}
          >
            {step === 'pick' ? (
              <>
                <p className="font-display text-lg font-semibold text-tinta">Varios movimientos juntos</p>
                <p className="mt-2 text-sm font-medium text-tinta">
                  Elegí el PDF «Resumen de cuenta en pesos» que bajás de Mercado Pago. Te muestro los movimientos
                  agrupados por día y vos elegís cuáles cargar.
                </p>
                <p className="mt-3 flex items-start gap-2 text-sm font-medium text-gris">
                  <AppIcon name="lock" className="mt-0.5 shrink-0" />
                  El archivo se lee en tu celular: no se sube ni se guarda.
                </p>
                <Button type="button" className="mt-4 w-full" onClick={() => fileRef.current?.click()}>
                  <AppIcon name="file-arrow-up" className="mr-2" /> Elegir PDF
                </Button>
              </>
            ) : null}
            {step === 'reading' ? (
              <>
                <p className="font-display text-lg font-semibold text-tinta">Leyendo el resumen…</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium text-gris">
                  <AppIcon name="file-lines" /> {fileName || 'archivo.pdf'}
                </p>
                <div
                  className="mt-4 h-[10px] overflow-hidden rounded-full border border-tinta bg-tarjeta"
                  role="progressbar"
                  aria-label="Leyendo"
                >
                  <div className="mp-progress h-full w-1/3 rounded-full border border-tinta bg-mostaza" />
                </div>
                <p className="mt-3 text-sm font-medium text-gris">Puede tardar unos segundos. No cargo nada hasta que confirmes.</p>
                <Button type="button" variant="alt" className="mt-4 w-full" onClick={() => setStep('pick')}>
                  Cancelar
                </Button>
              </>
            ) : null}
            {step === 'error' ? (
              <div role="alert">
                <p className="flex items-center gap-2 font-display text-lg font-semibold text-tinta">
                  <AppIcon name="circle-exclamation" /> No es un resumen en pesos
                </p>
                <p className="mt-2 text-sm font-medium text-tinta">
                  Este PDF no es el «Resumen de cuenta en pesos» de Mercado Pago. Los comprobantes sueltos y el resumen en
                  dólares no sirven acá.
                </p>
                <p className="mt-2 text-sm font-semibold text-tinta">No cargué nada.</p>
                <Button type="button" className="mt-4 w-full" onClick={() => fileRef.current?.click()}>
                  Elegir otro PDF
                </Button>
                {fileName ? <p className="mt-2 text-center text-sm font-medium text-gris">{fileName}</p> : null}
              </div>
            ) : null}
          </div>
          {step === 'pick' ? (
            <p className="mt-4 text-sm font-medium text-gris">
              Si ya cargaste a mano movimientos de esos días, borralos antes: no comparo por fecha ni por monto, y
              quedarían dos veces.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 'review' ? (
        <div
          className="px-4 pb-[200px] pt-[calc(var(--feston-alto)+0.75rem)]"
          {...(saving ? ({ inert: '' } as object) : null)}
        >
          <p className="text-sm font-medium text-gris">{summaryCountsLine(counts)}</p>
          {hasTransfers ? (
            <div className="mt-2 flex min-h-11 items-center justify-between gap-2">
              <p className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-tinta">
                <AppIcon name="user-group" />
                <span className="truncate">
                  {partnerNick}:{' '}
                  {partnerAliasName ? (
                    <span className="font-bold text-salvia-ink">{partnerAliasName}</span>
                  ) : (
                    'sin elegir'
                  )}
                </span>
              </p>
              <button
                type="button"
                className={`shrink-0 text-sm font-bold ${saving ? 'text-gris' : 'text-mostaza-ink'}`}
                aria-disabled={saving || undefined}
                disabled={saving}
                onClick={() => {
                  setMaruPick(partnerAliasName)
                  setMaruOpen(true)
                }}
              >
                {partnerAliasName ? 'Cambiar' : 'Elegir'}
              </button>
            </div>
          ) : null}

          {counts.blocked > 0 ? (
            <div
              ref={blockedRef}
              role="status"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-azul-ink bg-tarjeta px-3.5 py-2.5"
            >
              <p className="inline-flex items-center gap-2 text-sm font-bold text-tinta">
                <AppIcon name="lock" /> {settledMonthTitle(rows)} ya está saldado
              </p>
              <Button type="button" variant="alt" className="min-h-11 px-3" onClick={makeAllBlockedPrivate}>
                Pasar los {counts.blocked} a privado
              </Button>
            </div>
          ) : null}

          {showCreditoCard && creditoMeta ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border-2 border-azul-ink bg-tarjeta px-3.5 py-2.5">
              <CheckboxMark
                checked={createCreditoMp}
                disabled={saving}
                onToggle={() => setCreateCreditoMp((value) => !value)}
                label="Crear gasto fijo Créditos MP"
              />
              <div className="min-w-0">
                <p className="whitespace-nowrap font-display text-lg font-semibold text-tinta">
                  Gasto fijo «Créditos MP»
                </p>
                <p className="mt-1 text-sm font-medium text-gris">
                  {createCreditoMp ? creditoMeta.checked : creditoMeta.unchecked}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-5">
            {groups.map((group) => {
              const toggleable = group.rows.filter(rowIsToggleable)
              const checked = toggleable.filter((row) => row.checked).length
              const dayState =
                toggleable.length === 0 ? 'empty' : checked === toggleable.length ? 'all' : checked === 0 ? 'none' : 'mixed'
              return (
                <section key={group.date}>
                  <div className="mb-1 flex min-h-12 items-center justify-between gap-2 border-b-[1.5px] border-azul">
                    <div className="flex items-center gap-2">
                      <CheckboxMark
                        checked={dayState === 'all'}
                        mixed={dayState === 'mixed'}
                        disabled={saving || dayState === 'empty'}
                        dashed={dayState === 'empty'}
                        onToggle={() => toggleDay(group.date)}
                        label={
                          dayState === 'all'
                            ? `Destildar todo el ${group.label.toLowerCase()}`
                            : `Tildar todo el ${group.label.toLowerCase()}`
                        }
                      />
                      <h2 className="text-sm font-bold text-tinta">{group.label}</h2>
                    </div>
                    <p className="text-sm font-semibold text-gris">
                      {dayState === 'empty' ? 'Ya está cargado' : `${checked} de ${toggleable.length}`}
                    </p>
                  </div>
                  <ul>
                    {group.rows.map((row) => {
                      const dimmed = rowIsDimmed(row)
                      const subtitle = rowSubtitle(row, partnerNick, {
                        createCreditoMp: showCreditoCard ? createCreditoMp : false,
                        categoryName: row.categoryName,
                      })
                      const amountClass = dimmed
                        ? 'text-gris'
                        : row.kind === 'income'
                          ? 'text-mostaza-ink'
                          : row.kind === 'transfer'
                            ? 'text-ciruela-ink'
                            : 'text-tinta'
                      return (
                        <li key={row.id} className="border-t border-dashed border-linea-punteada">
                          <div className="grid min-h-[62px] grid-cols-[34px_1fr] items-start gap-2 py-2">
                            <div className="-ml-2.5">
                              {row.status === 'already_imported' ? (
                                <span className="grid h-11 w-11 place-items-center text-gris" aria-hidden>
                                  <AppIcon name="check-double" />
                                </span>
                              ) : row.status === 'refund_notice' || row.status === 'refund_pair' ? (
                                <span className="grid h-11 w-11 place-items-center text-tinta" aria-hidden>
                                  <AppIcon name="circle-exclamation" />
                                </span>
                              ) : (
                                <CheckboxMark
                                  checked={row.checked}
                                  disabled={saving || !rowIsToggleable(row)}
                                  onToggle={() => toggleRow(row.id)}
                                  label={`${row.checked ? 'Destildar' : 'Tildar'} ${row.title}, ${dayHeaderLabel(row.date).toLowerCase()}`}
                                />
                              )}
                            </div>
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              aria-label={`Revisar ${row.title}, ${dayHeaderLabel(row.date).toLowerCase()}`}
                              disabled={dimmed || saving}
                              onClick={() => openEdit(row)}
                            >
                              <span className="flex items-start justify-between gap-2">
                                <span
                                  className={`min-w-0 truncate font-display text-lg font-semibold ${dimmed ? 'text-gris' : 'text-tinta'}`}
                                >
                                  {row.title}
                                </span>
                                <span className={`shrink-0 whitespace-nowrap font-display text-lg font-semibold ${amountClass}`}>
                                  {formatSignedMoney(row.signedAmount)}
                                </span>
                              </span>
                              {subtitle ? (
                                <span
                                  className={`mt-0.5 block truncate text-sm font-medium ${
                                    row.status === 'refund_notice' ? 'font-semibold text-tinta' : 'text-gris'
                                  }`}
                                >
                                  {row.kind === 'transfer' && !dimmed ? (
                                    <>
                                      {row.transferDirection === 'received' ? (
                                        <>
                                          <span className="font-bold text-salvia-ink">{partnerNick}</span> te pasó
                                        </>
                                      ) : (
                                        <>
                                          Le pasaste a <span className="font-bold text-salvia-ink">{partnerNick}</span>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    subtitle
                                  )}
                                </span>
                              ) : null}
                              {row.status === 'already_imported' ? (
                                <span className="mt-1 inline-flex rounded-full border-[1.5px] border-gris px-2 py-0.5 text-sm font-semibold text-gris">
                                  Ya está cargado
                                </span>
                              ) : null}
                            </button>
                          </div>
                          {row.settledBlocked && row.checked ? (
                            <div className="pb-2 pl-8">
                              <p className="flex items-center gap-2 text-sm font-semibold text-tinta">
                                <AppIcon name="lock" /> {settledMonthTitle([row])} está saldado.
                              </p>
                              <button
                                type="button"
                                className="mt-1 min-h-11 font-bold text-mostaza-ink"
                                onClick={() => makePrivate(row.id)}
                              >
                                Pasar a privado
                              </button>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-dashed border-linea-punteada bg-crema px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto w-full max-w-lg" aria-live="polite">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-tinta">
                  {counts.checkedLoadable} de {counts.total}
                </p>
                <p className="text-sm font-medium text-gris">para cargar</p>
              </div>
              <div className="text-right text-sm font-medium text-gris">
                <p>
                  Salen{' '}
                  <span className="font-display text-base font-semibold text-tinta">
                    {formatSignedMoney(-counts.out || -0)}
                  </span>
                </p>
                <p>
                  Entran{' '}
                  <span className="font-display text-base font-semibold text-mostaza-ink">
                    {formatSignedMoney(counts.inn)}
                  </span>
                </p>
              </div>
            </div>
            {counts.blocked > 0 ? (
              <p className="mb-2 text-sm font-semibold text-tinta">{disabledReason}</p>
            ) : null}
            {saving ? (
              <p role="status" className="mb-2 flex items-center gap-2 text-sm font-semibold text-tinta">
                <AppIcon name="lock" /> Cargando. Hasta que termine no se puede cambiar la lista.
              </p>
            ) : null}
            {saveError ? <FieldError>{saveError}</FieldError> : null}
            {!saving && !saveError && disabledReason && counts.blocked === 0 ? (
              <p className="mb-2 text-sm font-semibold text-gris">{disabledReason}</p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              aria-busy={saving || undefined}
              aria-disabled={Boolean(disabledReason) || saving || undefined}
              disabled={Boolean(disabledReason) || saving}
              onClick={() => void submit()}
            >
              {saving ? (
                <>
                  <AppIcon name="rotate-right" className="mr-2 animate-spin" /> Cargando {counts.checkedLoadable}{' '}
                  {counts.checkedLoadable === 1 ? 'movimiento' : 'movimientos'}…
                </>
              ) : saveError ? (
                <>
                  <AppIcon name="rotate-right" className="mr-2" /> Probar de nuevo: cargar {counts.checkedLoadable}
                </>
              ) : (
                `Cargar ${counts.checkedLoadable} ${counts.checkedLoadable === 1 ? 'movimiento' : 'movimientos'}`
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <Sheet
        open={maruOpen}
        title={`¿Cuál de estos nombres es ${partnerNick}?`}
        onClose={() => setMaruOpen(false)}
        footer={
          <Button
            type="button"
            className="w-full"
            disabled={maruPick == null}
            onClick={() => maruPick != null && applyPartnerChoice(maruPick)}
          >
            Listo
          </Button>
        }
      >
        <p className="text-sm font-medium text-tinta">
          En el resumen figuran los nombres legales. Elegí el de {partnerNick} y sus transferencias se cargan como
          transferencias entre ustedes.
        </p>
        <div className="mt-3 space-y-1" role="radiogroup" aria-label="Nombre de la compañera">
          {nameChoices(rows, unrecognized, partnerAliasName).map((item) => (
            <button
              key={item.name}
              type="button"
              role="radio"
              aria-checked={maruPick === item.name}
              className={`flex min-h-14 w-full flex-col justify-center rounded-2xl px-3 text-left ${
                maruPick === item.name
                  ? 'border-2 border-tinta bg-azul-claro'
                  : 'border-[1.5px] border-azul-ink bg-tarjeta'
              }`}
              onClick={() => setMaruPick(item.name)}
            >
              <span className="font-display text-lg font-semibold text-tinta">{item.name}</span>
              <span className="text-sm font-medium text-gris">
                {item.count} {item.count === 1 ? 'transferencia' : 'transferencias'}, enviadas y recibidas
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          role="radio"
          aria-checked={maruPick === 'none'}
          className={`mt-4 flex min-h-14 w-full flex-col justify-center rounded-2xl border-t border-dashed border-linea-punteada px-3 text-left ${
            maruPick === 'none' ? 'border-2 border-tinta bg-azul-claro' : ''
          }`}
          onClick={() => setMaruPick('none')}
        >
          <span className="font-display text-lg font-semibold text-tinta">Ninguno es {partnerNick}</span>
          <span className="text-sm font-medium text-gris">Las cargo como posibles gastos o ingresos</span>
        </button>
        <p className="mt-3 text-sm font-medium text-gris">
          Lo recuerdo para los próximos resúmenes. Lo podés cambiar después, arriba de la lista.
        </p>
      </Sheet>

      <Sheet
        open={Boolean(editRow && editDraft)}
        title={editDraft?.title || 'Editar'}
        onClose={() => {
          setEditId(null)
          setEditDraft(null)
        }}
        footer={
          <Button type="button" className="w-full" onClick={applyEdit}>
            Listo
          </Button>
        }
      >
        {editRow && editDraft ? (
          <EditBody
            row={editRow}
            draft={editDraft}
            categories={categories}
            partnerNick={partnerNick}
            onChange={setEditDraft}
          />
        ) : null}
      </Sheet>

      <ConfirmSheet
        open={confirmLeave}
        title="¿Salir sin cargar?"
        onClose={() => setConfirmLeave(false)}
        confirmLabel="Salir"
        onConfirm={() => navigate(backTo)}
      >
        Se pierde lo que revisaste. El PDF no se guardó.
      </ConfirmSheet>

      <style>{`
        @keyframes mp-progress-slide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        .mp-progress { animation: mp-progress-slide 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mp-progress { animation: none; transform: none; width: 40%; }
        }
      `}</style>
    </div>
  )
}

function CheckboxMark({
  checked,
  mixed = false,
  disabled = false,
  dashed = false,
  onToggle,
  label,
}: {
  checked: boolean
  mixed?: boolean
  disabled?: boolean
  dashed?: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="grid h-11 w-11 place-items-center"
    >
      <span
        className={`grid h-6 w-6 place-items-center rounded-[6px] ${
          disabled && !dashed
            ? checked || mixed
              ? 'bg-gris text-tarjeta'
              : 'border-[1.5px] border-gris bg-tarjeta'
            : dashed
              ? 'border-[1.5px] border-dashed border-gris-claro bg-tarjeta'
              : checked || mixed
                ? 'bg-tinta text-tarjeta'
                : 'border-[1.5px] border-azul-ink bg-tarjeta'
        }`}
      >
        {mixed ? <AppIcon name="minus" className="text-xs" /> : checked ? <AppIcon name="check" className="text-xs" /> : null}
      </span>
    </button>
  )
}

function EditBody({
  row,
  draft,
  categories,
  partnerNick,
  onChange,
}: {
  row: MpReviewRow
  draft: EditDraft
  categories: Category[]
  partnerNick: string
  onChange: (next: EditDraft) => void
}) {
  const isExpense = row.kind === 'expense' && !row.creditoMp
  const suggested = categories.slice(0, 8)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-[1.5px] border-azul bg-crema p-3">
        <p className="text-sm font-semibold text-gris">En el resumen</p>
        <p className="mt-1 text-sm font-medium text-tinta">{row.description}</p>
        <p className="mt-1 text-sm font-medium text-gris">{longDateLabel(row.date)}</p>
        <p className="mt-1 font-display text-lg font-semibold text-tinta">{formatSignedMoney(row.signedAmount)}</p>
      </div>
      <label className="flex min-h-[52px] items-center justify-between gap-3 text-sm font-semibold text-tinta">
        Cargar este movimiento
        <button
          type="button"
          role="switch"
          aria-checked={draft.checked}
          className={`relative h-[32px] w-[52px] rounded-full border-2 border-tinta ${draft.checked ? 'bg-mostaza' : 'bg-tarjeta'}`}
          onClick={() => onChange({ ...draft, checked: !draft.checked })}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-tinta transition-transform ${
              draft.checked ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
      <div>
        <p className="mb-1 text-sm font-semibold text-gris">Se carga como</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={row.kind === 'expense' || row.creditoMp}>Gasto</Chip>
          <Chip active={row.kind === 'income'}>Ingreso</Chip>
          <Chip
            active={row.kind === 'transfer'}
            className={row.transferDirection && row.kind !== 'transfer' ? 'opacity-50' : ''}
          >
            Transferencia
          </Chip>
        </div>
        {row.transferDirection && row.kind !== 'transfer' ? (
          <p className="mt-2 text-sm font-medium text-gris">
            Transferencia es solo entre vos y {partnerNick}. Si esta persona es {partnerNick}, cambialo arriba de la
            lista.
          </p>
        ) : null}
      </div>
      <label className="block text-sm font-semibold text-gris">
        Nombre
        <input
          className={`${inputClass} mt-1`}
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </label>
      {isExpense ? (
        <>
          <div>
            <p className="mb-1 text-sm font-semibold text-gris">Categoría</p>
            <div className="flex flex-wrap gap-2">
              {suggested.map((category) => (
                <Chip
                  key={category.id}
                  active={draft.categoryId === category.id}
                  onClick={() =>
                    onChange({
                      ...draft,
                      categoryId: draft.categoryId === category.id ? '' : category.id,
                    })
                  }
                >
                  <AppIcon name={category.icon} /> {category.name}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-gris">¿Compartido o privado?</p>
            <div className="grid h-[52px] grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-2xl text-sm font-semibold ${
                  draft.isShared
                    ? 'border-2 border-tinta bg-azul-claro text-tinta'
                    : 'border-[1.5px] border-azul-ink bg-tarjeta text-tinta'
                }`}
                onClick={() => onChange({ ...draft, isShared: true })}
              >
                Compartido
              </button>
              <button
                type="button"
                className={`rounded-2xl text-sm font-semibold ${
                  !draft.isShared
                    ? 'border-2 border-tinta bg-azul-claro text-tinta'
                    : 'border-[1.5px] border-azul-ink bg-tarjeta text-tinta'
                }`}
                onClick={() => onChange({ ...draft, isShared: false })}
              >
                Privado
              </button>
            </div>
          </div>
          {row.merchantKey ? (
            <p className="text-sm font-medium text-gris">
              La próxima vez que aparezca «{row.counterpartName || row.description.replace(/^Pago( con QR)?\s+/i, '') || row.title}»
              lo pongo
              {draft.categoryId
                ? ` en ${categories.find((item) => item.id === draft.categoryId)?.name ?? 'esa categoría'}`
                : ' sin categoría'}{' '}
              y {draft.isShared ? 'compartido' : 'privado'}.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function sharedSettledFlag(row: MpReviewRow, settledMonths: readonly string[]): boolean {
  if (row.kind !== 'expense' || row.creditoMp || !rowIsToggleable(row)) return false
  const period = `${row.date.slice(0, 7)}-01`
  return row.isShared && settledMonths.some((item) => item.slice(0, 10) === period)
}

function settledMonthTitle(rows: readonly MpReviewRow[]): string {
  const blocked = rows.find((row) => row.settledBlocked) ?? rows[0]
  if (!blocked) return 'El mes'
  const period = `${blocked.date.slice(0, 7)}-01`
  const help = settledSharedHelp(period)
  return help.split(' ')[0] ?? 'El mes'
}

function settledFooterReason(rows: readonly MpReviewRow[], _settledMonths: readonly string[]): string {
  const blocked = rows.filter((row) => row.settledBlocked && row.checked)
  if (blocked.length === 0) return ''
  const Mes = settledMonthTitle(blocked)
  return `${Mes} está saldado: pasá a privado o destildá los ${blocked.length} compartidos.`
}

function nameChoices(
  rows: readonly MpReviewRow[],
  unrecognized: readonly string[],
  partnerAliasName: string | null,
) {
  const fromRows = [
    ...new Set(
      rows
        .map((row) => row.counterpartName)
        .filter((name): name is string => Boolean(name && name.trim())),
    ),
  ]
  const pool =
    unrecognized.length > 0
      ? unrecognized
      : partnerAliasName
        ? [partnerAliasName, ...fromRows.filter((name) => foldMerchant(name) !== foldMerchant(partnerAliasName))]
        : fromRows
  const counts = new Map<string, number>()
  for (const name of pool) {
    const key = foldMerchant(name)
    const n = rows.filter((row) => foldMerchant(row.counterpartName ?? '') === key).length
    counts.set(name, Math.max(1, n))
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function rebuildWithAliases(
  current: readonly MpReviewRow[],
  partnerName: string | null,
  rejected: readonly string[],
  prefs: readonly MpMerchantPrefRow[],
  settledMonths: readonly string[],
  _partnerNick: string,
): MpReviewRow[] {
  const partnerKey = partnerName ? foldMerchant(partnerName) : ''
  const rejectedKeys = new Set(rejected.map((name) => foldMerchant(name)))
  const prefByKey = new Map(prefs.map((pref) => [foldMerchant(pref.merchantKey), pref]))
  return current
    .map((row) => {
      if (!row.counterpartName || row.status === 'already_imported' || row.status === 'refund_pair' || row.status === 'refund_notice') {
        return row
      }
      const key = foldMerchant(row.counterpartName)
      if (partnerKey && key === partnerKey) {
        return {
          ...row,
          kind: 'transfer' as const,
          title: 'Transferencia',
          checked: true,
          isShared: false,
          categoryId: null,
          categoryName: null,
          status: 'ready' as const,
          statusLabel: null,
          settledBlocked: false,
        }
      }
      if (row.transferDirection === 'sent') {
        const pref = prefByKey.get(key)
        return {
          ...row,
          kind: 'expense' as const,
          title: (pref?.title && pref.title.trim()) || row.counterpartName,
          checked: false,
          merchantKey: key,
          categoryId: pref?.categoryId ?? null,
          isShared: pref?.isShared ?? true,
          status: rejectedKeys.has(key) || partnerKey ? ('ready' as const) : ('needs_partner_alias' as const),
          statusLabel: 'Transferencia a otra persona',
        }
      }
      if (row.transferDirection === 'received') {
        return {
          ...row,
          kind: 'income' as const,
          title: row.counterpartName,
          checked: false,
          isShared: false,
          status: rejectedKeys.has(key) || partnerKey ? ('ready' as const) : ('needs_partner_alias' as const),
          statusLabel: 'Transferencia de otra persona',
        }
      }
      return row
    })
    .map((row) => ({ ...row, settledBlocked: sharedSettledFlag(row, settledMonths) }))
}
