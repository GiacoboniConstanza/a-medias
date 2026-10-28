import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { FinanceProvider } from '../context/FinanceProvider.tsx'
import { ModulesProvider } from '../context/ModulesProvider.tsx'
import { shareReturnPath } from '../lib/shareInbox.ts'
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
  const location = useLocation()
  const here = `${location.pathname}${location.search}`
  const resume = shareReturnPath(here)
  if (supabaseConfigError) return <Navigate to="/ingresar" replace />
  if (loading || (session && !profile)) {
    return <p className="grid min-h-dvh place-items-center bg-bg font-display text-2xl font-semibold text-primary">A Medias</p>
  }
  if (!session) {
    const login = resume ? `/ingresar?next=${encodeURIComponent(resume)}` : '/ingresar'
    return <Navigate to={login} replace />
  }
  if (!profile?.householdId) {
    const home = resume ? `/hogar?next=${encodeURIComponent(resume)}` : '/hogar'
    return <Navigate to={home} replace />
  }
  return (
    <FinanceProvider>
      <ModulesProvider>
        <AppShell />
      </ModulesProvider>
    </FinanceProvider>
  )
}
