import { describe, expect, it } from 'vitest'
import { DONUT_MIN_ARC, donutArcs } from './donut.ts'

describe('arcos de la dona', () => {
  it('respeta la proporción cuando todos los tramos se ven', () => {
    expect(donutArcs([25, 75])).toEqual([0.25, 0.75])
    expect(donutArcs([0, 0])).toEqual([0, 0])
  })

  it('levanta un tramo chico al arco mínimo y encoge el resto', () => {
    const [tiny, rest] = donutArcs([1, 999])
    expect(tiny).toBe(DONUT_MIN_ARC)
    expect(rest).toBeCloseTo(1 - DONUT_MIN_ARC)
  })
})