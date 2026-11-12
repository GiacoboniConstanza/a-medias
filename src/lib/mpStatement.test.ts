import { describe, expect, it } from 'vitest'
import { linesFromLayout, linesFromPageItems } from './pdfLines.ts'
import { classifyMpMoves, foldMerchant, parseMpStatement } from './mpStatement.ts'

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
      importedIds: new Set(),
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
      transferDirection: 'received',
    })
    // Con alias ya cargado, otra persona = gasto posible, sin pedir alias.
    expect(byId['186916915419']).toMatchObject({
      kind: 'expense',
      checked: false,
      status: 'ready',
      statusLabel: 'Transferencia a otra persona',
    })
    expect(result.unrecognizedTransferNames).toHaveLength(0)

    expect(byId['3731351087']).toMatchObject({ kind: 'expense', checked: true, creditoMp: true })
    expect(byId['3823155186']).toMatchObject({ kind: 'expense', checked: true, creditoMp: true })

    const farmacia = byId['186936647405']
    expect(farmacia?.title).toMatch(/Farmacias del Pueblo/i)
    expect(farmacia?.checked).toBe(true)
  })

  it('sin alias pide compañera y lista transferencias no reconocidas', () => {
    const result = classifyMpMoves(moves, {
      partnerAliases: [],
      merchantPrefs: [],
      importedIds: new Set(),
    })
    expect(result.rows.find((row) => row.operationId === '186916915419')).toMatchObject({
      kind: 'expense',
      checked: false,
      status: 'needs_partner_alias',
    })
    expect(result.rows.find((row) => row.operationId === '186860352921')).toMatchObject({
      kind: 'income',
      checked: false,
      status: 'needs_partner_alias',
    })
    expect(result.unrecognizedTransferNames.some((name) => /Dorado/i.test(name))).toBe(true)
    expect(result.unrecognizedTransferNames.some((name) => /Compa[nñ]era Ejemplo/i.test(name))).toBe(true)
  })

  it('oculta pago + devolución del mismo ID en el archivo', () => {
    const result = classifyMpMoves(moves, {
      partnerAliases: [],
      merchantPrefs: [],
      importedIds: new Set(),
    })
    expect(result.rows.some((row) => row.operationId === '187836133751')).toBe(false)
    expect(result.rows.some((row) => row.operationId === '189136511556')).toBe(true)
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
    const result = classifyMpMoves(onlyRefund, {
      partnerAliases: [],
      merchantPrefs: [],
      importedIds: new Set(['187836133751']),
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      status: 'refund_notice',
      checked: false,
      kind: 'notice',
    })
  })

  it('en un segundo pase marca IDs ya importados', () => {
    const result = classifyMpMoves(moves, {
      partnerAliases: ['Compañera Ejemplo Apellido'],
      merchantPrefs: [],
      importedIds: new Set(['186176544447', '189136511556']),
    })
    expect(result.rows.find((row) => row.operationId === '186176544447')).toMatchObject({
      status: 'already_imported',
      checked: false,
      statusLabel: 'Ya está cargado',
    })
    expect(result.rows.find((row) => row.operationId === '189136511556')).toMatchObject({
      status: 'already_imported',
    })
  })

  it('conserva orden de páginas y ignora detalle de dólares (antes y después)', () => {
    // Simula pdfjs: y local por página (alto 841), sin offset global.
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
      { x: 40, y: 100, text: 'Fecha' },
      { x: 90, y: 100, text: 'de' },
      { x: 120, y: 100, text: 'generación:' },
      { x: 220, y: 100, text: '12-11-2026' },
    ]

    const inOrder = linesFromPageItems([page1, page2, page3Dollars])
    const parsed = parseMpStatement(inOrder)
    expect(parsed.map((row) => row.operationId)).toEqual(['111111111111', '222222222222'])
    expect(parsed[0]?.description).toMatch(/Pago con QR Alpha/i)
    expect(parsed[1]?.description).toMatch(/Pago Beta/i)

    // Encabezado de dólares primero (como si las páginas vinieran al revés) no debe robar el inicio.
    const dollarsFirst = linesFromPageItems([page3Dollars, page1, page2])
    const recovered = parseMpStatement(dollarsFirst)
    expect(recovered.map((row) => row.operationId)).toEqual(['111111111111', '222222222222'])

    // "DETALLE DE MOVIMIENTOS DEL PERIODO" también después de pesos: no se parsea como ancla.
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
