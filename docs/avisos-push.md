# Avisos push (infra genérica)

## Cómo funciona

1. La PWA pide permiso en `/notificaciones` (`src/lib/push/permissions.ts`) y guarda una fila en `push_subscriptions` (endpoint + claves + `user_agent`). Los flags `daily_enabled` / `dues_enabled` son **solo de Finanzas** en la UI; el despachador **no** los usa para filtrar.
2. Preferencias por módulo (M29): tabla `module_notification_prefs` (usuaria + módulo + prendido). Apagar Medicamentos deja de avisar en **todos** sus celus.
3. `scheduled_reminders` sigue para avisos genéricos / Finanzas (`local_time` recurrente o `fire_at` de una vez).
4. Medicamentos se despacha aparte: `claim_medication_due_slots` busca tomas **sin marcar** de tratamientos en curso, con el módulo prendido, en los últimos 5 minutos (hora AR), agrupa por usuaria+hora (M23) y registra en `medication_push_sends` para no duplicar.
5. Cada minuto, `pg_cron` + Vault llaman a la Edge Function `dispatch-push-reminders`. Ante 404/410 borra la suscripción.
6. Aviso de prueba (M21): `POST` a la misma función con `{ "action": "test", "endpoint": "…" }` y el JWT de la usuaria; solo ese celu.
7. El service worker muestra el aviso (`tag` por toma/grupo) y al tocar navega a la `url` (fallback `/recordatorios`).

Horas y días siempre en `America/Argentina/Buenos_Aires` (o `timezone` de la fila), nunca UTC pelado.

## Finanzas: recurrente y one-shot

Recurrente (`local_time`) o una vez (`fire_at` con `timestamp '…' at time zone 'America/Argentina/Buenos_Aires'`). Ver migración `20261113130000`.

## Pasos en producción (Coty)

1. Generar VAPID: `npx web-push generate-vapid-keys`
2. Secrets: `npx supabase secrets set PUSH_DISPATCH_SECRET=… VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:…`
3. Vault: `push_dispatch_url` y `push_dispatch_secret`
4. Migraciones `20261113130000`, `20261113130100`, `20261113130200` (si el cron no quedó, reprogramar)
5. `npx supabase functions deploy dispatch-push-reminders`
6. Vercel: `VITE_VAPID_PUBLIC_KEY` (pública) + redeploy
7. Probar desde `/notificaciones` → «Mandarme un aviso de prueba»
