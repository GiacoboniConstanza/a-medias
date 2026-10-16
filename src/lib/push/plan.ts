/**
 * Contrato de las notificaciones push web.
 * La tabla `push_subscriptions` ya existe y estas copias están definidas,
 * pero la app todavía no pide permiso, no llama a PushManager y el service
 * worker de la PWA no escucha el evento `push`.
 */
export const PUSH_STATUS = 'not_implemented' as const

export const pushPlan = {
  status: PUSH_STATUS,
  daily: {
    title: '¿Gastaste algo hoy?',
    body: 'Anotalo en dos toques así no se te escapa.',
    localTime: '21:30',
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
