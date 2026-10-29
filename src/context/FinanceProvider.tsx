import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadFinance, type FinanceData } from '../lib/api.ts'
import { useAuth } from './AuthProvider.tsx'
import { useMonth } from './MonthProvider.tsx'

type FinanceState = {
  data: FinanceData | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const FinanceContext = createContext<FinanceState | null>(null)

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const { month } = useMonth()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!profile?.householdId) return
    setLoading(true)
    try {
      const next = await loadFinance(profile.householdId, profile.id, month)
      setData(next)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude cargar los datos.')
    } finally {
      setLoading(false)
    }
  }, [profile?.householdId, profile?.id, month])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ data, loading, error, refresh }), [data, loading, error, refresh])
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance(): FinanceState {
  const value = useContext(FinanceContext)
  if (!value) throw new Error('Falta el FinanceProvider')
  return value
}
