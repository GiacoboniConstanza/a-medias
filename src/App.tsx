import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { RequireHousehold } from './components/AppShell.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { useModules } from './context/ModulesProvider.tsx'
import { MonthProvider } from './context/MonthProvider.tsx'
import { isHubHome } from './lib/modules.ts'
import { HouseholdScreen, LoginScreen, RegisterScreen } from './screens/AuthScreens.tsx'
import { legacySavingsLocation } from './lib/savings.ts'
import { HomeScreen } from './screens/HomeScreen.tsx'
import { MovementsScreen } from './screens/MovementsScreen.tsx'

const ExpenseScreen = lazy(() =>
  import('./screens/ExpenseScreen.tsx').then((module) => ({ default: module.ExpenseScreen })),
)
const SavingDetailScreen = lazy(() =>
  import('./screens/SavingDetailScreen.tsx').then((module) => ({ default: module.SavingDetailScreen })),
)
const SavingsScreen = lazy(() =>
  import('./screens/SavingsScreen.tsx').then((module) => ({ default: module.SavingsScreen })),
)
const HabitsScreen = lazy(() =>
  import('./screens/HabitsScreen.tsx').then((module) => ({ default: module.HabitsScreen })),
)
const HubScreen = lazy(() =>
  import('./screens/HubScreen.tsx').then((module) => ({ default: module.HubScreen })),
)
const MemosScreen = lazy(() =>
  import('./screens/MemosScreen.tsx').then((module) => ({ default: module.MemosScreen })),
)
const MealsScreen = lazy(() =>
  import('./screens/MealsScreen.tsx').then((module) => ({ default: module.MealsScreen })),
)
const ModulesScreen = lazy(() =>
  import('./screens/ModulesScreen.tsx').then((module) => ({ default: module.ModulesScreen })),
)
const RemindersScreen = lazy(() =>
  import('./screens/RemindersScreen.tsx').then((module) => ({ default: module.RemindersScreen })),
)
const SalaryScreen = lazy(() =>
  import('./screens/SalaryScreen.tsx').then((module) => ({ default: module.SalaryScreen })),
)
const ShareScreen = lazy(() =>
  import('./screens/ShareScreen.tsx').then((module) => ({ default: module.ShareScreen })),
)
const YearScreen = lazy(() =>
  import('./screens/YearScreen.tsx').then((module) => ({ default: module.YearScreen })),
)

function RouteFallback() {
  return <p className="py-16 text-center font-semibold text-muted">Cargando…</p>
}

function HomeGate() {
  const { enabled, ready } = useModules()
  if (!ready) return <RouteFallback />
  if (isHubHome(enabled)) return <HubScreen />
  return <HomeScreen />
}

function FinanceGate() {
  const { enabled, ready } = useModules()
  if (!ready) return <RouteFallback />
  if (!enabled.includes('finanzas')) return <Navigate to="/" replace />
  return <HomeScreen />
}

function CompartidosRedirect() {
  const { enabled, ready } = useModules()
  if (!ready) return <RouteFallback />
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
          <Suspense fallback={<RouteFallback />}>
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
                <Route path="ahorros/:id" element={<SavingDetailScreen />} />
                <Route path="bolsa" element={<Navigate to={legacySavingsLocation('/bolsa') ?? '/ahorros'} replace />} />
                <Route path="meta" element={<Navigate to={legacySavingsLocation('/meta') ?? '/ahorros'} replace />} />
                <Route path="compartidos" element={<CompartidosRedirect />} />
                <Route path="prestamos" element={<PrestamosRedirect />} />
                <Route path="recordatorios" element={<RemindersScreen />} />
                <Route path="sueldo" element={<SalaryScreen />} />
                <Route path="mi-anio" element={<YearScreen />} />
              </Route>
            </Routes>
          </Suspense>
        </MonthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
