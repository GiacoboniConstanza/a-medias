import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireHousehold } from './components/AppShell.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { useModules } from './context/ModulesProvider.tsx'
import { MonthProvider } from './context/MonthProvider.tsx'
import { isHubHome } from './lib/modules.ts'
import { HouseholdScreen, LoginScreen, RegisterScreen } from './screens/AuthScreens.tsx'
import { ExpenseScreen } from './screens/ExpenseScreen.tsx'
import { legacySavingsLocation } from './lib/savings.ts'
import { SavingsScreen } from './screens/SavingsScreen.tsx'
import { HomeScreen } from './screens/HomeScreen.tsx'
import { HabitsScreen } from './screens/HabitsScreen.tsx'
import { HubScreen } from './screens/HubScreen.tsx'
import { MemosScreen } from './screens/MemosScreen.tsx'
import { MealsScreen } from './screens/MealsScreen.tsx'
import { ModulesScreen } from './screens/ModulesScreen.tsx'
import { MovementsScreen } from './screens/MovementsScreen.tsx'
import { RemindersScreen } from './screens/RemindersScreen.tsx'
import { SalaryScreen } from './screens/SalaryScreen.tsx'
import { ShareScreen } from './screens/ShareScreen.tsx'
import { YearScreen } from './screens/YearScreen.tsx'

function HomeGate() {
  const { enabled, ready } = useModules()
  if (!ready) return <p className="py-16 text-center font-semibold text-muted">Cargando…</p>
  if (isHubHome(enabled)) return <HubScreen />
  return <HomeScreen />
}

function FinanceGate() {
  const { enabled, ready } = useModules()
  if (!ready) return <p className="py-16 text-center font-semibold text-muted">Cargando…</p>
  if (!enabled.includes('finanzas')) return <Navigate to="/" replace />
  return <HomeScreen />
}

function CompartidosRedirect() {
  const { enabled, ready } = useModules()
  if (!ready) return <p className="py-16 text-center font-semibold text-muted">Cargando…</p>
  const to = isHubHome(enabled) ? '/finanzas' : '/'
  return <Navigate to={{ pathname: to, search: '?saldo=1' }} replace />
}

function PrestamosRedirect() {
  return <Navigate to="/movimientos?tipo=transferencias" replace />
}

function SeMeFueRedirect() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/movimientos', search: location.search }} replace />
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MonthProvider>
          <Routes>
            <Route path="/ingresar" element={<LoginScreen />} />
            <Route path="/registro" element={<RegisterScreen />} />
            <Route path="/hogar" element={<HouseholdScreen />} />
            <Route element={<RequireHousehold />}>
              <Route index element={<HomeGate />} />
              <Route path="finanzas" element={<FinanceGate />} />
              <Route path="memos" element={<MemosScreen />} />
              <Route path="modulos" element={<ModulesScreen />} />
              <Route path="habitos" element={<HabitsScreen />} />
              <Route path="comidas" element={<MealsScreen />} />
              <Route path="cargar" element={<ExpenseScreen />} />
              <Route path="compartir" element={<ShareScreen />} />
              <Route path="movimientos" element={<MovementsScreen />} />
              <Route path="se-me-fue" element={<SeMeFueRedirect />} />
              <Route path="ahorros" element={<SavingsScreen />} />
              <Route path="bolsa" element={<Navigate to={legacySavingsLocation('/bolsa') ?? '/ahorros'} replace />} />
              <Route path="meta" element={<Navigate to={legacySavingsLocation('/meta') ?? '/ahorros'} replace />} />
              <Route path="compartidos" element={<CompartidosRedirect />} />
              <Route path="prestamos" element={<PrestamosRedirect />} />
              <Route path="recordatorios" element={<RemindersScreen />} />
              <Route path="sueldo" element={<SalaryScreen />} />
              <Route path="mi-anio" element={<YearScreen />} />
            </Route>
          </Routes>
        </MonthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
