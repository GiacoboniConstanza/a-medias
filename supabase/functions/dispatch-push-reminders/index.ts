/**
 * Envía Web Push de los scheduled_reminders que tocan en este minuto.
 * Secretos: PUSH_DISPATCH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 * Nunca hardcodear claves. Llamada esperada: Authorization Bearer <PUSH_DISPATCH_SECRET>.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

type Reminder = {
  id: string
  user_id: string
  module: string
  title: string
  body: string | null
  local_time: string
  timezone: string
  ref_table: string | null
  ref_id: string | null
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const expected = Deno.env.get('PUSH_DISPATCH_SECRET')
  const auth = req.headers.get('Authorization') ?? ''
  if (!expected || auth !== `Bearer ${expected}`) {
    return json(401, { error: 'unauthorized' })
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:avisos@example.test'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !serviceKey) {
    return json(500, { error: 'missing_env' })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: due, error: dueError } = await admin.rpc('claim_due_reminders')
  if (dueError) return json(500, { error: dueError.message })

  const reminders = (due ?? []) as Reminder[]
  let sent = 0
  let gone = 0
  let failed = 0

  for (const reminder of reminders) {
    const { data: subs, error: subError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', reminder.user_id)

    if (subError) {
      failed += 1
      continue
    }

    const payload = JSON.stringify({
      title: reminder.title,
      body: reminder.body ?? 'Tenés un aviso.',
      url: moduleUrl(reminder.module),
      module: reminder.module,
      reminderId: reminder.id,
    })

    for (const sub of (subs ?? []) as PushRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          payload,
        )
        sent += 1
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
          gone += 1
        } else {
          failed += 1
        }
      }
    }
  }

  return json(200, {
    claimed: reminders.length,
    sent,
    gone,
    failed,
  })
})
