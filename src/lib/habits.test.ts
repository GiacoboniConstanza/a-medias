import { describe, expect, it } from 'vitest'
import {
  habitsForDay,
  isScheduledOn,
  sproutStage,
  todayCounterLabel,
  todayProgress,
  weekCounter,
  weekCounterLabel,
  weekSnapshots,
  weekdayIndex,
  type Habit,
} from './habits.ts'

const wednesday = new Date(2026, 9, 28)
const tuesday = new Date(2026, 9, 27)
const monday = new Date(2026, 9, 26)

function habit(id: string, daysOfWeek: number[], archived = false): Habit {
  return { id, name: id, iconName: 'seedling', daysOfWeek, archived }
}

describe('hábitos del día según los días elegidos', () => {
  const water = habit('agua', [0, 2])

  it('el miércoles es el día 2 y entra si está elegido', () => {
    expect(weekdayIndex(wednesday)).toBe(2)
    expect(weekdayIndex(monday)).toBe(0)
    expect(isScheduledOn(water.daysOfWeek, wednesday)).toBe(true)
    expect(isScheduledOn(water.daysOfWeek, tuesday)).toBe(false)
  })

  it('hoy solo lista los activos que caen en ese día', () => {
    const habits = [water, habit('martes', [1]), habit('archivo', [2], true)]
    expect(habitsForDay(habits, wednesday).map((item) => item.id)).toEqual(['agua'])
    expect(habitsForDay(habits, tuesday).map((item) => item.id)).toEqual(['martes'])
  })
})

describe('contador de hábitos', () => {
  const habits = [habit('a', [2]), habit('b', [2]), habit('c', [2]), habit('d', [2]), habit('e', [2]), habit('lunes', [0])]
  const checks = [
    { habitId: 'a', day: '2026-10-28' },
    { habitId: 'b', day: '2026-10-28' },
    { habitId: 'c', day: '2026-10-28' },
    { habitId: 'lunes', day: '2026-10-26' },
  ]

  it('cuenta 3 de 5 en el día, sin los de otro día', () => {
    expect(todayProgress(habits, checks, wednesday)).toEqual({ done: 3, total: 5 })
    expect(todayCounterLabel(3, 5)).toBe('3 de 5')
  })

  it('en la semana cuenta los días con algún hábito cumplido', () => {
    const days = weekSnapshots(
      [habit('a', [0, 1, 2]), habit('b', [0, 1, 2])],
      [
        { habitId: 'a', day: '2026-10-26' },
        { habitId: 'b', day: '2026-10-26' },
        { habitId: 'a', day: '2026-10-28' },
      ],
      monday,
      wednesday,
    )
    const counter = weekCounter(days)
    expect(counter).toEqual({ touched: 2, elapsed: 3 })
    expect(weekCounterLabel(counter.touched, counter.elapsed)).toBe('2 de 3 días')
  })
})

describe('etapa del brote', () => {
  it('el día que viene es una maceta vacía y el día en cero es semilla', () => {
    expect(sproutStage(0, 5, 'future')).toBe('empty')
    expect(sproutStage(3, 5, 'future')).toBe('empty')
    expect(sproutStage(0, 0, 'today')).toBe('empty')
    expect(sproutStage(0, 5, 'past')).toBe('seed')
    expect(sproutStage(0, 5, 'today')).toBe('seed')
  })

  it('crece según la parte cumplida: brote, mediana y planta', () => {
    expect(sproutStage(1, 5, 'today')).toBe('sprout')
    expect(sproutStage(3, 5, 'today')).toBe('medium')
    expect(sproutStage(4, 5, 'today')).toBe('grown')
    expect(sproutStage(5, 5, 'today')).toBe('grown')
  })
})
