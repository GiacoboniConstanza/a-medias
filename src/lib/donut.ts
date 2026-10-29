/** Porción mínima del círculo para que un aporte chico no desaparezca. */
export const DONUT_MIN_ARC = 0.03

export function donutArcs(amounts: number[], minArc = DONUT_MIN_ARC): number[] {
  const weights = amounts.map((amount) => (amount > 0 ? amount : 0))
  const sum = weights.reduce((total, amount) => total + amount, 0)
  if (sum <= 0) return weights.map(() => 0)

  const ratios = weights.map((amount) => amount / sum)
  const small = ratios.map((ratio, index) => weights[index] > 0 && ratio < minArc)
  const smallCount = small.filter(Boolean).length
  if (smallCount === 0) return ratios

  const positive = weights.filter((amount) => amount > 0).length
  if (smallCount * minArc >= 1 || positive === smallCount) {
    return weights.map((amount) => (amount > 0 ? 1 / positive : 0))
  }

  const largeSum = ratios.reduce((total, ratio, index) => total + (small[index] ? 0 : ratio), 0)
  const scale = (1 - smallCount * minArc) / largeSum
  return ratios.map((ratio, index) => {
    if (weights[index] <= 0) return 0
    return small[index] ? minArc : ratio * scale
  })
}
