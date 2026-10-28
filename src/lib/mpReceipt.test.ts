import { describe, expect, it } from 'vitest'
import { parseMpReceipt, suggestCategoryName } from './mpReceipt.ts'

describe('comprobantes de Mercado Pago', () => {
  it('lee una transferencia con centavos y fecha larga', () => {
    const receipt = parseMpReceipt(`Mercado Pago
Transferencia enviada
Pagaste a Juan Pérez
$ 12.345,67
28 de octubre de 2026`)
    expect(receipt).toEqual({
      amount: 12345.67,
      merchant: 'Juan Pérez',
      date: '2026-10-28',
      confidence: 1,
    })
  })

  it('lee un pago con QR sin centavos y fecha corta', () => {
    const receipt = parseMpReceipt(`Pago con QR
Para Kiosco Don José
$ 2.500
28/10/2026`)
    expect(receipt).toEqual({
      amount: 2500,
      merchant: 'Kiosco Don José',
      date: '2026-10-28',
      confidence: 1,
    })
  })

  it('lee un pago en comercio con el destinatario en la línea siguiente', () => {
    const receipt = parseMpReceipt(`Pago en comercio
Destinatario
Farmacia Central
$12.345
28 de octubre de 2026`)
    expect(receipt).toEqual({
      amount: 12345,
      merchant: 'Farmacia Central',
      date: '2026-10-28',
      confidence: 1,
    })
  })

  it('lee centavos y la fecha corta después de Pagaste a', () => {
    const receipt = parseMpReceipt(`Pagaste a María López
Importe
$ 1.250,50
28/10/2026`)
    expect(receipt).toEqual({
      amount: 1250.5,
      merchant: 'María López',
      date: '2026-10-28',
      confidence: 1,
    })
  })

  it('lee un comercio al inicio de la línea, sin centavos y con fecha larga', () => {
    const receipt = parseMpReceipt(`Para Supermercado Coto
$ 8.900
28 de octubre de 2026`)
    expect(receipt).toEqual({
      amount: 8900,
      merchant: 'Supermercado Coto',
      date: '2026-10-28',
      confidence: 1,
    })
    expect(suggestCategoryName(receipt.merchant)).toBe('Súper')
  })

  it('deja en null lo que el comprobante no trae', () => {
    expect(
      parseMpReceipt(`Mercado Pago
Transferencia
$ 450,00`),
    ).toEqual({
      amount: 450,
      merchant: null,
      date: null,
      confidence: 0.33,
    })
  })
})
