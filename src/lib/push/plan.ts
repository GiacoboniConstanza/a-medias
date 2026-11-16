/**
 * Contrato de las notificaciones push web.
 * `public/push-handler.js` escucha `push` dentro del service worker.
 * Si existe `VITE_VAPID_PUBLIC_KEY`, la app puede pedir permiso y guardar la
 * suscripción. Sin esa clave no pide permiso y nadie envía avisos al celular.
 * Finanzas (diario / vencimientos / silencio) se despacha con claim_finance_due_pushes.
 */
export const PUSH_STATUS = 'active' as const

export const pushPlan = {
  status: PUSH_STATUS,
  daily: {
    title: '¿Gastaste algo hoy?',
    body: 'Anotalo en dos toques así no se te escapa.',
    defaultTimes: ['14:00', '21:30'] as const,
  },
  dues: {
    daysBefore: 2,
    title: (name: string) => `Vence ${name}`,
    body: 'Marcalo como pagado cuando lo abones.',
  },
  silence: {
    daysWithoutExpenses: 3,
    title: '¿Seguimos anotando?',
    body: 'Hace unos días que no anotás nada. ¿Todo bien?',
  },
} as const

/** Título de vencimientos (misma regla que private.finance_dues_title). */
export function duesPushTitle(names: readonly string[]): string {
  const sorted = [...names].map((name) => name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))
  if (sorted.length === 0) return 'Vence un fijo'
  if (sorted.length === 1) return `Vence ${sorted[0]}`
  if (sorted.length === 2) return `Vencen ${sorted[0]} y ${sorted[1]}`
  return `Vence ${sorted[0]} y ${sorted.length - 1} más`
}

export type PushSubscriptionDraft = {
  endpoint: string
  p256dh: string
  authKey: string
  dailyEnabled: boolean
  duesEnabled: boolean
}

export function pushRegistration(): { status: typeof PUSH_STATUS } {
  return { status: PUSH_STATUS }
}
