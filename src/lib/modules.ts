import type { AppModule } from '../types/database.ts'

export type ModuleId = AppModule

export const MODULES: readonly ModuleId[] = ['finanzas', 'habitos', 'comidas', 'memos']

export const COMING_SOON: readonly ModuleId[] = []

export type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
}

export const MODULE_META: Record<ModuleId, { label: string; detail: string; icon: string; to: string; tone: string; ink: string }> = {
  finanzas: { label: 'Finanzas', detail: 'Gastos y ahorros', icon: 'wallet', to: '/finanzas', tone: 'bg-mostaza-claro', ink: 'text-mostaza-ink' },
  habitos: { label: 'Hábitos', detail: 'Lo que querés hacer cada día', icon: 'seedling', to: '/habitos', tone: 'bg-salvia-claro', ink: 'text-salvia-ink' },
  comidas: { label: 'Comidas', detail: 'Proteína y lo que comés', icon: 'bowl-food', to: '/comidas', tone: 'bg-rosa-claro', ink: 'text-tinta' },
  memos: { label: 'Memos', detail: 'Notas y cosas para acordarte', icon: 'note-sticky', to: '/memos', tone: 'bg-azul-claro', ink: 'text-azul-ink' },
}

export const FINANCE_ROUTES = {
  resumen: '/finanzas',
  gastos: '/se-me-fue',
  compartidos: '/compartidos',
  prestamos: '/prestamos',
  ahorros: '/ahorros',
  avisos: '/recordatorios',
  anio: '/mi-anio',
  sueldo: '/sueldo',
  compartir: '/compartir',
  cargar: '/cargar',
  modulos: '/modulos',
} as const

/** Pestañas de Finanzas. Sin hub, Resumen apunta a `/` (navFor). */
export const FINANCE_TABS: readonly NavItem[] = [
  { to: FINANCE_ROUTES.resumen, label: 'Resumen', icon: 'wallet', end: true },
  { to: FINANCE_ROUTES.gastos, label: 'Gastos', icon: 'receipt' },
  { to: FINANCE_ROUTES.compartidos, label: 'Compartidos', icon: 'user-group' },
  { to: FINANCE_ROUTES.prestamos, label: 'Préstamos', icon: 'hand-holding-dollar' },
  { to: FINANCE_ROUTES.ahorros, label: 'Ahorros', icon: 'piggy-bank' },
]

const RESUMEN_ALIASES = new Set<string>([FINANCE_ROUTES.avisos, FINANCE_ROUTES.anio, FINANCE_ROUTES.sueldo, FINANCE_ROUTES.compartir])

export function isComingSoon(module: ModuleId): boolean {
  return COMING_SOON.includes(module)
}

export function isModuleId(value: string): value is ModuleId {
  return (MODULES as readonly string[]).includes(value)
}

export function enabledFromRows(rows: readonly { module: string; enabled: boolean }[]): ModuleId[] {
  const known = rows.filter((row) => isModuleId(row.module))
  const enabled = MODULES.filter((id) => known.some((row) => row.module === id && row.enabled))
  if (known.length === 0) return ['finanzas']
  return enabled
}

export function isHubHome(enabled: readonly ModuleId[]): boolean {
  return enabled.some((id) => id !== 'finanzas')
}

/** Menú general: Inicio y los módulos activos, en el orden fijo. */
export function navForModules(enabled: readonly ModuleId[]): NavItem[] {
  const active = MODULES.filter((id) => enabled.includes(id))
  const ids = active.length > 0 ? active : (['finanzas'] as const)
  return [
    { to: '/', label: 'Inicio', icon: 'house', end: true },
    ...ids.map((id) => ({
      to: MODULE_META[id].to,
      label: MODULE_META[id].label,
      icon: MODULE_META[id].icon,
    })),
  ]
}

export type NavMatch = { items: NavItem[]; activeTo: string }

function financeMenu(hub: boolean): NavItem[] {
  return FINANCE_TABS.map((item, index) => (index === 0 ? { ...item, to: hub ? item.to : '/' } : { ...item }))
}

/** Menú de Finanzas en Finanzas y el general en el resto. `from` es la pestaña que abrió Cargar. */
export function navFor(pathname: string, enabled: readonly ModuleId[], from?: string | null): NavMatch {
  const hub = isHubHome(enabled)
  const tabs = financeMenu(hub)
  const resumen = tabs[0]?.to ?? '/'
  const general = navForModules(enabled)
  if (pathname === FINANCE_ROUTES.modulos) return { items: general, activeTo: '/' }
  const onFinance =
    pathname === FINANCE_ROUTES.resumen ||
    tabs.some((item) => item.to === pathname) ||
    RESUMEN_ALIASES.has(pathname) ||
    pathname === FINANCE_ROUTES.cargar
  if (!onFinance) {
    const active = general.find((item) => item.to === pathname)?.to ?? '/'
    return { items: general, activeTo: active }
  }
  if (pathname === FINANCE_ROUTES.cargar) {
    const origin = from && tabs.some((item) => item.to === from) ? from : resumen
    return { items: tabs, activeTo: origin }
  }
  if (RESUMEN_ALIASES.has(pathname)) return { items: tabs, activeTo: resumen }
  return { items: tabs, activeTo: tabs.find((item) => item.to === pathname)?.to ?? resumen }
}

export function moduleSwitchLocked(enabled: readonly ModuleId[], module: ModuleId): boolean {
  return enabled.length <= 1 && enabled.includes(module)
}

export function toggleAllowed(enabled: readonly ModuleId[], module: ModuleId, next: boolean): string | null {
  if (next && isComingSoon(module)) return 'Próximamente'
  if (!next && moduleSwitchLocked(enabled, module)) return 'Tiene que quedar al menos un módulo activo'
  return null
}

export function hubDayLabel(date = new Date()): string {
  const label = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
