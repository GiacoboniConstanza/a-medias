# Avisos push (infra genérica)

## Cómo funciona

1. La PWA pide permiso en `/notificaciones` (`src/lib/push/permissions.ts`) y guarda una fila en `push_subscriptions` (endpoint + claves + `user_agent`). Los flags `daily_enabled` / `dues_enabled` son legacy de Finanzas en la UI; el despachador **no** los usa para filtrar.
2. Preferencias por módulo (M29): tabla `module_notification_prefs` (usuaria + módulo + prendido). Apagar Medicamentos o Finanzas deja de avisar ese módulo en **todos** sus celus.
3. `scheduled_reminders` sigue para avisos genéricos (`local_time` recurrente o `fire_at` de una vez).
4. Medicamentos: `claim_medication_due_slots` (tomas sin marcar, módulo prendido, lookback 5 min AR) → `medication_push_sends`.
5. Finanzas: `claim_finance_due_pushes` (diario / vencimientos / silencio según `reminder_preferences` + fijos + `daily_statuses`, módulo `finanzas` prendido) → `finance_push_sends`. Ver migración `20261116140000_finance_push.sql`.
6. Cada minuto, `pg_cron` + Vault llaman a la Edge Function `dispatch-push-reminders`. Ante 404/410 borra la suscripción.
7. Aviso de prueba (M21): `POST` a la misma función con `{ "action": "test", "endpoint": "…" }` y el JWT de la usuaria; solo ese celu.
8. El service worker muestra el aviso (`tag`) y al tocar navega a la `url` (Finanzas → `/recordatorios`).

Horas y días siempre en `America/Argentina/Buenos_Aires` (o `timezone` de la fila), nunca UTC pelado.

## Pasos en producción (Coty)

1. Generar VAPID: `npx web-push generate-vapid-keys`
2. Secrets: `npx supabase secrets set PUSH_DISPATCH_SECRET=… VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:…`
3. Vault: `push_dispatch_url` y `push_dispatch_secret`
4. Migraciones hasta `20261116140000_finance_push` (si el cron no quedó, reprogramar)
5. `npx supabase functions deploy dispatch-push-reminders` (incluye el bloque de Finanzas)
6. Vercel: `VITE_VAPID_PUBLIC_KEY` (pública) + redeploy
7. Probar desde `/notificaciones` → «Mandarme un aviso de prueba» y prender Finanzas en «Qué te avisa»
