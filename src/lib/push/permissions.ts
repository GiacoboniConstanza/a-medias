import { supabase } from '../supabase.ts'

export type PushReadiness = 'not_configured' | 'unsupported' | 'denied' | 'ready'

export function pushIsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY)
}

function decodeVapid(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

/**
 * Pide permiso y guarda la suscripción solo si hay clave VAPID.
 * Sin esa clave no llama a Notification ni a PushManager.
 */
export async function subscribeToPush(userId: string): Promise<PushReadiness> {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!key) return 'not_configured'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapid(key),
    }))
  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth_key: json.keys?.auth ?? '',
      daily_enabled: true,
      dues_enabled: true,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
  return 'ready'
}
