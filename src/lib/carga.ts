/** Tipos unificados del flujo Cargar (Finanzas). */

export type CargaTipo =
  | 'gasto'
  | 'ingreso'
  | 'transferencia'
  | 'ahorro'
  | 'fijo'
  | 'cuotas'
  | 'plan'

export type CargaGrupo = 'mes' | 'repite' | 'adelante'

export type CargaTipoMeta = {
  id: CargaTipo
  label: string
  hint: string
  group: CargaGrupo
  icon: string
  soft: string
  ink: string
  ring: string
}

export const CARGA_TIPOS: readonly CargaTipoMeta[] = [
  {
    id: 'gasto',
    label: 'Gasto',
    hint: 'Ya lo pagaste',
    group: 'mes',
    icon: 'receipt',
    soft: 'bg-rosa-claro',
    ink: 'text-rosa-texto',
    ring: 'border-rosa-texto',
  },
  {
    id: 'ingreso',
    label: 'Ingreso',
    hint: 'Plata que te entró',
    group: 'mes',
    icon: 'sack-dollar',
    soft: 'bg-mostaza-claro',
    ink: 'text-mostaza-ink',
    ring: 'border-mostaza-ink',
  },
  {
    id: 'transferencia',
    label: 'Transferencia',
    hint: 'Entre ustedes',
    group: 'mes',
    icon: 'right-left',
    soft: 'bg-ciruela-claro',
    ink: 'text-ciruela-ink',
    ring: 'border-ciruela-ink',
  },
  {
    id: 'ahorro',
    label: 'Ahorro',
    hint: 'Aportar o retirar',
    group: 'mes',
    icon: 'piggy-bank',
    soft: 'bg-azul-claro',
    ink: 'text-azul-ink',
    ring: 'border-azul-ink',
  },
  {
    id: 'fijo',
    label: 'Gasto fijo',
    hint: 'Cada mes',
    group: 'repite',
    icon: 'calendar-day',
    soft: 'bg-azul-claro',
    ink: 'text-azul-ink',
    ring: 'border-azul-ink',
  },
  {
    id: 'cuotas',
    label: 'Cuotas',
    hint: 'Tiene un plazo',
    group: 'repite',
    icon: 'calendar-days',
    soft: 'bg-ciruela-claro',
    ink: 'text-ciruela-ink',
    ring: 'border-ciruela-ink',
  },
  {
    id: 'plan',
    label: 'Plan',
    hint: 'Lo quiero comprar',
    group: 'adelante',
    icon: 'bag-shopping',
    soft: 'bg-salvia-claro',
    ink: 'text-salvia-ink',
    ring: 'border-salvia-ink',
  },
] as const

export const CARGA_GRUPOS: readonly { id: CargaGrupo; title: string }[] = [
  { id: 'mes', title: 'Este mes' },
  { id: 'repite', title: 'Se repite o tiene plazo' },
  { id: 'adelante', title: 'Más adelante' },
]

const LAST_KEY = 'a-medias.carga.ultimo-tipo'

export function parseCargaTipo(raw: string | null | undefined): CargaTipo | null {
  if (!raw) return null
  const found = CARGA_TIPOS.find((tipo) => tipo.id === raw)
  return found?.id ?? null
}

export function readLastCargaTipo(): CargaTipo | null {
  try {
    return parseCargaTipo(localStorage.getItem(LAST_KEY))
  } catch {
    return null
  }
}

export function rememberCargaTipo(tipo: CargaTipo): void {
  try {
    localStorage.setItem(LAST_KEY, tipo)
  } catch {
    // ignore
  }
}

export function step2Title(tipo: CargaTipo): string {
  switch (tipo) {
    case 'gasto':
      return 'Nuevo gasto'
    case 'ingreso':
      return 'Nuevo ingreso'
    case 'transferencia':
      return 'Nueva transferencia'
    case 'ahorro':
      return 'Nuevo ahorro'
    case 'fijo':
      return 'Nuevo gasto fijo'
    case 'cuotas':
      return 'Nuevas cuotas'
    case 'plan':
      return 'Nuevo plan'
  }
}

/** Destino al guardar (lista propia del tipo). */
export function afterSavePath(tipo: CargaTipo): string {
  if (tipo === 'fijo' || tipo === 'cuotas') return '/recordatorios'
  if (tipo === 'plan') return '/planes'
  return ''
}

export type CargaOriginHint = {
  tipo?: string | null
  from?: string | null
  planItemId?: string | null
  savingId?: string | null
  skipStep1?: boolean
}

/**
 * Orígenes que saltan el paso 1: Agregar en Planes, Ya lo compré, detalle de ahorro,
 * Anotar en avisos, Nuevo gasto en Compartir.
 */
export function shouldSkipStep1(origin: CargaOriginHint): boolean {
  if (origin.skipStep1) return true
  if (origin.planItemId) return true
  if (origin.savingId) return true
  const tipo = parseCargaTipo(origin.tipo ?? undefined)
  if (!tipo) return false
  const from = origin.from ?? ''
  if (tipo === 'plan' && (from === '/planes' || from.startsWith('/planes'))) return true
  if (tipo === 'ahorro' && (from.startsWith('/ahorros/') || from.includes('/ahorros/'))) return true
  if (tipo === 'gasto' && (from === '/recordatorios' || from === '/compartir' || from.startsWith('/compartir'))) {
    return true
  }
  if (tipo === 'fijo' && from === '/recordatorios/nuevo') return true
  return false
}

export function cargaPath(tipo?: CargaTipo | null): string {
  return tipo ? `/cargar/${tipo}` : '/cargar'
}

export function isMovementCargaTipo(tipo: CargaTipo): tipo is 'gasto' | 'ingreso' | 'transferencia' | 'ahorro' {
  return tipo === 'gasto' || tipo === 'ingreso' || tipo === 'transferencia' || tipo === 'ahorro'
}

export const TOAST_GUARDADO = 'Listo, lo guardé.'
