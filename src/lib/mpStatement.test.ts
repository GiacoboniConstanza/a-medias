import { describe, expect, it } from 'vitest'
import { linesFromLayout, linesFromPageItems } from './pdfLines.ts'
import {
  classifyMpMoves,
  creditoMpDueDay,
  foldMerchant,
  parseMpStatement,
  type MpImportedRecord,
} from './mpStatement.ts'
import { rowSubtitle, buildReviewRows, settledMonthHelp } from './mpImportReview.ts'

const FIXTURE = `
                                         DETALLE DE MOVIMIENTOS
                                               ID de la
Fecha         Descripción                                                    Valor                 Saldo
                                               operación
01-11-2026    Pago con QR La Anónima           186176544447            $ -35.078,20       $ 1.224.534,66
              Transferencia enviada Ana
01-11-2026                                     187273403652           $ -80.000,00         $ 1.144.534,66
              Perez Uno
02-11-2026    Rendimientos                     1752498663392             $ 3.284,67         $ 1.117.319,33
                                                                                                       1/4
                                            ID de la
Fecha        Descripción                    operación                Valor            Saldo
             Transferencia recibida
05-11-2026                                  186860352921     $ 800.000,00     $ 1.558.002,69
             Compañera Ejemplo Apellido
05-11-2026   Transferencia enviada Dorado   186916915419       $ -6.050,00     $ 238.452,69
             Pago con QR Farmacias del
05-11-2026                                  186936647405      $ -104.201,33     $ 121.351,36
             Pueblo
             Débito por deuda Créditos de
10-11-2026                                  3731351087     $ -110.356,47         $ 0,00
             Mercado Pago
             Débito por deuda Créditos de
10-11-2026                                  3823155186      $ -16.860,41   $ 133.139,59
             Mercado Pago
   10-11-2026       Pago Uber                               187836133751                       $ -6.643,00               $ 26.496,59
   10-11-2026       Devolución de pago Uber                 187836133751                        $ 6.643,00                $ 33.139,59
   11-11-2026       Pago Spotify                            189136511556                       $ -8.232,02                 $ 7.874,23
Fecha de generación: 12-11-2026
                                                                          RESUMEN DE TENENCIAS EN DÓLARES
`

function emptyImported() {
  return new Map<string, MpImportedRecord>()
}

