import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireHousehold } from './components/AppShell.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { MonthProvider } from './context/MonthProvider.tsx'
import { HouseholdScreen, LoginScreen, RegisterScreen } from './screens/AuthScreens.tsx'
import { BreakdownScreen } from './screens/BreakdownScreen.tsx'
import { ExpenseScreen } from './screens/ExpenseScreen.tsx'
import { ExtrasScreen } from './screens/ExtrasScreen.tsx'
import { GoalScreen } from './screens/GoalScreen.tsx'
import { HomeScreen } from './screens/HomeScreen.tsx'
import { RemindersScreen } from './screens/RemindersScreen.tsx'
import { SalaryScreen } from './screens/SalaryScreen.tsx'
import { SharedScreen } from './screens/SharedScreen.tsx'
import { YearScreen } from './screens/YearScreen.tsx'

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
              <Route index element={<HomeScreen />} />
                <Route path="cargar" element={<ExpenseScreen />} />
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
