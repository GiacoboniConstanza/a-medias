import { describe, expect, it } from 'vitest'
import { formatMoney } from './format.ts'
import { fixedExpensesTotal, fixedTotalNote, type FixedTotalItem } from './fixed-total.ts'
import { shareAmounts } from './split.ts'

const coty = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const maru = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const percents60 = { [coty]: 60, [maru]: 40 }
const percents50 = { [coty]: 50, [maru]: 50 }

function item(
  title: string,
  amount: number,
  opts: Partial<FixedTotalItem> & { isShared: boolean },
): FixedTotalItem {
  return {
    title,
    amount,
    hasAmount: opts.hasAmount ?? true,
    isShared: opts.isShared,
    payment: opts.payment ?? null,
  }
}

/** Datos §5 / §3.4 con pagados y Luz sin monto. */
function fullMonth(opts?: { luz?: boolean; alquiler?: boolean }): FixedTotalItem[] {
  const rows: FixedTotalItem[] = [
    item('Seguro del auto', 41_300, { isShared: false }),
    item('Internet', 24_999, { isShared: true }),
    item('Gimnasio', 35_000, { isShared: false }),
    item('Expensas', 98_000, { isShared: true }),
  ]
  if (opts?.luz !== false) {
    rows.push(item('Luz', 0, { isShared: true, hasAmount: false }))
  }
  if (opts?.alquiler !== false) {
    rows.push(
      item('Alquiler', 380_000, {
        isShared: true,
        payment: { amount: 380_000 },
      }),
    )
  }
  return rows
}

describe('fixedTotalNote', () => {
  it('arma la nota de §3.4', () => {
    expect(fixedTotalNote(38_000_000, ['Luz'])?.text).toBe(
      `${formatMoney(380_000)} ya pagados · Luz sin monto`,
    )
    expect(fixedTotalNote(38_000_000, ['Luz', 'Gas', 'Agua'])?.text).toBe(
      `${formatMoney(380_000)} ya pagados · 3 sin monto`,
    )
    expect(fixedTotalNote(38_000_000, [])?.text).toBe(`${formatMoney(380_000)} ya pagados`)
    expect(fixedTotalNote(0, ['Luz'])?.text).toBe('Luz sin monto')
    expect(fixedTotalNote(0, ['Luz', 'Gas', 'Agua'])?.text).toBe('3 sin monto')
    expect(fixedTotalNote(0, [])).toBeNull()
  })

  it('si el nombre no entra, usa «1 sin monto»', () => {
    const long = 'Suscripción muy larga que no entra en una línea'
    expect(fixedTotalNote(38_000_000, [long])?.missingLabel).toBe('1 sin monto')
  })
})

