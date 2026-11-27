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
const MealAddScreen = lazy(() =>
  import('./screens/MealAddScreen.tsx').then((module) => ({ default: module.MealAddScreen })),
)
const RecipesScreen = lazy(() =>
  import('./screens/RecipesScreen.tsx').then((module) => ({ default: module.RecipesScreen })),
)
const RecipeFormScreen = lazy(() =>
  import('./screens/RecipeFormScreen.tsx').then((module) => ({ default: module.RecipeFormScreen })),
)
const MedicationsScreen = lazy(() =>
  import('./screens/MedicationsScreen.tsx').then((module) => ({ default: module.MedicationsScreen })),
)
const MedicationStockScreen = lazy(() =>
  import('./screens/MedicationStockScreen.tsx').then((module) => ({ default: module.MedicationStockScreen })),
)
const MedicationFormScreen = lazy(() =>
  import('./screens/MedicationFormScreen.tsx').then((module) => ({ default: module.MedicationFormScreen })),
)
const MedicationTreatmentsScreen = lazy(() =>
  import('./screens/MedicationTreatmentsScreen.tsx').then((module) => ({
    default: module.MedicationTreatmentsScreen,
  })),
)
const MedicationDayScreen = lazy(() =>
  import('./screens/MedicationDayScreen.tsx').then((module) => ({ default: module.MedicationDayScreen })),
)
const NotificationsScreen = lazy(() =>
  import('./screens/NotificationsScreen.tsx').then((module) => ({ default: module.NotificationsScreen })),
)
const ModulesScreen = lazy(() =>
  import('./screens/ModulesScreen.tsx').then((module) => ({ default: module.ModulesScreen })),
)
const RemindersScreen = lazy(() =>
  import('./screens/RemindersScreen.tsx').then((module) => ({ default: module.RemindersScreen })),
)
const FixedExpenseFormScreen = lazy(() =>
  import('./screens/FixedExpenseFormScreen.tsx').then((module) => ({
    default: module.FixedExpenseFormScreen,
  })),
)
const SalaryScreen = lazy(() =>
  import('./screens/SalaryScreen.tsx').then((module) => ({ default: module.SalaryScreen })),
)
const SplitScreen = lazy(() =>
  import('./screens/SplitScreen.tsx').then((module) => ({ default: module.SplitScreen })),
)
const SplitHelpScreen = lazy(() =>
  import('./screens/SplitHelpScreen.tsx').then((module) => ({ default: module.SplitHelpScreen })),
)
const ShareScreen = lazy(() =>
  import('./screens/ShareScreen.tsx').then((module) => ({ default: module.ShareScreen })),
)
const YearScreen = lazy(() =>
  import('./screens/YearScreen.tsx').then((module) => ({ default: module.YearScreen })),
)
const CompareMonthsScreen = lazy(() =>
  import('./screens/CompareMonthsScreen.tsx').then((module) => ({ default: module.CompareMonthsScreen })),
)
const BudgetScreen = lazy(() =>
  import('./screens/BudgetScreen.tsx').then((module) => ({ default: module.BudgetScreen })),
)
const PlansScreen = lazy(() =>
  import('./screens/PlansScreen.tsx').then((module) => ({ default: module.PlansScreen })),
)
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen.tsx').then((module) => ({ default: module.SettingsScreen })),
)
const CategoriesScreen = lazy(() =>
  import('./screens/CategoriesScreen.tsx').then((module) => ({ default: module.CategoriesScreen })),
)
const StatementImportScreen = lazy(() =>
  import('./screens/StatementImportScreen.tsx').then((module) => ({ default: module.StatementImportScreen })),
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
                <Route path="comidas/agregar" element={<MealAddScreen />} />
                <Route path="comidas/recetas" element={<RecipesScreen />} />
                <Route path="comidas/recetas/nueva" element={<RecipeFormScreen />} />
                <Route path="comidas/recetas/:id" element={<RecipeFormScreen />} />
                <Route path="medicamentos" element={<MedicationsScreen />} />
                <Route path="medicamentos/stock" element={<MedicationStockScreen />} />
                <Route path="medicamentos/agregar" element={<MedicationFormScreen />} />
                <Route path="medicamentos/tratamientos" element={<MedicationTreatmentsScreen />} />
                <Route path="medicamentos/dia/:fecha" element={<MedicationDayScreen />} />
                <Route path="medicamentos/:id" element={<MedicationFormScreen />} />
                <Route path="notificaciones" element={<NotificationsScreen />} />
                <Route path="cargar" element={<ExpenseScreen />} />
                <Route path="cargar/:tipo" element={<ExpenseScreen />} />
                <Route path="compartir" element={<ShareScreen />} />
                <Route path="movimientos/resumen" element={<StatementImportScreen />} />
                <Route path="movimientos" element={<MovementsScreen />} />
                <Route path="se-me-fue" element={<SeMeFueRedirect />} />
                <Route path="ahorros" element={<SavingsScreen />} />
                <Route path="ahorros/:id" element={<SavingDetailScreen />} />
                <Route path="bolsa" element={<Navigate to={legacySavingsLocation('/bolsa') ?? '/ahorros'} replace />} />
                <Route path="meta" element={<Navigate to={legacySavingsLocation('/meta') ?? '/ahorros'} replace />} />
                <Route path="compartidos" element={<CompartidosRedirect />} />
                <Route path="prestamos" element={<PrestamosRedirect />} />
                <Route path="recordatorios" element={<RemindersScreen />} />
                <Route
                  path="recordatorios/nuevo"
                  element={
                    <Navigate to="/cargar/fijo" replace state={{ from: '/recordatorios', tipo: 'fijo', skipStep1: true }} />
                  }
                />
                <Route path="recordatorios/:id" element={<FixedExpenseFormScreen />} />
                <Route path="sueldo" element={<SalaryScreen />} />
                <Route path="reparto" element={<SplitScreen />} />
                <Route path="reparto/ayuda" element={<SplitHelpScreen />} />
                <Route path="mi-anio" element={<YearScreen />} />
                <Route path="mi-anio/comparar" element={<CompareMonthsScreen />} />
                <Route path="presupuesto" element={<BudgetScreen />} />
                <Route path="planes" element={<PlansScreen />} />
                <Route path="ajustes" element={<SettingsScreen />} />
                <Route path="ajustes/categorias" element={<CategoriesScreen />} />
              </Route>
            </Routes>
          </Suspense>
        </MonthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
