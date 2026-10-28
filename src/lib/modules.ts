import type { AppModule } from '../types/database.ts'

export type ModuleId = AppModule

export const MODULES: readonly ModuleId[] = ['finanzas', 'habitos', 'comidas', 'memos']

export const COMING_SOON: readonly ModuleId[] = ['comidas']

export type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
}

export const MODULE_META: Record<ModuleId, { label: string; detail: string; icon: string; to: string }> = {
  finanzas: { label: 'Finanzas', detail: 'Gastos, bolsa y la meta', icon: 'wallet', to: '/finanzas' },
  habitos: { label: 'Hábitos', detail: 'Lo que querés hacer cada día', icon: 'seedling', to: '/habitos' },
  comidas: { label: 'Comidas', detail: 'Próximamente', icon: 'bowl-food', to: '/comidas' },
  memos: { label: 'Memos', detail: 'Notas y cosas para acordarte', icon: 'note-sticky', to: '/memos' },
}

const FINANCE_NAV: readonly NavItem[] = [
  { to: '/', label: 'Inicio', icon: 'house', end: true },
  { to: '/se-me-fue', label: 'Gastos', icon: 'receipt' },
  { to: '/bolsa', label: 'Bolsa', icon: 'bag-shopping' },
  { to: '/meta', label: 'Meta', icon: 'umbrella-beach' },
  { to: '/recordatorios', label: 'Avisos', icon: 'bell' },
]

export const FINANCE_SECTION_LINKS: readonly NavItem[] = FINANCE_NAV.filter((item) => item.to !== '/')

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

/** Con solo Finanzas se conserva el menú de hoy. Si hay otro módulo, Inicio más los activos. */
export function navForModules(enabled: readonly ModuleId[]): NavItem[] {
  const active = MODULES.filter((id) => enabled.includes(id))
  if (!active.some((id) => id !== 'finanzas')) return FINANCE_NAV.map((item) => ({ ...item }))
  return [
    { to: '/', label: 'Inicio', icon: 'house', end: true },
    ...active.map((id) => ({
      to: MODULE_META[id].to,
      label: MODULE_META[id].label,
      icon: MODULE_META[id].icon,
    })),
  ]
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
