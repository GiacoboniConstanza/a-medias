import type { AppModule } from '../types/database.ts'

export type ModuleId = AppModule

export const MODULES: readonly ModuleId[] = ['finanzas', 'habitos', 'comidas', 'memos', 'medicamentos']

export const COMING_SOON: readonly ModuleId[] = []

export type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
}

export const MODULE_META: Record<ModuleId, { label: string; detail: string; icon: string; to: string; tone: string; ink: string }> = {
  finanzas: { label: 'Finanzas', detail: 'Movimientos y ahorros', icon: 'wallet', to: '/finanzas', tone: 'bg-mostaza', ink: 'text-tinta' },
  habitos: { label: 'Hábitos', detail: 'Lo que querés hacer cada día', icon: 'seedling', to: '/habitos', tone: 'bg-salvia', ink: 'text-tinta' },
  comidas: { label: 'Comidas', detail: 'Proteína y lo que comés', icon: 'bowl-food', to: '/comidas', tone: 'bg-rosa', ink: 'text-tinta' },
  memos: { label: 'Memos', detail: 'Notas y cosas para acordarte', icon: 'note-sticky', to: '/memos', tone: 'bg-azul', ink: 'text-tinta' },
  medicamentos: {
    label: 'Medicamentos',
    detail: 'Tus tomas y sus avisos',
    icon: 'pills',
    to: '/medicamentos',
    tone: 'bg-ciruela',
    ink: 'text-tinta',
  },
}

export const FINANCE_ROUTES = {
  resumen: '/finanzas',
  movimientos: '/movimientos',
  ahorros: '/ahorros',
  avisos: '/recordatorios',
  anio: '/mi-anio',
  sueldo: '/sueldo',
  compartir: '/compartir',
  presupuesto: '/presupuesto',
  cargar: '/cargar',
  modulos: '/modulos',
} as const

/** Pestañas de Finanzas. Sin hub, Resumen apunta a `/` (navFor). Cargar es el botón flotante. */
export const FINANCE_TABS: readonly NavItem[] = [
  { to: FINANCE_ROUTES.resumen, label: 'Resumen', icon: 'wallet', end: true },
  { to: FINANCE_ROUTES.movimientos, label: 'Movimientos', icon: 'list' },
  { to: FINANCE_ROUTES.ahorros, label: 'Ahorros', icon: 'piggy-bank' },
]

export const MEDICATION_ROUTES = {
  tomas: '/medicamentos',
  stock: '/medicamentos/stock',
  tratamientos: '/medicamentos/tratamientos',
  agregar: '/medicamentos/agregar',
} as const

/** Pestañas propias de Medicamentos (S1). */
export const MEDICATION_TABS: readonly NavItem[] = [
  { to: MEDICATION_ROUTES.tomas, label: 'Tomas', icon: 'circle-check', end: true },
  { to: MEDICATION_ROUTES.stock, label: 'Stock', icon: 'box-open' },
]

export const MEAL_ROUTES = {
  dia: '/comidas',
  recetas: '/comidas/recetas',
  agregar: '/comidas/agregar',
  recetaNueva: '/comidas/recetas/nueva',
} as const

/** Pestañas propias de Comidas (RC1): Día · Recetas. */
export const MEAL_TABS: readonly NavItem[] = [
  { to: MEAL_ROUTES.dia, label: 'Día', icon: 'calendar-day', end: true },
  { to: MEAL_ROUTES.recetas, label: 'Recetas', icon: 'book-open' },
]

const RESUMEN_ALIASES = new Set<string>([
  FINANCE_ROUTES.avisos,
  FINANCE_ROUTES.anio,
  `${FINANCE_ROUTES.anio}/comparar`,
  FINANCE_ROUTES.sueldo,
  FINANCE_ROUTES.compartir,
  FINANCE_ROUTES.presupuesto,
])

const MEDICATION_TOMAS_ALIASES = new Set<string>([MEDICATION_ROUTES.tratamientos])

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

/** Menú general: Inicio y los módulos activos, en el orden fijo. Medicamentos no entra a la barra (M3). */
export function navForModules(enabled: readonly ModuleId[]): NavItem[] {
  const active = MODULES.filter((id) => enabled.includes(id) && id !== 'medicamentos')
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

/** Menú de Finanzas en Finanzas y el general en el resto. */
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
    pathname === FINANCE_ROUTES.cargar ||
    pathname.startsWith(`${FINANCE_ROUTES.ahorros}/`) ||
    pathname === '/se-me-fue' ||
    pathname === '/compartidos' ||
    pathname === '/prestamos'
  if (!onFinance) {
    // Comidas: barra propia Día | Recetas (RC1).
    if (pathname.startsWith('/comidas')) {
      const tabs = [...MEAL_TABS]
      const isRecetas =
        pathname === MEAL_ROUTES.recetas || pathname.startsWith(`${MEAL_ROUTES.recetas}/`)
      const isAgregar = pathname === MEAL_ROUTES.agregar
      if (isAgregar) {
        const origin =
          from && tabs.some((item) => item.to === from) ? from : MEAL_ROUTES.dia
        return { items: tabs, activeTo: origin }
      }
      if (isRecetas) return { items: tabs, activeTo: MEAL_ROUTES.recetas }
      return { items: tabs, activeTo: MEAL_ROUTES.dia }
    }
    // Notificaciones: menú general con Inicio (S5).
    if (pathname === '/notificaciones') {
      return { items: general, activeTo: '/' }
    }
    // Medicamentos: barra propia Tomas | Stock (S1, S6).
    if (pathname.startsWith('/medicamentos')) {
      const tabs = [...MEDICATION_TABS]
      const isStock = pathname === MEDICATION_ROUTES.stock
      const isTomasHome = pathname === MEDICATION_ROUTES.tomas
      const isTratamientos = MEDICATION_TOMAS_ALIASES.has(pathname)
      const isDia = pathname.startsWith('/medicamentos/dia/')
      const isAgregar = pathname === MEDICATION_ROUTES.agregar
      const isEditar =
        pathname.startsWith('/medicamentos/') && !isStock && !isTratamientos && !isDia && !isAgregar
      if (isAgregar || isEditar) {
        const origin =
          from && tabs.some((item) => item.to === from) ? from : MEDICATION_ROUTES.tomas
        return { items: tabs, activeTo: origin }
      }
      if (isStock) return { items: tabs, activeTo: MEDICATION_ROUTES.stock }
      if (isTomasHome || isTratamientos || isDia) {
        return { items: tabs, activeTo: MEDICATION_ROUTES.tomas }
      }
      return { items: tabs, activeTo: MEDICATION_ROUTES.tomas }
    }
    const active = general.find((item) => item.to === pathname)?.to ?? '/'
    return { items: general, activeTo: active }
  }
  if (pathname === FINANCE_ROUTES.cargar) {
    const origin = from && tabs.some((item) => item.to === from) ? from : resumen
    return { items: tabs, activeTo: origin }
  }
  if (RESUMEN_ALIASES.has(pathname) || pathname === '/compartidos') return { items: tabs, activeTo: resumen }
  if (pathname === '/se-me-fue' || pathname === '/prestamos') {
    return { items: tabs, activeTo: FINANCE_ROUTES.movimientos }
  }
  if (pathname.startsWith(`${FINANCE_ROUTES.ahorros}/`)) {
    return { items: tabs, activeTo: FINANCE_ROUTES.ahorros }
  }
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
