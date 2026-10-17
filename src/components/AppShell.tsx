import { Navigate, Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { FinanceProvider } from '../context/FinanceProvider.tsx'
import { supabaseConfigError } from '../lib/supabase.ts'

export function AppShell() {
  return (
    <div className="min-h-dvh bg-shell text-text">
      <div className="mx-auto min-h-dvh max-w-[430px] bg-bg px-5 pb-44 pt-6">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}

export function RequireHousehold() {
  const { session, profile, loading } = useAuth()
  if (supabaseConfigError) return <Navigate to="/ingresar" replace />
  if (loading || (session && !profile)) {
    return <p className="grid min-h-dvh place-items-center bg-bg font-display text-2xl font-semibold text-primary">A Medias</p>
  }
  if (!session) return <Navigate to="/ingresar" replace />
  if (!profile?.householdId) return <Navigate to="/hogar" replace />
  return (
    <FinanceProvider>
      <AppShell />
    </FinanceProvider>
  )
}
