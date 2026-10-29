import { createContext, useContext, useMemo, useState } from 'react'
import { isCurrentMonth, monthKey, monthLabel, monthTitle, shiftMonth } from '../lib/month.ts'

type MonthState = {
  month: string
  label: string
  title: string
  isCurrent: boolean
  previous: () => void
  next: () => void
  goToday: () => void
}

const MonthContext = createContext<MonthState | null>(null)

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [month, setMonth] = useState(() => monthKey())
  const value = useMemo<MonthState>(
    () => ({
      month,
      label: monthLabel(month),
      title: monthTitle(month),
      isCurrent: isCurrentMonth(month),
      previous: () => setMonth((current) => shiftMonth(current, -1)),
      next: () => setMonth((current) => shiftMonth(current, 1)),
      goToday: () => setMonth(monthKey()),
    }),
    [month],
  )
  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>
}

export function useMonth(): MonthState {
  const value = useContext(MonthContext)
  if (!value) throw new Error('Falta el MonthProvider')
  return value
}