describe('resumen Mercado Pago', () => {
  const lines = linesFromLayout(FIXTURE)
  const moves = parseMpStatement(lines)

  it('lee fila de una línea y montos con signo', () => {
    const anonima = moves.find((row) => row.operationId === '186176544447')
    expect(anonima).toMatchObject({
      date: '2026-11-01',
      amount: -35078.2,
      description: expect.stringMatching(/Pago con QR La An[oó]nima/i),
    })
  })

  it('junta descripción partida arriba y abajo de la ancla', () => {
    const transfer = moves.find((row) => row.operationId === '187273403652')
    expect(transfer?.description).toMatch(/Transferencia enviada Ana/i)
    expect(transfer?.description).toMatch(/Perez Uno/i)
    expect(transfer?.amount).toBe(-80000)
  })

  it('ignora encabezado repetido y número de página', () => {
    expect(moves.every((row) => row.operationId !== '1' && row.operationId !== '4')).toBe(true)
    expect(moves.some((row) => /fecha/i.test(row.description))).toBe(false)
  })

  it('corta antes de la sección en dólares y de la fecha de generación', () => {
    expect(moves.every((row) => row.date <= '2026-11-11')).toBe(true)
    expect(moves.some((row) => /d[oó]lares/i.test(row.description))).toBe(false)
  })

  it('acepta IDs de 10 y 13 dígitos', () => {
    expect(moves.some((row) => row.operationId === '3731351087')).toBe(true)
    expect(moves.some((row) => row.operationId === '1752498663392')).toBe(true)
  })

  it('clasifica pagos, rendimientos, créditos y transferencias', () => {
    const result = classifyMpMoves(moves, {
      partnerAliases: ['Compañera Ejemplo Apellido'],
      merchantPrefs: [{ merchantKey: foldMerchant('La Anónima'), categoryId: 'cat-super', isShared: true }],
      imported: emptyImported(),
    })
    const byId = Object.fromEntries(result.rows.map((row) => [row.operationId, row]))

    expect(byId['186176544447']).toMatchObject({
      kind: 'expense',
      checked: true,
      title: expect.stringMatching(/La An[oó]nima/i),
      categoryId: 'cat-super',
      isShared: true,
    })
    expect(foldMerchant('La Anónima')).toBe(foldMerchant('La Anonima'))

    expect(byId['1752498663392']).toMatchObject({
      kind: 'income',
      checked: false,
      title: 'Rendimientos',
    })

    expect(byId['186860352921']).toMatchObject({
      kind: 'transfer',
      checked: true,
      title: 'Transferencia',
      transferDirection: 'received',
    })
    // D3: posible gasto compartido, sin pedir alias si ya hay compañera.
    expect(byId['186916915419']).toMatchObject({
      kind: 'expense',
      checked: false,
      status: 'ready',
      isShared: true,
    })
    // Dorado es nombre nuevo: se lista para preguntar, pero la fila ya es posible gasto.
    expect(result.unrecognizedTransferNames.some((name) => /Dorado/i.test(name))).toBe(true)

    expect(byId['3731351087']).toMatchObject({
      kind: 'expense',
      checked: true,
      creditoMp: true,
      title: 'Créditos MP',
    })
    expect(byId['3823155186']).toMatchObject({ kind: 'expense', checked: true, creditoMp: true })

    const farmacia = byId['186936647405']
    expect(farmacia?.title).toMatch(/Farmacias del Pueblo/i)
    expect(farmacia?.checked).toBe(true)
  })

  it('sin alias pide compañera y lista transferencias no reconocidas', () => {
    const result = classifyMpMoves(moves, {
      partnerAliases: [],
      merchantPrefs: [],
      imported: emptyImported(),
    })
    expect(result.rows.find((row) => row.operationId === '186916915419')).toMatchObject({
      kind: 'expense',
      checked: false,
      status: 'needs_partner_alias',
      isShared: true,
    })
    expect(result.rows.find((row) => row.operationId === '186860352921')).toMatchObject({
      kind: 'income',
      checked: false,
      status: 'needs_partner_alias',
    })
    expect(result.unrecognizedTransferNames.some((name) => /Dorado/i.test(name))).toBe(true)
    expect(result.unrecognizedTransferNames.some((name) => /Compa[nñ]era Ejemplo/i.test(name))).toBe(true)
  })

  it('D6: Ninguno es Maru solo pregunta por nombres nuevos', () => {
    const result = classifyMpMoves(moves, {
      partnerAliases: [],
      rejectedAliases: ['Compañera Ejemplo Apellido', 'Dorado', 'Ana Perez Uno'],
      merchantPrefs: [],
      imported: emptyImported(),
    })
    expect(result.unrecognizedTransferNames).toHaveLength(0)
    expect(result.rows.find((row) => row.operationId === '186916915419')?.status).toBe('ready')
  })

  it('D4: preferencia de comercio también aplica a personas', () => {
    const result = classifyMpMoves(moves, {
      partnerAliases: ['Compañera Ejemplo Apellido'],
      merchantPrefs: [
        {
          merchantKey: foldMerchant('Dorado'),
          categoryId: 'cat-hogar',
          isShared: true,
          title: 'Alquiler',
        },
      ],
      imported: emptyImported(),
    })
    expect(result.rows.find((row) => row.operationId === '186916915419')).toMatchObject({
      title: 'Alquiler',
      categoryId: 'cat-hogar',
      isShared: true,
      checked: false,
    })
  })

  it('D8: pago + devolución del mismo ID quedan visibles apagados', () => {
    const result = classifyMpMoves(moves, {
      partnerAliases: [],
      merchantPrefs: [],
      imported: emptyImported(),
    })
    const pair = result.rows.filter((row) => row.operationId === '187836133751')
    expect(pair).toHaveLength(2)
    expect(pair.every((row) => row.status === 'refund_pair' && !row.checked)).toBe(true)
    expect(pair[0]?.statusLabel).toMatch(/Te lo devolvieron/i)
    expect(result.rows.some((row) => row.operationId === '189136511556')).toBe(true)
  })

  it('D10: devolución sin pago en archivo ni cargado es ingreso posible', () => {
    const onlyRefund = parseMpStatement(
      linesFromLayout(`
DETALLE DE MOVIMIENTOS
Fecha         Descripción                    operación                Valor            Saldo
10-11-2026    Devolución de pago Uber        187836133751            $ 6.643,00        $ 33.139,59
Fecha de generación: 12-11-2026
`),
    )
    const result = classifyMpMoves(onlyRefund, {
      partnerAliases: [],
      merchantPrefs: [],
      imported: emptyImported(),
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      kind: 'income',
      checked: false,
      title: 'Devolución de Uber',
      status: 'ready',
    })
  })

  it('avisa devolución si el pago ya estaba importado', () => {
    const onlyRefund = parseMpStatement(
      linesFromLayout(`
DETALLE DE MOVIMIENTOS
Fecha         Descripción                    operación                Valor            Saldo
10-11-2026    Devolución de pago Uber        187836133751            $ 6.643,00        $ 33.139,59
Fecha de generación: 12-11-2026
`),
    )
    const imported = new Map<string, MpImportedRecord>([
      [
        '187836133751',
        {
          operationId: '187836133751',
          kind: 'expense',
          title: 'Uber',
          categoryId: null,
          categoryName: null,
          isShared: false,
          date: '2026-11-02',
        },
      ],
    ])
    const result = classifyMpMoves(onlyRefund, {
      partnerAliases: [],
      merchantPrefs: [],
      imported,
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      status: 'refund_notice',
      checked: false,
      kind: 'notice',
      title: 'Devolución de Uber',
    })
    expect(result.rows[0]?.statusLabel).toMatch(/ya está cargado/i)
  })

  it('D9: segundo pase conserva tipo, categoría y compartido de lo cargado', () => {
    const imported = new Map<string, MpImportedRecord>([
      [
        '186176544447',
        {
          operationId: '186176544447',
          kind: 'expense',
          title: 'La Anónima',
          categoryId: 'cat-super',
          categoryName: 'Súper',
          isShared: true,
          date: '2026-11-01',
        },
      ],
      [
        '189136511556',
        {
          operationId: '189136511556',
          kind: 'expense',
          title: 'Spotify',
          categoryId: null,
          categoryName: null,
          isShared: false,
          date: '2026-11-11',
        },
      ],
    ])
    const result = classifyMpMoves(moves, {
      partnerAliases: ['Compañera Ejemplo Apellido'],
      merchantPrefs: [],
      imported,
    })
    expect(result.rows.find((row) => row.operationId === '186176544447')).toMatchObject({
      status: 'already_imported',
      checked: false,
      title: 'La Anónima',
      categoryId: 'cat-super',
      categoryName: 'Súper',
      isShared: true,
      kind: 'expense',
    })
    const review = buildReviewRows(
      result.rows.filter((row) => row.operationId === '186176544447'),
      [],
    )
    expect(rowSubtitle(review[0]!, 'Maru')).toBe('Gasto · Súper · Compartido')
  })

  it('D12: due_day topea en 28', () => {
    expect(creditoMpDueDay('2026-11-10')).toBe(10)
    expect(creditoMpDueDay('2026-11-31')).toBe(28)
    expect(creditoMpDueDay('2026-11-29')).toBe(28)
  })

  it('P4 help de mes saldado nombra el mes', () => {
    expect(settledMonthHelp('2026-10-01')).toMatch(/^Octubre está saldado:/)
  })

  it('conserva orden de páginas y ignora detalle de dólares (antes y después)', () => {
    const page1 = [
      { x: 200, y: 800, text: 'RESUMEN' },
      { x: 260, y: 800, text: 'DE' },
      { x: 290, y: 800, text: 'CUENTA' },
      { x: 360, y: 800, text: 'EN' },
      { x: 390, y: 800, text: 'PESOS' },
      { x: 220, y: 760, text: 'DETALLE' },
      { x: 290, y: 760, text: 'DE' },
      { x: 320, y: 760, text: 'MOVIMIENTOS' },
      { x: 40, y: 720, text: 'Fecha' },
      { x: 120, y: 720, text: 'Descripción' },
      { x: 360, y: 720, text: 'operación' },
      { x: 480, y: 720, text: 'Valor' },
      { x: 560, y: 720, text: 'Saldo' },
      { x: 40, y: 680, text: '01-11-2026' },
      { x: 120, y: 680, text: 'Pago' },
      { x: 160, y: 680, text: 'con' },
      { x: 200, y: 680, text: 'QR' },
      { x: 240, y: 680, text: 'Alpha' },
      { x: 360, y: 680, text: '111111111111' },
      { x: 480, y: 680, text: '$' },
      { x: 500, y: 680, text: '-10.000,00' },
      { x: 560, y: 680, text: '$' },
      { x: 580, y: 680, text: '90.000,00' },
    ]
    const page2 = [
      { x: 40, y: 700, text: '02-11-2026' },
      { x: 120, y: 700, text: 'Pago' },
      { x: 160, y: 700, text: 'Beta' },
      { x: 360, y: 700, text: '222222222222' },
      { x: 480, y: 700, text: '$' },
      { x: 500, y: 700, text: '-5.000,00' },
      { x: 560, y: 700, text: '$' },
      { x: 580, y: 700, text: '85.000,00' },
      { x: 40, y: 640, text: '11-11-2026' },
      { x: 120, y: 640, text: 'Pago' },
      { x: 160, y: 640, text: 'Spotify' },
      { x: 360, y: 640, text: '189136511556' },
      { x: 480, y: 640, text: '$' },
      { x: 500, y: 640, text: '-8.232,02' },
      { x: 560, y: 640, text: '$' },
      { x: 580, y: 640, text: '7.874,23' },
      { x: 40, y: 120, text: 'Mercado' },
      { x: 100, y: 120, text: 'Libre' },
      { x: 150, y: 120, text: 'S.R.L.' },
      { x: 210, y: 120, text: 'CUIT' },
      { x: 260, y: 120, text: '30-70308853-4' },
      { x: 40, y: 100, text: 'Encontrá' },
      { x: 110, y: 100, text: 'nuestros' },
      { x: 180, y: 100, text: 'canales' },
      { x: 40, y: 80, text: 'de' },
      { x: 70, y: 80, text: 'consulta' },
      { x: 140, y: 80, text: 'en:' },
      { x: 180, y: 80, text: 'www.mercadopago.com.ar' },
      { x: 40, y: 50, text: 'Fecha' },
      { x: 90, y: 50, text: 'de' },
      { x: 120, y: 50, text: 'generación:' },
      { x: 220, y: 50, text: '12-11-2026' },
      { x: 500, y: 40, text: '2/3' },
    ]
    const page3Dollars = [
      { x: 200, y: 780, text: 'RESUMEN' },
      { x: 260, y: 780, text: 'DE' },
      { x: 290, y: 780, text: 'TENENCIAS' },
      { x: 380, y: 780, text: 'EN' },
      { x: 410, y: 780, text: 'DÓLARES' },
      { x: 200, y: 740, text: 'DETALLE' },
      { x: 270, y: 740, text: 'DE' },
      { x: 300, y: 740, text: 'MOVIMIENTOS' },
      { x: 420, y: 740, text: 'DEL' },
      { x: 460, y: 740, text: 'PERIODO' },
      { x: 40, y: 700, text: 'Fecha' },
      { x: 120, y: 700, text: 'Descripción' },
      { x: 360, y: 700, text: 'operación' },
      { x: 480, y: 700, text: 'Valor' },
      { x: 560, y: 700, text: 'Saldo' },
    ]

    const inOrder = linesFromPageItems([page1, page2, page3Dollars])
    const parsed = parseMpStatement(inOrder)
    expect(parsed.map((row) => row.operationId)).toEqual([
      '111111111111',
      '222222222222',
      '189136511556',
    ])
    expect(parsed[2]?.description).toBe('Pago Spotify')

    const dollarsFirst = linesFromPageItems([page3Dollars, page1, page2])
    const recovered = parseMpStatement(dollarsFirst)
    expect(recovered.map((row) => row.operationId)).toEqual([
      '111111111111',
      '222222222222',
      '189136511556',
    ])
    expect(recovered[2]?.description).toBe('Pago Spotify')

    const dollarsBoth = linesFromLayout(`
DETALLE DE MOVIMIENTOS DEL PERIODO
Fecha         Descripción                    operación                Valor            Saldo
RESUMEN DE CUENTA EN PESOS
DETALLE DE MOVIMIENTOS
Fecha         Descripción                    operación                Valor            Saldo
01-11-2026    Pago Gamma                     333333333333            $ -1.000,00       $ 1.000,00
RESUMEN DE TENENCIAS EN DÓLARES
DETALLE DE MOVIMIENTOS DEL PERIODO
Fecha         Descripción                    operación                Valor            Saldo
`)
    expect(parseMpStatement(dollarsBoth).map((row) => row.operationId)).toEqual(['333333333333'])
  })
})
