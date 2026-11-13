/**
 * Despacha avisos push:
 *  - scheduled_reminders (Finanzas / genéricos, fire_at o recurrente)
 *  - medicamentos: slots sin marcar, agrupados por usuaria+hora (M23), lookback 5 min
 * No filtra por daily_enabled/dues_enabled.
 * POST { action: 'test', endpoint } con Authorization del usuario → aviso de prueba a ese celu (M21).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

type Reminder = {
  id: string
  user_id: string
  module: string
  title: string
  body: string | null
  local_time: string | null
  fire_at: string | null
  timezone: string
}

type MedSlot = {
  user_id: string
  dose_on: string
  scheduled_time: string
  medication_id: string
  name: string
  dose_notes: string | null
}

type PushRow = {
  id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function moduleUrl(module: string): string {
  if (module === 'medicamentos') return '/medicamentos'
  if (module === 'finanzas') return '/recordatorios'
  return '/'
}

function formatHour(time: string): string {
  const [hh, mm] = time.split(':')
  return `${Number(hh)}:${mm ?? '00'}`
}

function vapidReady() {
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:avisos@example.test'
  if (!vapidPublic || !vapidPrivate) return null
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
  return true
}

async function sendToSub(sub: PushRow, payload: string): Promise<'sent' | 'gone' | 'failed'> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
      payload,
    )
    return 'sent'
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) return 'gone'
    return 'failed'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'missing_env' })
  if (!vapidReady()) return json(500, { error: 'missing_vapid' })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: { action?: string; endpoint?: string; source?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // Aviso de prueba al celu que lo pide (JWT de la usuaria).
  if (body.action === 'test') {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json(401, { error: 'unauthorized' })
    if (!body.endpoint) return json(400, { error: 'missing_endpoint' })

    const { data: sub, error: subError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', userData.user.id)
      .eq('endpoint', body.endpoint)
      .maybeSingle()
    if (subError || !sub) return json(404, { error: 'subscription_not_found' })

    const payload = JSON.stringify({
      title: 'A Medias',
      body: 'Así te van a llegar los avisos.',
      url: '/notificaciones',
      tag: `test-${sub.id}`,
    })
    const result = await sendToSub(sub as PushRow, payload)
    if (result === 'gone') {
      await admin.from('push_subscriptions').delete().eq('id', sub.id)
      return json(410, { error: 'gone' })
    }
    if (result === 'failed') return json(500, { error: 'send_failed' })
    return json(200, { ok: true })
  }

  const expected = Deno.env.get('PUSH_DISPATCH_SECRET')
  const auth = req.headers.get('Authorization') ?? ''
  if (!expected || auth !== `Bearer ${expected}`) {
    return json(401, { error: 'unauthorized' })
  }

  let sent = 0
  let gone = 0
  let failed = 0

  // 1) Recordatorios genéricos (Finanzas / fire_at)
  const { data: due, error: dueError } = await admin.rpc('claim_due_reminders')
  if (dueError) return json(500, { error: dueError.message })

  for (const reminder of (due ?? []) as Reminder[]) {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', reminder.user_id)

    const payload = JSON.stringify({
      title: reminder.title,
      body: reminder.body ?? 'Tenés un aviso.',
      url: moduleUrl(reminder.module),
      module: reminder.module,
      reminderId: reminder.id,
      tag: `reminder-${reminder.id}`,
    })

    for (const sub of (subs ?? []) as PushRow[]) {
      const result = await sendToSub(sub, payload)
      if (result === 'sent') sent += 1
      else if (result === 'gone') {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
        gone += 1
      } else failed += 1
    }
  }

  // 2) Medicamentos: reclama slots y agrupa por usuaria+hora
  const { data: medSlots, error: medError } = await admin.rpc('claim_medication_due_slots', {
    p_lookback_minutes: 5,
  })
  if (medError) return json(500, { error: medError.message })

  const groups = new Map<string, MedSlot[]>()
  for (const slot of (medSlots ?? []) as MedSlot[]) {
    const key = `${slot.user_id}|${slot.dose_on}|${slot.scheduled_time}`
    const list = groups.get(key) ?? []
    list.push(slot)
    groups.set(key, list)
  }

  for (const [, slots] of groups) {
    const first = slots[0]!
    const names = slots.map((slot) => slot.name).sort((a, b) => a.localeCompare(b, 'es'))
    const title =
      names.length === 1
        ? `${names[0]}${slots[0]?.dose_notes ? `, ${slots[0].dose_notes}` : ''}`
        : names.length === 2
          ? `${names[0]} y ${names[1]}`
          : `${names[0]} y ${names.length - 1} más`
    const hour = formatHour(first.scheduled_time)
    const body =
      names.length === 1
        ? `Toma de las ${hour}. Tocá para marcarla.`
        : `${names.length} tomas de las ${hour}.`
    const tag = `med-${first.user_id}-${first.dose_on}-${first.scheduled_time}`

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', first.user_id)

    const payload = JSON.stringify({
      title,
      body,
      url: '/medicamentos',
      module: 'medicamentos',
      tag,
    })

    for (const sub of (subs ?? []) as PushRow[]) {
      const result = await sendToSub(sub, payload)
      if (result === 'sent') sent += 1
      else if (result === 'gone') {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
        gone += 1
      } else failed += 1
    }
  }

  return json(200, {
    claimedReminders: (due ?? []).length,
    claimedMedGroups: groups.size,
    sent,
    gone,
    failed,
  })
})
