export type JarTone = 'green' | 'yellow' | 'red' | 'empty'

export type JarStatus = {
  remaining: number
  percentLeft: number
  tone: JarTone
  message: string
  daysLeft: number
}

export function jarStatus(input: {
  base: number
  privateSpent: number
  myShare: number
  dayOfMonth: number
  daysInMonth: number
  isCurrentMonth: boolean
}): JarStatus {
  const daysLeft = Math.max(input.daysInMonth - input.dayOfMonth + 1, 0)
  if (input.base <= 0) {
    return {
      remaining: 0,
      percentLeft: 0,
      tone: 'empty',
      message: 'Cargá tu sueldo base y te muestro cómo venís.',
      daysLeft,
    }
  }

  const spent = input.privateSpent + input.myShare
  const remaining = input.base - spent
  const percentLeft = Math.max(0, Math.round((remaining / input.base) * 100))
  const elapsed = Math.min(Math.max(input.dayOfMonth, 1), input.daysInMonth)
  const expectedSpent = input.base * (elapsed / input.daysInMonth)

  if (remaining < 0) {
    return {
      remaining,
      percentLeft: 0,
      tone: 'red',
      message: 'Te pasaste del sueldo base este mes.',
      daysLeft,
    }
  }

  if (!input.isCurrentMonth) {
    return {
      remaining,
      percentLeft,
      tone: percentLeft >= 25 ? 'green' : 'yellow',
      message: percentLeft >= 25 ? 'Cerraste el mes con plata de sobra.' : 'Ese mes quedó justo.',
      daysLeft: 0,
    }
  }

  if (spent <= expectedSpent * 0.9) {
    return {
      remaining,
      percentLeft,
      tone: 'green',
      message: 'Vas bien, te quedan unos días tranquilos.',
      daysLeft,
    }
  }

  if (spent <= expectedSpent * 1.1) {
    return {
      remaining,
      percentLeft,
      tone: 'yellow',
      message: 'Ojo, el ritmo está justo para lo que queda del mes.',
      daysLeft,
    }
  }

  return {
    remaining,
    percentLeft,
    tone: 'red',
    message: 'Se te está yendo más rápido de lo que entra.',
    daysLeft,
  }
}
