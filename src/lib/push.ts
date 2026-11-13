/**
 * Helpers de Web Push (permiso, suscripción, detección iOS).
 * La clave pública VAPID sale de VITE_VAPID_PUBLIC_KEY (nunca hardcodeada).
 */
import { deletePushSubscription, upsertPushSubscription } from './api.ts'

export type PushReadiness =
  | 'not_configured'
  | 'unsupported'
  | 'denied'
  | 'ios_needs_pwa'
  | 'ready'

export function pushIsConfigured(env: { VITE_VAPID_PUBLIC_KEY?: string } = import.meta.env): boolean {
  return Boolean(env.VITE_VAPID_PUBLIC_KEY)
}

/** Decodifica la clave VAPID URL-safe base64 a bytes. */
export function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

export function isIosLike(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  // iPadOS puede presentarse como MacIntel con touch.
  return platform === 'MacIntel' && maxTouchPoints > 1
}

export function isStandalonePwa(displayModeStandalone: boolean, legacyStandalone: boolean): boolean {
  return displayModeStandalone || legacyStandalone
}

/**
 * En iPhone/iPad la push solo anda con la app agregada a inicio.
 * Sin PWA instalada conviene avisar antes de pedir permiso.
 */
export function isIosWithoutPwa(input?: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  displayModeStandalone?: boolean
  legacyStandalone?: boolean
}): boolean {
  const userAgent = input?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const platform = input?.platform ?? (typeof navigator !== 'undefined' ? navigator.platform : '')
  const maxTouchPoints =
    input?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0)
  const displayModeStandalone =
    input?.displayModeStandalone ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false)
  const legacyStandalone =
    input?.legacyStandalone ??
    (typeof navigator !== 'undefined' &&
      'standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))

  return isIosLike(userAgent, platform, maxTouchPoints) && !isStandalonePwa(displayModeStandalone, legacyStandalone)
}

export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  return Notification.requestPermission()
}

/**
 * Pide permiso, suscribe con VAPID y guarda el endpoint vía api.ts.
 * En iOS sin PWA instalada no intenta suscribirse.
 */
export async function subscribeCurrentDevice(userId: string): Promise<PushReadiness> {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!key) return 'not_configured'
  if (typeof window === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (isIosWithoutPwa()) return 'ios_needs_pwa'

  const permission = await requestPushPermission()
  if (permission === 'unsupported') return 'unsupported'
  if (permission !== 'granted') return 'denied'

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(key),
    }))

  const json = subscription.toJSON()
  await upsertPushSubscription({
    userId,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    authKey: json.keys?.auth ?? '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  })
  return 'ready'
}

export async function unsubscribeCurrentDevice(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return false
  const endpoint = subscription.endpoint
  const ok = await subscription.unsubscribe()
  if (ok) await deletePushSubscription(endpoint)
  return ok
}
