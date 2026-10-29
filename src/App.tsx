import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireHousehold } from './components/AppShell.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { useModules } from './context/ModulesProvider.tsx'
import { MonthProvider } from './context/MonthProvider.tsx'
import { isHubHome } from './lib/modules.ts'
import { HouseholdScreen, LoginScreen, RegisterScreen } from './screens/AuthScreens.tsx'
import { BreakdownScreen } from './screens/BreakdownScreen.tsx'
import { ExpenseScreen } from './screens/ExpenseScreen.tsx'
import { ExtrasScreen } from './screens/ExtrasScreen.tsx'
import { GoalScreen } from './screens/GoalScreen.tsx'
import { HomeScreen } from './screens/HomeScreen.tsx'
import { HabitsScreen } from './screens/HabitsScreen.tsx'
import { HubScreen } from './screens/HubScreen.tsx'
import { MemosScreen } from './screens/MemosScreen.tsx'
import { MealsScreen } from './screens/MealsScreen.tsx'
import { ModulesScreen } from './screens/ModulesScreen.tsx'
import { RemindersScreen } from './screens/RemindersScreen.tsx'
import { SalaryScreen } from './screens/SalaryScreen.tsx'
import { ShareScreen } from './screens/ShareScreen.tsx'
import { SharedScreen } from './screens/SharedScreen.tsx'
import { YearScreen } from './screens/YearScreen.tsx'

function HomeGate() {
  const { enabled, ready } = useModules()
  if (!ready) return <p className="py-16 text-center font-extrabold text-muted">Cargando…</p>
  if (isHubHome(enabled)) return <HubScreen />
  return <HomeScreen />
}

function FinanceGate() {
  const { enabled, ready } = useModules()
  if (!ready) return <p className="py-16 text-center font-extrabold text-muted">Cargando…</p>
  if (!enabled.includes('finanzas')) return <Navigate to="/" replace />
  return <HomeScreen />
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
              <Route path="se-me-fue" element={<BreakdownScreen />} />
              <Route path="bolsa" element={<ExtrasScreen />} />
              <Route path="meta" element={<GoalScreen />} />
              <Route path="compartidos" element={<SharedScreen />} />
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