describe('fixedExpensesTotal · §3.4', () => {
  it('sin filtros, sin pagados ni sin monto', () => {
    const card = fixedExpensesTotal({
      items: fullMonth({ luz: false, alquiler: false }),
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: false,
    })
    expect(card).not.toBeNull()
    expect(card!.label).toBe('Total del mes')
    expect(card!.total).toBe(199_299)
    expect(card!.note).toBeNull()
    expect(card!.showParts).toBe(true)
    expect(card!.myShare).toBe(73_799.4)
    expect(card!.partnerShare).toBe(49_199.6)
    expect(card!.showPrivate).toBe(true)
    expect(card!.privateTotal).toBe(76_300)
  })

  it('con pagados y sin monto (uno)', () => {
    const card = fixedExpensesTotal({
      items: fullMonth(),
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: false,
    })
    expect(card!.total).toBe(579_299)
    expect(card!.note?.text).toBe(`${formatMoney(380_000)} ya pagados · Luz sin monto`)
    expect(card!.myShare).toBe(301_799.4)
    expect(card!.partnerShare).toBe(201_199.6)
    expect(card!.privateTotal).toBe(76_300)
    expect(card!.partsAriaLabel).toBe(
      'Vos 301.799,40 pesos; Maru 201.199,60 pesos, de los compartidos',
    )
  })

  it('con pagados y varios sin monto', () => {
    const items = [
      ...fullMonth({ luz: false }),
      item('Luz', 0, { isShared: true, hasAmount: false }),
      item('Gas', 0, { isShared: true, hasAmount: false }),
      item('Agua', 0, { isShared: true, hasAmount: false }),
    ]
    const card = fixedExpensesTotal({
      items,
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: false,
    })
    expect(card!.note?.text).toBe(`${formatMoney(380_000)} ya pagados · 3 sin monto`)
  })

  it('solo pagados', () => {
    const card = fixedExpensesTotal({
      items: fullMonth({ luz: false }),
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: false,
    })
    expect(card!.total).toBe(579_299)
    expect(card!.note?.text).toBe(`${formatMoney(380_000)} ya pagados`)
  })

  it('solo sin monto (uno)', () => {
    const card = fixedExpensesTotal({
      items: fullMonth({ alquiler: false }),
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: false,
    })
    expect(card!.total).toBe(199_299)
    expect(card!.note?.text).toBe('Luz sin monto')
  })

  it('solo sin monto (varios)', () => {
    const items = [
      ...fullMonth({ luz: false, alquiler: false }),
      item('Luz', 0, { isShared: true, hasAmount: false }),
      item('Gas', 0, { isShared: true, hasAmount: false }),
      item('Agua', 0, { isShared: true, hasAmount: false }),
    ]
    const card = fixedExpensesTotal({
      items,
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: false,
    })
    expect(card!.note?.text).toBe('3 sin monto')
  })

  it('solo privados (filtro)', () => {
    const card = fixedExpensesTotal({
      items: fullMonth().filter((row) => !row.isShared),
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: true,
    })
    expect(card!.label).toBe('Total con estos filtros')
    expect(card!.total).toBe(76_300)
    expect(card!.showParts).toBe(false)
    expect(card!.showPrivate).toBe(false)
    expect(card!.note).toBeNull()
  })

  it('solo compartidos (filtro)', () => {
    const card = fixedExpensesTotal({
      items: fullMonth().filter((row) => row.isShared),
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: true,
    })
    expect(card!.label).toBe('Total con estos filtros')
    expect(card!.total).toBe(502_999)
    expect(card!.showParts).toBe(true)
    expect(card!.showPrivate).toBe(false)
    expect(card!.myShare).toBe(301_799.4)
    expect(card!.note?.text).toBe(`${formatMoney(380_000)} ya pagados · Luz sin monto`)
  })

  it('falta un sueldo → partes 50/50 sin texto extra', () => {
    const card = fixedExpensesTotal({
      items: fullMonth(),
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents50,
      filtersActive: false,
    })
    expect(card!.myShare).toBe(251_499.5)
    expect(card!.partnerShare).toBe(251_499.5)
  })

  it('sin pareja en el hogar', () => {
    const card = fixedExpensesTotal({
      items: fullMonth(),
      meId: coty,
      partnerId: null,
      partnerName: '',
      splitPercents: { [coty]: 100 },
      filtersActive: false,
    })
    expect(card!.total).toBe(579_299)
    expect(card!.showParts).toBe(false)
    expect(card!.showPrivate).toBe(true)
    expect(card!.privateTotal).toBe(76_300)
  })

  it('sin nada a la vista no hay tarjeta', () => {
    expect(
      fixedExpensesTotal({
        items: [],
        meId: coty,
        partnerId: maru,
        partnerName: 'Maru',
        splitPercents: percents60,
        filtersActive: false,
      }),
    ).toBeNull()
  })

  it('pagado suma payment.amount aunque hasAmount sea false', () => {
    const card = fixedExpensesTotal({
      items: [
        item('Alquiler', 0, {
          isShared: true,
          hasAmount: false,
          payment: { amount: 380_000 },
        }),
      ],
      meId: coty,
      partnerId: maru,
      partnerName: 'Maru',
      splitPercents: percents60,
      filtersActive: false,
    })
    expect(card!.total).toBe(380_000)
    expect(card!.note?.text).toBe(`${formatMoney(380_000)} ya pagados`)
  })

  it('las partes suman el compartido al centavo', () => {
    const shared = 502_999
    const parts = shareAmounts(shared, [60, 40])
    expect(parts[0]! + parts[1]!).toBe(shared)
  })
})
