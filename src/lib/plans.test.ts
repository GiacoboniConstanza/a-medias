import { describe, expect, it } from 'vitest'
import {
  boughtPlanItems,
  filterPlanItemsByTag,
  formatChosenDelta,
  myPlanCost,
  openPlanItems,
  partnerStatusLabel,
  planCommitted,
  planItemShares,
  planMargin,
  planRemaining,
  planSalaryForMonth,
  planTags,
  sortPlanItems,
  type PlanItem,
} from './plans.ts'
import { salaryPercents, type SalaryPoint } from './salary.ts'

const coty = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const maru = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const even = { [coty]: 50, [maru]: 50 }
const bySalary = { [coty]: 56, [maru]: 44 }

function item(partial: Partial<PlanItem> & Pick<PlanItem, 'id' | 'title' | 'amount'>): PlanItem {
  return {
    note: null,
    tag: null,
    isPrivate: false,
    ownerId: null,
    chosen: false,
    expenseId: null,
    expenseAmount: null,
    expensePeriod: null,
    ...partial,
  }
}

describe('margen y te queda (§2 ejemplo)', () => {
  it('margen = sueldo − fijos compartidos − privados', () => {
    expect(planMargin(1_000_000, 300_000, 250_000)).toBe(450_000)
    expect(planMargin(800_000, 300_000, 200_000)).toBe(300_000)
    expect(planMargin(0, 300_000, 250_000)).toBeNull()
  })

  it('reparte un ítem compartido a mitad', () => {
    expect(planItemShares(150_000, coty, maru, even)).toEqual({
      myShare: 75_000,
      partnerShare: 75_000,
    })
    expect(myPlanCost({ amount: 40_000, isPrivate: true }, coty, maru, even)).toBe(40_000)
  })

  it('con rack elegido Te queda 375k; con lámpara 335k', () => {
    const margin = 450_000
    const rack = item({ id: '1', title: 'Rack TV', amount: 150_000, chosen: true, tag: 'Living' })
    const lamp = item({
      id: '2',
      title: 'Lámpara',
      amount: 40_000,
      chosen: true,
      isPrivate: true,
      ownerId: coty,
      tag: 'Cuarto',
    })
    expect(planRemaining(margin, planCommitted([rack], coty, maru, even, '2026-11-01'))).toBe(375_000)
    expect(planRemaining(margin, planCommitted([rack, lamp], coty, maru, even, '2026-11-01'))).toBe(335_000)
  })

  it('elegir biblioteca y sillón deja Te queda negativo', () => {
    const items = [
      item({ id: '1', title: 'Rack TV', amount: 150_000, chosen: true }),
      item({
        id: '2',
        title: 'Lámpara',
        amount: 40_000,
        chosen: true,
        isPrivate: true,
        ownerId: coty,
      }),
      item({ id: '3', title: 'Biblioteca', amount: 250_000, chosen: true }),
      item({ id: '4', title: 'Sillón', amount: 500_000, chosen: true }),
    ]
    expect(planRemaining(450_000, planCommitted(items, coty, maru, even, '2026-11-01'))).toBe(-40_000)
  })

  it('reparto según sueldos 56/44 en el rack', () => {
    const shares = planItemShares(150_000, coty, maru, bySalary)
    expect(shares.myShare).toBe(84_000)
    expect(shares.partnerShare).toBe(66_000)
  })

  it('lo comprado este mes sigue restando; otro mes no', () => {
    const bought = item({
      id: '1',
      title: 'Rack TV',
      amount: 150_000,
      expenseId: 'e1',
      expenseAmount: 150_000,
      expensePeriod: '2026-11-01',
    })
    expect(planCommitted([bought], coty, maru, even, '2026-11-01')).toBe(75_000)
    expect(planCommitted([bought], coty, maru, even, '2026-12-01')).toBe(0)
  })
})

