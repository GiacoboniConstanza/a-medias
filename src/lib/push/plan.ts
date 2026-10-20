/**
 * Contrato de las notificaciones push web.
 * `public/push-handler.js` escucha `push` dentro del service worker.
 * Si existe `VITE_VAPID_PUBLIC_KEY`, la app puede pedir permiso y guardar la
 * suscripción. Sin esa clave no pide permiso y nadie envía avisos al celular.
 */
export const PUSH_STATUS = 'not_configured' as const

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
    body: 'Hace unos días que no anotás nada. ¿Todo bien?',
  },
} as const

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
