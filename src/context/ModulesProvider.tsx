import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthProvider.tsx'
import { supabase } from '../lib/supabase.ts'
import { enabledFromRows, toggleAllowed, type ModuleId } from '../lib/modules.ts'

type ModulesState = {
  enabled: ModuleId[]
  ready: boolean
  error: string
  toggle: (module: ModuleId, next: boolean) => Promise<void>
}

const ModulesContext = createContext<ModulesState | null>(null)

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const userId = profile?.id ?? null
  const [enabled, setEnabled] = useState<ModuleId[]>(['finanzas'])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) {
      setEnabled(['finanzas'])
      setReady(false)
      setError('')
      return
    }
    let active = true
    setReady(false)
    supabase
      .from('user_modules')
      .select('module, enabled')
      .eq('user_id', userId)
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setEnabled(['finanzas'])
          setError(loadError.message)
          setReady(true)
          return
        }
        setEnabled(enabledFromRows(data ?? []))
        setError('')
        setReady(true)
      })
    return () => {
      active = false
    }
  }, [userId])

  const toggle = useCallback(
    async (module: ModuleId, next: boolean) => {
      if (!userId) throw new Error('Tenés que iniciar sesión')
      const blocked = toggleAllowed(enabled, module, next)
      if (blocked) throw new Error(blocked)
      const previous = enabled
      const optimistic = next ? [...enabled, module] : enabled.filter((id) => id !== module)
      setEnabled(enabledFromRows(optimistic.map((id) => ({ module: id, enabled: true }))))
      const { error: saveError } = await supabase.from('user_modules').upsert(
        { user_id: userId, module, enabled: next },
        { onConflict: 'user_id,module' },
      )
      if (saveError) {
        setEnabled(previous)
        throw new Error(saveError.message)
      }
    },
    [enabled, userId],
  )

  const value = useMemo(() => ({ enabled, ready, error, toggle }), [enabled, ready, error, toggle])
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>
}

export function useModules(): ModulesState {
  const value = useContext(ModulesContext)
  if (!value) throw new Error('Falta el ModulesProvider')
  return value
}
