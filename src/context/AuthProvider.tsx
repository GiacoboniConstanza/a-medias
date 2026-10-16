import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { ViewMode } from '../types/database.ts'
import { supabase } from '../lib/supabase.ts'

export type Profile = {
  id: string
  householdId: string | null
  displayName: string
  viewMode: ViewMode
}

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, household_id, display_name, view_mode')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id,
    householdId: data.household_id,
    displayName: data.display_name,
    viewMode: data.view_mode,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      return
    }
    setProfile(await fetchProfile(userId))
  }, [session?.user.id])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      return
    }
    fetchProfile(userId)
      .then((next) => {
        if (active) setProfile(next)
      })
      .catch(() => {
        if (active) setProfile(null)
      })
    return () => {
      active = false
    }
  }, [session?.user.id])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, profile, loading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Falta el AuthProvider')
  return value
}