describe('orden, tags y señal', () => {
  it('elige primero y después por importe', () => {
    const ordered = openPlanItems([
      item({ id: 's', title: 'Sillón', amount: 500_000 }),
      item({ id: 'r', title: 'Rack TV', amount: 150_000, chosen: true }),
      item({ id: 'b', title: 'Biblioteca', amount: 250_000 }),
      item({
        id: 'l',
        title: 'Lámpara',
        amount: 40_000,
        chosen: true,
        isPrivate: true,
        ownerId: coty,
      }),
    ])
    expect(ordered.map((row) => row.title)).toEqual(['Lámpara', 'Rack TV', 'Biblioteca', 'Sillón'])
  })

  it('filtra por etiqueta sin tocar el resumen', () => {
    const items = [
      item({ id: '1', title: 'Rack', amount: 1, tag: 'Living', chosen: true }),
      item({ id: '2', title: 'Lámpara', amount: 1, tag: 'Cuarto' }),
    ]
    expect(filterPlanItemsByTag(items, 'Living').map((row) => row.title)).toEqual(['Rack'])
    expect(planTags(items)).toEqual(['Cuarto', 'Living'])
  })

  it('arma la señal de la otra', () => {
    expect(partnerStatusLabel('Maru', 'alcanza')).toBe('Maru: alcanza')
    expect(partnerStatusLabel('Maru', 'no_alcanza')).toBe('Maru: no alcanza')
    expect(partnerStatusLabel('Maru', 'falta_sueldo')).toBe('Maru: falta sueldo')
    expect(partnerStatusLabel('Maru', null)).toBeNull()
  })

  it('formatea elegidos con un solo estilo de menos', () => {
    expect(formatChosenDelta(135_000)).toBe('− $ 135.000,00')
  })

  it('Te queda cierra con margen − elegidos (lámpara + mitad rack)', () => {
    const margin = 450_000
    const items = [
      item({
        id: '1',
        title: 'Lámpara',
        amount: 45_000,
        chosen: true,
        isPrivate: true,
        ownerId: coty,
      }),
      item({ id: '2', title: 'Rack TV', amount: 180_000, chosen: true }),
    ]
    const elegidos = planCommitted(items, coty, maru, even, '2026-11-01')
    expect(elegidos).toBe(135_000)
    expect(formatChosenDelta(elegidos)).toBe('− $ 135.000,00')
    expect(planRemaining(margin, elegidos)).toBe(315_000)
  })

  it('separa comprados de abiertos', () => {
    const items = [
      item({ id: '1', title: 'Rack', amount: 1, chosen: true }),
      item({
        id: '2',
        title: 'Cortinas',
        amount: 60_000,
        expenseId: 'e',
        expenseAmount: 60_000,
        expensePeriod: '2026-10-01',
      }),
    ]
    expect(boughtPlanItems(items)).toHaveLength(1)
    expect(sortPlanItems(items)[0]?.title).toBe('Rack')
  })
})

describe('sueldo y reparto post-corte', () => {
  const point = (amount: number, effectiveFrom: string, id: string): SalaryPoint => ({
    id,
    amount,
    effectiveFrom,
    createdAt: `${effectiveFrom}T12:00:00.000Z`,
    label: null,
  })

  it('suma varios sueldos del mes desde el corte', () => {
    const history = [
      point(480_000, '2026-12-01', '1'),
      point(120_000, '2026-12-01', '2'),
      point(500_000, '2026-11-01', '3'),
    ]
    expect(planSalaryForMonth(history, '2026-12-01')).toBe(600_000)
    expect(planSalaryForMonth(history, '2026-11-01')).toBe(500_000)
    expect(planSalaryForMonth(history, '2027-01-01')).toBe(0)
  })

  it('margen con varios sueldos y modo mitad (50/50)', () => {
    const salary = planSalaryForMonth(
      [point(100_000, '2027-03-01', 'a'), point(200_000, '2027-03-01', 'b')],
      '2027-03-01',
    )
    expect(salary).toBe(300_000)
    const mitad = { [coty]: 50, [maru]: 50 }
    const margin = planMargin(salary, 80_000, 20_000)
    expect(margin).toBe(200_000)
    const rack = item({ id: '1', title: 'Rack', amount: 100_000, chosen: true })
    expect(planRemaining(margin!, planCommitted([rack], coty, maru, mitad, '2027-03-01'))).toBe(150_000)
  })

  it('modo manual 70/30 reparte el ítem elegido', () => {
    const manual = { [coty]: 70, [maru]: 30 }
    const rack = item({ id: '1', title: 'Rack', amount: 100_000, chosen: true })
    expect(planItemShares(100_000, coty, maru, manual)).toEqual({
      myShare: 70_000,
      partnerShare: 30_000,
    })
    expect(planCommitted([rack], coty, maru, manual, '2027-04-01')).toBe(70_000)
  })

  it('falta sueldo → margen null; proporcional cae en 50/50', () => {
    expect(planSalaryForMonth([], '2027-05-01')).toBe(0)
    expect(planMargin(0, 10_000, 0)).toBeNull()
    expect(salaryPercents([600_000, 0])).toEqual([50, 50])
  })
})
